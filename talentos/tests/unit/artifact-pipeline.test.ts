/**
 * Pipeline events and the four metric groups (spec §13). Events are
 * append-only records of what a human did. Every metric carries its
 * formula and denominator, an empty pipeline is never a zero, and nothing
 * can be broken down by a candidate attribute.
 */
import { describe, expect, it } from "vitest";
import {
  EXITS,
  STAGES,
  compareMetric,
  computeMetrics,
  currentPosition,
  durationMetric,
  exitOf,
  furthestStage,
  median,
  pipelineEventSchema,
  reachedCounts,
  type PipelineEvent,
} from "../../artifact-src/core/pipeline";
import { rateMetric } from "../../artifact-src/core/envelope";

const NOW = "2026-09-04T00:00:00.000Z";
const day = (n: number) =>
  new Date(
    Date.parse("2026-08-01T00:00:00.000Z") + n * 86_400_000,
  ).toISOString();

const ev = (
  over: Partial<PipelineEvent> & Pick<PipelineEvent, "candidateId" | "type">,
): PipelineEvent =>
  pipelineEventSchema.parse({ id: `e${Math.random()}`, at: NOW, ...over });

describe("events describe what already happened", () => {
  it("derives the furthest stage a candidate reached, not the last event written", () => {
    const events = [
      ev({
        candidateId: "c1",
        type: "stage_change",
        toStage: "submitted",
        at: day(3),
      }),
      ev({
        candidateId: "c1",
        type: "reply_recorded",
        outcome: "interested",
        at: day(5),
      }),
    ];
    expect(furthestStage("c1", events)).toBe("submitted");
    expect(furthestStage("nobody", events)).toBeUndefined();
  });

  it("treats recorded outreach and replies as reaching their stage", () => {
    const events = [ev({ candidateId: "c1", type: "outreach_recorded" })];
    expect(furthestStage("c1", events)).toBe("contacted");
    events.push(
      ev({ candidateId: "c1", type: "reply_recorded", outcome: "unclear" }),
    );
    expect(furthestStage("c1", events)).toBe("replied");
  });

  it("an exit is where someone is now, whatever stage they reached", () => {
    const events = [
      ev({ candidateId: "c1", type: "stage_change", toStage: "interviewing" }),
      ev({
        candidateId: "c1",
        type: "exit",
        exit: "withdrawn",
        note: "took another offer",
        at: day(9),
      }),
    ];
    expect(currentPosition("c1", events)).toEqual({
      kind: "exit",
      exit: "withdrawn",
    });
    expect(exitOf("c1", events)?.note).toBe("took another offer");
    expect(currentPosition("c2", events)).toEqual({ kind: "none" });
  });

  it("counts everyone who ever reached a stage, so the funnel's denominators are real", () => {
    const events = [
      ev({ candidateId: "c1", type: "stage_change", toStage: "submitted" }),
      ev({ candidateId: "c2", type: "outreach_recorded" }),
      ev({ candidateId: "c3", type: "stage_change", toStage: "sourced" }),
    ];
    const counts = reachedCounts(["c1", "c2", "c3"], events);
    expect(counts.sourced).toBe(3);
    expect(counts.contacted).toBe(2);
    expect(counts.submitted).toBe(1);
    expect(counts.hired).toBe(0);
  });

  it("rejects an event that names a stage the pipeline does not have", () => {
    expect(
      pipelineEventSchema.safeParse({
        id: "x",
        candidateId: "c",
        at: NOW,
        type: "stage_change",
        toStage: "vibes",
      }).success,
    ).toBe(false);
    expect(STAGES).toHaveLength(8);
    expect(EXITS).toEqual(["rejected", "withdrawn", "on_hold"]);
  });
});

