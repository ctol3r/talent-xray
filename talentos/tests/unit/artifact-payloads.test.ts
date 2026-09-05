/**
 * P0-A regression: the provider boundary never mutates what it is given.
 * The HM Intake payload here is DEEPLY FROZEN — the exact condition that
 * produced "Render failed (Cannot add property id, object is not
 * extensible)" — and must normalize, accept an answer, round-trip through
 * JSON (the store), and reach downstream context.
 */
import { describe, expect, it } from "vitest";
import {
  PayloadShapeError,
  deepCopy,
  downgradeVerified,
  normalizeGenerated,
  withIntakeAnswer,
  type IntakePayload,
} from "../../artifact-src/core/payloads";
import { deepFreeze } from "../../artifact-src/core/defect-checks";
import { renderContext } from "../../artifact-src/ai/context";
import { contextFromFacts } from "../../artifact-src/core/search-context";

const frozen: IntakePayload = deepFreeze({
  categories: [
    {
      title: "Why now",
      rationale: "r",
      questions: [
        {
          question: "Why does this role exist now?",
          whyItMatters: "capacity vs capability",
        },
        { question: "Who is the dream hire?", whyItMatters: "sets the bar" },
      ],
    },
  ],
  playback: {
    target: "t",
    hardRequirements: [],
    flexibleRequirements: [],
    idealPhenotype: "i",
    adjacentPhenotypes: [],
    disqualifiers: [],
    unresolvedQuestions: [],
  },
});

describe("P0-A · frozen HM Intake payload", () => {
  it("normalizes to an owned copy with ids, leaving the provider object untouched", () => {
    const out = normalizeGenerated("intake", frozen);
    expect(out).not.toBe(frozen);
    expect(Object.isFrozen(out)).toBe(false);
    expect(out.categories[0].questions[0].id).toMatch(/[0-9a-f-]{8,}/);
    expect("id" in frozen.categories[0].questions[0]).toBe(false);
  });

  it("accepts an answer immutably and survives a JSON round trip", () => {
    const out = normalizeGenerated("intake", frozen);
    const qid = out.categories[0].questions[0].id!;
    const answered = withIntakeAnswer(
      out,
      qid,
      "Capability-driven.",
      "2026-09-04T00:00:00Z",
    );
    expect(out.categories[0].questions[0].answer).toBeUndefined();
    expect(answered.categories[0].questions[0].answer).toBe(
      "Capability-driven.",
    );
    const reloaded = normalizeGenerated(
      "intake",
      JSON.parse(JSON.stringify(answered)),
    );
    expect(reloaded.categories[0].questions[0].answer).toBe(
      "Capability-driven.",
    );
    expect(reloaded.categories[0].questions[0].id).toBe(qid);
  });

  it("reaches downstream context as a human statement — even when an IR exists", () => {
    const out = normalizeGenerated("intake", frozen);
    const answered = withIntakeAnswer(
      out,
      out.categories[0].questions[0].id!,
      "Capability-driven.",
      "2026-09-04T00:00:00Z",
    );
    const ctx = contextFromFacts(
      { id: "s", roleTitle: "Nurse", jd: "JD text" },
      [],
      "2026-09-04T00:00:00Z",
    );
    const text = renderContext({
      ctx,
      artifacts: {
        intake: {
          payload: answered,
          meta: { provider: "x", generatedAt: "" },
          traitWarnings: [],
        },
      },
      intent: {
        need: {
          businessProblem: "",
          roleSummary: "",
          claims: [],
          unknowns: [],
        },
        requirements: [],
        uncertainties: [],
        contradictions: [],
        statements: [],
        revision: 0,
      },
      nowIso: "2026-09-04T00:00:00Z",
    });
    expect(text).toContain("Hiring-manager intake answers");
    expect(text).toContain("A: Capability-driven.");
    expect(text).toContain("SOURCE OF TRUTH");
  });

  it("rejects a payload that misses required fields with a shape error, not a crash", () => {
    expect(() => normalizeGenerated("intake", { categories: "nope" })).toThrow(
      PayloadShapeError,
    );
  });
});

describe("downgradeVerified is pure", () => {
  it("returns a new tree and counts downgrades; the frozen source is untouched", () => {
    const src = deepFreeze({
      sections: [
        {
          claims: [
            { text: "x", certainty: "verified" },
            { text: "y", certainty: "estimated" },
          ],
        },
      ],
    });
    const { value, downgrades } = downgradeVerified(src);
    expect(downgrades).toBe(1);
    expect(value.sections[0].claims[0].certainty).toBe("inferred");
    expect(value.sections[0].claims[0]).toHaveProperty("note");
    expect(src.sections[0].claims[0].certainty).toBe("verified");
  });
  it("deepCopy strips freezing", () => {
    const copy = deepCopy(frozen);
    expect(Object.isFrozen(copy.categories[0])).toBe(false);
  });
});
