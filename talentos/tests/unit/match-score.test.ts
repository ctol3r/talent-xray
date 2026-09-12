/**
 * The match percentage.
 *
 * A single number about a person is the most dangerous output this product
 * has, so the tests are mostly about what it refuses to do: it never counts
 * an unexamined criterion as a failure, it never hides how little was
 * examined, and it never turns a disqualifier upside down.
 */
import { describe, expect, it } from "vitest";
import {
  caveatFor,
  matchBand,
  scoreMatch,
  type RequirementKind,
} from "@/lib/domain/match-score";
import type { EvidenceItem } from "@/lib/core/payloads";

const item = (
  criterion: string,
  status: EvidenceItem["status"],
): EvidenceItem => ({ criterion, status, evidenceText: "because of x" });

const kinds =
  (map: Record<string, RequirementKind>) =>
  (criterion: string): RequirementKind =>
    map[criterion] ?? "preferred";

describe("an unexamined criterion is not a failure", () => {
  it("leaves missing and unknown out of the number entirely", () => {
    const score = scoreMatch(
      [
        item("Built a function", "strong"),
        item("Closed researchers", "unknown"),
        item("Knows the market", "missing"),
      ],
      kinds({}),
    );
    // Two of three could not be assessed; the one that could was strong.
    expect(score.match).toBe(100);
    expect(score.assessed).toBe(1);
    expect(score.total).toBe(3);
    expect(score.notAssessed).toEqual([
      "Closed researchers",
      "Knows the market",
    ]);
  });

  it("says how little was assessed, so 100% cannot be read as a verdict", () => {
    const score = scoreMatch(
      [
        item("A", "strong"),
        item("B", "unknown"),
        item("C", "unknown"),
        item("D", "unknown"),
      ],
      kinds({}),
    );
    expect(score.match).toBe(100);
    expect(score.coverage).toBe(25);
    expect(score.caveat).toContain("25%");
    expect(score.caveat).toContain("fraction");
  });

  it("gives no number at all when nothing could be assessed", () => {
    const score = scoreMatch([item("A", "unknown")], kinds({}));
    expect(score.match).toBeNull();
    expect(score.caveat).toContain("no number to give");
  });
});

describe("weighting", () => {
  it("counts a must-have for more than a preferred", () => {
    const strongMust = scoreMatch(
      [item("Must", "strong"), item("Nice", "contradictory")],
      kinds({ Must: "must_have", Nice: "preferred" }),
    );
    const strongNice = scoreMatch(
      [item("Must", "contradictory"), item("Nice", "strong")],
      kinds({ Must: "must_have", Nice: "preferred" }),
    );
    expect(strongMust.match).toBeGreaterThan(strongNice.match!);
  });

  it("counts partial as half", () => {
    expect(scoreMatch([item("A", "partial")], kinds({})).match).toBe(50);
  });
});

describe("a disqualifier runs the other way", () => {
  it("treats contradicting one as good news", () => {
    // "Volume-only background" contradicted by the evidence is a point in
    // the candidate's favour, not against.
    const score = scoreMatch(
      [item("Volume only", "contradictory")],
      kinds({ "Volume only": "disqualifier" }),
    );
    expect(score.match).toBe(100);
    expect(score.disqualifiersMet).toEqual([]);
  });

  it("surfaces one the evidence supports, above everything else", () => {
    const score = scoreMatch(
      [item("Great at everything", "strong"), item("Volume only", "strong")],
      kinds({ "Volume only": "disqualifier" }),
    );
    expect(score.disqualifiersMet).toEqual(["Volume only"]);
    expect(score.caveat).toContain("Volume only");
    expect(score.caveat).toContain("before anything else");
  });
});

describe("the caveat is always attached", () => {
  it("says something in every state", () => {
    for (const [match, coverage, gaps] of [
      [null, 0, 3],
      [100, 25, 3],
      [80, 100, 0],
      [60, 90, 1],
    ] as [number | null, number, number][]) {
      expect(caveatFor(match, coverage, gaps, []).length).toBeGreaterThan(20);
    }
  });
});

describe("the band is for colour only", () => {
  it("has no band when there is no number", () => {
    expect(matchBand(null)).toBe("none");
    expect(matchBand(85)).toBe("high");
    expect(matchBand(50)).toBe("mid");
    expect(matchBand(10)).toBe("low");
  });
});
