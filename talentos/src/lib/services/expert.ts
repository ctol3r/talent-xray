/**
 * The conversation with the talent expert, as threads with a state.
 *
 * One conversation, kept in `settings` under `chat:main` — no table and no
 * migration, the same way the daily note is kept.
 *
 * What changed, and why. This used to be a flat list of turns: a question
 * turn, then either an answer turn or a "waiting" turn carrying two file
 * paths. That shape recorded everything and could still collect nothing. With
 * no model key a question becomes a file a Claude session fulfils, and the
 * only way to pick the answer up was to type the identical question again,
 * because the handoff was keyed on a hash of the prompt and the prompt
 * carried the conversation. Ask something else in between and the hash moved;
 * the answer stayed on disk and nobody ever saw it. One did: a composed reply
 * sat unread in the outbox for six hours while the question that would have
 * collected it had already scrolled out of the transcript.
 *
 * So an ask is a thread now, and the thread stores the id of the request it
 * is waiting on. Collection reads that file directly. It never re-derives the
 * hash, never rebuilds the prompt, and therefore cannot drift away from its
 * own answer. Re-asking to collect is gone.
 *
 * A thread is in exactly one of four states and every one of them is written
 * down before anything can fail:
 *
 *  - `queued`     the request is in the outbox, nobody has picked it up;
 *  - `answering`  a session has been handed it (it claimed the request file);
 *  - `answered`   the response validated and is on the thread;
 *  - `failed`     it broke, with the reason, and it can be retried as it is.
 *
 * `readChat` still returns the old turn shape. The outbox page reads it, and
 * a view is cheaper than making two features land at once.
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { SessionFulfillmentPendingError } from "@/lib/ai/session";
import { askTheExpert, expertReplySchema } from "@/lib/ai/tasks/expert";
import { scanPayloadForProtectedTraits } from "@/lib/domain/fair-hiring";
import { expertById, routeQuestion } from "../../../artifact-src/core/experts";

export const CHAT_KEY = "chat:main";
/** Enough to scroll back through a week; past that it is a filing system. */
export const MAX_THREADS = 200;

/** The four states, in the order a thread moves through them. */
export const THREAD_STATES = [
  "queued",
  "answering",
  "answered",
  "failed",
] as const;

const requestSchema = z.object({
  /** The outbox request id: `<schemaName>-<hash>`. The handle for everything. */
  id: z.string().max(200),
  requestPath: z.string(),
  responsePath: z.string(),
});

const answerSchema = z.object({
  at: z.string(),
  text: z.string().max(8000),
  uncertain: z.array(z.string().max(300)).max(5).default([]),
  next: z.array(z.string().max(160)).max(3).default([]),
  declined: z.boolean().default(false),
  /** Protected-characteristic language found in the reply. Warned, never blocked. */
  flagged: z.array(z.string()).max(8).default([]),
});

const threadSchema = z.object({
  id: z.string(),
  askedAt: z.string(),
  question: z.string().max(4000),
  /** Which specialist it was routed to. */
  expert: z.string(),
  /** The words that routed it there, so a wrong route is a visible wrong route. */
  because: z.array(z.string()).max(3).default([]),
  state: z.enum(THREAD_STATES),
  request: requestSchema.optional(),
  answer: answerSchema.optional(),
  failure: z
    .object({ at: z.string(), message: z.string().max(2000) })
    .optional(),
});

export type AskThread = z.infer<typeof threadSchema>;
export type ThreadState = AskThread["state"];

const chatSchema = z.object({
  version: z.literal(2),
  threads: z.array(threadSchema).max(MAX_THREADS),
});

/* ------------------------------------------------------------------ *
 * Version 1: the flat turn list, still on disk in every install that  *
 * asked anything before today. Read, never written.                   *
 * ------------------------------------------------------------------ */

const legacyTurnSchema = z.object({
  id: z.string(),
  at: z.string(),
  who: z.enum(["you", "expert"]),
  text: z.string().max(8000),
  expert: z.string().optional(),
  because: z.array(z.string()).max(3).optional(),
  uncertain: z.array(z.string().max(300)).max(5).optional(),
  next: z.array(z.string().max(160)).max(3).optional(),
  declined: z.boolean().optional(),
  flagged: z.array(z.string()).max(8).optional(),
  waiting: z
    .object({ requestPath: z.string(), responsePath: z.string() })
    .optional(),
});

