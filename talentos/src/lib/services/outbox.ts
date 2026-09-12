/**
 * The session outbox, as something the app can show and be answered through.
 *
 * `pnpm outbox` already listed what was waiting, and that was enough while
 * the only person who could answer a request was sitting at a terminal with
 * a Claude session open. It is not enough as an explanation: a recruiter who
 * asks a question and gets a waiting panel has no way to see the queue, how
 * long it has been there, or whether anything is moving.
 *
 * So this reads the same directory the CLI reads. The filesystem is the
 * source of truth and stays that way — there is no table mirroring it, and
 * nothing here caches. A response written by a session in a terminal and a
 * response pasted into the page are the same file, which is the only reason
 * the two can be used interchangeably.
 *
 * Two rules this module exists to keep:
 *
 *  - Nothing is written until it has been validated against the schema the
 *    app will read it back with. A half-written or wrong-shaped response is
 *    worse than no response, because the reader casts rather than parses.
 *  - Nothing is written outside the outbox. The id is checked against a
 *    pattern before a path is built from it.
 */
import fs from "node:fs";
import path from "node:path";
import type { ZodError } from "zod";
import type { Db } from "@/lib/db/client";
import { schemaFor } from "@/lib/ai/schemas";
import {
  formatWaited,
  isRequestId,
  kindLabel,
  schemaNameOf,
  subjectOf,
  type OutboxRequest,
  type OutboxSubject,
} from "@/lib/domain/outbox";
import { askExpert, readChat } from "@/lib/services/expert";
import { listSearchProjects } from "@/lib/services/search-projects";
import { routeQuestion } from "../../../artifact-src/core/experts";

export interface OutboxRow {
  /** The filename stem: `<schemaName>-<hash>`. Identifies the request everywhere. */
  id: string;
  schemaName: string;
  /** The schema name written for somebody reading a list. */
  kind: string;
  subject: OutboxSubject;
  /** Set when the subject is a job that is still on file. */
  jobId?: string;
  /** When the request file was written. */
  writtenAt: string;
  /** How long it waited: until now, or until it was answered. */
  waited: string;
  state: "waiting" | "answered";
  /** True when a turn in the home conversation is waiting on this request. */
  collectable: boolean;
  /** Whether a schema is registered for it — a paste is refused without one. */
  known: boolean;
  /** How big the request is. Shown because some of them are enormous. */
  bytes: number;
}

export function outboxDir(): string {
  const configured =
    process.env.TALENTOS_SESSION_OUTBOX ?? "./data/session-outbox";
  return path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
}

function requestPath(id: string): string {
  return path.join(outboxDir(), `${id}.request.json`);
}

function responsePath(id: string): string {
  return path.join(outboxDir(), `${id}.response.json`);
}

function readRequest(file: string): OutboxRequest | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as OutboxRequest;
  } catch {
    return null;
  }
}

/**
 * Which request files a turn of the home conversation is waiting on.
 *
 * The transcript records the request path on the waiting turn, so this is a
 * lookup rather than a guess — and it is what lets a pasted answer be
 * collected here instead of the recruiter having to ask the same question
 * again.
 */
function chatWaitingOn(db: Db): Map<string, string> {
  const waiting = new Map<string, string>();
  for (const turn of readChat(db)) {
    if (turn.waiting?.requestPath) {
      waiting.set(path.basename(turn.waiting.requestPath), turn.text);
    }
  }
  return waiting;
}

/**
 * Everything in the outbox, waiting first and oldest first inside that.
 *
 * Answered requests stay on the list. A queue that hides what it finished is
 * a queue you cannot audit, and the most common question after "what is
 * waiting" is "did that one ever get answered".
 */
export async function listOutbox(db: Db): Promise<OutboxRow[]> {
  const dir = outboxDir();
  if (!fs.existsSync(dir)) return [];

  const waitingOn = chatWaitingOn(db);
  const jobs = await listSearchProjects(db);
  const byName = new Map(jobs.map((job) => [job.name, job.id]));
  const now = Date.now();

  const rows: OutboxRow[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".request.json")) continue;
    const id = file.slice(0, -".request.json".length);
    if (!isRequestId(id)) continue;

    const full = path.join(dir, file);
    const request = readRequest(full);
    if (!request) continue;

    const answer = responsePath(id);
    const answered = fs.existsSync(answer);
    const writtenAt = fs.statSync(full).mtime;
    const until = answered ? fs.statSync(answer).mtime.getTime() : now;

    const schemaName = schemaNameOf(request, file);
    const subject = subjectOf(request, schemaName);
    rows.push({
      id,
      schemaName,
      kind: kindLabel(schemaName),
      subject,
      ...(subject.kind === "job" && byName.has(subject.label)
        ? { jobId: byName.get(subject.label) }
        : {}),
      writtenAt: writtenAt.toISOString(),
      waited: formatWaited(Math.max(0, until - writtenAt.getTime())),
      state: answered ? "answered" : "waiting",
      collectable: !answered && waitingOn.has(file),
      known: schemaFor(schemaName) !== undefined,
      bytes: fs.statSync(full).size,
    });
  }

  return rows.sort((a, b) => {
    if (a.state !== b.state) return a.state === "waiting" ? -1 : 1;
    return a.writtenAt.localeCompare(b.writtenAt);
  });
}

/**
 * One request file, whole, for the copy button.
 *
 * Read on demand rather than sent with the list. A prompt carrying a job
 * description and the whole canonical intelligence runs to a hundred
 * kilobytes, and the real outbox holds dozens of them — putting every payload
 * in the page would have made opening the queue cost several megabytes to
 * show a list of five lines.
 */
