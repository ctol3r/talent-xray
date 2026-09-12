/**
 * The universal output contract (spec §9): exactly eight A–H next steps,
 * every one actionable and resolvable; unsafe actions gated on a human
 * confirmation; metrics that always carry a denominator; and claims that
 * cannot call themselves source-backed with no source.
 */
import { describe, expect, it } from "vitest";
import {
  ACTION_TYPES,
  NEXT_STEP_LABELS,
  guardClaims,
  metricResultSchema,
  outputEnvelopeSchema,
  rateMetric,
  requiresConfirmation,
  validateEnvelope,
  validateNextSteps,
  type SuggestedNextStep,
} from "../../artifact-src/core/envelope";
import type { ResearchClaim } from "../../artifact-src/core/research";

const NOW = "2026-09-04T00:00:00.000Z";
const RESOLVABLE = new Set(["overview", "market_intelligence", "cand-1"]);

const steps = (over: Partial<SuggestedNextStep>[] = []): SuggestedNextStep[] =>
  NEXT_STEP_LABELS.map((label, i) => ({
    label,
    title: `Open the ${["overview", "canonical need", "intake loop", "success profile", "market intel", "strategy", "channels", "search strings"][i]} module`,
    description: "",
    actionType: "navigate_module" as const,
    targetId: "overview",
    ...(over[i] ?? {}),
  }));

const envelope = (over: Record<string, unknown> = {}) => ({
  id: "env-1",
  searchId: "s1",
  searchVersion: "v1",
  moduleType: "market_intelligence",
  generatedAt: NOW,
  researchStatus: "blocked",
  headline: "Supply is tighter than the brief assumes",
  executiveSummary:
    "Three of five must-haves cut the pool below the shortlist target.",
  content: {},
  suggestedNextSteps: steps(),
  ...over,
});

describe("A–H next steps", () => {
  it("accepts exactly eight, one per label", () => {
    expect(validateNextSteps(steps(), { resolvableIds: RESOLVABLE })).toEqual(
      [],
    );
  });

  it("rejects seven, nine, and a duplicated label", () => {
    const seven = validateNextSteps(steps().slice(0, 7), {
      resolvableIds: RESOLVABLE,
    });
    expect(seven.some((i) => i.code === "missing_label")).toBe(true);
    expect(seven.some((i) => i.code === "labels")).toBe(true);

    const nine = validateNextSteps(
      [...steps(), { ...steps()[0], title: "Open the overview module again" }],
      { resolvableIds: RESOLVABLE },
    );
    expect(nine.some((i) => i.code === "duplicate_label")).toBe(true);

    const dup = steps();
    dup[1] = { ...dup[1], label: "A" };
    expect(
      validateNextSteps(dup, { resolvableIds: RESOLVABLE }).some(
        (i) => i.code === "duplicate_label",
      ),
    ).toBe(true);
  });

  it("rejects generic filler used to reach eight", () => {
    const filler = steps([{}, { title: "Consider options" }]);
    const issues = validateNextSteps(filler, { resolvableIds: RESOLVABLE });
    expect(issues.some((i) => i.code === "filler")).toBe(true);
  });

  it("rejects a step pointing at something that does not exist", () => {
    const bad = steps([{ targetId: "module_that_is_not_there" }]);
    const issues = validateNextSteps(bad, { resolvableIds: RESOLVABLE });
    expect(issues.some((i) => i.code === "unresolvable_target")).toBe(true);
  });

  it("rejects an action type that does not relate to this output", () => {
    const bad = steps([{ actionType: "approve_pivot", targetId: undefined }]);
    const issues = validateNextSteps(bad, {
      resolvableIds: RESOLVABLE,
      allowedActions: new Set(["navigate_module", "generate_module"]),
    });
    expect(issues.some((i) => i.code === "not_actionable")).toBe(true);
  });

  it("allows at most two recommended steps", () => {
    const three = steps([
      { recommended: true },
      { recommended: true },
      { recommended: true },
    ]);
    expect(
      validateNextSteps(three, { resolvableIds: RESOLVABLE }).some(
        (i) => i.code === "too_many_recommended",
      ),
    ).toBe(true);
    const two = steps([{ recommended: true }, { recommended: true }]);
    expect(validateNextSteps(two, { resolvableIds: RESOLVABLE })).toEqual([]);
  });
});

describe("nothing sends automatically", () => {
  it("every outward or decisive action requires a human confirmation", () => {
    for (const type of [
      "send_outreach",
      "external_communication",
      "advance_stage",
      "record_decision",
      "approve_pivot",
      "reject_pivot",
    ] as const) {
      expect(ACTION_TYPES[type].confirm).toBe(true);
      expect(requiresConfirmation({ actionType: type })).toBe(true);
    }
    expect(requiresConfirmation({ actionType: "navigate_module" })).toBe(false);
  });
});

