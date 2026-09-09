/**
 * Where the job is, read off the hill.
 *
 * The phase row stopped being navigation and became a report, so what it
 * reports has to be defensible. Every test here is about the rule that makes
 * it defensible — the earliest phase with unknowns in it, not the furthest
 * phase anybody has touched — and about the two ways a chart can stop
 * answering: nobody has moved anything, or the scopes are no longer the
 * seven the derivation knows.
 */
import { describe, expect, it } from "vitest";
import {
  defaultChart,
  finishScope,
  moveScope,
  readChart,
  removeScope,
  renameScope,
  snapshot,
  type HillChart,
} from "../../artifact-src/core/hill";
import {
  DEFAULT_SCOPE_PHASE,
  JOB_PHASES,
  jobPhase,
} from "../../artifact-src/core/job-phase";
import { PHASES } from "@/components/workspace-nav";

const NOW = "2026-09-08T09:00:00.000Z";
const read = (chart: HillChart) => jobPhase(readChart(chart, NOW));

/** Everything in the named phases pushed over the crest. */
function settle(chart: HillChart, ids: string[]): HillChart {
  return ids.reduce((next, id) => moveScope(next, id, 0.7), chart);
}

describe("the four names", () => {
  it("are the nav's four, in the nav's order", () => {
    // Two files name these phases and neither may drift: the row that reports
    // and the row that links have to agree about what a phase is called and
    // which one comes first, because the derivation is the order.
    expect(PHASES.map((phase) => phase.id)).toEqual([...JOB_PHASES]);
  });

  it("cover every default scope exactly once", () => {
    const placed = Object.values(DEFAULT_SCOPE_PHASE);
    expect(placed).toHaveLength(defaultChart().scopes.length);
    for (const phase of JOB_PHASES) {
      expect(`${phase} has scopes: ${placed.includes(phase)}`).toBe(
        `${phase} has scopes: true`,
      );
    }
  });
});

describe("which phase the job is in", () => {
  it("starts in Understand, and says the chart has not been touched", () => {
    const reading = read(defaultChart());
    expect(reading.phase).toBe("understand");
    expect(reading.unread).toBe(true);
    expect(reading.says).toBe("nothing on the hill has moved yet");
  });

  it("moves on only when a phase's unknowns are gone", () => {
    const chart = defaultChart();
    // s1 over the crest, s2 still uphill: Understand is not finished with.
    expect(read(moveScope(chart, "s1", 0.8)).phase).toBe("understand");
    expect(read(settle(chart, ["s1", "s2"])).phase).toBe("find");
    expect(read(settle(chart, ["s1", "s2", "s3", "s4"])).phase).toBe("engage");
  });

  it("counts the crest as settled, because that is what the crest means", () => {
    // 0.5 is 'at the crest' — the unknowns are gone and what is left is doing
    // it. A phase whose scopes are all there is behind you.
    const chart = settle(defaultChart(), ["s2"]);
    expect(read(moveScope(chart, "s1", 0.5)).phase).toBe("find");
  });

  it("reports the earliest open phase, not the furthest one touched", () => {
    // Interviewing while the pay band is still a question. The calendar says
    // Engage; the work says the unknown is still in Understand, and this row
    // agrees with the work.
    let chart = settle(defaultChart(), ["s3", "s4", "s5", "s6"]);
    chart = moveScope(chart, "s1", 0.9);
    const reading = read(chart);
    expect(reading.phase).toBe("understand");
    expect(reading.says).toContain("What it pays");
  });

  it("lands on Decide when nothing anywhere is uphill", () => {
    const chart = settle(defaultChart(), [
      "s1",
      "s2",
      "s3",
      "s4",
      "s5",
      "s6",
      "s7",
    ]);
    const reading = read(chart);
    expect(reading.phase).toBe("decide");
    expect(reading.because).toBeNull();
    expect(reading.says).toBe("nothing left uphill");
  });

  it("treats a finished scope as settled", () => {
    let chart = settle(defaultChart(), ["s2"]);
    chart = finishScope(chart, "s1", NOW);
    expect(read(chart).phase).toBe("find");
  });
});

describe("what it says, and why", () => {
  it("names the scope that decided it", () => {
    const reading = read(defaultChart());
    // Unread charts say so instead; move one so there is a reason to give.
    const moved = read(moveScope(defaultChart(), "s3", 0.2));
    expect(reading.because).not.toBeNull();
    expect(moved.says).toContain("What the job is");
  });

  it("prefers a raised hand to an ordinary open scope", () => {
    // Both scopes are uphill in Understand. s1 last moved five weeks ago and
    // has a hand up; s2 moved yesterday. The row has one line, so it spends
    // it on the hand.
    let chart = defaultChart();
    chart = snapshot(chart, "test", "", "2026-07-25T09:00:00.000Z");
    chart = moveScope(chart, "s1", 0.3);
    chart = snapshot(chart, "test", "", "2026-08-01T09:00:00.000Z");
    chart = moveScope(chart, "s2", 0.3);
    chart = snapshot(chart, "test", "", "2026-09-07T09:00:00.000Z");
    const reading = read(chart);
    expect(reading.phase).toBe("understand");
    expect(reading.because?.scope.name).toBe("What the job is");
    expect(reading.because?.signal).toBe("stuck");
    expect(reading.says).toContain("has not moved in");
  });

  it("survives a renamed scope, because the id is what is keyed", () => {
    const chart = renameScope(
      settle(defaultChart(), ["s1", "s2"]),
      "s3",
      "Where the nurses actually are",
    );
    const reading = read(chart);
    expect(reading.phase).toBe("find");
    expect(reading.says).toContain("Where the nurses actually are");
  });
});

describe("charts the derivation cannot place", () => {
  it("ignores a scope the owner added, rather than guessing its phase", () => {
    // An added scope gets an id outside the seven, so it belongs to no phase.
    // Adding one must not move the job.
    const chart = settle(defaultChart(), ["s1", "s2"]);
    const before = read(chart).phase;
    const added = { ...chart, scopes: [...chart.scopes] };
    added.scopes.push({
      id: "s8",
      name: "Visa sponsorship",
      position: 0,
      unknown: "whether the budget covers it",
      doneAt: null,
      colour: "#7dd3fc",
    });
    expect(read(added).phase).toBe(before);
  });

  it("goes quiet when every scope has been replaced", () => {
    let chart = defaultChart();
    for (const scope of [...chart.scopes]) chart = removeScope(chart, scope.id);
    const reading = read(chart);
    expect(reading.unread).toBe(true);
    expect(reading.settled).toEqual([]);
  });

  it("does not call a phase settled when it has no scopes left", () => {
    // Deleting 'Where these people are' and 'Reaching them' must not report
    // Find as finished — there is nothing there to have finished.
    let chart = settle(defaultChart(), ["s1", "s2"]);
    chart = removeScope(chart, "s3");
    chart = removeScope(chart, "s4");
    expect(read(chart).settled).not.toContain("find");
    expect(read(chart).phase).toBe("engage");
  });
});
