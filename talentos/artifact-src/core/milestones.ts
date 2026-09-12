/**
 * How long a job takes to reach the three moments that matter, in elapsed days.
 *
 * Three intervals, all measured from the same start — the brief — because the
 * brief is the moment the employer and the recruiter agreed what they were
 * looking for, and every question a manager actually asks is "how long from
 * then?". Not from when the job row was typed, which is administration, and
 * not from first contact, which is a different search's answer.
 *
 *   brief → first qualified reply    is the market answering.
 *   brief → shortlist agreed         is the two of you agreeing who is real.
 *   brief → signature                is the whole thing.
 *
 * **Every one of these is measured between two recorded events, never
 * inferred.** That is the entire point, and it is why this file has no
 * fallbacks in it. A stage a candidate happens to be sitting in does not tell
 * you when they got there; an offer marked accepted does not tell you a
 * contract was signed; a reply does not tell you the reply was any good. Where
 * the product did not record the moment, the moment is absent, and an absent
 * moment removes that job from the sample rather than being guessed at. A
 * median assembled from guesses is worse than no median, because it looks
 * exactly like one assembled from facts.
 *
 * The counterpart rule is the sample floor. Two closed jobs produce a
 * "median" that is just the mean of two jobs, and printing it to one decimal
 * place dresses an anecdote up as a measurement. Below the floor this reports
 * the count and refuses the number.
 *
 * Nothing here imports anything, so the same arithmetic runs in the artifact.
 */

const DAY_MS = 86_400_000;

/**
 * The moments recorded on a job.
 *
 * Four, and no more, because each one is a thing a person did that somebody
 * could be asked to point at. `brief` is stamped when the hiring-manager
 * intake is completed; the other three are the recruiter's own judgement,
 * recorded at the point in the flow where the judgement is already being made.
 */
export const MILESTONE_KINDS = [
  "brief",
  "first_qualified_reply",
  "shortlist_agreed",
  "signature",
] as const;
export type MilestoneKind = (typeof MILESTONE_KINDS)[number];

export interface ElapsedMeasure {
  id: string;
  from: MilestoneKind;
  to: MilestoneKind;
  /** What the row is called on screen. Jobs, not searches. */
  label: string;
}

export const ELAPSED_MEASURES: ElapsedMeasure[] = [
  {
    id: "reply",
    from: "brief",
    to: "first_qualified_reply",
    label: "Brief → first qualified reply",
  },
  {
    id: "shortlist",
    from: "brief",
    to: "shortlist_agreed",
    label: "Brief → shortlist agreed",
  },
  {
    id: "signature",
    from: "brief",
    to: "signature",
    label: "Brief → signature",
  },
];

/**
 * The window, in days.
 *
 * Four weeks rather than a month, so the window is the same length every time
 * it is drawn and a number cannot move because February. Long enough that a
 * single fast job does not swing it, short enough that it is still a claim
 * about how the desk is running now rather than about last quarter.
 */
export const WINDOW_DAYS = 28;

/**
 * The fewest jobs that may stand behind a median.
 *
 * Three. At one the "median" is that job; at two it is the midpoint of two
 * jobs, which is a mean wearing a different hat. Neither deserves a decimal
 * point. Three is not a large sample and this does not pretend otherwise —
 * the count is printed beside every number precisely so nobody has to take
 * the median's word for how much is behind it.
 */
export const MIN_SAMPLE = 3;

export interface Interval {
  jobId: string;
  /** When the brief happened. */
  from: string;
  /** When the end milestone happened. */
  to: string;
}

export interface ElapsedReading {
  id: string;
  label: string;
  /** Median elapsed days, or null when the sample is too small to report one. */
  days: number | null;
  /** How many jobs stand behind it. Shown whether or not there is a number. */
  n: number;
  /** True when a median is being reported. */
  enough: boolean;
  /** The reading, said plainly, including when there is not one. */
  says: string;
}

function daysBetween(from: string, to: string): number | null {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / DAY_MS;
}

/** The middle value. Not the mean: one job that took a year moves a mean. */
export function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