const legacyChatSchema = z.object({
  version: z.literal(1),
  turns: z.array(legacyTurnSchema),
});

/**
 * Turn list to threads.
 *
 * A question turn opens a thread; the expert turn that follows closes it as
 * answered, waiting or failed. An expert turn with nothing before it is
 * dropped — there is no question to attach it to, and inventing one would put
 * words in the recruiter's mouth.
 */
function adoptLegacy(
  turns: z.infer<typeof legacyChatSchema>["turns"],
): AskThread[] {
  const threads: AskThread[] = [];
  for (const turn of turns) {
    if (turn.who === "you") {
      threads.push({
        id: turn.id,
        askedAt: turn.at,
        question: turn.text,
        expert: routeQuestion(turn.text).expert.id,
        because: [],
        state: "failed",
        failure: {
          at: turn.at,
          message:
            "Asked before this conversation kept a state. Retry to ask it again.",
        },
      });
      continue;
    }
    const open = threads.at(-1);
    if (!open) continue;
    open.expert = turn.expert ?? open.expert;
    open.because = turn.because ?? [];
    if (turn.waiting) {
      open.state = "queued";
      open.request = {
        id: requestIdFrom(turn.waiting.requestPath),
        requestPath: turn.waiting.requestPath,
        responsePath: turn.waiting.responsePath,
      };
      delete open.failure;
      continue;
    }
    open.state = "answered";
    open.answer = {
      at: turn.at,
      text: turn.text,
      uncertain: turn.uncertain ?? [],
      next: turn.next ?? [],
      declined: turn.declined ?? false,
      flagged: turn.flagged ?? [],
    };
    delete open.failure;
  }
  return threads;
}

/** `…/ExpertReply-bf82b31299fe.request.json` → `ExpertReply-bf82b31299fe`. */
export function requestIdFrom(requestPath: string): string {
  return path.basename(requestPath).replace(/\.request\.json$/, "");
}

/**
 * The claim marker.
 *
 * `queued` and `answering` are different facts and the difference matters to
 * somebody watching a thread: one means nobody has looked at it, the other
 * means somebody has. The only honest signal available is whether a session
 * has been handed the request, so that is what is recorded — `pnpm outbox
 * <file>` writes this marker beside the request when it prints the prompts.
 * Nothing infers it, and nothing pretends to know more than that.
 */
export function claimPathFor(requestPath: string): string {
  return requestPath.replace(/\.request\.json$/, ".claimed");
}

export function readThreads(db: Db): AskThread[] {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, CHAT_KEY))
    .get();
  if (!row) return [];

  const current = chatSchema.safeParse(row.value);
  if (current.success) return current.data.threads;

  const legacy = legacyChatSchema.safeParse(row.value);
  if (legacy.success) return adoptLegacy(legacy.data.turns);

  /**
   * Unreadable. This used to return an empty array, which read on screen as
   * "you have never asked anything" and then let the next ask overwrite the
   * row — a whole conversation gone with nothing said. Throwing puts the
   * failure where somebody can see it instead of deleting the evidence.
   */
  throw new Error(
    `The conversation in settings.${CHAT_KEY} is not in a shape this version can read, ` +
      `so it has been left alone rather than overwritten. ${current.error.issues[0]?.message ?? ""}`.trim(),
  );
}

function writeThreads(db: Db, threads: AskThread[]): void {
  const value = chatSchema.parse({
    version: 2,
    threads: threads.slice(-MAX_THREADS),
  });
  db.insert(settings)
    .values({ key: CHAT_KEY, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date().toISOString() },
    })
    .run();
}

export function clearChat(db: Db): void {
  writeThreads(db, []);
}

/* ------------------------------------------------------------------ *
 * The old turn shape, derived. The outbox page reads this.            *
 * ------------------------------------------------------------------ */

export interface ChatTurn {
  id: string;
  at: string;
  who: "you" | "expert";
  text: string;
  expert?: string;
  because?: string[];
  uncertain?: string[];
  next?: string[];
  declined?: boolean;
  flagged?: string[];
  waiting?: { requestPath: string; responsePath: string };
}

