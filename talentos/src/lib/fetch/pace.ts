/**
 * How fast, and when to stop.
 *
 * A pure reducer over one host's state plus a run-wide budget. It takes `now`
 * and returns the next state; it owns no timers, no sockets and no clock, so
 * the whole politeness policy can be tested as a table instead of a stopwatch.
 *
 * The rule that shapes everything here: a published floor may only ever be
 * lengthened. A crawl-delay, a `Retry-After`, a backoff step — each one sets a
 * minimum, and anything this module does to it (jitter, clamping, combining)
 * moves it up. Clamping a site's stated interval downward is the exact
 * impoliteness the interval was published to prevent.
 */

/** No published delay: two seconds is slower than a person clicking. */
export const DEFAULT_INTERVAL_MS = 2000;
/** A floor under any published delay, so `Crawl-delay: 0` is not a flood. */
export const MIN_INTERVAL_MS = 1000;
/** Longest wait honoured in one step. Beyond this the host is left for later. */
export const MAX_WAIT_MS = 120_000;
/** Backoff after a throttle that carried no `Retry-After`. */
export const THROTTLE_BACKOFF_MS = [5_000, 15_000, 45_000];
export const THROTTLES_BEFORE_STAND_DOWN = 3;
export const FAILURES_BEFORE_STAND_DOWN = 4;
/** One request in flight per host. Not configurable, and that is the point. */
export const HOST_CONCURRENCY = 1;

export interface RunBudget {
  /** Every response that left the socket counts, whatever its status. */
  requests: number;
  bytes: number;
  /** Wall-clock milliseconds since the run started. */
  elapsedMs: number;
}

export interface RunLimits {
  maxRequests: number;
  maxBytes: number;
  maxElapsedMs: number;
}

export const DEFAULT_RUN_LIMITS: RunLimits = {
  maxRequests: 40,
  maxBytes: 24 * 1024 * 1024,
  maxElapsedMs: 180_000,
};

export interface HostPace {
  host: string;
  /** From robots, when the host published one. Seconds, as written. */
  crawlDelaySeconds: number | null;
  /** Epoch ms before which nothing may be sent to this host. */
  nextAllowedAt: number;
  requests: number;
  consecutiveFailures: number;
  throttles: number;
  /** Set once this host is out of the run, with the sentence saying why. */
  standDown: string | null;
}

export function newHostPace(host: string, now: number): HostPace {
  return {
    host,
    crawlDelaySeconds: null,
    nextAllowedAt: now,
    requests: 0,
    consecutiveFailures: 0,
    throttles: 0,
    standDown: null,
  };
}

/** The gap this host asks for, in milliseconds, never below the floor. */
export function intervalMs(pace: HostPace): number {
  const published =
    pace.crawlDelaySeconds === null ? 0 : pace.crawlDelaySeconds * 1000;
  return Math.max(MIN_INTERVAL_MS, DEFAULT_INTERVAL_MS, published);
}

export function isReady(pace: HostPace, now: number): boolean {
  return pace.standDown === null && now >= pace.nextAllowedAt;
}

/**
 * `Retry-After` in both of its forms. A value that has already passed, or one
 * that cannot be read, returns null rather than zero — a zero would make a
 * malformed header produce a shorter pause than no header at all.
 */
export function parseRetryAfter(
  value: string | null,
  now: number,
): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/u.test(trimmed)) {
    const ms = Number(trimmed) * 1000;
    return ms > 0 ? ms : null;
  }
  const at = Date.parse(trimmed);
  if (Number.isNaN(at)) return null;
  const ms = at - now;
  return ms > 0 ? ms : null;
}

export type PaceOutcome =
  | { kind: "ok"; bytes: number }
  | { kind: "throttled"; retryAfter: string | null }
  | { kind: "serverError" }
  | { kind: "transportError" }
  | { kind: "refused" };

export interface PaceStep {
  pace: HostPace;
  budget: RunBudget;
  /** How long before this host may be asked again. */
  waitMs: number;
}

