/**
 * How much each job has moved lately, and the shape that makes across a desk.
 *
 * One number per job, from three things the product already records: tasks
 * ticked, people moved through the funnel, and when each of those happened.
 * Then the distribution of those numbers, drawn as a curve, so a deskful of
 * jobs has a shape you can read in a glance — most of them bunched at the
 * quiet end is a different week from most of them bunched at the busy end,
 * and neither is visible in a list.
 *
 * **This is not progress, and must never be labelled as it.** The hill chart
 * (D-083) is a claim about what is still unknown, which nothing can measure,
 * which is why nothing but a person may move a dot on it. This is a claim
 * about what has been recorded, which is a count of rows that exist. The two
 * are compatible exactly because they are different claims: a job can be busy
 * and going nowhere, and this will say busy, because busy is all it knows.
 *
 * So the vocabulary is deliberately narrow. Movement, quiet, busy. Never
 * healthy, never on track, never a percentage, never a grade.
 *
 * Nothing here imports anything but the clock, so the same curve draws in the
 * artifact.
 */
import { DEFAULT_HALF_LIFE_DAYS, type JobClock } from "./clock";

export type MovementKind = "task" | "advance" | "retreat" | "person";

export interface MovementEvent {
  at: string;
  kind: MovementKind;
}

/**
 * What each kind of movement is worth.
 *
 * A person moving forward through the funnel counts most because it is the
 * work the rest of the work is for. A retreat still counts — somebody moved
 * back a stage, which took a conversation and a decision, and a measure that
 * only rewards good news is one people learn to game. A ticked task and a
 * person added count the same: both are a thing that got done today.
 */
export const MOVEMENT_WEIGHTS: Record<MovementKind, number> = {
  advance: 3,
  retreat: 1,
  task: 1,
  person: 1,
};

/**
 * How fast movement stops counting — on this job's clock, not on a calendar.
 *
 * Passed in rather than fixed, because a fortnight of silence means opposite
 * things on a two-week search and a two-year one. `jobClock` works the number
 * out from the start date agreed at intake; the default here is only what a
 * job with no agreed date falls back to.
 *
 * That proportionality is also what makes two jobs on different clocks
 * comparable at all. A job worked at the pace its own window requires
 * accumulates roughly the same decayed total whatever that window is, because
 * the half-life grows with it — so the scale below can stay a constant and
 * the axis means the same thing for every job on it.
 */
export const HALF_LIFE_DAYS = DEFAULT_HALF_LIFE_DAYS;

/**
 * Where the scale flattens.
 *
 * A job being worked at the pace its own agreed window requires lands around
 * two-thirds of the way up, and everything past that compresses. Without a
 * ceiling one very busy job would push every other job into the first pixel of
 * the axis, and the curve would be a picture of that one job.
 */
export const MOVEMENT_SCALE = 12;

const DAY_MS = 86_400_000;

function ageInDays(at: string, now: string): number | null {
  const then = Date.parse(at);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(then) || !Number.isFinite(nowMs)) return null;
  return Math.max(0, (nowMs - then) / DAY_MS);
}

/**
 * One job's movement, from 0 (nothing recorded lately) to just under 1,
 * measured against the pace this job's own window asks for.
 */
export function movementOf(
  events: MovementEvent[],
  now: string,
  halfLifeDays = HALF_LIFE_DAYS,
): number {
  let total = 0;
  for (const event of events) {
    const age = ageInDays(event.at, now);
    // An undated event is not a recent one. Counting it as today would let a
    // row with a missing timestamp make a dead job look busy.
    if (age === null) continue;
    total += MOVEMENT_WEIGHTS[event.kind] * Math.pow(0.5, age / halfLifeDays);
  }
  return 1 - Math.exp(-total / MOVEMENT_SCALE);
}

export interface MovementReading {
  value: number;
  /** What the number is, said plainly. Never a grade. */
  says: string;
}

/** How long a job may be new before having recorded nothing is worth saying. */
export const SETTLING_IN_DAYS = 7;

/**
 * The number, plus the sentence that stops it being misread.
 *
 * A job opened yesterday with nothing recorded and a job untouched for six
 * weeks both score zero, and they are not the same situation. The number
 * cannot tell them apart; the sentence can, so the sentence is not optional.
 */
export function movementReading(
  events: MovementEvent[],
  openedAt: string,
  now: string,
  clock?: JobClock,
): MovementReading {
  const halfLife = clock?.halfLifeDays ?? HALF_LIFE_DAYS;
  const value = movementOf(events, now, halfLife);
  const dated = events
    .map((event) => ageInDays(event.at, now))
    .filter((age): age is number => age !== null);
  const opened = ageInDays(openedAt, now) ?? 0;
  // A window, said in the job's own terms. "Lately" is a different length of
  // time on a two-week search and a two-year one, and the sentence has to say
  // which one it means or the number beside it cannot be argued with.
  // The half-life itself, not a multiple of it: past that an event is
  // contributing less than half of itself, and counting it in the sentence
  // would say more happened lately than the number beside it reflects.
  const window = Math.round(halfLife);
  const lately =
    window >= 60
      ? `${Math.round(window / 30)} months`
      : window === 14
        ? "the last fortnight"
        : `${window} days`;

  if (dated.length === 0) {
    return {
      value,
      says:
        opened <= SETTLING_IN_DAYS
          ? "opened this week; nothing recorded yet"
          : `nothing recorded since it opened ${Math.round(opened)} days ago`,
    };
  }

  const last = Math.round(Math.min(...dated));
  const recent = dated.filter((age) => age <= window).length;
  if (recent === 0) {
    return { value, says: `nothing recorded in ${last} days` };
  }
  return {
    value,
    says: `${recent} recorded in ${lately === "the last fortnight" ? lately : `the last ${lately}`}${last > 2 ? `, last one ${last} days ago` : ""}`,
  };
}

