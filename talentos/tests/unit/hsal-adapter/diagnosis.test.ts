import { describe, expect, it } from "vitest";
import {
  generateCandidateTests,
  generateDeterministicModels,
  mergeAIModels,
  rankTests,
  scoreTest,
  strongestModel,
  TEST_SCORE_WEIGHTS,
  type SearchDiagnosisModel,
} from "@talentos/hsal-adapter";
import { sp104 } from "../../../fixtures/sp104";

const facts = {
  project: sp104.searchProject,
  snapshot: sp104.pipelineW6,
  candidates: sp104.candidates,
  hmFeedback: sp104.hmFeedback,
};

describe("deterministic diagnosis rules on SP104", () => {
  const models = generateDeterministicModels(facts);
  const byId = Object.fromEntries(models.map((m) => [m.id, m]));

  it("generates the five competing models", () => {
    expect(Object.keys(byId).sort()).toEqual([
      "M-SP104-COMP",
      "M-SP104-OUTREACH",
      "M-SP104-PROCESS",
      "M-SP104-PROFILE",
      "M-SP104-SUPPLY",
    ]);
    expect(models.every((m) => m.decisionCaseId === "DC-SP104")).toBe(true);
  });

  it("gives Success Profile the strongest support, Supply and Process medium, Outreach/Comp low or medium", () => {
    expect(byId["M-SP104-PROFILE"]?.assessment?.support).toBe("high");
    expect(byId["M-SP104-SUPPLY"]?.assessment?.support).toBe("medium");
    expect(byId["M-SP104-PROCESS"]?.assessment?.support).toBe("medium");
    expect(["low", "medium"]).toContain(
      byId["M-SP104-OUTREACH"]?.assessment?.support,
    );
    expect(["low", "medium"]).toContain(
      byId["M-SP104-COMP"]?.assessment?.support,
    );
    expect(strongestModel(models)?.id).toBe("M-SP104-PROFILE");
  });

  it("links proxy rejections as evidence for the profile model and against supply", () => {
    const profile = byId["M-SP104-PROFILE"]!;
    expect(profile.evidenceForIds).toEqual(
      expect.arrayContaining([
        "E-SP104-C31-4",
        "E-SP104-C44-4",
        "E-SP104-C52-5",
        "E-SP104-C73-4",
        "E-HMF-SP104-C44-R1",
      ]),
    );
    expect(profile.evidenceAgainstIds).toEqual(
      expect.arrayContaining(["E-SP104-C61-4"]),
    );
    expect(
      byId["M-SP104-SUPPLY"]?.evidenceAgainstIds.length,
    ).toBeGreaterThanOrEqual(4);
    expect(byId["M-SP104-COMP"]?.evidenceForIds).toEqual(
      expect.arrayContaining(["E-SP104-C54-3", "E-SP104-C54-4"]),
    );
    expect(profile.predictions[0]?.validationCondition).toMatch(/≥ 50%/);
  });

  it("drops links to evidence HSAL does not know about", () => {
    const filtered = generateDeterministicModels({
      ...facts,
      knownEvidenceIds: new Set(["E-SP104-C31-4"]),
    });
    const profile = filtered.find((m) => m.id === "M-SP104-PROFILE")!;
    expect(profile.evidenceForIds).toEqual(["E-SP104-C31-4"]);
  });

  it("does not claim a profile constraint on a healthy funnel", () => {
    const healthy = {
      ...facts,
      snapshot: {
        ...sp104.pipelineW6,
        counts: {
          ...sp104.pipelineW6.counts,
          hm_screen: 8,
          onsite: 6,
          offer: 3,
          hire: 1,
        },
      },
      candidates: [],
      hmFeedback: [],
    };
    const m = generateDeterministicModels(healthy);
    expect(
      m.find((x) => x.type === "success_profile")?.assessment?.support,
    ).toBe("low");
    expect(
      m.find((x) => x.type === "hiring_process")?.assessment?.support,
    ).toBe("low");
  });
});

