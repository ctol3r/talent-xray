import { describe, expect, it } from "vitest";
import {
  computeFunnel,
  computeOutreachStats,
  computeSourceEffectiveness,
  computeTimeInStage,
  type StageEventRecord,
  type StageRecord,
} from "@/lib/domain/analytics";

const stages: StageRecord[] = [
  { key: "identified", label: "Identified", position: 0, isTerminal: false },
  { key: "contacted", label: "Contacted", position: 1, isTerminal: false },
  { key: "recruiter_screen", label: "Screen", position: 2, isTerminal: false },
  { key: "closed", label: "Closed", position: 3, isTerminal: true },
];

const events: StageEventRecord[] = [
  { candidateId: "a", fromStage: null, toStage: "identified", occurredAt: "2026-08-01T00:00:00Z" },
  { candidateId: "a", fromStage: "identified", toStage: "contacted", occurredAt: "2026-08-03T00:00:00Z" },
  { candidateId: "a", fromStage: "contacted", toStage: "recruiter_screen", occurredAt: "2026-08-07T00:00:00Z" },
  { candidateId: "b", fromStage: null, toStage: "identified", occurredAt: "2026-08-02T00:00:00Z" },
  { candidateId: "b", fromStage: "identified", toStage: "contacted", occurredAt: "2026-08-04T00:00:00Z" },
  { candidateId: "c", fromStage: null, toStage: "identified", occurredAt: "2026-08-05T00:00:00Z" },
];

describe("computeFunnel", () => {
  it("counts distinct candidates who ever entered each stage", () => {
    const funnel = computeFunnel(stages, events);
    expect(funnel.map((f) => [f.key, f.reached])).toEqual([
      ["identified", 3],
      ["contacted", 2],
      ["recruiter_screen", 1],
      ["closed", 0],
    ]);
  });

  it("computes conversion against the previous non-terminal stage", () => {
    const funnel = computeFunnel(stages, events);
    expect(funnel[0].conversionFromPrevious).toBeNull();
    expect(funnel[1].conversionFromPrevious).toBeCloseTo(2 / 3);
    expect(funnel[2].conversionFromPrevious).toBeCloseTo(1 / 2);
    expect(funnel[3].conversionFromPrevious).toBeNull(); // terminal
  });
});

describe("computeTimeInStage", () => {
  it("averages completed visits only", () => {
    const result = computeTimeInStage(events);
    // candidate a: identified 2d, contacted 4d; candidate b: identified 2d.
    expect(result.identified).toBe(2 * 24 * 3600 * 1000);
    expect(result.contacted).toBe(4 * 24 * 3600 * 1000);
    // recruiter_screen has no completed visit — absent, not zero.
    expect(result.recruiter_screen).toBeUndefined();
  });
});

describe("computeOutreachStats", () => {
  it("computes response rate over sent messages only", () => {
    const stats = computeOutreachStats([
      { status: "drafted" },
      { status: "sent" },
      { status: "replied" },
      { status: "no_reply" },
    ]);
    expect(stats.drafted).toBe(4);
    expect(stats.sent).toBe(3);
    expect(stats.replied).toBe(1);
    expect(stats.responseRate).toBeCloseTo(1 / 3);
  });
  it("returns null response rate with zero sent", () => {
    expect(computeOutreachStats([{ status: "drafted" }]).responseRate).toBeNull();
  });
});

describe("computeSourceEffectiveness", () => {
  it("attributes screen-or-beyond progress to source types", () => {
    const rows = computeSourceEffectiveness(
      new Map([
        ["a", ["github"]],
        ["b", ["linkedin"]],
        ["c", ["linkedin"]],
      ]),
      events,
      stages,
    );
    const github = rows.find((r) => r.sourceType === "github");
    const linkedin = rows.find((r) => r.sourceType === "linkedin");
    expect(github).toEqual({
      sourceType: "github",
      candidates: 1,
      reachedScreenOrBeyond: 1,
    });
    expect(linkedin).toEqual({
      sourceType: "linkedin",
      candidates: 2,
      reachedScreenOrBeyond: 0,
    });
  });
});