export function threadsAsTurns(threads: AskThread[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const thread of threads) {
    turns.push({
      id: `${thread.id}-q`,
      at: thread.askedAt,
      who: "you",
      text: thread.question,
    });
    const head = {
      expert: thread.expert,
      because: thread.because,
    };
    if (thread.state === "answered" && thread.answer) {
      turns.push({
        id: `${thread.id}-a`,
        at: thread.answer.at,
        who: "expert",
        text: thread.answer.text,
        ...head,
        uncertain: thread.answer.uncertain,
        next: thread.answer.next,
        declined: thread.answer.declined,
        ...(thread.answer.flagged.length > 0
          ? { flagged: thread.answer.flagged }
          : {}),
      });
    } else if (thread.request) {
      turns.push({
        id: `${thread.id}-w`,
        at: thread.askedAt,
        who: "expert",
        text: thread.question,
        ...head,
        waiting: {
          requestPath: thread.request.requestPath,
          responsePath: thread.request.responsePath,
        },
      });
    } else if (thread.failure) {
      turns.push({
        id: `${thread.id}-f`,
        at: thread.failure.at,
        who: "expert",
        text: thread.failure.message,
        ...head,
      });
    }
  }
  return turns;
}

export function readChat(db: Db): ChatTurn[] {
  return threadsAsTurns(readThreads(db));
}

/* ------------------------------------------------------------------ *
 * Collection                                                          *
 * ------------------------------------------------------------------ */

/** A thread nobody has answered yet. */
export function isOpen(thread: AskThread): boolean {
  return thread.state === "queued" || thread.state === "answering";
}

/**
 * Pick up whatever has been answered, and notice what has been claimed.
 *
 * This is the whole collection path and it does not ask anything. For each
 * open thread it looks at the one file that thread is waiting on: if the
 * response is there it is validated and becomes the answer, and if it is not
 * valid the thread fails with the reason rather than casting a wrong shape
 * into the conversation. Nothing here can write a request.
 *
 * Returns whether anything moved, so a caller can skip revalidating a page
 * that would render identically.
 */
export function collectAnswers(db: Db): {
  changed: boolean;
  threads: AskThread[];
} {
  const threads = readThreads(db);
  let changed = false;

  for (const thread of threads) {
    if (!isOpen(thread) || !thread.request) continue;

    if (fs.existsSync(thread.request.responsePath)) {
      let raw: unknown;
      try {
        raw = JSON.parse(fs.readFileSync(thread.request.responsePath, "utf8"));
      } catch (error) {
        thread.state = "failed";
        thread.failure = {
          at: new Date().toISOString(),
          message: `The answer file ${path.basename(thread.request.responsePath)} is not readable JSON: ${(error as Error).message}`,
        };
        changed = true;
        continue;
      }
      const checked = expertReplySchema.safeParse(raw);
      if (!checked.success) {
        const issue = checked.error.issues[0];
        const where = issue?.path.length ? issue.path.join(".") : "the answer";
        thread.state = "failed";
        thread.failure = {
          at: new Date().toISOString(),
          message: `The answer in ${path.basename(thread.request.responsePath)} is not the shape this reads back — ${where}: ${issue?.message ?? "wrong shape"}`,
        };
        changed = true;
        continue;
      }
      thread.state = "answered";
      thread.answer = {
        at: new Date().toISOString(),
        text: checked.data.answer,
        uncertain: checked.data.uncertain,
        next: checked.data.next,
        declined: checked.data.declined,
        flagged: scanPayloadForProtectedTraits(checked.data).map(
          (hit) => hit.trait,
        ),
      };
      delete thread.failure;
      changed = true;
      continue;
    }

    if (
      thread.state === "queued" &&
      fs.existsSync(claimPathFor(thread.request.requestPath))
    ) {
      thread.state = "answering";
      changed = true;
    }
  }

  if (changed) writeThreads(db, threads);
  return { changed, threads };
}

/* ------------------------------------------------------------------ *
 * Asking                                                              *
 * ------------------------------------------------------------------ */