export function readRequestPayload(id: string): string | null {
  if (!isRequestId(id)) return null;
  const file = requestPath(id);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
}

export type SubmitResult =
  | { ok: true; collected: boolean; where: string }
  | { ok: false; error: string };

/**
 * The first thing wrong with a pasted response, named by its field.
 *
 * Zod reports every issue; a person fixing a paste wants the first one, at a
 * path they can find in what they pasted. The root of the object has no path,
 * so it is called what it is rather than being reported against an empty
 * string.
 */
function firstProblem(error: ZodError): string {
  const issue = error.issues[0];
  const where = issue.path.length > 0 ? issue.path.join(".") : "the response";
  return `${where}: ${issue.message}`;
}

/**
 * Take an answer for one request: validate it, write it, and collect it.
 *
 * The write is a rename over a temporary file in the same directory, so the
 * app can never read a half-written response — it either sees the previous
 * state or the whole answer, and there is no moment in between.
 */
export async function submitResponse(
  db: Db,
  id: string,
  pasted: string,
): Promise<SubmitResult> {
  if (!isRequestId(id)) {
    return { ok: false, error: `${id} is not a request in this outbox.` };
  }

  const file = requestPath(id);
  if (!fs.existsSync(file)) {
    return { ok: false, error: `No request called ${id} is in the outbox.` };
  }
  const request = readRequest(file);
  if (!request) {
    return {
      ok: false,
      error: `${id}.request.json is not readable JSON. Nothing was written.`,
    };
  }

  const target = responsePath(id);
  /**
   * The request names where its answer goes. The path is computed here rather
   * than taken from the file, and then the two are compared: a request whose
   * `respondTo` points somewhere else is not one this page can answer, and
   * saying so is better than writing a file the app will never read.
   */
  if (request.respondTo && path.resolve(request.respondTo) !== target) {
    return {
      ok: false,
      error:
        `${id} expects its answer at ${request.respondTo}, which is not in this outbox. ` +
        `Nothing was written.`,
    };
  }

  const schemaName = schemaNameOf(request, `${id}.request.json`);
  const schema = schemaFor(schemaName);
  if (!schema) {
    return {
      ok: false,
      error:
        `No schema is registered for ${schemaName}, so this response cannot be checked before it is written. ` +
        `Add it to src/lib/ai/schemas.ts. Nothing was written.`,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(pasted);
  } catch (error) {
    return {
      ok: false,
      error: `That is not JSON: ${(error as Error).message}. Nothing was written.`,
    };
  }

  const checked = schema.safeParse(parsed);
  if (!checked.success) {
    return {
      ok: false,
      error: `${firstProblem(checked.error)}. Nothing was written.`,
    };
  }

  /**
   * The validated object is written, not the raw paste. Zod drops keys the
   * schema does not declare, which is exactly what the app does to this file
   * when it reads it back — so writing the parsed form means the file on disk
   * and the value the app uses are the same thing. The temporary name carries
   * no recognised suffix, so neither this page nor `pnpm outbox` can see a
   * write in progress.
   */
  const temporary = path.join(outboxDir(), `${id}.${process.pid}.tmp`);
  fs.writeFileSync(temporary, `${JSON.stringify(checked.data, null, 2)}\n`);
  fs.renameSync(temporary, target);

  return collect(db, id);
}

/**
 * Hand the answer to whatever was waiting for it.
 *
 * For a turn of the home conversation this is `askExpert` with the same
 * question — the identical call the ask box makes, which is why it collects
 * rather than asks again: the handoff is keyed on a hash of the prompt, so
 * re-running an answered request reads the response file instead of writing a
 * new one. Nothing new is invented here to deliver the answer; the existing
 * path is simply run once, so nobody has to retype their question.
 *
 * Everything else is collected where it is generated, by the button that
 * asked for it. Saying which is more use than pretending this page can
 * finish a job it does not have the job's id for.
 */
async function collect(db: Db, id: string): Promise<SubmitResult> {
  const asked = chatWaitingOn(db).get(`${id}.request.json`);
  if (asked === undefined) {
    return {
      ok: true,
      collected: false,
      where:
        "Saved. Open the page that asked for it and generate again — the answer is read from the file, so nothing is generated twice.",
    };
  }

  const before = readChat(db);
  const waiting = before.find(
    (turn) => turn.who === "expert" && turn.waiting && turn.text === asked,
  );
  const turns = await askExpert(db, asked, sameRouteAs(asked, waiting?.expert));
  const last = turns.at(-1);
  if (last?.waiting) {
    return {
      ok: true,
      collected: false,
      where:
        "Saved, but the conversation has moved on since this was asked, so the question now reads differently and has become a new request. Answer that one to see it in the conversation.",
    };
  }
  return { ok: true, collected: true, where: "Answered on the home page." };
}

/**
 * Reproduce the routing the question was originally asked with.
 *
 * The specialist decides the system prompt, the system prompt decides the
 * hash, and the hash decides which file gets read — so collecting with a
 * different specialist writes a second request and leaves the answered one
 * unread. Naming the specialist explicitly guarantees the same one; it is
 * left unnamed when the router would pick that one anyway, because doing so
 * keeps the words that routed it, which the conversation shows.
 */
function sameRouteAs(question: string, expert?: string): string | undefined {
  if (!expert) return undefined;
  return routeQuestion(question).expert.id === expert ? undefined : expert;
}
