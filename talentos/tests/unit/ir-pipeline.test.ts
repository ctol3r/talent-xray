/**
 * W8.5 acceptance — the CAIS golden path through the canonical IR boundary
 * (owner stop-order 2026-09-02, D-010/D-011):
 *
 *   JD → HiringNeedIR → initial HiringIntentIR → (research boundary)
 *   → adaptive intake → clarified RequirementIRs → SuccessIR → EvidenceIR
 *   → TalentPopulationIR → SearchPlanIR → composed discovery queries
 *   → TalentXRayCandidateDiscoveryProvider → explicit save with
 *   unverified source evidence.
 *
 * The specific demand: the vague hiring-manager phrase "research taste"
 * must become an explicit RequirementIR — verbatim statement + concrete
 * definition + evidence spec — not remain an unexplained string.
 *
 * Runs on the mock provider; the same services drive the anthropic and
 * session providers unchanged.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import type { RequirementIR, UncertaintyIR } from "@/lib/core/ir";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

let db: Db;
let tmpDir: string;
let projectId: string;
let tasteRequirement: RequirementIR | undefined;
let tasteUncertainty: UncertaintyIR | undefined;
let composedQuery = "";

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-ir-"));
  process.env.TALENTOS_DATABASE_PATH = path.join(tmpDir, "ir.db");
  globalThis.__talentosDb = undefined;
  const { getDb } = await import("@/lib/db/client");
  db = getDb();
  const { createSearchProject, saveJobDescription } =
    await import("@/lib/services/search-projects");
  const { GOLDEN_FIXTURES } = await import("@/lib/db/seed");
  const cais = GOLDEN_FIXTURES[0];
  const project = await createSearchProject(db, {
    name: `IR golden path — ${cais.name}`,
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

describe("CAIS golden path through the canonical IR (mock provider)", () => {
  it("JD → HiringNeedIR + initial HiringIntentIR; 'research taste' becomes an explicit RequirementIR", async () => {
    const { deriveHiringNeed } = await import("@/lib/services/intelligence");
    const { intent } = await deriveHiringNeed(db, projectId);

    expect(intent.need.businessProblem).toBeTruthy();
    expect(intent.need.claims.length).toBeGreaterThan(0);
    expect(intent.need.claims.every((c) => c.provenance === "jd")).toBe(true);
    expect(intent.revision).toBe(0);
    expect(intent.statements).toEqual([]);

    // The vague phrase is now a typed requirement, not an unexplained string.
    tasteRequirement = intent.requirements.find((r) =>
      /research taste/i.test(r.label),
    );
    expect(tasteRequirement).toBeTruthy();
    expect(tasteRequirement?.statement).toMatch(
      /Research taste matters more to us than citation counts/i,
    );
    expect(tasteRequirement?.definition).toBeTruthy();
    expect(tasteRequirement?.definition).not.toBe(tasteRequirement?.statement);
    expect(tasteRequirement?.evidenceSpec.length).toBeGreaterThan(0);
    expect(tasteRequirement?.status).toBe("needs_clarification");

    // ...and it drives an open, consequential uncertainty.
    expect(tasteRequirement?.linkedUncertaintyIds.length).toBeGreaterThan(0);
    tasteUncertainty = intent.uncertainties.find((u) =>
      tasteRequirement?.linkedUncertaintyIds.includes(u.id ?? ""),
    );
    expect(tasteUncertainty?.status).toBe("open");
    expect(tasteUncertainty?.consequential).toBe(true);
    expect(tasteUncertainty?.consequence).toBeTruthy();
  });

  it("domain research is a separate boundary: the people engines never answer it", async () => {
    // The step exists in the pipeline; with no general ResearchProvider
    // wired, the honest state is "unavailable" — recorded as uncertainty,
    // never faked, and never served by the people-only discovery engines.
    const { getResearchProvider } = await import("@/lib/research/provider");
    const research = getResearchProvider();
    expect(research.configured).toBe(false);
    await expect(research.search("ML research labor market")).rejects.toThrow(
      /cannot answer research questions|No general research provider/,
    );
  });

  it("adaptive intake proposes the highest-information question (targets the taste uncertainty)", async () => {
    const { proposeNextQuestion } = await import("@/lib/services/intelligence");
    const { nextQuestion } = await proposeNextQuestion(db, projectId);
    expect(nextQuestion).toBeTruthy();
    expect(nextQuestion?.targetsUncertaintyIds).toContain(tasteUncertainty?.id);
    expect(nextQuestion?.informationValue).toBeTruthy();
  });

  it("capturing the HM's answer verbatim clarifies the requirement and resolves the uncertainty", async () => {
    const { recordManagerStatement } =
      await import("@/lib/services/intelligence");
    const hmAnswer =
      "By research taste I mean they pick problems that matter before the field agrees they matter — look for self-initiated projects that later became benchmarks, not citation counts.";
    const { intent, nextQuestion } = await recordManagerStatement(db, {
      searchProjectId: projectId,
      text: hmAnswer,
      speaker: "hiring_manager",
      context: "Asked the proposed research-taste calibration question.",
    });

    // Verbatim, append-only statement log.
    expect(intent.statements).toHaveLength(1);
    expect(intent.statements[0].text).toBe(hmAnswer);
    expect(intent.revision).toBe(1);

    // The claim was extracted with manager_statement provenance.
    expect(
      intent.need.claims.some(
        (c) => c.provenance === "manager_statement" && c.text === hmAnswer,
      ),
    ).toBe(true);

    // The requirement is now explicit, defined in the HM's terms.
    const clarified = intent.requirements.find((r) =>
      /research taste/i.test(r.label),
    );
    expect(clarified?.status).toBe("explicit");
    expect(clarified?.origin).toBe("manager_statement");
    expect(clarified?.definition).toContain("pick problems that matter");

    // The uncertainty it targeted is resolved with the resolution recorded.
    const resolved = intent.uncertainties.find(
      (u) => u.id === tasteUncertainty?.id,
    );
    expect(resolved?.status).toBe("resolved");
    expect(resolved?.resolution).toBe(hmAnswer);

    // Nothing consequential left open → the loop honestly stops asking.
    expect(nextQuestion).toBeNull();
  });

  it("derives SuccessIR / EvidenceIR / TalentPopulationIR / SearchPlanIR linked to requirement ids", async () => {
    const { deriveSearchPlan, getIntelligence } =
      await import("@/lib/services/intelligence");
    await deriveSearchPlan(db, projectId);
    const row = await getIntelligence(db, projectId);
    const payload = row?.payload;
    expect(payload?.success?.mission).toBeTruthy();
    expect(payload?.evidence?.items.length).toBeGreaterThan(0);
    expect(payload?.population?.segments.length).toBeGreaterThan(0);
    expect(payload?.searchPlan?.queryPlans.length).toBeGreaterThan(0);

    const requirementIds = new Set(
      (payload?.intent.requirements ?? []).map((r) => r.id),
    );
    for (const item of payload?.evidence?.items ?? []) {
      expect(requirementIds.has(item.requirementId)).toBe(true);
    }
    const plan = payload?.searchPlan?.queryPlans[0];
    expect(
      plan?.linkedRequirementIds.every((id) => requirementIds.has(id)),
    ).toBe(true);
    // Supply estimates stay honest — no fabricated market sizing.
    for (const segment of payload?.population?.segments ?? []) {
      expect(["abundant", "adequate", "scarce", "unknown"]).toContain(
        segment.estimatedSupply,
      );
    }
  });

  it("SearchPlanIR → deterministic composer → visible discovery queries", async () => {
    const { composeDiscoveryQueries } =
      await import("@/lib/services/intelligence");
    const planned = await composeDiscoveryQueries(db, projectId);
    expect(planned.length).toBeGreaterThan(0);
    const queries = planned[0].queries;
    expect(queries.length).toBeGreaterThan(0);
    // The composed strings carry the plan's concepts and x-ray targets.
    expect(queries.some((q) => q.query.includes("site:"))).toBe(true);
    expect(queries.some((q) => /"Research Scientist"/.test(q.query))).toBe(
      true,
    );
    composedQuery = queries[0].query;
  });

  it("runs a composed query through TalentXRayCandidateDiscoveryProvider (stubbed transport)", async () => {
    process.env.TALENTOS_GOOGLE_CSE_KEY = "test-key";
    const { createTalentXRayDiscoveryProvider } =
      await import("@/lib/research/talent-xray");
    const provider = createTalentXRayDiscoveryProvider(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            link: "https://scholar.example/profile-a",
            title: "A. Researcher — Google Scholar",
            snippet: "Robustness and evals; first-author NeurIPS.",
          },
          { link: "https://github.example/profile-b", title: "B — GitHub" },
        ],
      }),
    }));
    const results = await provider.search(composedQuery, { engine: "core" });
    expect(results).toHaveLength(2);
    expect(results[0].provider).toBe("talent-xray");
    expect(results[0].providerRank).toBe(1);
    expect(results[1].providerRank).toBe(2);

    // Explicit save closes the loop: snippet lands as UNVERIFIED evidence.
    const { saveDiscoveryResult, listCandidateSourceEvidence } =
      await import("@/lib/services/discovery");
    const { getCandidate } = await import("@/lib/services/candidates");
    const { candidateId } = await saveDiscoveryResult(db, {
      searchProjectId: projectId,
      url: results[0].url,
      title: results[0].title,
      snippet: results[0].snippet,
      provider: results[0].provider,
      engine: results[0].engine,
      query: results[0].query,
      providerRank: results[0].providerRank,
      retrievedAt: results[0].retrievedAt,
      candidateName: "A. Researcher",
    });
    const candidate = await getCandidate(db, candidateId as string);
    expect(candidate?.resumeText ?? null).toBeNull();
    const evidence = await listCandidateSourceEvidence(
      db,
      candidateId as string,
    );
    expect(evidence).toHaveLength(1);
    expect(evidence[0].verificationStatus).toBe("unverified");
    expect(evidence[0].providerRank).toBe(1);
    delete process.env.TALENTOS_GOOGLE_CSE_KEY;
  });
});
