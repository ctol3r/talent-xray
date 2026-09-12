/**
 * A job's activity, at a glance.
 *
 * Two readings, side by side, because they answer different questions.
 *
 * The **strip** is GitHub's contribution graph: one cell per day, shaded by
 * how much happened. It answers "is this job being worked" — and the honest
 * answer is usually visible as a gap rather than a colour, which is the
 * point. A job with a fortnight of blank cells is a job nobody is running,
 * and no summary number says that as fast.
 *
 * The **bar** is GitHub's language bar: one proportional strip showing where
 * the people in this job actually are. It answers "what shape is this
 * pipeline" — sixty people all sitting in research is a different problem
 * from six people spread to offer.
 *
 * All of it is derived from rows that already exist. Nothing here is a score,
 * and nothing here ranks a person.
 */

import { dayOf, shiftDay } from "../../../artifact-src/core/day";

export { shiftDay };

export interface ActivityEvent {
  /** ISO timestamp of something that happened on this job. */
  at: string;
  kind: "person" | "stage" | "source" | "learning" | "note";
}

export interface ActivityCell {
  day: string;
  count: number;
  /** 0–4, the way a contribution graph shades. */
  level: 0 | 1 | 2 | 3 | 4;
}

export const ACTIVITY_DAYS = 84;

/**
 * Shade relative to this job's own busiest day, not to a fixed scale.
 *
 * A job that peaks at three events a day and one that peaks at forty should
 * both read as "busy on its busiest day". An absolute scale would render the
 * first entirely blank and tell its owner nothing.
 */
export function activityStrip(
  events: ActivityEvent[],
  today: string,
  days = ACTIVITY_DAYS,
): ActivityCell[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const day = dayOf(event.at);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const cells: ActivityCell[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = shiftDay(today, -i);
    cells.push({ day, count: counts.get(day) ?? 0, level: 0 });
  }
  const peak = Math.max(...cells.map((cell) => cell.count), 0);
  if (peak === 0) return cells;
  return cells.map((cell) => ({
    ...cell,
    level:
      cell.count === 0
        ? 0
        : (Math.min(4, Math.ceil((cell.count / peak) * 4)) as 1 | 2 | 3 | 4),
  }));
}

export interface StageSlice {
  stage: string;
  label: string;
  count: number;
  /** Percentage of the pipeline, rounded so the parts total 100. */
  percent: number;
  colour: string;
}

/**
 * Colours run cool to warm along the pipeline, so the eye reads progress
 * left to right without a legend.
 */
const STAGE_COLOURS = [
  "#64748b",
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#eab308",
  "#f97316",
  "#ec4899",
  "#a855f7",
];

export function stageColour(index: number): string {
  return STAGE_COLOURS[index % STAGE_COLOURS.length];
}

/**
 * The proportional bar. Percentages are rounded so they sum to exactly 100:
 * a bar with a one-pixel gap at the end looks like a rendering bug, and the
 * largest slice absorbs the remainder because that is where a rounding error
 * is least visible.
 */
export function pipelineBar(
  stages: { key: string; label: string }[],
  counts: Map<string, number>,
): { slices: StageSlice[]; total: number } {
  const present = stages
    .map((stage, index) => ({
      stage: stage.key,
      label: stage.label,
      count: counts.get(stage.key) ?? 0,
      percent: 0,
      colour: stageColour(index),
    }))
    .filter((slice) => slice.count > 0);

  const total = present.reduce((sum, slice) => sum + slice.count, 0);
  if (total === 0) return { slices: [], total: 0 };

  let assigned = 0;
  const slices = present.map((slice) => {
    const percent = Math.round((slice.count / total) * 100);
    assigned += percent;
    return { ...slice, percent };
  });
  const drift = 100 - assigned;
  if (drift !== 0) {
    const biggest = slices.reduce((a, b) => (b.count > a.count ? b : a));
    biggest.percent += drift;
  }
  return { slices, total };
}

/** One sentence about the strip, because a picture with no words is a mood. */
export function activitySummary(cells: ActivityCell[]): string {
  const active = cells.filter((cell) => cell.count > 0);
  if (active.length === 0) {
    return `Nothing recorded in ${cells.length} days.`;
  }
  const total = active.reduce((sum, cell) => sum + cell.count, 0);
  const last = active[active.length - 1].day;
  const quiet = cells.length - 1 - cells.findIndex((c) => c.day === last);
  return `${total} things over ${active.length} active ${
    active.length === 1 ? "day" : "days"
  }${quiet > 0 ? `, last ${quiet} ${quiet === 1 ? "day" : "days"} ago` : ", including today"}.`;
}
