/**
 * The politeness reducer. Every case here is a way a published floor could be
 * shortened by accident, which is the one thing this layer must never do.
 */
import { describe, expect, it } from "vitest";
import {
  budgetLeft,
  DEFAULT_INTERVAL_MS,
  FAILURES_BEFORE_STAND_DOWN,
  intervalMs,
  isReady,
  MAX_WAIT_MS,
  newHostPace,
  noteOutcome,
  parseRetryAfter,
  THROTTLE_BACKOFF_MS,
  unlistedCapLeft,
  UNLISTED_HOST_REQUEST_CAP,
  type RunBudget,
} from "@/lib/fetch/pace";

const NOW = 1_700_000_000_000;
const empty: RunBudget = { requests: 0, bytes: 0, elapsedMs: 0 };

describe("intervalMs", () => {
  it("is the default when nothing was published", () => {
    expect(intervalMs(newHostPace("h.example", NOW))).toBe(DEFAULT_INTERVAL_MS);
  });

  it("converts a published crawl-delay from seconds", () => {
    const pace = { ...newHostPace("h.example", NOW), crawlDelaySeconds: 10 };
    expect(intervalMs(pace)).toBe(10_000);
  });

  it("never goes below the floor, even for Crawl-delay: 0", () => {
    const pace = { ...newHostPace("h.example", NOW), crawlDelaySeconds: 0 };
    expect(intervalMs(pace)).toBe(DEFAULT_INTERVAL_MS);
  });
});

describe("parseRetryAfter", () => {
  it("reads the seconds form", () => {
    expect(parseRetryAfter("30", NOW)).toBe(30_000);
  });

  it("reads the HTTP-date form", () => {
    const at = new Date(NOW + 45_000).toUTCString();
    expect(parseRetryAfter(at, NOW)).toBeGreaterThan(44_000);
  });

  it("returns null rather than zero for a past or unreadable value", () => {
    expect(
      parseRetryAfter(new Date(NOW - 60_000).toUTCString(), NOW),
    ).toBeNull();
    expect(parseRetryAfter("soon", NOW)).toBeNull();
    expect(parseRetryAfter("0", NOW)).toBeNull();
    expect(parseRetryAfter(null, NOW)).toBeNull();
  });
});

describe("noteOutcome", () => {
  it("charges the budget for every response that left the socket", () => {
    let state = {
      pace: newHostPace("h.example", NOW),
      budget: empty,
      waitMs: 0,
    };
    for (const outcome of [
      { kind: "ok" as const, bytes: 100 },
      { kind: "serverError" as const },
      { kind: "throttled" as const, retryAfter: null },
    ]) {
      state = noteOutcome(state.pace, state.budget, outcome, NOW);
    }
    expect(state.budget.requests).toBe(3);
    expect(state.budget.bytes).toBe(100);
  });

  it("lets Retry-After lengthen a wait and never shorten it", () => {
    const pace = newHostPace("h.example", NOW);
    const short = noteOutcome(
      pace,
      empty,
      { kind: "throttled", retryAfter: "1" },
      NOW,
    );
    // One second is shorter than the first backoff step, so the step wins.
    expect(short.waitMs).toBe(THROTTLE_BACKOFF_MS[0]);
    const long = noteOutcome(
      pace,
      empty,
      { kind: "throttled", retryAfter: "30" },
      NOW,
    );
    expect(long.waitMs).toBe(30_000);
  });

  it("a malformed Retry-After is never shorter than no header at all", () => {
    const pace = newHostPace("h.example", NOW);
    const bad = noteOutcome(
      pace,
      empty,
      { kind: "throttled", retryAfter: "yesterday" },
      NOW,
    );
    const none = noteOutcome(
      pace,
      empty,
      { kind: "throttled", retryAfter: null },
      NOW,
    );
    expect(bad.waitMs).toBe(none.waitMs);
  });

  it("resets the counters on a good answer", () => {
    let pace = newHostPace("h.example", NOW);
    pace = noteOutcome(
      pace,
      empty,
      { kind: "throttled", retryAfter: null },
      NOW,
    ).pace;
    expect(pace.throttles).toBe(1);
    pace = noteOutcome(pace, empty, { kind: "ok", bytes: 1 }, NOW).pace;
    expect(pace.throttles).toBe(0);
    expect(pace.consecutiveFailures).toBe(0);
  });

  it("stands a host down after four failures running", () => {
    let pace = newHostPace("h.example", NOW);
    for (let i = 0; i < FAILURES_BEFORE_STAND_DOWN; i++) {
      pace = noteOutcome(pace, empty, { kind: "transportError" }, NOW).pace;
    }
    expect(pace.standDown).toContain("four times running");
    expect(isReady(pace, NOW + 1_000_000)).toBe(false);
  });

  it("stands a host down rather than parking on a very long pause", () => {
    const pace = newHostPace("h.example", NOW);
    const step = noteOutcome(
      pace,
      empty,
      { kind: "throttled", retryAfter: String(MAX_WAIT_MS / 1000 + 60) },
      NOW,
    );
    expect(step.pace.standDown).toContain("longer than one run waits");
  });

  it("leaves a host's counters alone when we were the ones who declined", () => {
    const pace = noteOutcome(
      newHostPace("h.example", NOW),
      empty,
      { kind: "refused" },
      NOW,
    ).pace;
    expect(pace.consecutiveFailures).toBe(0);
    expect(pace.throttles).toBe(0);
    expect(pace.requests).toBe(1);
  });
});

describe("budgets", () => {
  it("stops a run on requests, bytes or wall clock, and says which", () => {
    expect(
      budgetLeft({ requests: 40, bytes: 0, elapsedMs: 0 }).reason,
    ).toContain("requests");
    expect(
      budgetLeft({ requests: 0, bytes: 1e9, elapsedMs: 0 }).reason,
    ).toContain("as much as");
    expect(
      budgetLeft({ requests: 0, bytes: 0, elapsedMs: 1e9 }).reason,
    ).toContain("s");
    expect(budgetLeft(empty).ok).toBe(true);
  });

  it("caps a host nobody has read the terms of", () => {
    const pace = {
      ...newHostPace("h.example", NOW),
      requests: UNLISTED_HOST_REQUEST_CAP,
    };
    expect(unlistedCapLeft(pace).ok).toBe(false);
    expect(unlistedCapLeft(newHostPace("h.example", NOW)).ok).toBe(true);
  });
});
