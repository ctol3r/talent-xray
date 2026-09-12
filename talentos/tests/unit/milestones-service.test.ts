/**
 * The four moments, against a real database.
 *
 * The claim this file exists to hold is narrow and load-bearing: the events
 * are *emitted by the workflow*, at the points where the transitions already
 * happen, and they are emitted nowhere else. Everything the dashboard prints
 * rests on that, so the tests are as much about what does not get written as
 * about what does — an offer marked accepted must leave no signature behind,
 * and a reply nobody qualified must leave no first-qualified-reply.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { searchMilestones } from "@/lib/db/schema";
import { createSearchProject } from "@/lib/services/search-projects";
import { createCandidate } from "@/lib/services/candidates";
import {
  completeIntake,
  updateOutreachStatus,
  upsertOffer,
} from "@/lib/services/workflow";
import { deskElapsed, recordMilestone } from "@/lib/services/milestones";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

let db: Db;
let projectId: string;
let candidateId: string;

async function kinds(): Promise<string[]> {
  const rows = await db.select().from(searchMilestones);
  return rows.map((row) => row.kind).sort();
}

async function makeIntakeSession(): Promise<string> {
  const [row] = await db
    .insert(schema.intakeSessions)
    .values({
      searchProjectId: projectId,
      status: "in_progress",
      payload: { categories: [] } as never,
    })
    .returning();
  return row.id;
}

async function makeMessage(): Promise<string> {
  const [row] = await db
    .insert(schema.outreachMessages)
    .values({ candidateId, kind: "email_1", body: "Hello." })
    .returning();
  return row.id;
}

beforeEach(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-milestones-"));
  const sqlite = new Database(path.join(dir, "test.db"));
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema }) as unknown as Db;
  migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const project = await createSearchProject(db, {
    name: "CAIS — Founding Recruiter",
    roleTitle: "Founding Recruiter",
  });
  projectId = project.id;
  const person = await createCandidate(db, {
    searchProjectId: projectId,
    name: "A. Candidate",
    stage: "contacted",
  });
  candidateId = person.id;
});

describe("the brief", () => {
  it("is stamped when the intake is completed", async () => {
    await completeIntake(db, await makeIntakeSession());
    expect(await kinds()).toEqual(["brief"]);
  });

  it("is stamped once, keeping the first time it happened", async () => {
    const sessionId = await makeIntakeSession();
    await completeIntake(db, sessionId);
    const [first] = await db.select().from(searchMilestones);
    await completeIntake(db, sessionId);
    const rows = await db.select().from(searchMilestones);
    expect(rows).toHaveLength(1);
    expect(rows[0].occurredAt).toBe(first.occurredAt);
  });
});

describe("the first qualified reply", () => {
  it("is stamped when a reply is marked qualified", async () => {
    await updateOutreachStatus(db, {
      messageId: await makeMessage(),
      status: "replied",
      qualified: true,
    });
    expect(await kinds()).toEqual(["first_qualified_reply"]);
  });

  it("is not stamped by a reply nobody qualified", async () => {
    // The whole difference between this measure and "time to any reply".
    // A polite no is a reply and is not a qualified one, and only the person
    // reading it can tell.
    await updateOutreachStatus(db, {
      messageId: await makeMessage(),
      status: "replied",
    });
    expect(await kinds()).toEqual([]);
  });

  it("is not stamped by marking a message sent", async () => {
    await updateOutreachStatus(db, {
      messageId: await makeMessage(),
      status: "sent",
      qualified: true,
    });
    expect(await kinds()).toEqual([]);
  });

  it("keeps the first one when a second reply is also qualified", async () => {
    await updateOutreachStatus(db, {
      messageId: await makeMessage(),
      status: "replied",
      qualified: true,
    });
    const [first] = await db.select().from(searchMilestones);
    await updateOutreachStatus(db, {
      messageId: await makeMessage(),
      status: "replied",
      qualified: true,
    });
    const rows = await db.select().from(searchMilestones);
    expect(rows).toHaveLength(1);
    expect(rows[0].occurredAt).toBe(first.occurredAt);
  });
});

describe("the signature", () => {
  it("is stamped when the offer is marked signed", async () => {
    await upsertOffer(db, {
      searchProjectId: projectId,
      candidateId,
      status: "signed",
    });
    expect(await kinds()).toEqual(["signature"]);
  });

  it("is not stamped when the offer is only accepted", async () => {
    // A verbal yes is not a contract. Counting it as one would report a
    // brief-to-signature date for a signature that has not happened.
    await upsertOffer(db, {
      searchProjectId: projectId,
      candidateId,
      status: "accepted",
    });
    expect(await kinds()).toEqual([]);
  });

  it("is not stamped by a declined offer", async () => {
    await upsertOffer(db, {
      searchProjectId: projectId,
      candidateId,
      status: "declined",
    });
    expect(await kinds()).toEqual([]);
  });
});

describe("what the dashboard reads back", () => {
  it("refuses a median until three jobs have finished the interval", async () => {
    const jobIds = [projectId];
    await recordMilestone(db, {
      searchProjectId: projectId,
      kind: "brief",
      occurredAt: new Date(Date.now() - 10 * 86_400_000).toISOString(),
    });
    await recordMilestone(db, {
      searchProjectId: projectId,
      kind: "signature",
    });

    const one = await deskElapsed(db, jobIds);
    const signature = one.readings.find((r) => r.id === "signature")!;
    expect(signature.n).toBe(1);
    expect(signature.days).toBeNull();
    expect(signature.says).toContain("not enough closed searches yet");
  });

  it("reports a median once three have, with the count beside it", async () => {
    const jobIds: string[] = [];
    for (const days of [10, 20, 30]) {
      const job = await createSearchProject(db, {
        name: `Job ${days}`,
        roleTitle: "Recruiter",
      });
      jobIds.push(job.id);
      await recordMilestone(db, {
        searchProjectId: job.id,
        kind: "brief",
        occurredAt: new Date(Date.now() - days * 86_400_000).toISOString(),
      });
      await recordMilestone(db, { searchProjectId: job.id, kind: "signature" });
    }
    const desk = await deskElapsed(db, jobIds);
    const signature = desk.readings.find((r) => r.id === "signature")!;
    expect(signature.n).toBe(3);
    expect(signature.days).toBeCloseTo(20, 0);
    expect(desk.jobsInScope).toBe(3);
  });

  it("never counts a job outside the scope it was given", async () => {
    // The guard against a filtered dashboard quietly answering about the
    // whole desk. The out-of-scope job has a complete, in-window interval and
    // must still contribute nothing.
    const other = await createSearchProject(db, {
      name: "Not in scope",
      roleTitle: "Recruiter",
    });
    await recordMilestone(db, {
      searchProjectId: other.id,
      kind: "brief",
      occurredAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    });
    await recordMilestone(db, { searchProjectId: other.id, kind: "signature" });

    const desk = await deskElapsed(db, [projectId]);
    expect(desk.readings.find((r) => r.id === "signature")!.n).toBe(0);
    expect(desk.jobsInScope).toBe(1);
  });

  it("reads nothing back on a workspace where nothing has been recorded", async () => {
    // The state this ships in: the events start accruing from now, so every
    // measure must say so rather than inventing a number from history it
    // never observed.
    const desk = await deskElapsed(db, [projectId]);
    expect(desk.readings.map((r) => r.n)).toEqual([0, 0, 0]);
    expect(desk.readings.every((r) => r.days === null)).toBe(true);
  });
});
