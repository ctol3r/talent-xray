/**
 * Days, and the timezone the reader is actually in.
 *
 * The bug this exists to prevent had no visible symptom: the daily page
 * simply showed less than had happened, and the calendar's dots pointed at
 * the day before. `todayKey()` returned the local date and the query that
 * read "that day" asked for `<date>T00:00:00Z`–`<date+1>T00:00:00Z`, which is
 * the same 24 hours only in Greenwich. West of it, everything after late
 * afternoon fell off today and reappeared tomorrow.
 *
 * So the tests here are invariants rather than fixed strings: a fixed string
 * would only be right in whatever zone the machine happens to be in, which is
 * exactly the assumption that caused this.
 */
import { describe, expect, it } from "vitest";
import {
  dayBounds,
  dayOf,
  dayTitle,
  shiftDay,
  todayKey,
} from "../../artifact-src/core/day";

const INSTANTS = [
  "2026-09-08T00:00:00.000Z",
  "2026-09-08T07:59:59.999Z",
  "2026-09-08T12:00:00.000Z",
  "2026-09-08T23:59:59.999Z",
  "2026-01-01T04:30:00.000Z",
  "2025-12-31T23:00:00.000Z",
  // Both sides of the northern daylight-saving shifts.
  "2026-03-08T09:30:00.000Z",
  "2026-11-01T08:30:00.000Z",
];

describe("an instant and the day it lands in", () => {
  it("puts every instant inside the bounds of the day it reports", () => {
    // The one property the old code broke. If `dayOf` and `dayBounds` do not
    // agree, a row is filed under a day whose own query cannot find it.
    for (const at of INSTANTS) {
      const { from, to } = dayBounds(dayOf(at));
      expect(at >= from, `${at} is not after ${from}`).toBe(true);
      expect(at < to, `${at} is not before ${to}`).toBe(true);
    }
  });

  it("agrees with todayKey, which is what the pages ask for", () => {
    for (const at of INSTANTS) {
      expect(todayKey(new Date(at))).toBe(dayOf(at));
    }
  });

  it("starts a day at local midnight, not at midnight in Greenwich", () => {
    for (const day of ["2026-09-08", "2026-01-01", "2026-06-15"]) {
      const start = new Date(dayBounds(day).from);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
    }
  });

  it("hands one day's end to the next day's start, with nothing between", () => {
    // Including across a daylight-saving weekend, where the two days are 23
    // and 25 hours long: a gap here is an hour of work that belongs to no
    // page at all.
    for (const day of [
      "2026-03-07",
      "2026-03-08",
      "2026-10-31",
      "2026-12-31",
    ]) {
      expect(dayBounds(day).to).toBe(dayBounds(shiftDay(day, 1)).from);
    }
  });

  it("reads a malformed timestamp rather than throwing", () => {
    expect(dayOf("not a date")).toBe("not a date");
    expect(() => dayOf("")).not.toThrow();
  });
});

describe("day arithmetic", () => {
  it("crosses months and years", () => {
    expect(shiftDay("2026-09-30", 1)).toBe("2026-10-01");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDay("2024-02-28", 1)).toBe("2024-02-29");
  });

  it("is reversible", () => {
    for (const day of ["2026-03-08", "2026-11-01", "2026-06-15"]) {
      expect(shiftDay(shiftDay(day, 7), -7)).toBe(day);
    }
  });

  it("titles a day by the label, not by the machine's clock", () => {
    // Read at noon UTC so no offset can drag the title onto its neighbour.
    expect(dayTitle("2026-09-08")).toContain("8 September 2026");
    expect(dayTitle("2026-09-08")).toContain("Tuesday");
  });
});
