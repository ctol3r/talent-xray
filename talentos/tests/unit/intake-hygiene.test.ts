/**
 * Deterministic backstops behind the intake reasoner's own rules, from the
 * W12 full-corpus taxonomy (eval/w12/REPORT.md §12.1). Each case is drawn
 * from a conversation that actually failed: g-04/i-01 (S-2), j-04/x-02
 * (S-3), j-05/x-01/g-01 (S-4).
 */
import { describe, expect, it } from "vitest";
import type {
  ManagerStatement,
  RequirementIR,
  UncertaintyIR,
} from "@/lib/core/ir";
import {
  applyIntakeHygiene,
  dropWithdrawnRequirements,
  keepMarketComparisonsOpen,
  reconcileRequirementOrigins,
} from "@/lib/domain/intake-hygiene";

const JD =
  "Executive Chef — The Larkspur Lodge, Telluride. Manage a brigade of 22. Oversee banquets and in-room dining.";

const statement = (
  text: string,
  speaker = "hiring_manager",
): ManagerStatement =>
  ({
    id: `s-${text.slice(0, 8)}`,
    at: "2026-09-02T00:00:00Z",
    speaker,
    text,
  }) as ManagerStatement;

const requirement = (over: Partial<RequirementIR>): RequirementIR => ({
  label: "Manage a brigade of 22",
  statement: "Manage a brigade of 22.",
  definition: "Runs the kitchen's line.",
  kind: "must_have",
  origin: "jd",
  evidenceSpec: [],
  falseSignals: [],
  status: "explicit",
  linkedUncertaintyIds: [],
  ...over,
});

const uncertainty = (over: Partial<UncertaintyIR>): UncertaintyIR => ({
  id: "unc-rate",
  about: "The rate, and how it compares with the Northern Virginia market",
  kind: "missing_information",
  consequence: "Outreach cannot be priced honestly.",
  consequential: true,
  status: "open",
  ...over,
});

describe("S-2 · requirement origin follows the statement", () => {
  const restated = statement(
    "A brigade of twenty-two here is really two brigades, restaurant and banquet, and the person needs to have run both at once.",
  );

  it("flips a JD origin whose statement is now the manager's words", () => {
    const [out] = reconcileRequirementOrigins(
      [requirement({ statement: restated.text })],
      JD,
      [restated],
    );
    expect(out.origin).toBe("manager_statement");
    expect(out.assertedBy).toBe("hiring_manager");
  });

  it("credits the speaker who actually said it", () => {
    const board = statement(
      "Manage a brigade of 22, and both services.",
      "board_president",
    );
    const [out] = reconcileRequirementOrigins(
      [requirement({ statement: board.text })],
      JD,
      [restated, board],
    );
    expect(out.assertedBy).toBe("board_president");
  });

  it("leaves a genuinely JD-sourced requirement alone", () => {
    const [out] = reconcileRequirementOrigins([requirement({})], JD, [
      restated,
    ]);
    expect(out.origin).toBe("jd");
    expect(out.assertedBy).toBeUndefined();
  });

  it("leaves a statement that matches no source alone, rather than guessing", () => {
    const [out] = reconcileRequirementOrigins(
      [
        requirement({
          statement: "Something nobody in this search ever said.",
        }),
      ],
      JD,
      [restated],
    );
    expect(out.origin).toBe("jd");
  });
});

describe("S-4 · withdrawn requirements are removed, not demoted", () => {
  it("drops a requirement the reasoner kept as preferred and labelled withdrawn", () => {
    const out = dropWithdrawnRequirements([
      requirement({ label: "BSEE (withdrawn)", kind: "preferred" }),
      requirement({ label: "Native speaker (withdrawn)", kind: "preferred" }),
      requirement({
        label: "Detail-oriented (filler, withdrawn)",
        kind: "preferred",
      }),
      requirement({ label: "Virginia journeyman electrician license" }),
    ]);
    expect(out.map((r) => r.label)).toEqual([
      "Virginia journeyman electrician license",
    ]);
  });

  it("does not drop a live requirement that merely discusses a withdrawal", () => {
    const out = dropWithdrawnRequirements([
      requirement({
        label: "Texas Licensed Court Interpreter (Master level)",
        definition:
          "The examined competence the withdrawn 'native speaker' line was gesturing at.",
      }),
    ]);
    expect(out).toHaveLength(1);
  });
});

describe("S-3 · market comparisons cannot be closed from inside the company", () => {
  it("reverts a comparison resolved by the manager stating their own number", () => {
    const [out] = keepMarketComparisonsOpen(
      [uncertainty({ status: "resolved", resolution: "Forty-two an hour." })],
      [uncertainty({})],
    );
    expect(out.status).toBe("open");
    expect(out.resolution).toBeUndefined();
    // The manager's answer is kept — it is one side of the comparison.
    expect(out.consequence).toContain("Forty-two an hour.");
  });

  it("leaves an ordinary uncertainty resolved", () => {
    const plain = uncertainty({
      id: "unc-shift",
      about: "Whether the post is nights or a rotating pattern",
      status: "resolved",
      resolution: "Nights, fixed.",
    });
    const [out] = keepMarketComparisonsOpen(
      [plain],
      [{ ...plain, status: "open", resolution: undefined }],
    );
    expect(out.status).toBe("resolved");
  });

  it("leaves one that was already resolved before this turn alone", () => {
    const resolved = uncertainty({
      status: "resolved",
      resolution: "Benchmarked last quarter.",
    });
    const [out] = keepMarketComparisonsOpen([resolved], [resolved]);
    expect(out.status).toBe("resolved");
  });
});

describe("applyIntakeHygiene", () => {
  it("applies all three backstops to one turn", () => {
    const said = statement("BSEE — no. Take it off. The rate is forty-two.");
    const out = applyIntakeHygiene(
      {
        requirements: [
          requirement({ label: "BSEE (withdrawn)", kind: "preferred" }),
          requirement({ statement: said.text }),
        ],
        uncertainties: [
          uncertainty({ status: "resolved", resolution: "Forty-two an hour." }),
        ],
      },
      { uncertainties: [uncertainty({})] },
      JD,
      [said],
    );
    expect(out.requirements).toHaveLength(1);
    expect(out.requirements[0].origin).toBe("manager_statement");
    expect(out.uncertainties[0].status).toBe("open");
  });
});
