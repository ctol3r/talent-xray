/**
 * A job's activity strip and pipeline bar.
 *
 * Two properties carry it. The strip shades relative to the job's own
 * busiest day, so a quiet job is not rendered entirely blank and told
 * nothing — an absolute scale would make every small search look dead. And
 * the bar's percentages sum to exactly 100, because a proportional bar with
 * a gap at the end reads as a rendering fault rather than as data.
 */
import { describe, expect, it } from "vitest";
import {
  ACTIVITY_DAYS,
  activityStrip,
  activitySummary,
  pipelineBar,
  shiftDay,
  stageColour,
  type ActivityEvent,
} from "@/lib/domain/activity-bar";

const on = (day: string, times = 1): ActivityEvent[] =>
  Array.from({ length: times }, () => ({
    at: `${day}T10:00:00.000Z`,
    kind: "person" as const,
  }));

describe("the strip", () => {
  it("has one cell per day, ending today", () => {
    const cells = activityStrip([], "2026-09-07");
    expect(cells).toHaveLength(ACTIVITY_DAYS);
    expect(cells[cells.length - 1].day).toBe("2026-09-07");
    expect(cells[0].day).toBe(shiftDay("2026-09-07", -(ACTIVITY_DAYS - 1)));
  });

  it("shades relative to this job's own busiest day", () => {
    // Three events is this job's peak, so it is the darkest shade — even
    // though another job might do forty in a day.
    const cells = activityStrip(
      [...on("2026-09-07", 3), ...on("2026-09-06", 1)],
      "2026-09-07",
    );
    const today = cells[cells.length - 1];
    const yesterday = cells[cells.length - 2];
    expect(today.level).toBe(4);
    expect(yesterday.level).toBeGreaterThan(0);
    expect(yesterday.level).toBeLessThan(4);
  });

  it("leaves every cell empty when nothing happened", () => {
    expect(activityStrip([], "2026-09-07").every((c) => c.level === 0)).toBe(
      true,
    );
  });

  it("ignores anything outside the window", () => {
    const cells = activityStrip(on("2020-01-01", 5), "2026-09-07");
    expect(cells.every((cell) => cell.count === 0)).toBe(true);
  });
});

describe("the sentence under the strip", () => {
  it("says plainly when nothing happened", () => {
    expect(activitySummary(activityStrip([], "2026-09-07"))).toContain(
      "Nothing recorded",
    );
  });

  it("says how long since the last activity", () => {
    const cells = activityStrip(on("2026-09-01", 2), "2026-09-07");
    expect(activitySummary(cells)).toContain("6 days ago");
  });

  it("says so when today counts", () => {
    const cells = activityStrip(on("2026-09-07", 1), "2026-09-07");
    expect(activitySummary(cells)).toContain("including today");
  });
});

describe("the pipeline bar", () => {
  const stages = [
    { key: "research", label: "Research" },
    { key: "review", label: "Review" },
    { key: "offer", label: "Offer" },
  ];

  it("shows only the stages that have anybody in them", () => {
    const { slices, total } = pipelineBar(
      stages,
      new Map([
        ["research", 3],
        ["offer", 1],
      ]),
    );
    expect(slices.map((slice) => slice.stage)).toEqual(["research", "offer"]);
    expect(total).toBe(4);
  });

  it("makes the parts sum to exactly 100", () => {
    // Thirds do not divide evenly; a bar with a gap at the end looks broken.
    const { slices } = pipelineBar(
      stages,
      new Map([
        ["research", 1],
        ["review", 1],
        ["offer", 1],
      ]),
    );
    expect(slices.reduce((sum, slice) => sum + slice.percent, 0)).toBe(100);
  });

  it("puts the rounding remainder on the biggest slice", () => {
    const { slices } = pipelineBar(
      stages,
      new Map([
        ["research", 7],
        ["review", 1],
        ["offer", 1],
      ]),
    );
    expect(slices.reduce((sum, slice) => sum + slice.percent, 0)).toBe(100);
    const biggest = slices.reduce((a, b) => (b.count > a.count ? b : a));
    expect(biggest.stage).toBe("research");
  });

  it("shows nothing at all rather than an empty bar", () => {
    expect(pipelineBar(stages, new Map()).slices).toEqual([]);
  });

  it("gives every stage a colour, wrapping rather than running out", () => {
    expect(stageColour(0)).not.toBe(stageColour(1));
    expect(stageColour(99)).toBeTruthy();
  });
});
