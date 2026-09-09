/**
 * A calendar day, in the reader's own timezone.
 *
 * Every timestamp in this database is stored as a UTC ISO string, because
 * that is the only way two machines can agree on an instant. Every *day* the
 * product shows is a local calendar day, because that is the only day a
 * person has: "what happened today" means the day you are living in, not the
 * day it is in Greenwich.
 *
 * Those two facts have to meet somewhere, and until this file existed they
 * met by accident. `todayKey()` returned the local date; the query that read
 * "that day" asked for `<date>T00:00:00Z` to `<date+1>T00:00:00Z`, which is a
 * different 24 hours everywhere except Greenwich. In California the daily
 * page dropped everything after 5pm and carried in yesterday's evening
 * instead — a whole afternoon of work missing from the page whose entire job
 * is to show you what you did.
 *
 * So there are exactly two conversions, and everything that buckets by day
 * goes through one of them:
 *
 *  - `dayOf(iso)` — which local day did this instant fall on?
 *  - `dayBounds(day)` — which instants bound this local day?
 *
 * Nothing here imports anything, so the artifact reads days the same way.
 */

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function keyOf(at: Date): string {
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/** Today, where the reader is. `YYYY-MM-DD`. */
export function todayKey(now = new Date()): string {
  return keyOf(now);
}

/**
 * Day arithmetic, done at noon UTC.
 *
 * A day key is a label rather than an instant, so this is deliberately not
 * timezone-aware: noon is far enough from either midnight that no offset and
 * no daylight-saving shift can push it into the wrong date.
 */
export function shiftDay(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dayTitle(day: string): string {
  return new Date(`${day}T12:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The local calendar day an instant fell on.
 *
 * Not `iso.slice(0, 10)`, which is the day in Greenwich and is wrong by one
 * for a third of the clock in most of the world. An unparseable string falls
 * back to the slice rather than throwing: a malformed row should show up in
 * the wrong bucket, not take the page down.
 */
export function dayOf(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime()) ? iso.slice(0, 10) : keyOf(at);
}

/** Midnight at the start of a local day, as the instant it actually is. */
function midnight(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, date ?? 1, 0, 0, 0, 0).toISOString();
}

/**
 * The half-open instant range `[from, to)` covering one local day.
 *
 * Both ends are ISO strings in the same shape as every stored timestamp, so
 * callers can keep comparing them as strings — which is what the SQL does.
 *
 * On the one day a year a timezone skips its own midnight, `midnight` returns
 * 1am instead. That is not a gap: the previous day's `to` is the same
 * expression as this day's `from`, so the two windows still meet exactly.
 */
export function dayBounds(day: string): { from: string; to: string } {
  return { from: midnight(day), to: midnight(shiftDay(day, 1)) };
}