/** What earlier threads said, oldest first, for the follow-up to make sense. */
function historyBefore(
  threads: AskThread[],
  upTo: number,
): { who: "you" | "expert"; text: string }[] {
  const history: { who: "you" | "expert"; text: string }[] = [];
  for (const thread of threads.slice(0, upTo)) {
    if (thread.state !== "answered" || !thread.answer) continue;
    history.push({ who: "you", text: thread.question });
    history.push({ who: "expert", text: thread.answer.text });
  }
  return history;
}

/**
 * Run one thread against the model and record whichever of the three things
 * happens. The thread is already written before this is called, so every
 * ending is an update to something the reader can already see.
 */
async function runThread(
  db: Db,
  threads: AskThread[],
  index: number,
): Promise<AskThread[]> {
  const thread = threads[index];
  try {
    const reply = await askTheExpert({
      expert: expertById(thread.expert),
      question: thread.question,
      history: historyBefore(threads, index),
    });
    /**
     * The session provider parses the response file and casts. Checking it
     * here means a wrong-shaped answer becomes a failed thread with a reason
     * instead of `undefined` arriving somewhere further down.
     */
    const checked = expertReplySchema.safeParse(reply);
    if (!checked.success) {
      throw new Error(
        `The answer is not the shape this reads back: ${checked.error.issues[0]?.message ?? "wrong shape"}`,
      );
    }
    thread.state = "answered";
    thread.answer = {
      at: new Date().toISOString(),
      text: checked.data.answer,
      uncertain: checked.data.uncertain,
      next: checked.data.next,
      declined: checked.data.declined,
      flagged: scanPayloadForProtectedTraits(checked.data).map(
        (hit) => hit.trait,
      ),
    };
    delete thread.failure;
  } catch (error) {
    if (error instanceof SessionFulfillmentPendingError) {
      thread.state = "queued";
      thread.request = {
        id: requestIdFrom(error.requestPath),
        requestPath: error.requestPath,
        responsePath: error.responsePath,
      };
      delete thread.failure;
    } else {
      thread.state = "failed";
      thread.failure = {
        at: new Date().toISOString(),
        message: (error as Error).message,
      };
    }
  }
  writeThreads(db, threads);
  return threads;
}

/**
 * Ask, and record the thread first.
 *
 * The question is written down with its routed specialist before the model is
 * touched, so there is no moment where the input has been cleared and nothing
 * exists. Everything after that is a state change on a thread the reader is
 * already looking at.
 *
 * A repeat of the newest question is treated as a retry of that thread rather
 * than a second thread. That used to be load-bearing — it was the only way to
 * collect an answer — and it is kept only because asking the same thing twice
 * in a row still means "try that again", not "file it twice".
 */
export async function askThread(
  db: Db,
  question: string,
  chosen?: string,
): Promise<AskThread[]> {
  const asked = question.trim();
  const threads = readThreads(db);
  if (!asked) return threads;

  const routing = chosen
    ? { expert: expertById(chosen), because: [] as string[] }
    : routeQuestion(asked);

  const tail = threads.at(-1);
  if (tail && tail.question === asked && tail.state !== "answered") {
    tail.expert = routing.expert.id;
    tail.because = routing.because;
    tail.state = "queued";
    writeThreads(db, threads);
    return runThread(db, threads, threads.length - 1);
  }

  threads.push({
    id: `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    askedAt: new Date().toISOString(),
    question: asked,
    expert: routing.expert.id,
    because: routing.because,
    state: "queued",
  });
  writeThreads(db, threads);
  return runThread(db, threads, threads.length - 1);
}

/**
 * Try a thread again with the question it already has.
 *
 * The point is that nobody retypes anything. The question, and the specialist
 * it was routed to, are on the thread; this re-runs exactly those.
 */
export async function retryThread(
  db: Db,
  threadId: string,
): Promise<AskThread[]> {
  const threads = readThreads(db);
  const index = threads.findIndex((thread) => thread.id === threadId);
  if (index === -1) return threads;
  threads[index].state = "queued";
  delete threads[index].failure;
  writeThreads(db, threads);
  return runThread(db, threads, index);
}

/** Kept for the outbox page, which collects by asking the same question. */
export async function askExpert(
  db: Db,
  question: string,
  chosen?: string,
): Promise<ChatTurn[]> {
  return threadsAsTurns(await askThread(db, question, chosen));
}
