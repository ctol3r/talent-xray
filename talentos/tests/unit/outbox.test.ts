/**
 * The outbox, end to end, without a browser.
 *
 * The claim being tested is the one that matters: a question asked with no
 * model key becomes a row, and answering that row puts the reply in the
 * conversation without the question being asked again. Everything else here
 * exists to stop the two ways that can quietly break — a response file
 * written before it was checked, and a schema added to the app but not to the
 * thing that checks pasted answers.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { askExpert, readChat } from "@/lib/services/expert";
import {
  listOutbox,
  readRequestPayload,
  submitResponse,
} from "@/lib/services/outbox";
import { RESPONSE_SCHEMAS } from "@/lib/ai/schemas";
import { formatWaited, kindLabel, subjectOf } from "@/lib/domain/outbox";

let db: Db;
let sqlite: Database.Database;
let dir: string;
let outbox: string;

const QUESTION = "why is nobody replying to my first message";

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-outbox-"));
  outbox = path.join(dir, "session-outbox");
  // The session provider is the whole point: with a key, or with the mock,
  // nothing is ever written to an outbox and there is nothing to test.
  process.env.TALENTOS_MODEL_PROVIDER = "session";
  process.env.TALENTOS_SESSION_OUTBOX = outbox;

  sqlite = new Database(path.join(dir, "test.db"));
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema }) as unknown as Db;
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
});

afterAll(() => {
  sqlite?.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("what is waiting", () => {
  it("has nothing to show before anything is asked", async () => {
    expect(await listOutbox(db)).toEqual([]);
  });

  it("shows a question from the home page as one waiting row", async () => {
    const turns = await askExpert(db, QUESTION);
    // The ask box got a wait, not an answer: there is no model key.
    expect(turns.at(-1)?.waiting).toBeTruthy();

    const rows = await listOutbox(db);
    expect(rows.length).toBe(1);
    const [row] = rows;
    expect(row.schemaName).toBe("ExpertReply");
    expect(row.kind).toBe("Expert reply");
    expect(row.state).toBe("waiting");
    expect(row.subject.kind).toBe("conversation");
    expect(row.subject.label).toBe(QUESTION);
    // The copy button reads the request file itself, whole, on demand.
    expect(row.bytes).toBeGreaterThan(0);
    expect(JSON.parse(readRequestPayload(row.id) ?? "{}").schemaName).toBe(
      "ExpertReply",
    );
    expect(readRequestPayload("../../etc/passwd")).toBeNull();
    // The conversation is waiting on this exact file, so the answer can be
    // collected here rather than by asking again.
    expect(row.collectable).toBe(true);
  });
});

describe("a response that does not match its schema", () => {
  it("is refused by the name of the field that is wrong", async () => {
    const [row] = await listOutbox(db);
    const result = await submitResponse(
      db,
      row.id,
      // `answer` is there; `uncertain` is a string where an array belongs.
      JSON.stringify({
        answer: "Because the first message asked for a call.",
        uncertain: "nothing",
        declined: false,
        next: [],
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("uncertain");
  });

  it("is refused when a field is missing, by that field's name", async () => {
    const [row] = await listOutbox(db);
    const result = await submitResponse(
      db,
      row.id,
      JSON.stringify({ answer: "Something.", uncertain: [], next: [] }),
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("declined");
  });

  it("is refused when it is not JSON at all", async () => {
    const [row] = await listOutbox(db);
    const result = await submitResponse(db, row.id, "not json {");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("not JSON");
  });

  it("wrote nothing at all while being refused three times", async () => {
    // The rule the whole module exists for. A partial or wrong-shaped
    // response file is worse than none: the provider that reads it back
    // casts rather than parses, so it would fail somewhere else entirely.
    const written = fs.readdirSync(outbox);
    expect(written.filter((name) => name.includes(".response."))).toEqual([]);
    expect(written.filter((name) => name.endsWith(".tmp"))).toEqual([]);
    const [row] = await listOutbox(db);
    expect(row.state).toBe("waiting");
  });

  it("refuses an id that is not a request in this outbox", async () => {
    const result = await submitResponse(
      db,
      "../../etc/passwd",
      JSON.stringify({ answer: "x", uncertain: [], declined: false, next: [] }),
    );
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toContain("not a request");
  });
});

describe("a valid response", () => {
  it("is written, and the answer appears in the conversation unasked", async () => {
    const [row] = await listOutbox(db);
    const result = await submitResponse(
      db,
      row.id,
      JSON.stringify({
        answer:
          "A first message that asks for a call is asking for a decision before there is a reason to make one.",
        uncertain: ["what the first message actually said"],
        declined: false,
        next: ["what should the second message say"],
      }),
    );

    expect(result).toEqual({
      ok: true,
      collected: true,
      where: "Answered on the home page.",
    });

    // The file the rest of the app reads, in the place it reads it from.
    expect(fs.existsSync(path.join(outbox, `${row.id}.response.json`))).toBe(
      true,
    );

    // And the answer is in the transcript, with no second copy of the
    // question and nothing still waiting.
    const turns = readChat(db);
    expect(turns.filter((turn) => turn.text === QUESTION).length).toBe(1);
    expect(turns.some((turn) => turn.waiting)).toBe(false);
    expect(turns.at(-1)?.who).toBe("expert");
    expect(turns.at(-1)?.text).toContain("asking for a decision");
    expect(turns.at(-1)?.uncertain).toEqual([
      "what the first message actually said",
    ]);
  });

  it("leaves the row answered rather than hiding it", async () => {
    const rows = await listOutbox(db);
    expect(rows.length).toBe(1);
    expect(rows[0].state).toBe("answered");
    expect(rows[0].collectable).toBe(false);
  });
});

describe("the schemas a paste can be checked against", () => {
  it("covers every schemaName the app asks for", () => {
    // The registry is what stands between a pasted answer and an unvalidated
    // write. A task added without being registered would silently lose that,
    // so the source is the source of truth and this is the check.
    const dirOnDisk = path.resolve("src/lib/ai/tasks");
    const declared = new Set<string>();
    for (const file of fs.readdirSync(dirOnDisk)) {
      const source = fs.readFileSync(path.join(dirOnDisk, file), "utf8");
      for (const match of source.matchAll(/schemaName:\s*"([A-Za-z0-9]+)"/g)) {
        declared.add(match[1]);
      }
    }
    // Research is not in tasks/ — it has its own provider and fixed shape.
    declared.add("Research");

    const missing = [...declared]
      .filter((name) => !(name in RESPONSE_SCHEMAS))
      .sort();
    expect(`unregistered: ${missing.join(", ")}`).toBe("unregistered: ");
  });
});

describe("reading a request", () => {
  it("names a job-bound request by the job it belongs to", () => {
    const subject = subjectOf(
      {
        user: "## Search project\nSearch: CAIS — Founding Recruiter\nCompany: x",
      },
      "RoleIntelligence",
    );
    expect(subject).toEqual({
      kind: "job",
      label: "CAIS — Founding Recruiter",
    });
  });

  it("takes the question out of an expert prompt that carries history", () => {
    const subject = subjectOf(
      {
        user: "Earlier in this conversation:\n\nRecruiter: hello\n\nThe recruiter now asks:\nwhat does a counter-offer mean here",
      },
      "ExpertReply",
    );
    expect(subject).toEqual({
      kind: "conversation",
      label: "what does a counter-offer mean here",
    });
  });

  it("names a research request by its query", () => {
    expect(
      subjectOf({ query: "where do CNC machinists gather" }, "Research"),
    ).toEqual({ kind: "query", label: "where do CNC machinists gather" });
  });

  it("writes a schema name the way somebody reading a list would", () => {
    expect(kindLabel("RoleIntelligence")).toBe("Role intelligence");
    expect(kindLabel("IntakeSession")).toBe("Intake session");
    expect(kindLabel("SourcingStrategy")).toBe("Sourcing strategy");
    expect(kindLabel("HmBrief")).toBe("Hiring manager brief");
  });

  it("rounds a wait down to the largest unit that is still true", () => {
    expect(formatWaited(30_000)).toBe("under a minute");
    expect(formatWaited(60_000)).toBe("1 minute");
    expect(formatWaited(3 * 3_600_000)).toBe("3 hours");
    expect(formatWaited(47 * 3_600_000)).toBe("1 day");
  });
});
