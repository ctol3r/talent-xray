/**
 * W9 acceptance: HM brief + candidate packets generate and persist as
 * editable drafts (mock provider); HM feedback is appended verbatim and
 * feeds the guidance-thread snapshot metrics.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

let db: Db;
let tmpDir: string;
let projectId: string;
let candidateId: string;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-guidance-"));
  process.env.TALENTOS_DATABASE_PATH = path.join(tmpDir, "g.db");
  globalThis.__talentosDb = undefined;
  const { getDb } = await import("@/lib/db/client");
  db = getDb();
  const { createSearchProject, saveJobDescription } =
    await import("@/lib/services/search-projects");
  const { GOLDEN_FIXTURES } = await import("@/lib/db/seed");
  const cais = GOLDEN_FIXTURES[0];
  const project = await createSearchProject(db, {
    name: "Guidance test",
    roleTitle: cais.roleTitle,
    companyName: cais.company,
    industry: cais.industry,
  });
  projectId = project.id;
  await saveJobDescription(db, {
    searchProjectId: projectId,
    rawText: cais.jd,
    source: "pasted",
  });
  const { createCandidate, createCandidateInput } =
    await import("@/lib/services/candidates");
  const candidate = await createCandidate(
    db,
    createCandidateInput.parse({
      searchProjectId: projectId,
      name: "Guidance Test Candidate",
      stage: "hm_review",
    }),
  );
  candidateId = candidate.id;
});

afterAll(() => {
  globalThis.__talentosDb = undefined;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("two-sided guidance (mock provider)", () => {
  it("generates and persists the HM brief as an editable artifact", async () => {
    const { generateHmBrief, getHmBrief, updateHmBriefPayload } =
      await import("@/lib/services/guidance");
    await generateHmBrief(db, projectId);
    const brief = await getHmBrief(db, projectId);
    expect(brief?.payload.headline).toBeTruthy();
    expect(brief?.payload.calibrationQuestions.length).toBeGreaterThan(0);

    const edited = {
      ...brief!.payload,
      headline: "EDITED BY RECRUITER",
    };
    await updateHmBriefPayload(db, projectId, edited);
    const reread = await getHmBrief(db, projectId);
    expect(reread?.payload.headline).toBe("EDITED BY RECRUITER");
  });

  it("generates candidate packets, latest per kind", async () => {
    const { generateCandidatePacket, listCandidatePackets } =
      await import("@/lib/services/guidance");
    await generateCandidatePacket(db, {
      candidateId,
      kind: "process_guide",
    });
    await generateCandidatePacket(db, {
      candidateId,
      kind: "interview_prep",
    });
    await generateCandidatePacket(db, {
      candidateId,
      kind: "interview_prep",
    });
    const packets = await listCandidatePackets(db, candidateId);
    expect(packets.map((p) => p.kind).sort()).toEqual([
      "interview_prep",
      "process_guide",
    ]);
  });

  it("appends HM feedback verbatim and never moves the stage", async () => {
    const { recordHmFeedback } = await import("@/lib/services/guidance");
    const { getCandidate } = await import("@/lib/services/candidates");
    await recordHmFeedback(db, {
      candidateId,
      decision: "hold",
      evidenceNote: "Strong infra evidence; no first-author paper located yet.",
    });
    const candidate = await getCandidate(db, candidateId);
    expect(candidate?.hmFeedback).toHaveLength(1);
    expect(candidate?.hmFeedback?.[0].decision).toBe("hold");
    expect(candidate?.stage).toBe("hm_review");
  });

  it("feeds the guidance-thread snapshot metrics", async () => {
    const { buildProjectSnapshot } =
      await import("@/lib/services/search-projects");
    const snapshot = await buildProjectSnapshot(db, projectId);
    expect(snapshot.hasHmBrief).toBe(true);
    // The one hm_review candidate has feedback now → nothing pending.
    expect(snapshot.hmReviewPendingCount).toBe(0);

    const { createCandidate, createCandidateInput } =
      await import("@/lib/services/candidates");
    await createCandidate(
      db,
      createCandidateInput.parse({
        searchProjectId: projectId,
        name: "Pending Feedback Candidate",
        stage: "hm_review",
      }),
    );
    const after = await buildProjectSnapshot(db, projectId);
    expect(after.hmReviewPendingCount).toBe(1);
  });
});