describe("best next test ranking", () => {
  const models = generateDeterministicModels(facts);
  const tests = generateCandidateTests("SP104", models);

  it("scores with the configured weights, normalized 0..1", () => {
    expect(
      TEST_SCORE_WEIGHTS.informationGain +
        TEST_SCORE_WEIGHTS.discriminatoryPower +
        TEST_SCORE_WEIGHTS.reversibility +
        TEST_SCORE_WEIGHTS.cost +
        TEST_SCORE_WEIGHTS.executionTime,
    ).toBeCloseTo(1);
    expect(
      scoreTest({
        informationGain: 1,
        discriminatoryPower: 1,
        reversibility: 1,
        cost: 0,
        executionTime: 0,
      }),
    ).toBeCloseTo(1);
    expect(
      scoreTest({
        informationGain: 0,
        discriminatoryPower: 0,
        reversibility: 0,
        cost: 1,
        executionTime: 1,
      }),
    ).toBeCloseTo(0);
  });

  it("recommends TEST-SP104-BLIND for SP104", () => {
    const ranked = rankTests(tests, models);
    expect(ranked[0]?.test.id).toBe("TEST-SP104-BLIND");
    expect(ranked[0]?.test.expectedInformationGain).toBe("high");
    expect(ranked[0]?.test.cost).toBe("low");
    expect(ranked[0]?.test.reversibility).toBe("easy");
    expect(ranked[0]?.test.durationEstimate).toBe("< 1 day");
    expect(ranked[0]?.test.discriminatesBetweenModelIds).toEqual(
      expect.arrayContaining(["M-SP104-PROFILE", "M-SP104-SUPPLY"]),
    );
    expect(ranked[0]!.score).toBeGreaterThan(ranked[1]!.score);
  });

  it("is deterministic and respects custom weights", () => {
    const a = rankTests(tests, models).map((r) => r.test.id);
    const b = rankTests(tests, models).map((r) => r.test.id);
    expect(a).toEqual(b);
    const costOnly = rankTests(tests, models, {
      informationGain: 0,
      discriminatoryPower: 0,
      reversibility: 0,
      cost: 1,
      executionTime: 0,
    });
    expect(costOnly.every((r) => r.score <= 1)).toBe(true);
  });
});

describe("optional AI enhancement merge", () => {
  const deterministic = generateDeterministicModels(facts);
  it("adds and annotates models but never removes deterministic ones, and rejects invalid output", () => {
    const merged = mergeAIModels(
      "SP104",
      deterministic,
      {
        suggestions: [
          {
            modelId: "M-SP104-SUPPLY",
            challenge: "Supply cannot explain rejected strong candidates.",
            missingEvidence: ["Market size estimate"],
          },
          {
            type: "other",
            name: "Employer brand",
            explanation: "Unknown brand suppresses replies.",
            assessment: { support: "low", reasoning: "speculative" },
          },
        ],
      },
      new Set(),
    );
    expect(merged.accepted).toBe(true);
    expect(merged.models.map((m) => m.id)).toEqual(
      expect.arrayContaining(deterministic.map((m) => m.id)),
    );
    expect(merged.models.find((m) => m.id === "M-SP104-AI-1")?.name).toBe(
      "Employer brand",
    );
    expect(
      merged.models
        .find((m) => m.id === "M-SP104-SUPPLY")
        ?.assumptions.some((a) => a.statement.startsWith("AI challenge")),
    ).toBe(true);
    expect(merged.missingEvidence).toEqual(["Market size estimate"]);
    const bad = mergeAIModels(
      "SP104",
      deterministic,
      { suggestions: [{ type: "nonsense" }] },
      new Set(),
    );
    expect(bad.accepted).toBe(false);
    expect(bad.models).toBe(deterministic);
  });
  it("never sets belief confidence (models carry no belief fields)", () => {
    const m: SearchDiagnosisModel = deterministic[0]!;
    expect("confidence" in m).toBe(false);
  });
});
