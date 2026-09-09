/**
 * The hill chart's rules.
 *
 * Almost every test here is about a refusal or a distinction, because that is
 * what the chart is: the difference between not-known and not-done, between a
 * scope nobody started and one that is stuck, and between a dot that arrived
 * yesterday and one that arrived a fortnight ago and has sat there since.
 */
import { describe, expect, it } from "vitest";
import {
  addScope,
  clampPosition,
  DEFAULT_SCOPES,
  defaultChart,
  finishScope,
  hillHeight,
  hillPoint,
  moveScope,
  phaseOf,
  readChart,
  readScope,
  removeScope,
  renameScope,
  snapshot,
  splitScope,
  STILL_AFTER_DAYS,
  STUCK_AFTER_DAYS,
  summariseChart,
  type HillChart,
} from "../../artifact-src/core/hill";

const DAY = 86_400_000;
const T0 = "2026-09-01T09:00:00.000Z";
const at = (days: number) =>
  new Date(Date.parse(T0) + days * DAY).toISOString();

describe("the shape of the hill", () => {
  it("is flat at both feet and highest at the crest", () => {
    expect(hillHeight(0)).toBeCloseTo(0);
    expect(hillHeight(0.5)).toBeCloseTo(1);
    expect(hillHeight(1)).toBeCloseTo(0);
    // Flat at the feet, so a dot near the start moves along the ground rather
    // than off an edge.
    expect(Math.abs(hillHeight(0.02) - hillHeight(0))).toBeLessThan(0.01);
  });

  it("rises then falls, and never doubles back", () => {
    for (let i = 1; i <= 50; i++) {
      expect(hillHeight(i / 100)).toBeGreaterThan(hillHeight((i - 1) / 100));
    }
    for (let i = 51; i <= 100; i++) {
      expect(hillHeight(i / 100)).toBeLessThan(hillHeight((i - 1) / 100));
    }
  });

  it("puts a dot on the curve, in the drawing's own coordinates", () => {
    const crest = hillPoint(0.5, 400, 200);
    expect(crest.x).toBeCloseTo(200);
    expect(crest.y).toBeCloseTo(0);
    expect(hillPoint(0, 400, 200).y).toBeCloseTo(200);
    // Out-of-range positions are pinned rather than drawn off the picture.
    expect(hillPoint(4, 400, 200).x).toBeCloseTo(400);
    expect(clampPosition(Number.NaN)).toBe(0);
  });
});

describe("what a position means", () => {
  it("names the crest as a place, not a line", () => {
    expect(phaseOf(0)).toBe("not started");
    expect(phaseOf(0.3)).toBe("uphill");
    expect(phaseOf(0.5)).toBe("at the crest");
    expect(phaseOf(0.52)).toBe("at the crest");
    expect(phaseOf(0.8)).toBe("downhill");
    expect(phaseOf(1)).toBe("as good as done");
  });
});

describe("every job starts with a chart", () => {
  it("has the scopes a search has to resolve, all at the left foot", () => {
    const chart = defaultChart();
    expect(chart.scopes).toHaveLength(DEFAULT_SCOPES.length);
    expect(chart.scopes.every((s) => s.position === 0)).toBe(true);
    expect(chart.history).toEqual([]);
    // Distinct ids and distinct colours, because two dots the same colour in
    // the same place are one dot.
    expect(new Set(chart.scopes.map((s) => s.id)).size).toBe(
      chart.scopes.length,
    );
    expect(new Set(chart.scopes.map((s) => s.colour)).size).toBe(
      chart.scopes.length,
    );
  });

  it("says every scope as the question it answers", () => {
    for (const scope of DEFAULT_SCOPES) {
      expect(scope.unknown.length).toBeGreaterThan(20);
      expect(scope.name).not.toMatch(/%|percent/i);
    }
  });
});

