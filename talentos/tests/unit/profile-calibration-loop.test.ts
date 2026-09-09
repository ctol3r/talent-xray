/**
 * The whole loop, against a real database: four rejections raise a question,
 * the answer changes the success profile, the change is in its history, and
 * the next candidate is scored against the profile as revised.
 *
 * This is the acceptance test. The pure rules are next door in
 * profile-calibration.test.ts; what is checked here is that they are wired to
 * the profile the score actually reads, and that answering is the thing that
 * moves the number.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import {
  candidateEvidence,
  candidates,
  successProfiles,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { createSearchProject } from "@/lib/services/search-projects";
import { createCandidate, updateCandidate } from "@/lib/services/candidates";
import {
  answerCalibration,
  CalibrationRefused,
  readCalibration,
} from "@/lib/services/profile-calibration";
import { candidateMatch } from "@/lib/services/match";
import type {
  EvidenceAlignmentPayload,
  SuccessProfilePayload,
} from "@/lib/core/payloads";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

let db: Db;
let sqlite: Database.Database;
let dir: string;
let jobId: string;
let nextPersonId: string;

const hm = (text: string) => ({ text, provenance: "hiring_manager" as const });

const PROFILE = {
  mission: "Own the reliability of the scheduling layer.",
  outcomes: [],
  responsibilities: [],
  mustHave: [
    { id: "CRIT-STAFF", ...hm("Current Staff Engineer title") },
    { id: "CRIT-DIST", ...hm("Production distributed systems experience") },
  ],
  preferred: [{ id: "CRIT-AI", ...hm("AI infrastructure experience") }],
  trainable: [],
  evidenceSignals: [],
  negativeSignals: [],
  adjacentBackgrounds: [],
  exemplarPeople: [],
  exemplarCompanies: [],
  targetIndustries: [],
  targetCompanies: [],
  alternateTitles: [],
  targetGeographies: [],
  candidateMotivators: [],
  sellingPoints: [],
  risks: [],
  unresolvedQuestions: [],
} satisfies SuccessProfilePayload;

/** The four notes the demo job carries, dates and all. */
const PASSES: { name: string; at: string; note: string }[] = [
  {
    name: "Candidate C31",
    at: "2026-08-12T16:00:00.000Z",
    note: "Strong systems background, but we need someone writing Go recently.",
  },
  {
    name: "Candidate C44",
    at: "2026-08-14T16:00:00.000Z",
    note: "Interesting background, but I don't see the Staff title we asked for.",
  },
  {
    name: "Candidate C52",
    at: "2026-08-18T16:00:00.000Z",
    note: "Strong candidate, but I want someone who already operates formally at Staff.",
  },
  {
    name: "Candidate C73",
    at: "2026-08-25T16:00:00.000Z",
    note: "I'd prefer someone who has already held Staff.",
  },
];

/** The same evidence for everyone, so only the profile can move the number. */
const ALIGNMENT = {
  items: [
    {
      id: "CRIT-STAFF",
      criterion: "Current Staff Engineer title",
      status: "contradictory",
      evidenceText: "Titled Senior, not Staff.",
    },
    {
      id: "CRIT-DIST",
      criterion: "Production distributed systems experience",
      status: "strong",
      evidenceText: "Six years on a production scheduler.",
    },
    {
      id: "CRIT-AI",
      criterion: "AI infrastructure experience",
      status: "strong",
      evidenceText: "Ran the training cluster.",
    },
  ],
  reviewPriority: {
    suggestion: "review_first",
    rationale: "Deep systems work.",
  },
  questionsToValidate: [],
} satisfies EvidenceAlignmentPayload;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-calibration-"));
  sqlite = new Database(path.join(dir, "test.db"));
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema }) as unknown as Db;
  migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const job = await createSearchProject(db, {
    name: "Axiom Compute — Staff Engineer",
    roleTitle: "Staff Software Engineer",
  });
  jobId = job.id;
  await db
    .insert(successProfiles)
    .values({ searchProjectId: jobId, payload: PROFILE });

  for (const pass of PASSES) {
    const person = await createCandidate(db, {
      searchProjectId: jobId,
      name: pass.name,
    });
    await updateCandidate(db, { id: person.id, disposition: "not_selected" });
    // Written directly so the dates are the ones the hiring manager's passes
    // actually carry; recordHmFeedback stamps "now", which would make every
    // rejection newer than every answer.
    await db
      .update(candidates)
      .set({
        stage: "hm_review",
        hmFeedback: [
          { at: pass.at, decision: "pass", evidenceNote: pass.note },
        ],
      })
      .where(eq(candidates.id, person.id));
  }

  const next = await createCandidate(db, {
    searchProjectId: jobId,
    name: "Someone assessed later",
  });
  nextPersonId = next.id;
  await db.insert(candidateEvidence).values({
    candidateId: nextPersonId,
    searchProjectId: jobId,
    payload: ALIGNMENT,
  });
});