describe("the four groups", () => {
  const groups = () =>
    computeMetrics({
      candidateIds: ["c1", "c2", "c3"],
      events: [
        ev({
          candidateId: "c1",
          type: "stage_change",
          toStage: "sourced",
          at: day(0),
        }),
        ev({
          candidateId: "c2",
          type: "stage_change",
          toStage: "sourced",
          at: day(0),
        }),
        ev({
          candidateId: "c3",
          type: "stage_change",
          toStage: "sourced",
          at: day(0),
        }),
        ev({ candidateId: "c1", type: "outreach_recorded", at: day(1) }),
        ev({ candidateId: "c2", type: "outreach_recorded", at: day(2) }),
        ev({
          candidateId: "c1",
          type: "reply_recorded",
          outcome: "interested",
          at: day(4),
        }),
      ],
      nowIso: NOW,
      openedAt: day(0),
    });

  it("is exactly four groups, each with a purpose", () => {
    const g = groups();
    expect(g.map((x) => x.key)).toEqual([
      "funnel",
      "responsiveness",
      "quality",
      "velocity",
    ]);
    for (const group of g) {
      expect(group.purpose.length).toBeGreaterThan(30);
      expect(group.metrics.length).toBeGreaterThan(0);
    }
  });

  it("every metric states a formula and, when measured, a denominator", () => {
    for (const m of groups().flatMap((g) => g.metrics)) {
      expect(m.formula.length, m.id).toBeGreaterThan(10);
      if (m.status === "measured") {
        expect(typeof m.denominator, m.id).toBe("number");
        expect(m.denominator, m.id).toBeGreaterThan(0);
        expect(m.value, m.id).not.toBeNull();
      }
    }
  });

  it("refuses to call a rate measured below its minimum sample", () => {
    const reply = groups()
      .find((g) => g.key === "responsiveness")!
      .metrics.find((m) => m.id === "reply_rate")!;
    // 1 of 2 contacted replied, but the minimum sample is 10.
    expect(reply.status).toBe("not_enough_data");
    expect(reply.denominator).toBe(2);
    expect(reply.minimumSample).toBe(10);
    expect(reply.value).toBeNull();
  });

  it("measures a duration only with enough observations, and carries the sample size", () => {
    const few = durationMetric({
      id: "d",
      label: "d",
      formula: "median days",
      days: [2, 3],
      asOf: NOW,
    });
    expect(few.status).toBe("not_enough_data");
    expect(few.denominator).toBe(2);
    const enough = durationMetric({
      id: "d",
      label: "d",
      formula: "median days",
      days: [2, 3, 10],
      asOf: NOW,
    });
    expect(enough.status).toBe("measured");
    expect(enough.value).toBe(3);
    expect(enough.denominator).toBe(3);
    expect(enough.unit).toBe("days");
  });

  it("an empty pipeline reports not-enough-data everywhere, never 0%", () => {
    const empty = computeMetrics({
      candidateIds: ["c1"],
      events: [],
      nowIso: NOW,
    });
    const measured = empty
      .flatMap((g) => g.metrics)
      .filter((m) => m.status === "measured");
    expect(measured).toEqual([]);
  });

  it("days open is honest about a missing open date", () => {
    const without = computeMetrics({
      candidateIds: [],
      events: [],
      nowIso: NOW,
    })
      .find((g) => g.key === "velocity")!
      .metrics.find((m) => m.id === "days_open")!;
    expect(without.status).toBe("not_enough_data");
    expect(without.note).toContain("It is not zero.");

    const withDate = computeMetrics({
      candidateIds: [],
      events: [],
      nowIso: NOW,
      openedAt: day(0),
    })
      .find((g) => g.key === "velocity")!
      .metrics.find((m) => m.id === "days_open")!;
    expect(withDate.status).toBe("measured");
    expect(withDate.value).toBe(34);
  });

  it("no metric can be broken down by a candidate attribute", () => {
    const text = JSON.stringify(
      computeMetrics({ candidateIds: ["c"], events: [], nowIso: NOW }),
    ).toLowerCase();
    for (const term of [
      "gender",
      "ethnic",
      "religion",
      "disabilit",
      "nationality",
      '"age"',
    ]) {
      expect(text).not.toContain(term);
    }
  });

  it("a conversion never exceeds its own population", () => {
    const groups = computeMetrics({
      candidateIds: ["c1", "c2"],
      events: [
        ev({ candidateId: "c1", type: "stage_change", toStage: "offer" }),
        ev({ candidateId: "c2", type: "stage_change", toStage: "offer" }),
      ],
      nowIso: NOW,
    });
    for (const m of groups.flatMap((g) => g.metrics)) {
      if (m.status === "measured" && m.unit !== "days") {
        expect(m.value, m.id).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("comparisons", () => {
  const measured = (value: number, denominator: number) =>
    rateMetric({
      id: "r",
      label: "Reply rate",
      formula: "replies ÷ contacted",
      numerator: value * denominator,
      denominator,
      minimumSample: 10,
      asOf: NOW,
    });

  it("will not report a change when either side is unmeasured", () => {
    const thin = measured(0.5, 4);
    expect(thin.status).toBe("not_enough_data");
    const result = compareMetric(thin, measured(0.5, 20));
    expect(result.reportable).toBe(false);
    expect(result.reason).toContain("nothing can be said about a change");
  });

  it("reports a direction with both sample sizes when both sides are measured", () => {
    const result = compareMetric(measured(0.2, 20), measured(0.4, 25));
    expect(result.reportable).toBe(true);
    expect(result.direction).toBe("up");
    expect(result.reason).toContain("n=20");
    expect(result.reason).toContain("n=25");
  });
});

describe("median", () => {
  it("handles odd, even and empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeUndefined();
  });
});
