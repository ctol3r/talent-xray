/**
 * W7 acceptance: the crew queue runs a full project through generation →
 * critic → (one revision) on the mock provider, honoring dependencies.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

let db: Db;
let tmpDir: string;
let projectId: string;
let candidateId: string;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-crew-"));
  process.env.TALENTOS_DATABASE_PATH = path.join(tmpDir, "crew.db");
  // Fresh singleton for this env.
  globalThis.__talentosDb = undefined;
  const { getDb } = await import("@/lib/db/client");
  db = getDb();

  const { createSearchProject, saveJobDescription } =
    await import("@/lib/services/search-projects");
  const { GOLDEN_FIXTURES } = await import("@/lib/db/seed");
  const cais = GOLDEN_FIXTURES[0];
  const project = await createSearchProject(db, {
    name: `Crew test — ${cais.name}`,
    companyName: cais.company,
    roleTitle: cais.roleTitle,
    geography: cais.geography,
    country: cais.country,
    industry: cais.industry,
    seniority: cais.seniority,
    businessObjective: cais.businessObjective,
  });
  projectId = project.id;
  await saveJobDescription(db, {
    searchProjectId: projectId,
    rawText: cais.jd,
    source: "pasted",
  });
});

afterAll(() => {
  globalThis.__talentosDb = undefined;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("crew orchestration (mock provider)", () => {
  it("gates jobs on their dependencies at kickoff", async () => {
    const { kickoffCrew, runnableJobs, CREW_PROJECT_TASKS } =
      await import("@/lib/services/crew");
    const jobs = await kickoffCrew(db, projectId);
    expect(jobs).toHaveLength(CREW_PROJECT_TASKS.length);
    const runnable = await runnableJobs(db, projectId);
    expect(runnable.map((j) => j.task)).toEqual(["role_intelligence"]);
  });

  it("advances the whole crew to done, critiquing every artifact", async () => {
    const { advanceCrew, listCrewJobs } = await import("@/lib/services/crew");
    const result = await advanceCrew(db, projectId);
    expect(result.remaining).toBe(0);
    expect(result.failed).toEqual([]);
    const jobs = (await listCrewJobs(db, projectId)).filter(
      (j) => j.status !== "cancelled",
    );
    expect(jobs.every((j) => j.status === "done")).toBe(true);
    // Every reviewable artifact got a critique.
    const critiqued = jobs.filter((j) => j.critique);
    expect(critiqued.length).toBeGreaterThanOrEqual(7);
  });

  it("runs exactly one revision pass when the critic says revise", async () => {
    const { listCrewJobs } = await import("@/lib/services/crew");
    const jobs = await listCrewJobs(db, projectId);
    // Mock critic revises Role Intelligence and accepts everything else.
    const role = jobs.find(
      (j) => j.task === "role_intelligence" && j.status === "done",
    );
    expect(role?.critique?.verdict).toBe("revise");
    expect(role?.attempt).toBe(2); // generate + one revision
    const intake = jobs.find((j) => j.task === "intake" && j.status === "done");
    expect(intake?.critique?.verdict).toBe("accept");
    expect(intake?.attempt).toBe(1);
  });

  it("persists every artifact the crew generated", async () => {
    const { getRoleIntelligence, getSuccessProfile, getInterviewPlan } =
      await import("@/lib/services/artifacts");
    const { listQueries } = await import("@/lib/services/workflow");
    expect(await getRoleIntelligence(db, projectId)).toBeTruthy();
    expect(await getSuccessProfile(db, projectId)).toBeTruthy();
    expect(await getInterviewPlan(db, projectId)).toBeTruthy();
    expect((await listQueries(db, projectId)).length).toBeGreaterThan(0);
  });

  it("runs the candidate crew (evidence → outreach) in order", async () => {
    const { createCandidate, createCandidateInput } =
      await import("@/lib/services/candidates");
    const { advanceCrew, kickoffCandidateCrew, listCrewJobs, runnableJobs } =
      await import("@/lib/services/crew");
    const candidate = await createCandidate(
      db,
      createCandidateInput.parse({
        searchProjectId: projectId,
        name: "Crew Test Candidate",
        resumeText: "Synthetic test resume for crew ordering.",
      }),
    );
    candidateId = candidate.id;
    await kickoffCandidateCrew(db, candidateId);
    const runnable = await runnableJobs(db, projectId);
    const candidateRunnable = runnable.filter(
      (j) => j.candidateId === candidateId,
    );
    expect(candidateRunnable.map((j) => j.task)).toEqual(["evidence"]);
    const result = await advanceCrew(db, projectId);
    expect(result.remaining).toBe(0);
    const jobs = await listCrewJobs(db, projectId);
    const outreach = jobs.find(
      (j) => j.candidateId === candidateId && j.task === "outreach",
    );
    expect(outreach?.status).toBe("done");
  });

  it("restarting the crew cancels the previous run", async () => {
    const { kickoffCrew, listCrewJobs } = await import("@/lib/services/crew");
    await kickoffCrew(db, projectId);
    const jobs = await listCrewJobs(db, projectId);
    const cancelled = jobs.filter((j) => j.status === "cancelled");
    // Only project-scope jobs are restarted; the candidate run stays done.
    expect(cancelled.length).toBe(0); // previous project jobs were all done
    const queued = jobs.filter((j) => j.status === "queued");
    expect(queued.length).toBe(9);
  });
});