describe("envelope validation", () => {
  it("passes a well-formed envelope", () => {
    const res = validateEnvelope(envelope(), { resolvableIds: RESOLVABLE });
    expect(res.issues).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.envelope?.moduleType).toBe("market_intelligence");
  });

  it("refuses 'current' with no research snapshot attached", () => {
    const res = validateEnvelope(envelope({ researchStatus: "current" }), {
      resolvableIds: RESOLVABLE,
    });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "research_currency")).toBe(true);
    const withSnapshot = validateEnvelope(
      envelope({ researchStatus: "current", researchSnapshotId: "rs-1" }),
      { resolvableIds: RESOLVABLE },
    );
    expect(withSnapshot.ok).toBe(true);
  });

  it("refuses a fact that claims a source it does not cite", () => {
    const res = validateEnvelope(
      envelope({
        facts: [
          {
            id: "f1",
            text: "Median pay is £41,000.",
            kind: "source_fact",
            evidenceState: "source_backed",
            sourceIds: [],
            limitations: [],
            contradictions: [],
          },
        ],
      }),
      { resolvableIds: RESOLVABLE },
    );
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.message.includes("cites no source"))).toBe(
      true,
    );
  });

  it("reports schema problems instead of throwing", () => {
    const res = validateEnvelope({ id: "x" }, { resolvableIds: RESOLVABLE });
    expect(res.ok).toBe(false);
    expect(res.issues.every((i) => i.code === "schema")).toBe(true);
    expect(res.envelope).toBeUndefined();
  });

  it("defaults every optional section so a minimal envelope still parses", () => {
    const parsed = outputEnvelopeSchema.parse(envelope());
    expect(parsed.facts).toEqual([]);
    expect(parsed.actionItems).toEqual([]);
    expect(parsed.pivotProposals).toEqual([]);
  });
});

describe("metrics carry their denominator", () => {
  it("a measured metric with no denominator is rejected", () => {
    const bad = metricResultSchema.safeParse({
      id: "m",
      label: "Reply rate",
      formula: "replies ÷ contacted",
      value: 0.5,
      status: "measured",
      asOf: NOW,
    });
    expect(bad.success).toBe(false);
  });

  it("0 of 0 is not-enough-data, never zero percent", () => {
    const zero = rateMetric({
      id: "r",
      label: "Reply rate",
      formula: "replies ÷ contacted",
      numerator: 0,
      denominator: 0,
      asOf: NOW,
    });
    expect(zero.status).toBe("not_enough_data");
    expect(zero.value).toBeNull();
  });

  it("0 of 12 is a real zero", () => {
    const real = rateMetric({
      id: "r",
      label: "Reply rate",
      formula: "replies ÷ contacted",
      numerator: 0,
      denominator: 12,
      asOf: NOW,
    });
    expect(real.status).toBe("measured");
    expect(real.value).toBe(0);
  });

  it("respects a minimum sample size", () => {
    const small = rateMetric({
      id: "r",
      label: "Reply rate",
      formula: "replies ÷ contacted",
      numerator: 1,
      denominator: 3,
      minimumSample: 10,
      asOf: NOW,
    });
    expect(small.status).toBe("not_enough_data");
    expect(small.minimumSample).toBe(10);
  });
});

describe("claim guard", () => {
  const claim = (over: Partial<ResearchClaim>): ResearchClaim => ({
    id: "c",
    text: "t",
    kind: "source_fact",
    evidenceState: "source_backed",
    sourceIds: [],
    limitations: [],
    contradictions: [],
    ...over,
  });

  it("relabels an unsourced fact as a model inference and says why", () => {
    const { claims, relabelled } = guardClaims([claim({})]);
    expect(relabelled).toBe(1);
    expect(claims[0].kind).toBe("model_inference");
    expect(claims[0].evidenceState).toBe("self_attested");
    expect(claims[0].limitations.join(" ")).toContain(
      "without a supporting source",
    );
  });

  it("downgrades a 'checked' claim with no source but leaves a sourced one alone", () => {
    const { claims, relabelled } = guardClaims([
      claim({ kind: "estimate", evidenceState: "checked" }),
      claim({ id: "ok", sourceIds: ["src1"] }),
    ]);
    expect(relabelled).toBe(1);
    expect(claims[0].evidenceState).toBe("self_attested");
    expect(claims[1].kind).toBe("source_fact");
    expect(claims[1].evidenceState).toBe("source_backed");
  });
});