describe("the trail", () => {
  function chartMoving(positions: [number, number][]): HillChart {
    let chart = defaultChart();
    for (const [day, position] of positions) {
      chart = moveScope(chart, "s1", position);
      chart = snapshot(chart, "chris", "", at(day));
    }
    return chart;
  }

  it("keeps a snapshot only when something actually changed", () => {
    let chart = defaultChart();
    chart = moveScope(chart, "s1", 0.3);
    chart = snapshot(chart, "chris", "", at(0));
    // Opening the page again must not make a still scope look busy.
    chart = snapshot(chart, "chris", "", at(1));
    chart = snapshot(chart, "chris", "", at(2));
    expect(chart.history).toHaveLength(1);
    // Unless somebody wrote something, which is a change even when nothing moved.
    chart = snapshot(chart, "chris", "waiting on the manager", at(3));
    expect(chart.history).toHaveLength(2);
  });

  it("calls an untouched scope not started, never stuck", () => {
    const chart = chartMoving([[0, 0.3]]);
    const reading = readScope(chart.scopes[1], chart.history, at(60));
    expect(reading.phase).toBe("not started");
    expect(reading.signal).toBe("moving");
    expect(reading.says).toBe("not started");
  });

  it("raises a hand once a moving scope has sat still long enough", () => {
    const chart = chartMoving([
      [0, 0.2],
      [1, 0.35],
    ]);
    const scope = chart.scopes[0];
    expect(readScope(scope, chart.history, at(2)).signal).toBe("moving");
    expect(
      readScope(scope, chart.history, at(1 + STILL_AFTER_DAYS)).signal,
    ).toBe("still");
    const stuck = readScope(scope, chart.history, at(1 + STUCK_AFTER_DAYS));
    expect(stuck.signal).toBe("stuck");
    // Asks about the work, not about the person.
    expect(stuck.says).toContain("get it over the hill");
    expect(stuck.says).not.toMatch(/\byou\b|late|behind|failed/i);
  });

  it("reports a scope that crossed the crest and came back", () => {
    const chart = chartMoving([
      [0, 0.4],
      [1, 0.7],
      [2, 0.3],
    ]);
    const reading = readScope(chart.scopes[0], chart.history, at(3));
    expect(reading.signal).toBe("backslid");
    expect(reading.retreatedFrom).toBeCloseTo(0.7);
    expect(reading.says).toContain("looked solved");
  });

  it("outranks stillness with backsliding, because it is the louder signal", () => {
    const chart = chartMoving([
      [0, 0.8],
      [1, 0.2],
    ]);
    expect(readScope(chart.scopes[0], chart.history, at(90)).signal).toBe(
      "backslid",
    );
  });

  it("takes a finished scope off the hill however long it sat there", () => {
    let chart = chartMoving([[0, 0.9]]);
    chart = finishScope(chart, "s1", at(1));
    const reading = readScope(chart.scopes[0], chart.history, at(90));
    expect(reading.signal).toBe("done");
    expect(reading.says).toBe("done");
  });
});

describe("the line at the top", () => {
  it("counts unknowns and raised hands, and never a percentage", () => {
    let chart = defaultChart();
    chart = moveScope(chart, "s1", 0.8);
    chart = snapshot(chart, "chris", "", at(0));
    const line = summariseChart(readChart(chart, at(1)));
    expect(line).toContain("still has unknowns in it");
    expect(line).not.toMatch(/%|percent|complete/i);
  });

  it("says so plainly when nothing is left uphill", () => {
    let chart: HillChart = { scopes: [], history: [] };
    chart = addScope(chart, "One");
    chart = moveScope(chart, "s1", 0.9);
    expect(summariseChart(readChart(chart, at(0)))).toBe(
      "everything left is downhill",
    );
  });
});

describe("changing the scopes", () => {
  it("splits a stuck scope into two that can move independently", () => {
    let chart = defaultChart();
    chart = moveScope(chart, "s2", 0.4);
    chart = snapshot(chart, "chris", "", at(0));
    const before = chart.scopes.length;

    chart = splitScope(chart, "s2", "The band", "Sign-off on the band");
    expect(chart.scopes).toHaveLength(before + 1);
    // Both halves start where the original was: splitting a scope tells you
    // nothing new about how far along it is.
    const halves = chart.scopes.filter((s) =>
      ["The band", "Sign-off on the band"].includes(s.name),
    );
    expect(halves).toHaveLength(2);
    expect(halves.every((s) => Math.abs(s.position - 0.4) < 0.001)).toBe(true);
    // The original keeps its id, so its trail is not orphaned.
    expect(chart.scopes.find((s) => s.id === "s2")?.name).toBe("The band");
  });

  it("never reuses an id, so a new scope cannot inherit an old trail", () => {
    let chart = defaultChart();
    chart = removeScope(chart, "s3");
    chart = addScope(chart, "Something else");
    const ids = chart.scopes.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain("s3");
  });

  it("leaves the history alone when a scope is dropped", () => {
    let chart = defaultChart();
    chart = moveScope(chart, "s1", 0.6);
    chart = snapshot(chart, "chris", "", at(0));
    chart = removeScope(chart, "s1");
    // A snapshot records what the chart said on a day. Editing the past to
    // match the present is how a trail stops being evidence.
    expect(chart.history[0].positions.s1).toBeCloseTo(0.6);
  });

  it("keeps the old name when a rename is blank", () => {
    const chart = renameScope(defaultChart(), "s1", "   ");
    expect(chart.scopes[0].name).toBe(DEFAULT_SCOPES[0].name);
  });
});
