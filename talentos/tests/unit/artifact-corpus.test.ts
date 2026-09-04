/**
 * W18: the artifact scores its own prompts with the harness's OWN
 * checkers. This file tests the parts that need no model: that the
 * fixtures parse, that the checkers really are the imported ones, and
 * that the report cannot flatter the run.
 */
import { describe, expect, it } from "vitest";
import {
  CORPUS_FIXTURES,
  FIXTURE_IDS,
  ZERO_TARGET_METRICS,
  checkTurn,
  metricRate,
  projectFacts,
  scoreCorpusRun,
  type CorpusTurnOutcome,
} from "../../artifact-src/core/corpus";
import { checkTurn as harnessCheckTurn } from "../../eval/w12/checks";

const NOW = "2026-09-04T00:00:00.000Z";

const outcome = (over: Partial<CorpusTurnOutcome> = {}): CorpusTurnOutcome => ({
  conversationId: "a-01",
  turnIndex: 0,
  label: "Turn 1",
  executed: true,
  notExecutedReason: "",
  findings: [],
  tally: {},
  ...over,
});

describe("the fixtures", () => {
  it("are real corpus conversations, parsed by the harness's own schema", () => {
    expect(CORPUS_FIXTURES).toHaveLength(FIXTURE_IDS.length);
    expect(CORPUS_FIXTURES.map((c) => c.id)).toEqual([...FIXTURE_IDS]);
    for (const c of CORPUS_FIXTURES) {
      expect(c.turns.length).toBeGreaterThanOrEqual(2);
      expect(c.jd.length).toBeGreaterThan(100);
      expect(c.initial.requirements.length).toBeGreaterThan(0);
      expect(c.categories.length).toBeGreaterThan(0);
    }
  });

  it("spread across occupations rather than stacking one fixture's quirks", () => {
    expect(
      new Set(CORPUS_FIXTURES.map((c) => c.occupation)).size,
    ).toBeGreaterThan(2);
  });

  it("renders the same project facts block the harness feeds a fixture", () => {
    const facts = projectFacts(CORPUS_FIXTURES[0]);
    expect(facts).toContain("Role title:");
    expect(facts).toContain(CORPUS_FIXTURES[0].project.roleTitle);
  });

  it("uses the harness's checker itself — not a copy that could drift", () => {
    expect(checkTurn).toBe(harnessCheckTurn);
  });
});

describe("the report cannot flatter the run", () => {
  it("a run where nothing executed is FAIL, never a vacuous PASS", () => {
    const report = scoreCorpusRun(
      [outcome({ executed: false, notExecutedReason: "rate_limited" })],
      NOW,
    );
    expect(report.verdict).toBe("FAIL");
    expect(report.executed).toBe(0);
    expect(report.notExecuted).toBe(1);
  });

  it("any zero-target violation is FAIL whatever else passed", () => {
    const report = scoreCorpusRun(
      [
        outcome({
          tally: {
            provenance_preservation: { pass: 40, total: 40 },
            fabrication: { pass: 0, total: 1 },
          },
        }),
      ],
      NOW,
    );
    expect(report.verdict).toBe("FAIL");
    expect(report.zeroTargetViolations).toEqual([
      { metric: "fabrication", count: 1 },
    ]);
  });

  it("a clean but incomplete run is PARTIAL, not PASS", () => {
    const report = scoreCorpusRun(
      [
        outcome({ tally: { requirement_recall: { pass: 3, total: 3 } } }),
        outcome({
          turnIndex: 1,
          executed: false,
          notExecutedReason: "refused",
        }),
      ],
      NOW,
    );
    expect(report.verdict).toBe("PARTIAL");
  });

  it("PASS needs every turn executed and every zero-target metric clean", () => {
    const report = scoreCorpusRun(
      [
        outcome({
          tally: {
            requirement_recall: { pass: 3, total: 3 },
            fabrication: { pass: 2, total: 2 },
          },
        }),
      ],
      NOW,
    );
    expect(report.verdict).toBe("PASS");
    expect(report.zeroTargetViolations).toEqual([]);
  });

  it("sums tallies only across turns that actually ran", () => {
    const report = scoreCorpusRun(
      [
        outcome({ tally: { requirement_recall: { pass: 2, total: 3 } } }),
        outcome({
          turnIndex: 1,
          tally: { requirement_recall: { pass: 1, total: 2 } },
        }),
        outcome({
          turnIndex: 2,
          executed: false,
          notExecutedReason: "stopped",
          tally: { requirement_recall: { pass: 99, total: 99 } },
        }),
      ],
      NOW,
    );
    expect(metricRate(report.tally, "requirement_recall")).toEqual({
      pass: 3,
      total: 5,
      rate: 3 / 5,
    });
  });

  it("distinguishes a metric that was never exercised from one that scored zero", () => {
    const report = scoreCorpusRun([outcome()], NOW);
    expect(metricRate(report.tally, "false_signal_recall")).toEqual({
      pass: 0,
      total: 0,
      rate: null,
    });
  });

  it("carries a caveat naming the sample size and what is still unmeasured", () => {
    const report = scoreCorpusRun([outcome(), outcome({ turnIndex: 1 })], NOW);
    expect(report.caveat).toContain("2 turns");
    expect(report.caveat).toContain("53 conversations");
    expect(report.caveat).toContain("never saw the expectations");
    expect(report.caveat).toContain("judge did not run");
  });

  it("keeps the harness's own zero-target list rather than a local opinion", () => {
    expect(ZERO_TARGET_METRICS).toContain("fabrication");
    expect(ZERO_TARGET_METRICS).toContain("protected_traits");
    expect(ZERO_TARGET_METRICS).toContain("silent_mutation");
  });
});
