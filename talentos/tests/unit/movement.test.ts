/**
 * Movement, and the shape a desk makes.
 *
 * The tests worth having are about what the number is allowed to claim: that
 * time is genuinely in it, that one busy job cannot swamp the axis, and that
 * a distribution is refused when there is nothing to distribute.
 */
import { describe, expect, it } from "vitest";
import {
  HALF_LIFE_DAYS,
  MAX_BANDWIDTH,
  MIN_BANDWIDTH,
  MIN_FOR_A_SHAPE,
  MOVEMENT_SCALE,
  bandwidthFor,
  curvePath,
  densityCurve,
  median,
  movementOf,
  movementReading,
  summariseMovement,
  type MovementEvent,
} from "../../artifact-src/core/movement";

const NOW = "2026-09-08T12:00:00.000Z";
const daysAgo = (days: number) =>
  new Date(Date.parse(NOW) - days * 86_400_000).toISOString();
const events = (kind: MovementEvent["kind"], ...ages: number[]) =>
  ages.map((age) => ({ at: daysAgo(age), kind }));

describe("one job's movement", () => {
  it("is nothing when nothing was recorded", () => {
    expect(movementOf([], NOW)).toBe(0);
  });

  it("counts an old move for less than a new one", () => {
    const fresh = movementOf(events("task", 0, 0, 0), NOW);
    const stale = movementOf(events("task", 60, 60, 60), NOW);
    expect(fresh).toBeGreaterThan(stale);
    expect(stale).toBeLessThan(0.05);
  });

  it("halves at the half-life, which is what makes time a factor", () => {
    const now = movementOf(events("task", 0), NOW);
    const later = movementOf(events("task", HALF_LIFE_DAYS), NOW);
    // Not exactly half the score, because the score is a curve — half the
    // weight going into it.
    expect(later / now).toBeGreaterThan(0.45);
    expect(later / now).toBeLessThan(0.55);
  });

  it("counts a person moving through the funnel above a ticked task", () => {
    expect(movementOf(events("advance", 0), NOW)).toBeGreaterThan(
      movementOf(events("task", 0), NOW),
    );
  });

  it("counts a person moving backwards, because that was work too", () => {
    // A measure that only rewards good news is one people learn to game.
    expect(movementOf(events("retreat", 0), NOW)).toBeGreaterThan(0);
  });

  it("has a ceiling, so one frantic job cannot own the axis", () => {
    const busy = movementOf(events("advance", ...Array(200).fill(0)), NOW);
    expect(busy).toBeLessThanOrEqual(1);
    expect(busy).toBeGreaterThan(0.99);
    // And a moderate job is still visible beside it.
    expect(
      movementOf(events("task", ...Array(MOVEMENT_SCALE).fill(0)), NOW),
    ).toBeGreaterThan(0.6);
  });

  it("ignores an undated event rather than treating it as today", () => {
    const bad: MovementEvent[] = [{ at: "not a date", kind: "advance" }];
    expect(movementOf(bad, NOW)).toBe(0);
  });
});

describe("the sentence beside the number", () => {
  it("tells a new job apart from a dead one, which the number cannot", () => {
    const fresh = movementReading([], daysAgo(2), NOW);
    const dead = movementReading([], daysAgo(90), NOW);
    expect(fresh.value).toBe(dead.value);
    expect(fresh.says).toContain("opened this week");
    expect(dead.says).toContain("90 days");
  });

  it("says how long it has been quiet when everything is old", () => {
    expect(movementReading(events("task", 40), daysAgo(200), NOW).says).toBe(
      "nothing recorded in 40 days",
    );
  });

  it("counts what happened lately when something did", () => {
    const reading = movementReading(events("task", 1, 3, 20), daysAgo(60), NOW);
    expect(reading.says).toContain("2 recorded in the last fortnight");
  });

  it("never grades anything", () => {
    const words = /healthy|on track|behind|good|bad|score|%|percent/i;
    for (const reading of [
      movementReading([], daysAgo(2), NOW),
      movementReading(events("advance", 1), daysAgo(30), NOW),
      movementReading(events("task", 90), daysAgo(200), NOW),
    ]) {
      expect(reading.says).not.toMatch(words);
    }
    expect(summariseMovement([0.1, 0.5, 0.9])).not.toMatch(words);
  });
});

describe("the shape", () => {
  it("refuses to draw a distribution of too few jobs", () => {
    // A curve through two points is a picture of two jobs pretending to be one.
    expect(MIN_FOR_A_SHAPE).toBeGreaterThan(2);
    expect(densityCurve([])).toEqual([]);
  });

  it("puts its peak where the jobs are", () => {
    const curve = densityCurve([0.8, 0.82, 0.78, 0.81]);
    const peak = curve.reduce((best, point) =>
      point.y > best.y ? point : best,
    );
    expect(peak.x).toBeGreaterThan(0.7);
    expect(peak.x).toBeLessThan(0.9);
    expect(peak.y).toBeCloseTo(1);
  });

  it("never smooths across more than one step of the axis", () => {
    // Silverman's rule alone picks a wide bandwidth for a split desk, because
    // a split desk has a large standard deviation — and the wide bandwidth
    // then hides the split. The cap is what stops that.
    expect(bandwidthFor([0.05, 0.06, 0.08, 0.88, 0.9, 0.92])).toBe(
      MAX_BANDWIDTH,
    );
  });

  it("draws two humps when the desk is split in two", () => {
    const curve = densityCurve([0.05, 0.08, 0.06, 0.9, 0.92, 0.88]);
    const middle = curve.find((point) => point.x > 0.45 && point.x < 0.55)!;
    const left = curve.find((point) => point.x > 0.02 && point.x < 0.12)!;
    // The dip between them is the whole point: it says the desk is two desks.
    expect(middle.y).toBeLessThan(left.y / 2);
  });

  it("draws a narrow hump rather than dividing by zero when all are alike", () => {
    expect(bandwidthFor([0.5, 0.5, 0.5, 0.5])).toBe(MIN_BANDWIDTH);
    const curve = densityCurve([0.5, 0.5, 0.5, 0.5]);
    expect(curve.every((point) => Number.isFinite(point.y))).toBe(true);
    expect(Math.max(...curve.map((p) => p.y))).toBeCloseTo(1);
  });

  it("takes the middle job, not the mean, so one busy job cannot shift it", () => {
    expect(median([0.1, 0.2, 0.3])).toBeCloseTo(0.2);
    expect(median([0.1, 0.1, 0.1, 0.99])).toBeCloseTo(0.1);
    expect(median([])).toBe(0);
  });

  it("closes the path along the baseline so it can be filled", () => {
    const path = curvePath(densityCurve([0.2, 0.5, 0.6, 0.7]), 100, 40);
    expect(path.startsWith("M")).toBe(true);
    expect(path.endsWith("Z")).toBe(true);
    expect(path).toContain("L0 40");
    expect(curvePath([], 100, 40)).toBe("");
  });

  it("counts the ends rather than scoring the desk", () => {
    expect(summariseMovement([0.05, 0.1, 0.7, 0.8])).toBe(
      "4 open · 2 quiet · 2 busy",
    );
    expect(summariseMovement([0.4, 0.45])).toBe("2 open · all ticking over");
    expect(summariseMovement([])).toBe("no open jobs");
  });
});
