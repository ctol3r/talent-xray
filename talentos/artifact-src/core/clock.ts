/**
 * Each job's own clock, set at intake.
 *
 * A fortnight of silence on a search the manager wants filled in two weeks is
 * a crisis. The same fortnight on a search with a two-year horizon is a
 * Tuesday. Every measure in this product that has the word "recent" or
 * "stalled" in it was quietly assuming one pace for both, which makes it
 * wrong for almost every job: it nags on the slow ones and says nothing on
 * the fast ones, which is the worst of both.
 *
 * So nothing measures in absolute days any more. It measures in fractions of
 * the window the manager agreed to, and this file is where that window is
 * worked out.
 *
 * **The window is the job's opening to its target start date.** That is the
 * one time expectation the product actually captures — it is asked on the
 * intake form and stored on the job — so it is the one this can be built on
 * without inventing a field nobody filled in. When it is absent there is no
 * agreed window, and rather than guess, everything falls back to a stated
 * default and says that it has. A default nobody agreed to is not a fact
 * about the job, and the honest thing is for the page to say so and for the
 * fix to be obvious: agree a date.
 *
 * Nothing here imports anything, so the same clock runs in the artifact.
 */

const DAY_MS = 86_400_000;

/**
 * The window assumed when nobody agreed one.
 *
 * A fortnight, which is what every threshold in the product used before this
 * existed — so a job with no agreed date behaves exactly as it did, and
 * nothing changed underneath anybody without their asking for it.
 */
export const DEFAULT_HALF_LIFE_DAYS = 14;

/**
 * How much of the window one half-life is.
 *
 * A tenth. Ten half-lives across the search means activity from the first
 * tenth of it has faded to a thousandth by the end, which is the right shape:
 * what you did in week one of a twelve-week search should not still be
 * counting in week twelve.
 */
export const HALF_LIFE_SHARE = 0.1;

/**
 * Floor and ceiling, and both are about the reading being usable rather than
 * about the arithmetic.
 *
 * Under two days the number twitches hourly and nobody can act on it. Over
 * two months, "lately" has stopped meaning anything even on a multi-year
 * search — you still want to know whether it moved this quarter.
 */
export const MIN_HALF_LIFE_DAYS = 2;
export const MAX_HALF_LIFE_DAYS = 60;

export interface JobClock {
  /** Days from opening to the agreed start date. Null when none was agreed. */
  agreedDays: number | null;
  daysElapsed: number;
  /** Days until the agreed date; negative once it has passed. */
  daysLeft: number | null;
  /** 0 at the start of the agreed window, 1 at the agreed date, more after. */
  through: number | null;
  /** How fast activity stops counting on this job. */
  halfLifeDays: number;
  /**
   * How much longer this job may sit still before anything is said, as a
   * multiple of the default. A two-week search runs out of patience in a day;
   * a two-year one takes a month to be worth mentioning.
   */
  patience: number;
  /** The window, said plainly, including when there is not one. */
  says: string;
}

function days(from: string, to: string): number | null {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (b - a) / DAY_MS;
}

export function jobClock(
  openedAt: string,
  targetStartDate: string | null | undefined,
  now: string,
): JobClock {
  const elapsed = Math.max(0, days(openedAt, now) ?? 0);
  // A date is a day, not an instant. Reading it as midday stops a job agreed
  // for "the 30th" reading as overdue for the whole of the 30th.
  const target = (targetStartDate ?? "").trim();
  const agreed = target
    ? days(openedAt, `${target.slice(0, 10)}T12:00:00Z`)
    : null;

  // A start date in the past relative to the job's own opening is not a
  // window, it is a backfill somebody is already late for. There is nothing
  // to measure a pace against, so it is treated as no agreed window.
  const agreedDays = agreed !== null && agreed > 0 ? agreed : null;

  const halfLifeDays =
    agreedDays === null
      ? DEFAULT_HALF_LIFE_DAYS
      : Math.min(
          MAX_HALF_LIFE_DAYS,
          Math.max(MIN_HALF_LIFE_DAYS, agreedDays * HALF_LIFE_SHARE),
        );

  const daysLeft =
    agreedDays === null ? null : Math.round(agreedDays - elapsed);
  const through = agreedDays === null ? null : elapsed / agreedDays;

  return {
    agreedDays: agreedDays === null ? null : Math.round(agreedDays),
    daysElapsed: Math.round(elapsed),
    daysLeft,
    through,
    halfLifeDays,
    patience: halfLifeDays / DEFAULT_HALF_LIFE_DAYS,
    says: describe(agreedDays, daysLeft),
  };
}

function describe(agreedDays: number | null, daysLeft: number | null): string {
  if (agreedDays === null || daysLeft === null) {
    // Said as the missing agreement it is, not as a setting. The fix is a
    // conversation with the manager, not a form field.
    return "no start date agreed — measured on a default fortnight";
  }
  const window =
    agreedDays >= 720
      ? `${Math.round(agreedDays / 365)} years`
      : agreedDays >= 60
        ? `${Math.round(agreedDays / 30)} months`
        : `${Math.round(agreedDays / 7)} weeks`;
  if (daysLeft < 0) return `${window} agreed, ${-daysLeft} days past it`;
  if (daysLeft === 0) return `${window} agreed, due today`;
  return `${window} agreed, ${daysLeft} days left`;
}

/**
 * A threshold in days, on this job's clock.
 *
 * Floored at one day: a threshold under a day fires within an afternoon, and
 * a measure that goes off while you are still doing the thing is one people
 * turn off.
 */
export function onClock(days: number, clock: JobClock): number {
  return Math.max(1, Math.round(days * clock.patience));
}

/**
 * How pressed this job is, for sorting: 0 with the whole window ahead, 1 at
 * the agreed date, above 1 past it.
 *
 * A job with no agreed window sorts as though it were halfway through — not
 * at the front, because nobody has said it is urgent, and not at the back,
 * because nobody has said it is not. Sorting it either extreme would be this
 * product asserting something the manager never said.
 */
export function timePressure(clock: JobClock): number {
  return clock.through ?? 0.5;
}
