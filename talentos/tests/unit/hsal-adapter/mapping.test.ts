import { describe, expect, it } from "vitest";
import {
  candidateEvidenceRequests,
  hmFeedbackEvidenceRequests,
  toDecisionCaseRequest,
  toEvidenceView,
  toHSALStateRequest,
  searchProjectSchema,
  pipelineSnapshotSchema,
} from "@talentos/hsal-adapter";
import { sp104 } from "../../../fixtures/sp104";

describe("SearchProject → DecisionCase", () => {
  it("maps SP104 to DC-SP104 with the specified question and scope", () => {
    const dc = toDecisionCaseRequest(sp104.searchProject);
    expect(dc.id).toBe("DC-SP104");
    expect(dc.title).toBe(
      "Axiom Compute — Distributed Systems Search Diagnosis",
    );
    expect(dc.question).toBe(
      "Why is SP104 underperforming and what should we change next?",
    );
    expect(dc.scopeRef).toBe("talentos:search-project:SP104");
    expect(dc.status).toBe("exploring");
  });
});

describe("PipelineSnapshot → HSAL State", () => {
  it("marks counts observed and derived rates inferred", () => {
    const s = toHSALStateRequest(sp104.searchProject, sp104.pipelineW6);
    expect(s.id).toBe("S-PIPE-SP104-W6");
    expect(s.status).toBe("actual");
    const counts = s.dimensions.filter((d) => d.key.startsWith("count."));
    expect(counts).toHaveLength(9);
    expect(counts.every((d) => d.epistemicStatus === "observed")).toBe(true);
    const rates = s.dimensions.filter((d) => d.key.startsWith("rate."));
    expect(rates.length).toBeGreaterThanOrEqual(4);
    expect(rates.every((d) => d.epistemicStatus === "inferred")).toBe(true);
    expect(s.dimensions.find((d) => d.key === "count.sourced")?.value).toBe(
      124,
    );
    expect(
      s.dimensions.find((d) => d.key === "bottleneck.largest_drop")?.value,
    ).toBe("HM SCREENS → ONSITES");
    expect(s.sourceRefs).toEqual(["talentos:pipeline-snapshot:PIPE-SP104-W6"]);
    expect(s.uncertainty.level).toBe("high");
  });
});

describe("candidate observations → evidence", () => {
  it("creates one evidence per observation with deterministic ids and observed status", () => {
    const c31 = sp104.candidates.find((c) => c.candidateId === "C31")!;
    const reqs = candidateEvidenceRequests(c31);
    expect(reqs).toHaveLength(c31.observations.length);
    expect(reqs[0]?.id).toBe("E-SP104-C31-1");
    expect(
      reqs.every(
        (r) =>
          r.epistemicStatus === "observed" &&
          r.sourceKind === "talentos_candidate" &&
          r.propose === false,
      ),
    ).toBe(true);
    expect(reqs[3]?.sourceRef).toBe(
      "talentos:candidate:C31:obs:4:hm_rejected:CRIT-GO",
    );
    expect(reqs[3]?.content).toContain("CRIT-GO");
  });

  it("does not merge contradictory observations into one record", () => {
    const c54 = sp104.candidates.find((c) => c.candidateId === "C54")!;
    const reqs = candidateEvidenceRequests(c54);
    const contents = reqs.map((r) => r.content);
    expect(contents.some((c) => c.includes("compensation objection"))).toBe(
      true,
    );
    expect(contents.some((c) => c.includes("candidate withdrew"))).toBe(true);
    expect(new Set(reqs.map((r) => r.id)).size).toBe(reqs.length);
  });
});

describe("HM feedback → evidence", () => {
  it("records what the HM said as observed evidence plus one record per structured reason", () => {
    const f = sp104.hmFeedback.find((x) => x.candidateId === "C31")!;
    const reqs = hmFeedbackEvidenceRequests(f);
    expect(reqs).toHaveLength(2);
    expect(reqs[0]?.id).toBe("E-HMF-SP104-C31");
    expect(reqs[0]?.content).toMatch(
      /^HM said on C31 \[reject\]: "Strong systems background/,
    );
    expect(reqs[0]?.epistemicStatus).toBe("observed");
    expect(reqs[0]?.sourceType).toBe("user_statement");
    expect(reqs[1]?.sourceRef).toBe(
      "talentos:hm-feedback:HMF-SP104-C31:C31:reject:CRIT-GO",
    );
  });

  it("projects HSAL evidence back to a TalentOS source type", () => {
    const view = toEvidenceView({
      id: "E-1",
      decisionCaseId: "DC-SP104",
      content: "x",
      sourceType: "user_statement",
      sourceKind: "talentos_hm_feedback",
      sourceRef: "r",
      capturedAt: "2026-09-01T00:00:00.000Z",
      capturedByActorId: "agent:talentos",
      epistemicStatus: "observed",
    });
    expect(view.sourceType).toBe("talentos_hm_feedback");
    expect(view.observedAt).toBe("2026-09-01T00:00:00.000Z");
  });
});

describe("fixture validation", () => {
  it("SP104 fixtures satisfy the contracts", () => {
    expect(searchProjectSchema.safeParse(sp104.searchProject).success).toBe(
      true,
    );
    expect(pipelineSnapshotSchema.safeParse(sp104.pipelineW9).success).toBe(
      true,
    );
    expect(sp104.candidates.map((c) => c.candidateId)).toEqual([
      "C31",
      "C44",
      "C52",
      "C54",
      "C61",
      "C73",
    ]);
    expect(sp104.hmFeedback).toHaveLength(5);
    expect(sp104.belief.confidence).toBe(0.76);
    expect(sp104.revision.newConfidence).toBe(0.31);
    expect(sp104.experimentResult.metrics["advanced"]).toBe(7);
  });
});
