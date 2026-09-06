/**
 * Critical integration tests A–J from the TalentOS × HSAL brief, executed
 * against a real HSAL gateway + SQLite through @hsal/sdk.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTalentOSHSALAdapter,
  HSALClient,
  InMemoryBindingStore,
  InMemoryLearningStore,
  type SearchDiagnosisResult,
  type TalentOSHSALAdapter,
} from "@talentos/hsal-adapter";
import {
  sp104,
  sp104Learning,
  SP104_RECRUITER,
  Sp104FixtureSource,
} from "../../fixtures/sp104";
import { startHSAL, type RunningHSAL } from "../../scripts/lib/hsal-gateway";

let hsal: RunningHSAL;
let client: HSALClient;
let adapter: TalentOSHSALAdapter;
const source = new Sp104FixtureSource();
let diagnosis: SearchDiagnosisResult;

beforeAll(async () => {
  hsal = await startHSAL();
  client = new HSALClient({ baseUrl: hsal.url, token: hsal.token });
  adapter = createTalentOSHSALAdapter({
    client,
    domain: source,
    bindings: new InMemoryBindingStore(),
    learnings: new InMemoryLearningStore(),
  });
});
afterAll(async () => {
  await hsal?.stop();
});

describe("SP104 diagnosis loop", () => {
  it("Test A: SP104 initializes → DC-SP104 exists and binding is idempotent", async () => {
    const b1 = await adapter.initializeSearchCase(sp104.searchProject);
    const b2 = await adapter.initializeSearchCase(sp104.searchProject);
    expect(b1.hsalDecisionCaseId).toBe("DC-SP104");
    expect(b2).toEqual(b1);
    const dc = await client.getDecisionCase("DC-SP104");
    expect(dc.scopeRef).toBe("talentos:search-project:SP104");
    expect(dc.question).toBe(
      "Why is SP104 underperforming and what should we change next?",
    );
  });

  it("Test B: baseline pipeline creates an observed State", async () => {
    const st = await adapter.syncPipelineState(
      sp104.searchProject,
      sp104.pipelineW6,
    );
    expect(st.id).toBe("S-PIPE-SP104-W6");
    expect(st.status).toBe("actual");
    expect(st.dimensions.find((d) => d.key === "count.sourced")).toMatchObject({
      value: 124,
      epistemicStatus: "observed",
    });
    expect(
      st.dimensions.find((d) => d.key === "rate.hmToOnsiteRate"),
    ).toMatchObject({ value: 0.25, epistemicStatus: "inferred" });
    const again = await adapter.syncPipelineState(
      sp104.searchProject,
      sp104.pipelineW6,
    );
    expect(again.id).toBe(st.id);
  });

  it("captures the recruiter belief at 0.76 (idempotent)", async () => {
    const b = await adapter.captureRecruiterBelief(sp104.belief);
    expect(b.id).toBe("B-SP104-SUPPLY");
    expect(b.confidence).toBe(0.76);
    expect(b.holderActorId).toBe(SP104_RECRUITER);
    const again = await adapter.captureRecruiterBelief({
      ...sp104.belief,
      confidence: 0.1,
    });
    expect(again.confidence).toBe(0.76);
  });

  it("ingests candidate and HM evidence as separate observed records", async () => {
    let n = 0;
    for (const c of sp104.candidates)
      n += (await adapter.ingestCandidateEvidence(c)).length;
    expect(n).toBe(
      sp104.candidates.reduce((a, c) => a + c.observations.length, 0),
    );
    let h = 0;
    for (const f of sp104.hmFeedback)
      h += (await adapter.ingestHMFeedback(f)).length;
    expect(h).toBe(9);
    const ctx = await client.getDecisionCaseContext("DC-SP104");
    expect(ctx.evidence.length).toBe(n + h);
    expect(ctx.evidence.every((e) => e.epistemicStatus === "observed")).toBe(
      true,
    );
    expect(
      ctx.evidence.find((e) => e.id === "E-HMF-SP104-C44")?.content,
    ).toContain("HM said on C44 [reject]");
  });

  it("Test C + D + E: diagnosis generates competing models, PROFILE strongest, BLIND recommended; belief still 0.76", async () => {
    diagnosis = await adapter.diagnoseSearch("SP104");
    expect(diagnosis.decisionCaseId).toBe("DC-SP104");
    expect(diagnosis.models.length).toBeGreaterThanOrEqual(4);
    const support = Object.fromEntries(
      diagnosis.models.map((m) => [m.id, m.assessment?.support]),
    );
    expect(support["M-SP104-PROFILE"]).toBe("high");
    expect(support["M-SP104-SUPPLY"]).toBe("medium");
    expect(support["M-SP104-PROCESS"]).toBe("medium");
    expect(diagnosis.strongestModelId).toBe("M-SP104-PROFILE");
    expect(diagnosis.recommendedNextTest?.id).toBe("TEST-SP104-BLIND");
    expect(diagnosis.recommendedNextTest?.intervention.status).toBe("proposed");
    expect(diagnosis.largestDrop?.label).toBe("HM SCREENS → ONSITES");
    // stored in HSAL
    const models = await client.listModels("DC-SP104");
    expect(
      models.find((m) => m.id === "M-SP104-PROFILE")?.evidenceForIds.length,
    ).toBeGreaterThanOrEqual(5);
    // Test C: belief unchanged by model generation
    expect((await client.getBelief("B-SP104-SUPPLY")).confidence).toBe(0.76);
    // re-running is idempotent for objects and still leaves belief alone
    const again = await adapter.diagnoseSearch("SP104");
    expect(again.recommendedNextTest?.id).toBe("TEST-SP104-BLIND");
    expect((await client.listModels("DC-SP104")).length).toBe(models.length);
    expect((await client.getBelief("B-SP104-SUPPLY")).confidence).toBe(0.76);
  });

  it("human selects the intervention; status becomes selected; nothing executes", async () => {
    await expect(
      adapter.selectIntervention("TEST-SP104-BLIND", "agent:talentos"),
    ).rejects.toThrow(/human/);
    const sel = await adapter.selectIntervention(
      "TEST-SP104-BLIND",
      SP104_RECRUITER,
    );
    expect(sel.status).toBe("selected");
    expect(sel.selectedByActorId).toBe(SP104_RECRUITER);
    const events = await client.listEvents({ objectId: "TEST-SP104-BLIND" });
    expect(events.map((e) => e.type)).toContain("intervention.selected");
    expect((await client.getBelief("B-SP104-SUPPLY")).confidence).toBe(0.76);
  });

  it("Test F + G: 7/10 experiment result creates evidence, strengthens the profile model; belief still 0.76", async () => {
    const ev = await adapter.ingestExperimentResult(sp104.experimentResult);
    expect(ev).toHaveLength(4);
    expect(ev[0]?.sourceType).toBe("experiment");
    expect(ev[0]?.content).toContain("7 of 10");
    const profile = await client.getModel("M-SP104-PROFILE");
    expect(profile.status).toBe("strengthened");
    expect(profile.predictions[0]).toMatchObject({
      resolved: true,
      outcome: true,
    });
    const supply = await client.getModel("M-SP104-SUPPLY");
    expect(supply.status).toBe("weakened");
    expect((await client.getBelief("B-SP104-SUPPLY")).confidence).toBe(0.76);
    const types = (await client.listEvents({ limit: 500 })).map((e) => e.type);
    expect(types).toContain("experiment.result.ingested");
    expect(types).not.toContain("belief.confidence_changed");
  });

  it("Test H: explicit human revision 0.76 → 0.31 with a revision event; stale writes rejected; new belief at 0.82", async () => {
    await expect(
      adapter.reviseBelief({
        ...sp104.revision,
        previousConfidence: 0.5,
        evidenceIds: [],
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      adapter.reviseBelief({
        ...sp104.revision,
        evidenceIds: [],
        actorId: "agent:talentos",
      }),
    ).rejects.toThrow(/human/);
    const evidenceIds = ["E-EXP-SP104-BLIND-1-1", "E-EXP-SP104-BLIND-1-2"];
    const rev = await adapter.reviseBelief({
      beliefId: sp104.revision.beliefId,
      previousConfidence: 0.76,
      newConfidence: 0.31,
      reason: sp104.revision.reason,
      evidenceIds,
      actorId: SP104_RECRUITER,
    });
    expect(rev).toMatchObject({
      previousConfidence: 0.76,
      newConfidence: 0.31,
      actorId: SP104_RECRUITER,
      viaActorId: "agent:talentos",
    });
    expect((await client.getBelief("B-SP104-SUPPLY")).confidence).toBe(0.31);
    const ev = await client.listEvents({
      objectId: "B-SP104-SUPPLY",
      type: "belief.confidence_changed",
    });
    expect(ev).toHaveLength(1);
    expect(ev[0]?.metadata).toMatchObject({
      from: 0.76,
      to: 0.31,
      revisionId: rev.id,
    });
    const profileBelief = await adapter.captureRecruiterBelief(
      sp104.revision.newBelief,
    );
    expect(profileBelief.id).toBe("B-SP104-PROFILE");
    expect(profileBelief.confidence).toBe(0.82);
  });

  it("records the human success-profile change and Test I: post-intervention state creates a Trajectory", async () => {
    const change = await adapter.recordSuccessProfileChange(
      "SP104",
      sp104.searchProject.successProfile,
      sp104.successProfileAfter,
      SP104_RECRUITER,
      "TEST-SP104-BLIND",
    );
    expect(change.epistemicStatus).toBe("user_asserted");
    expect(change.content).toContain("Professional Go experience");
    source.snapshotPhase = "w9";
    source.profilePhase = "after";
    const tr = await adapter.recordPostInterventionState(
      sp104.searchProject,
      sp104.pipelineW9,
      "TEST-SP104-BLIND",
    );
    expect(tr.id).toBe("TR-TEST-SP104-BLIND");
    expect(tr.originStateId).toBe("S-PIPE-SP104-W6");
    expect(tr.stateIds).toEqual(["S-PIPE-SP104-W9"]);
    expect(tr.interventionIds).toEqual(["TEST-SP104-BLIND"]);
    expect(tr.outcomes.find((o) => o.key === "count.onsite")).toMatchObject({
      before: 1,
      after: 5,
    });
    expect(tr.outcomes.find((o) => o.key === "count.hire")).toMatchObject({
      before: 0,
      after: 1,
    });
    expect(
      tr.outcomes.find((o) => o.key === "rate.hmToOnsiteRate")?.interpretation,
    ).toMatch(/25\.0% → 62\.5%/);
  });

  it("Test J: Search Learning persists and references source belief/model/evidence ids", async () => {
    const learning = await adapter.createSearchLearning(
      sp104Learning({
        evidenceIds: ["E-EXP-SP104-BLIND-1-1", "E-EXP-SP104-BLIND-1-2"],
        originatingBeliefIds: ["B-SP104-SUPPLY", "B-SP104-PROFILE"],
        originatingModelIds: ["M-SP104-PROFILE"],
      }),
    );
    expect(learning.id).toBe("LEARN-SP104-001");
    const found = await adapter.findRelevantSearchLearnings({
      roleFamily: "distributed systems",
      seniority: "staff",
    });
    expect(found[0]?.id).toBe("LEARN-SP104-001");
    expect(found[0]?.originatingBeliefIds).toContain("B-SP104-SUPPLY");
    expect(found[0]?.originatingModelIds).toContain("M-SP104-PROFILE");
    const ev = await client.listEvents({ objectId: "LEARN-SP104-001" });
    expect(ev[0]?.type).toBe("search_learning.created");
  });

  it("every epistemically meaningful change is auditable in one log", async () => {
    const types = new Set(
      (await client.listEvents({ limit: 1000 })).map((e) => e.type),
    );
    for (const t of [
      "talentos.search_case.bound",
      "pipeline.state.ingested",
      "belief.created",
      "candidate.evidence.ingested",
      "hm_feedback.evidence.ingested",
      "diagnosis.models.generated",
      "model.proposed",
      "intervention.proposed",
      "intervention.selected",
      "experiment.result.ingested",
      "belief.confidence_changed",
      "talentos.success_profile.changed",
      "trajectory.created",
      "search_learning.created",
    ]) {
      expect(types, t).toContain(t);
    }
  });
});