/**
 * Fold one response into the host's state and the run's budget.
 *
 * Every outcome that left the socket charges the budget, including the ones
 * that failed: a run that retries its way through a broken host is spending
 * somebody's bandwidth whether or not it got a page back.
 */
export function noteOutcome(
  pace: HostPace,
  budget: RunBudget,
  outcome: PaceOutcome,
  now: number,
): PaceStep {
  const next: HostPace = { ...pace, requests: pace.requests + 1 };
  const spent: RunBudget = {
    requests: budget.requests + 1,
    bytes: budget.bytes + (outcome.kind === "ok" ? outcome.bytes : 0),
    elapsedMs: budget.elapsedMs,
  };
  const base = intervalMs(pace);
  let wait = base;

  switch (outcome.kind) {
    case "ok":
      next.consecutiveFailures = 0;
      next.throttles = 0;
      break;
    case "refused":
      // The host answered and we chose not to read it. Nothing is wrong with
      // the host, so its counters are untouched.
      break;
    case "throttled": {
      next.throttles = pace.throttles + 1;
      const step =
        THROTTLE_BACKOFF_MS[
          Math.min(next.throttles - 1, THROTTLE_BACKOFF_MS.length - 1)
        ];
      const asked = parseRetryAfter(outcome.retryAfter, now);
      // The header may lengthen the wait and never shorten it.
      wait = Math.max(base, step, asked ?? 0);
      if (next.throttles >= THROTTLES_BEFORE_STAND_DOWN) {
        next.standDown =
          "asked us to slow down more than twice, so we stopped asking";
      }
      break;
    }
    case "serverError":
    case "transportError": {
      next.consecutiveFailures = pace.consecutiveFailures + 1;
      const step =
        THROTTLE_BACKOFF_MS[
          Math.min(next.consecutiveFailures - 1, THROTTLE_BACKOFF_MS.length - 1)
        ];
      wait = Math.max(base, step);
      if (next.consecutiveFailures >= FAILURES_BEFORE_STAND_DOWN) {
        next.standDown =
          "did not answer four times running, so we stopped asking";
      }
      break;
    }
  }

  // A wait longer than we will hold for takes the host out of this run rather
  // than parking a worker on it. The address is still composed for the
  // recruiter, so nothing is lost except our own patience.
  if (wait > MAX_WAIT_MS && !next.standDown) {
    next.standDown = `asked for a pause of ${Math.round(wait / 1000)}s, which is longer than one run waits`;
  }
  next.nextAllowedAt = now + wait;
  return { pace: next, budget: spent, waitMs: wait };
}

export interface BudgetVerdict {
  ok: boolean;
  reason: string;
}

export function budgetLeft(
  budget: RunBudget,
  limits: RunLimits = DEFAULT_RUN_LIMITS,
): BudgetVerdict {
  if (budget.requests >= limits.maxRequests) {
    return {
      ok: false,
      reason: `this run has made its ${limits.maxRequests} requests`,
    };
  }
  if (budget.bytes >= limits.maxBytes) {
    return {
      ok: false,
      reason: "this run has read as much as it is allowed to",
    };
  }
  if (budget.elapsedMs >= limits.maxElapsedMs) {
    return {
      ok: false,
      reason: `this run has taken its ${Math.round(limits.maxElapsedMs / 1000)}s`,
    };
  }
  return { ok: true, reason: "" };
}

/**
 * A host nobody has cleared gets a small budget rather than an unlimited one:
 * enough to read the pages a search actually returned, not enough to walk a
 * site. Named separately from the run budget because it survives the run —
 * the caller carries it between runs if it wants the cap to mean anything.
 */
export const UNLISTED_HOST_REQUEST_CAP = 8;

export function unlistedCapLeft(pace: HostPace): BudgetVerdict {
  if (pace.requests >= UNLISTED_HOST_REQUEST_CAP) {
    return {
      ok: false,
      reason: `nobody has read this host's terms, so it is asked at most ${UNLISTED_HOST_REQUEST_CAP} times in a run`,
    };
  }
  return { ok: true, reason: "" };
}
