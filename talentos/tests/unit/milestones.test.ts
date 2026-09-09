/**
 * The three elapsed-day medians, and the two things that make them honest:
 * they are built only from recorded events, and they refuse to print a number
 * a sample that small cannot support.
 *
 * The refusal is the part worth testing hardest. A median that silently
 * appears at n=1 is indistinguishable on screen from one at n=40, so the floor
 * is not a nicety — it is the only thing standing between the reader and an
 * anecdote with a decimal point on it.
 */
import { describe, expect, it } from "vitest";
import {
  ELAPSED_MEASURES,
  MIN_SAMPLE,
  WINDOW_DAYS,
  elapsedReading,
  elapsedReadings,
  intervalsFor,
  medianOf,
  withinWindow,
  type MilestoneRow,
} from "../../artifact-src/core/milestones";

const NOW = "2026-09-08T12:00:00.000Z";

/** A day offset from NOW, negative for the past. */
function at(days: number): string {
  return new Date(Date.parse(NOW) + days * 86_400_000).toISOString();
}

const SIGNATURE = ELAPSED_MEASURES.find((m) => m.id === "signature")!;
const REPLY = ELAPSED_MEASURES.find((m) => m.id === "reply")!;

describe("the middle value", () => {
  it("is null with nothing to take the middle of", () => {
    expect(medianOf([])).toBeNull();
  });

  it("is the midpoint on an even count and the middle one on an odd count", () => {
    expect(medianOf([10, 20, 30])).toBe(20);
    expect(medianOf([10, 20, 30, 40])).toBe(25);
  });

  it("is not the mean, so one job that took a year does not move it", () => {
    expect(medianOf([10, 11, 12, 13, 365])).toBe(12);
  });
});

describe("which intervals belong to this window", () => {
  it("selects on when the interval finished, not when it started", () => {
    // Briefed five months ago, signed yesterday. This is news about this week
    // and must count, or every long search is excluded from every window and
    // the median only ever describes the quick ones.
    const values = withinWindow(
      [{ jobId: "a", from: at(-150), to: at(-1) }],
      NOW,
    );
    expect(values).toHaveLength(1);
    expect(values[0]).toBeCloseTo(149, 5);
  });

  it("drops intervals that finished before the window opened", () => {
    expect(
      withinWindow([{ jobId: "a", from: at(-90), to: at(-40) }], NOW),
    ).toEqual([]);
  });

  it("drops an interval that ends before it starts rather than clamping it", () => {
    // Two timestamps disagreeing is a fact worth losing a data point over.
    // Clamping to zero would bury the contradiction inside the distribution.
    expect(
      withinWindow([{ jobId: "a", from: at(-2), to: at(-5) }], NOW),
    ).toEqual([]);
  });

  it("drops unparseable dates instead of treating them as now", () => {
    expect(
      withinWindow([{ jobId: "a", from: "not a date", to: at(-3) }], NOW),
    ).toEqual([]);
  });
});

describe("pairing milestones into intervals", () => {
  it("needs both ends, and a job missing either contributes nothing", () => {
    const rows: MilestoneRow[] = [
      { jobId: "a", kind: "brief", occurredAt: at(-30) },
      { jobId: "a", kind: "signature", occurredAt: at(-2) },
      // Briefed, never signed. Not a zero, not a default — absent.
      { jobId: "b", kind: "brief", occurredAt: at(-30) },
      // Signed with no brief on file: nothing to measure from.
      { jobId: "c", kind: "signature", occurredAt: at(-2) },
    ];
    const intervals = intervalsFor(SIGNATURE, rows);
    expect(intervals.map((i) => i.jobId)).toEqual(["a"]);
  });

  it("takes the earliest of a repeated kind, because these are firsts", () => {
    const rows: MilestoneRow[] = [
      { jobId: "a", kind: "brief", occurredAt: at(-30) },
      { jobId: "a", kind: "brief", occurredAt: at(-20) },
      { jobId: "a", kind: "first_qualified_reply", occurredAt: at(-5) },
      { jobId: "a", kind: "first_qualified_reply", occurredAt: at(-3) },
    ];
    const [interval] = intervalsFor(REPLY, rows);
    expect(interval.from).toBe(at(-30));
    expect(interval.to).toBe(at(-5));
  });

  it("ignores milestones belonging to other measures", () => {
    const rows: MilestoneRow[] = [
      { jobId: "a", kind: "brief", occurredAt: at(-30) },
      { jobId: "a", kind: "shortlist_agreed", occurredAt: at(-4) },
    ];
    expect(intervalsFor(SIGNATURE, rows)).toEqual([]);
  });
});

