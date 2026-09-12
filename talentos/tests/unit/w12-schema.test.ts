/**
 * W12 finding F-2 (stakeholder disagreement): RequirementIR must be able to
 * say WHO asserted a requirement and that it is DISPUTED, without
 * overloading `status` — which describes how well a requirement is defined,
 * not whether people agree on it. Pinned so the distinction cannot be lost.
 */
import { describe, expect, it } from "vitest";
import {
  requirementIRSchema,
  intakeReasoningOutputSchema,
} from "@/lib/core/ir";

const base = {
  label: "Fix the close and the control environment",
  statement:
    "the close takes twenty-two days and we've had two material weaknesses",
  definition:
    "Has taken a slow close and a weak control environment and fixed both.",
  kind: "must_have" as const,
  origin: "manager_statement" as const,
  evidenceSpec: ["Close cycle reduced under the person's ownership"],
  falseSignals: ["Controller experience in an already-clean environment"],
  status: "explicit" as const,
  linkedUncertaintyIds: [],
};

describe("RequirementIR authority semantics (W12 F-2)", () => {
  it("records who asserted a requirement and that it is contested", () => {
    const r = requirementIRSchema.parse({
      ...base,
      assertedBy: "board_chair",
      contested: true,
    });
    expect(r.assertedBy).toBe("board_chair");
    expect(r.contested).toBe(true);
    // A contested requirement stays a clearly-defined must-have: disagreement
    // is not vagueness and must not be encoded as needs_clarification.
    expect(r.status).toBe("explicit");
    expect(r.kind).toBe("must_have");
  });

  it("leaves both fields optional, so JD-derived requirements are unaffected", () => {
    const r = requirementIRSchema.parse({ ...base, origin: "jd" });
    expect(r.assertedBy).toBeUndefined();
    expect(r.contested).toBeUndefined();
  });

  it("carries through the reasoner's output contract", () => {
    const out = intakeReasoningOutputSchema.parse({
      extractedClaims: [{ text: "x", provenance: "manager_statement" }],
      requirements: [{ ...base, assertedBy: "ceo", contested: true }],
      uncertainties: [],
      contradictions: [],
      nextQuestion: null,
    });
    expect(out.requirements[0].assertedBy).toBe("ceo");
    expect(out.requirements[0].contested).toBe(true);
  });
});
