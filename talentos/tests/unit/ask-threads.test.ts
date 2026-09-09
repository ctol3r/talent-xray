/**
 * The ask path, held to the promise it makes.
 *
 * The promise is narrow and it is the whole feature: a question that has been
 * asked is written down with a state, and the answer finds its way back to it
 * without anybody typing the question a second time. Both halves were broken
 * in ways that looked like nothing happening, so both halves are pinned here.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { settings } from "@/lib/db/schema";
import {
  CHAT_KEY,
  askThread,
  claimPathFor,
  collectAnswers,
  readChat,
  readThreads,
  retryThread,
} from "@/lib/services/expert";

let sqlite: Database.Database;
let db: Db;
let outbox: string;

const ANSWER = {
  answer: "Open the intake with the hiring manager before you write a string.",
  uncertain: ["whether the role is funded"],
  declined: false,
  next: ["what should the intake cover"],
};

beforeEach(() => {
  sqlite = new Database(":memory:");
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: resolve("drizzle") });
  outbox = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-outbox-"));
  process.env.TALENTOS_SESSION_OUTBOX = outbox;
  process.env.TALENTOS_MODEL_PROVIDER = "session";
});

afterEach(() => {
  sqlite.close();
  fs.rmSync(outbox, { recursive: true, force: true });
  delete process.env.TALENTOS_SESSION_OUTBOX;
  delete process.env.TALENTOS_MODEL_PROVIDER;
});

describe("an ask is written down before anything can go wrong", () => {
  it("records the question, its specialist and its request id, queued", async () => {
    const threads = await askThread(db, "how do I open an intake");

    expect(threads).toHaveLength(1);
    const [thread] = threads;
    expect(thread.question).toBe("how do I open an intake");
    expect(thread.state).toBe("queued");
    expect(thread.expert).toBe("intake");
    // The request id is on the thread. This is what makes collection a lookup
    // rather than a re-derivation of the prompt hash.
    expect(thread.request?.id).toMatch(/^ExpertReply-[0-9a-f]{12}$/);
    expect(fs.existsSync(thread.request!.requestPath)).toBe(true);
  });

  it("survives a reload — the state is in the database, not in the page", async () => {
    await askThread(db, "how do I open an intake");

    // Nothing in memory: this is what a hard refresh reads.
    const reloaded = readThreads(db);
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].question).toBe("how do I open an intake");
    expect(reloaded[0].state).toBe("queued");
  });

  it("keeps a second, different question as its own thread", async () => {
    await askThread(db, "how do I open an intake");
    const threads = await askThread(db, "why is nobody replying");

    expect(threads.map((thread) => thread.question)).toEqual([
      "how do I open an intake",
      "why is nobody replying",
    ]);
    expect(threads.map((thread) => thread.state)).toEqual([
      "queued",
      "queued",
    ]);
  });
});

describe("the answer comes back without anybody asking twice", () => {
  it("collects a response written beside the request", async () => {
    const [thread] = await askThread(db, "how do I open an intake");
    fs.writeFileSync(thread.request!.responsePath, JSON.stringify(ANSWER));

    const { changed, threads } = collectAnswers(db);

    expect(changed).toBe(true);
    expect(threads[0].state).toBe("answered");
    expect(threads[0].answer?.text).toBe(ANSWER.answer);
    expect(threads[0].answer?.next).toEqual(ANSWER.next);
    // The question is still the question. Collecting does not restate it.
    expect(threads[0].question).toBe("how do I open an intake");
  });

  it("collects even when the conversation moved on after the ask", async () => {
    const [first] = await askThread(db, "how do I open an intake");
    await askThread(db, "why is nobody replying");
    // This is the case the old shape could not do: the prompt hash for the
    // first question is long gone, but the thread still knows its own file.
    fs.writeFileSync(first.request!.responsePath, JSON.stringify(ANSWER));

    const { threads } = collectAnswers(db);

    expect(threads[0].state).toBe("answered");
    expect(threads[0].answer?.text).toBe(ANSWER.answer);
    expect(threads[1].state).toBe("queued");
  });

  it("does nothing, and says so, when nothing has been answered", async () => {
    await askThread(db, "how do I open an intake");
    expect(collectAnswers(db).changed).toBe(false);
  });

  it("shows a claimed request as being answered", async () => {
    const [thread] = await askThread(db, "how do I open an intake");
    fs.writeFileSync(claimPathFor(thread.request!.requestPath), "now\n");

    const { changed, threads } = collectAnswers(db);

    expect(changed).toBe(true);
    expect(threads[0].state).toBe("answering");
  });
});

describe("a failure is a state, not a disappearance", () => {
  it("fails the thread with a reason when the answer is the wrong shape", async () => {
    const [thread] = await askThread(db, "how do I open an intake");
    fs.writeFileSync(
      thread.request!.responsePath,
      JSON.stringify({ answer: "no other fields" }),
    );

    const { threads } = collectAnswers(db);

    expect(threads[0].state).toBe("failed");
    expect(threads[0].failure?.message).toContain("uncertain");
    // The question is still there to retry with.
    expect(threads[0].question).toBe("how do I open an intake");
  });

  it("fails the thread when the answer file is not JSON", async () => {
    const [thread] = await askThread(db, "how do I open an intake");
    fs.writeFileSync(thread.request!.responsePath, "not json at all");

    const { threads } = collectAnswers(db);

    expect(threads[0].state).toBe("failed");
    expect(threads[0].failure?.message).toContain("not readable JSON");
  });

  it("retries with the question it already has, so nobody retypes it", async () => {
    const [thread] = await askThread(db, "how do I open an intake");
    fs.writeFileSync(thread.request!.responsePath, "not json at all");
    collectAnswers(db);

    fs.rmSync(thread.request!.responsePath);
    const threads = await retryThread(db, thread.id);

    expect(threads).toHaveLength(1);
    expect(threads[0].question).toBe("how do I open an intake");
    expect(threads[0].state).toBe("queued");
    expect(threads[0].failure).toBeUndefined();
  });
});

describe("a conversation is never silently thrown away", () => {
  it("adopts the old turn shape, keeping the request a wait was on", () => {
    const requestPath = path.join(outbox, "ExpertReply-bf82b31299fe.request.json");
    db.insert(settings)
      .values({
        key: CHAT_KEY,
        value: {
          version: 1,
          turns: [
            {
              id: "q1",
              at: "2026-09-09T02:34:52.576Z",
              who: "you",
              text: "why is nobody replying",
            },
            {
              id: "w1",
              at: "2026-09-09T02:34:52.581Z",
              who: "expert",
              text: "why is nobody replying",
              expert: "outreach",
              because: ["reply"],
              waiting: {
                requestPath,
                responsePath: requestPath.replace(".request.", ".response."),
              },
            },
          ],
        },
      })
      .run();

    const threads = readThreads(db);

    expect(threads).toHaveLength(1);
    expect(threads[0].question).toBe("why is nobody replying");
    expect(threads[0].state).toBe("queued");
    expect(threads[0].expert).toBe("outreach");
    expect(threads[0].request?.id).toBe("ExpertReply-bf82b31299fe");
  });

  it("refuses to read an unreadable conversation rather than reporting none", () => {
    db.insert(settings)
      .values({ key: CHAT_KEY, value: { version: 9, nonsense: true } })
      .run();

    // The old code returned [] here, which read as "you never asked anything"
    // and let the next ask overwrite the row.
    expect(() => readThreads(db)).toThrow(/not in a shape/);
    expect(
      db.select().from(settings).where(eq(settings.key, CHAT_KEY)).get(),
    ).toBeDefined();
  });
});

describe("the outbox page's view of the conversation still works", () => {
  it("renders a queued thread as a waiting turn carrying its request path", async () => {
    const [thread] = await askThread(db, "how do I open an intake");

    const turns = readChat(db);

    expect(turns.map((turn) => turn.who)).toEqual(["you", "expert"]);
    expect(turns[1].waiting?.requestPath).toBe(thread.request!.requestPath);
    expect(turns[1].text).toBe("how do I open an intake");
  });
});