/**
 * The intervals that count towards this window.
 *
 * An interval qualifies on when it *finished*, not when it started. A job
 * briefed five months ago that got its signature on Tuesday is news about this
 * week and belongs in the window; a job briefed on Tuesday that has not
 * finished has no elapsed time yet and belongs nowhere. Selecting on the start
 * instead would quietly exclude every long job from every window, which is the
 * one bias a time-to-hire number must not have.
 *
 * An interval that ends before it starts is dropped rather than clamped. It
 * means two timestamps disagree, and averaging a contradiction into the middle
 * of a distribution hides it.
 */
export function withinWindow(
  intervals: Interval[],
  now: string,
  windowDays = WINDOW_DAYS,
): number[] {
  const values: number[] = [];
  for (const interval of intervals) {
    const age = daysBetween(interval.to, now);
    if (age === null || age < 0 || age > windowDays) continue;
    const elapsed = daysBetween(interval.from, interval.to);
    if (elapsed === null || elapsed < 0) continue;
    values.push(elapsed);
  }
  return values;
}

/** Days, to one decimal place, which is as fine as a date-stamped event earns. */
export function sayDays(days: number): string {
  return `${days.toFixed(1)} days`;
}

/**
 * One measure, as a number and a sentence, or as a refusal and a count.
 *
 * The sentence is not decoration. "12.5 days" over three jobs and "12.5 days"
 * over thirty are different claims printed identically, and the only thing
 * that tells them apart is the n beside them.
 */
export function elapsedReading(
  measure: ElapsedMeasure,
  intervals: Interval[],
  now: string,
  options: { windowDays?: number; minSample?: number } = {},
): ElapsedReading {
  const windowDays = options.windowDays ?? WINDOW_DAYS;
  const minSample = options.minSample ?? MIN_SAMPLE;
  const values = withinWindow(intervals, now, windowDays);
  const n = values.length;

  if (n < minSample) {
    return {
      id: measure.id,
      label: measure.label,
      days: null,
      n,
      enough: false,
      says: `not enough closed searches yet — ${n} in the last ${windowDays} days`,
    };
  }

  const days = medianOf(values)!;
  return {
    id: measure.id,
    label: measure.label,
    days,
    n,
    enough: true,
    says: `${sayDays(days)} · n=${n} · last ${windowDays} days`,
  };
}

export interface MilestoneRow {
  jobId: string;
  kind: MilestoneKind;
  occurredAt: string;
}

/**
 * Pair the milestones up into intervals, one per job per measure.
 *
 * A job contributes to a measure only when it has both ends. Missing either is
 * not a zero and not a default — it is a job this measure has nothing to say
 * about, and it is left out so the n stays truthful.
 */
export function intervalsFor(
  measure: ElapsedMeasure,
  rows: MilestoneRow[],
): Interval[] {
  const from = new Map<string, string>();
  const to = new Map<string, string>();
  for (const row of rows) {
    // Earliest wins. These milestones happen once; a second row for the same
    // kind is a correction or a re-run, and the first time it happened is the
    // one the interval is about.
    const bucket =
      row.kind === measure.from ? from : row.kind === measure.to ? to : null;
    if (!bucket) continue;
    const held = bucket.get(row.jobId);
    if (held === undefined || row.occurredAt < held)
      bucket.set(row.jobId, row.occurredAt);
  }
  const intervals: Interval[] = [];
  for (const [jobId, start] of from) {
    const end = to.get(jobId);
    if (end !== undefined) intervals.push({ jobId, from: start, to: end });
  }
  return intervals;
}

/**
 * All three measures, over one scope of jobs.
 *
 * The caller passes the jobs; this never widens the set. A number drawn from
 * jobs the reader has filtered away is a number about a desk they are not
 * looking at, and they have no way to tell from the figure that it happened.
 */
export function elapsedReadings(
  rows: MilestoneRow[],
  now: string,
  options: { windowDays?: number; minSample?: number } = {},
): ElapsedReading[] {
  return ELAPSED_MEASURES.map((measure) =>
    elapsedReading(measure, intervalsFor(measure, rows), now, options),
  );
}