describe("the sample floor", () => {
  it("refuses a median of one and says how many there are", () => {
    const reading = elapsedReading(
      SIGNATURE,
      [{ jobId: "a", from: at(-10), to: at(-1) }],
      NOW,
    );
    expect(reading.days).toBeNull();
    expect(reading.enough).toBe(false);
    expect(reading.n).toBe(1);
    expect(reading.says).toContain("not enough closed searches yet");
  });

  it("still refuses at two, because a midpoint of two is a mean in disguise", () => {
    const reading = elapsedReading(
      SIGNATURE,
      [
        { jobId: "a", from: at(-10), to: at(-1) },
        { jobId: "b", from: at(-20), to: at(-2) },
      ],
      NOW,
    );
    expect(reading.days).toBeNull();
    expect(reading.n).toBe(2);
  });

  it("reports a number at the floor, with the count beside it", () => {
    const reading = elapsedReading(
      SIGNATURE,
      [
        { jobId: "a", from: at(-11), to: at(-1) },
        { jobId: "b", from: at(-22), to: at(-2) },
        { jobId: "c", from: at(-33), to: at(-3) },
      ],
      NOW,
    );
    expect(reading.enough).toBe(true);
    expect(reading.n).toBe(3);
    expect(reading.days).toBeCloseTo(20, 5);
    expect(reading.says).toContain("n=3");
  });

  it("counts only what is in the window when deciding whether it has enough", () => {
    // Four intervals, three of them old. The floor is about what this window
    // can support, so the number must be refused rather than propped up by
    // history the caption does not cover.
    const reading = elapsedReading(
      SIGNATURE,
      [
        { jobId: "a", from: at(-10), to: at(-1) },
        { jobId: "b", from: at(-200), to: at(-100) },
        { jobId: "c", from: at(-200), to: at(-90) },
        { jobId: "d", from: at(-200), to: at(-80) },
      ],
      NOW,
    );
    expect(reading.n).toBe(1);
    expect(reading.days).toBeNull();
  });

  it("keeps the floor and the window as the stated constants", () => {
    expect(MIN_SAMPLE).toBe(3);
    expect(WINDOW_DAYS).toBe(28);
  });
});

describe("all three measures over one scope", () => {
  it("reports each one independently, from its own events", () => {
    const rows: MilestoneRow[] = [];
    for (const job of ["a", "b", "c"]) {
      rows.push({ jobId: job, kind: "brief", occurredAt: at(-20) });
      rows.push({
        jobId: job,
        kind: "first_qualified_reply",
        occurredAt: at(-15),
      });
    }
    // Only one job ever got a signature, so that measure must refuse while
    // the reply measure reports.
    rows.push({ jobId: "a", kind: "signature", occurredAt: at(-1) });

    const readings = elapsedReadings(rows, NOW);
    const byId = new Map(readings.map((r) => [r.id, r]));
    expect(byId.get("reply")!.enough).toBe(true);
    expect(byId.get("reply")!.n).toBe(3);
    expect(byId.get("reply")!.days).toBeCloseTo(5, 5);
    expect(byId.get("shortlist")!.n).toBe(0);
    expect(byId.get("shortlist")!.enough).toBe(false);
    expect(byId.get("signature")!.n).toBe(1);
    expect(byId.get("signature")!.enough).toBe(false);
  });

  it("says nothing rather than zero when there are no events at all", () => {
    for (const reading of elapsedReadings([], NOW)) {
      expect(reading.days).toBeNull();
      expect(reading.n).toBe(0);
      expect(reading.says).toContain("not enough closed searches yet");
    }
  });

  it("never reports a measure for a job outside the scope it was given", () => {
    // The scope is whatever rows the caller passed. This is the guard against
    // a dashboard answering about jobs the reader has filtered away.
    const inScope: MilestoneRow[] = [
      { jobId: "a", kind: "brief", occurredAt: at(-9) },
      { jobId: "a", kind: "signature", occurredAt: at(-1) },
    ];
    expect(
      elapsedReadings(inScope, NOW).find((r) => r.id === "signature")!.n,
    ).toBe(1);
  });
});