// ---------------------------------------------------------------------------
// the shape

export interface CurvePoint {
  x: number;
  y: number;
}

/**
 * Fewer jobs than this and there is no distribution to draw.
 *
 * A curve through two points is not a picture of a desk, it is a picture of
 * two jobs pretending to be one. Below the threshold the ticks are shown and
 * the curve is not, and the panel says why rather than drawing a shape nobody
 * should read anything into.
 */
export const MIN_FOR_A_SHAPE = 4;

/**
 * The smallest spread the curve will admit to.
 *
 * Every job scoring the same would otherwise divide by zero and draw an
 * infinitely thin spike. The floor turns that into a narrow hump, which is
 * what "they are all in the same place" should look like.
 */
export const MIN_BANDWIDTH = 0.07;

/**
 * The widest the curve is allowed to smooth.
 *
 * Silverman's rule alone was wrong here, and a test caught it: a desk split
 * cleanly into busy jobs and quiet ones has a large standard deviation, the
 * rule reads that as "spread out", and the wide bandwidth it picks smooths the
 * two humps into one. The gap between them is the single most useful thing
 * this picture can show — half the desk is being worked and half is not — and
 * the default was hiding exactly that.
 *
 * The cap is one step of the axis. Movement has about ten distinguishable
 * steps in practice, so smoothing across more than one of them cannot reveal
 * structure, only remove it.
 */
export const MAX_BANDWIDTH = 0.14;

export function bandwidthFor(values: number[]): number {
  const n = values.length;
  if (n < 2) return MIN_BANDWIDTH;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance =
    values.reduce((total, value) => total + (value - mean) ** 2, 0) / n;
  // Silverman's rule of thumb, bounded at both ends. A rule of thumb is the
  // honest choice for the floor: with a dozen jobs there is not enough data to
  // fit a bandwidth, and pretending otherwise would make the curve wobble
  // whenever one job moved.
  const silverman = 1.06 * Math.sqrt(variance) * Math.pow(n, -0.2);
  return Math.min(MAX_BANDWIDTH, Math.max(MIN_BANDWIDTH, silverman));
}

/**
 * The distribution, as a smooth curve, by kernel density rather than by bins.
 *
 * A histogram of a dozen values is mostly a picture of where the bin edges
 * fell — move them half a bin and the shape changes. A kernel with a stated
 * bandwidth has no edges to fall anywhere, and the bandwidth is a number that
 * can be argued with.
 *
 * `y` is scaled so the tallest point is 1, because the axis is a shape rather
 * than a density: what the reader takes from it is where the jobs are bunched,
 * not how many per unit of movement.
 */
export function densityCurve(
  values: number[],
  options: { points?: number; bandwidth?: number } = {},
): CurvePoint[] {
  const points = options.points ?? 48;
  if (values.length === 0) return [];
  const bandwidth = options.bandwidth ?? bandwidthFor(values);

  const curve: CurvePoint[] = [];
  let tallest = 0;
  for (let i = 0; i < points; i++) {
    const x = i / (points - 1);
    let y = 0;
    for (const value of values) {
      const z = (x - value) / bandwidth;
      y += Math.exp(-0.5 * z * z);
    }
    tallest = Math.max(tallest, y);
    curve.push({ x, y });
  }
  if (tallest === 0) return curve.map((point) => ({ ...point, y: 0 }));
  return curve.map((point) => ({ x: point.x, y: point.y / tallest }));
}

/** The curve as an SVG path, closed along the baseline so it can be filled. */
export function curvePath(
  curve: CurvePoint[],
  width: number,
  height: number,
): string {
  if (curve.length === 0) return "";
  const parts = curve.map(
    (point, index) =>
      `${index === 0 ? "M" : "L"}${(point.x * width).toFixed(2)} ${(
        height -
        point.y * height
      ).toFixed(2)}`,
  );
  parts.push(`L${width.toFixed(2)} ${height.toFixed(2)}`);
  parts.push(`L0 ${height.toFixed(2)}`);
  parts.push("Z");
  return parts.join(" ");
}

/** The middle job, for a mark on the axis. Not the mean: one very busy job moves a mean. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * The line above the curve.
 *
 * Counts, never a score for the desk as a whole. "Six of eleven are quiet" is
 * a fact somebody can act on; a single number for a desk is one nobody can.
 */
export function summariseMovement(values: number[]): string {
  if (values.length === 0) return "no open jobs";
  const quiet = values.filter((value) => value < 0.2).length;
  const busy = values.filter((value) => value >= 0.6).length;
  const parts = [`${values.length} open`];
  if (quiet > 0) parts.push(`${quiet} quiet`);
  if (busy > 0) parts.push(`${busy} busy`);
  if (quiet === 0 && busy === 0) parts.push("all ticking over");
  return parts.join(" · ");
}
