/**
 * The job's own clock.
 *
 * The whole point is that a fortnight is not one length of time. The tests
 * that matter are the two extremes — a two-week search and a two-year one —
 * and the case where nobody agreed anything, which must not be guessed at.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_HALF_LIFE_DAYS,
  MAX_HALF_LIFE_DAYS,
  MIN_HALF_LIFE_DAYS,
  jobClock,
  onClock,
  timePressure,
} from "../../artifact-src/core/clock";
import { movementOf } from "../../artifact-src/core/movement";
import {
  readScope,
  type HillScope,
  type HillSnapshot,
} from "../../artifact-src/core/hill";

const NOW = "2026-09-08T12:00:00.000Z";
const daysAgo = (days: number) =>
  new Date(Date.parse(NOW) - days * 86_400_000).toISOString();
const inDays = (days: number) =>
  new Date(Date.parse(NOW) + days * 86_400_000).toISOString().slice(0, 10);

describe("the window agreed at intake", () => {
  it("reads a two-week search and a two-year one as different lengths", () => {
    const fast = jobClock(daysAgo(1), inDays(13), NOW);
    const slow = jobClock(daysAgo(1), inDays(729), NOW);
    expect(fast.agreedDays).toBe(14);
    expect(slow.agreedDays).toBe(730);
    // A tenth of the window, floored and capped so the reading stays usable.
    expect(fast.halfLifeDays).toBe(MIN_HALF_LIFE_DAYS);
    expect(slow.halfLifeDays).toBe(MAX_HALF_LIFE_DAYS);
    expect(fast.says).toContain("2 weeks agreed");
    expect(slow.says).toContain("2 years agreed");
  });

  it("says how much of the window is left, and when it has gone", () => {
    expect(jobClock(daysAgo(10), inDays(20), NOW).says).toContain(
      "20 days left",
    );
    expect(jobClock(daysAgo(50), inDays(-9), NOW).says).toContain(
      "9 days past it",
    );
    expect(jobClock(daysAgo(10), inDays(0), NOW).says).toContain("due today");
  });

  it("assumes nothing when nobody agreed a date, and says it assumed", () => {
    const none = jobClock(daysAgo(10), null, NOW);
    expect(none.agreedDays).toBeNull();
    expect(none.through).toBeNull();
    // Exactly what every threshold used before clocks existed, so a job with
    // no agreed date behaves as it always did.
    expect(none.halfLifeDays).toBe(DEFAULT_HALF_LIFE_DAYS);
    expect(none.patience).toBe(1);
    expect(none.says).toContain("no start date agreed");
  });

  it("treats a start date before the job opened as no window at all", () => {
    // Not a window; a backfill somebody is already late for. There is no pace
    // to measure against, so none is claimed.
    expect(jobClock(daysAgo(10), inDays(-40), NOW).agreedDays).toBeNull();
    expect(jobClock(daysAgo(10), "nonsense", NOW).agreedDays).toBeNull();
  });

  it("sorts a job with no agreed date in the middle, asserting nothing", () => {
    expect(timePressure(jobClock(daysAgo(10), null, NOW))).toBe(0.5);
    expect(timePressure(jobClock(daysAgo(1), inDays(99), NOW))).toBeLessThan(
      0.1,
    );
    expect(
      timePressure(jobClock(daysAgo(100), inDays(-10), NOW)),
    ).toBeGreaterThan(1);
  });
});

describe("what the clock does to every other measure", () => {
  it("scales a threshold, and never below a day", () => {
    const fast = jobClock(daysAgo(1), inDays(13), NOW);
    const slow = jobClock(daysAgo(1), inDays(729), NOW);
    expect(onClock(7, fast)).toBe(1);
    expect(onClock(14, fast)).toBe(2);
    expect(onClock(7, slow)).toBe(30);
    expect(onClock(14, slow)).toBe(60);
    // A threshold under a day fires within an afternoon; nobody keeps that on.
    expect(onClock(1, fast)).toBe(1);
  });

  it("makes a week of silence a crisis on one job and a Tuesday on another", () => {
    const fast = jobClock(daysAgo(20), inDays(-6), NOW);
    const slow = jobClock(daysAgo(20), inDays(710), NOW);
    const scope: HillScope = {
      id: "s1",
      name: "Reaching them",
      position: 0.4,
      unknown: "",
      doneAt: null,
      colour: "#fff",
    };
    const history: HillSnapshot[] = [
      { at: daysAgo(9), by: "chris", positions: { s1: 0.2 }, note: "" },
      { at: daysAgo(8), by: "chris", positions: { s1: 0.4 }, note: "" },
    ];
    expect(readScope(scope, history, NOW, fast).signal).toBe("stuck");
    expect(readScope(scope, history, NOW, slow).signal).toBe("moving");
  });

  it("reads the same week's work against what each job's window demands", () => {
    const events = Array.from({ length: 6 }, (_, i) => ({
      at: daysAgo(i),
      kind: "advance" as const,
    }));
    const fast = jobClock(daysAgo(2), inDays(12), NOW);
    const slow = jobClock(daysAgo(2), inDays(728), NOW);
    // Six people moved in six days is a good week on a two-year search and
    // nowhere near enough on a two-week one — a fortnight to fill needs the
    // whole funnel inside it. So the SAME work reads as less movement on the
    // job that demands more, which is what puts it in front of you.
    expect(movementOf(events, NOW, fast.halfLifeDays)).toBeLessThan(
      movementOf(events, NOW, slow.halfLifeDays),
    );
  });
});