afterAll(() => {
  sqlite.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("four rejections at one stage raise the question", () => {
  it("asks which requirement was wrong, and lists all four", () => {
    const { question } = readCalibration(db, jobId);
    expect(question?.asks).toBe("Which requirement was wrong?");
    expect(question?.stageLabel).toBe("Hiring Manager Review");
    expect(question?.rejections.map((r) => r.candidateName)).toEqual(
      PASSES.map((p) => p.name),
    );
    expect(question?.rejections.map((r) => r.note)).toEqual(
      PASSES.map((p) => p.note),
    );
  });

  it("dates them from the pass, not from when the row last changed", () => {
    const { question } = readCalibration(db, jobId);
    expect(question?.rejections[0].at).toBe(PASSES[0].at);
  });

  it("refuses an answer while no question is open", async () => {
    const quiet = await createSearchProject(db, {
      name: "Axiom Compute — Nobody rejected",
      roleTitle: "Staff Software Engineer",
    });
    await db
      .insert(successProfiles)
      .values({ searchProjectId: quiet.id, payload: PROFILE });
    expect(() =>
      answerCalibration(db, {
        jobId: quiet.id,
        note: "Felt like changing the bar.",
        edit: { kind: "dropped", criterionId: "CRIT-STAFF" },
      }),
    ).toThrow(CalibrationRefused);
  });
});

describe("answering it", () => {
  let before: number | null;

  it("scores the later candidate against the profile as it stands", async () => {
    const score = await candidateMatch(db, nextPersonId);
    before = score?.match ?? null;
    // The title is a must-have and the evidence contradicts it, so it is
    // carrying a must-have's weight against them.
    expect(score?.rows.find((r) => r.criterion.includes("Staff"))?.kind).toBe(
      "must_have",
    );
    expect(before).not.toBeNull();
  });

  it("changes the success profile", () => {
    answerCalibration(db, {
      jobId,
      by: "you",
      note: "Three of the four passes were about the title. The scope is the requirement; the title is not.",
      edit: { kind: "relaxed", criterionId: "CRIT-STAFF" },
    });
    const row = db
      .select()
      .from(successProfiles)
      .where(eq(successProfiles.searchProjectId, jobId))
      .get();
    expect(row?.payload.mustHave.map((c) => c.id)).toEqual(["CRIT-DIST"]);
    expect(row?.payload.preferred.map((c) => c.id)).toContain("CRIT-STAFF");
  });

  it("puts the change in the profile's history, with what prompted it", () => {
    const { history } = readCalibration(db, jobId);
    expect(history).toHaveLength(1);
    expect(history[0].says).toBe(
      '"Current Staff Engineer title" moved from must have to preferred',
    );
    expect(history[0].revision.note).toContain("The scope is the requirement");
    expect(history[0].revision.promptedBy.stageLabel).toBe(
      "Hiring Manager Review",
    );
    expect(history[0].prompted.map((p) => p.name)).toEqual(
      PASSES.map((p) => p.name),
    );
  });

  it("scores the next candidate against the revised profile", async () => {
    const score = await candidateMatch(db, nextPersonId);
    expect(score?.rows.find((r) => r.criterion.includes("Staff"))?.kind).toBe(
      "preferred",
    );
    // The contradicted criterion now carries half the weight it did, so the
    // same evidence produces a higher number against a profile that asks for
    // less. This is the whole point of the loop.
    expect(score?.match ?? 0).toBeGreaterThan(before ?? 0);
  });

  it("keeps the number's shape: a match, and how much was assessable", async () => {
    const score = await candidateMatch(db, nextPersonId);
    // "71% of 88% assessed" — two numbers, and coverage is still reported
    // separately rather than folded into one figure.
    expect(score?.coverage).toBe(100);
    expect(score?.assessed).toBe(3);
    expect(score?.total).toBe(3);
    expect(score?.caveat).toBeTruthy();
  });

  it("goes quiet, having been answered", () => {
    expect(readCalibration(db, jobId).question).toBeNull();
  });

  it("changed nothing about any candidate", async () => {
    const people = await db
      .select()
      .from(candidates)
      .where(eq(candidates.searchProjectId, jobId));
    const rejected = people.filter((p) => p.disposition === "not_selected");
    expect(rejected).toHaveLength(4);
    for (const person of rejected) {
      expect(person.stage).toBe("hm_review");
      expect(person.hmFeedback).toHaveLength(1);
    }
  });
});

describe("the history outlives nothing it should", () => {
  it("drops a deleted person's name from the entry rather than keeping a copy", async () => {
    const { history } = readCalibration(db, jobId);
    const kept = history[0].revision.promptedBy.candidateIds[0];
    const { deleteCandidate } = await import("@/lib/services/candidates");
    await deleteCandidate(db, kept);
    const after = readCalibration(db, jobId);
    expect(after.history[0].prompted).toHaveLength(3);
    expect(after.history[0].deleted).toBe(1);
    // And the entry itself survives: what changed and why is still readable.
    expect(after.history[0].says).toContain(
      "moved from must have to preferred",
    );
  });
});
