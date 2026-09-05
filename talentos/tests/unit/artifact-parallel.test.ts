/**
 * Parallel pages (W20.4). A ribbon is drawn only where the evidence check
 * found the quote, so the locator must agree with `quoteAppearsIn` exactly
 * — same normalization — and map back to the recruiter's original text.
 */
import { describe, expect, it } from "vitest";
import {
  locateQuote,
  normalizeWithMap,
  ribbonPath,
  segmentSource,
} from "../../artifact-src/core/parallel";
import { normalize, quoteAppearsIn } from "../../artifact-src/core/evidence";

const TEXT =
  "SYNTHETIC PROFILE — not a real person.\n  Built the   distributed “evaluation” harness\nused across the lab.\tTwo first-author papers.  ";

describe("normalizeWithMap", () => {
  it("produces exactly what the evidence check normalizes to", () => {
    for (const t of [
      TEXT,
      "  leading and trailing  ",
      "Curly ‘quotes’ and “doubles”",
      "MiXeD\n\n\nCASE",
      "",
      "   ",
    ]) {
      expect(normalizeWithMap(t).norm).toBe(normalize(t));
    }
  });
  it("maps every normalized character back to a raw offset", () => {
    const { norm, map } = normalizeWithMap(TEXT);
    expect(map).toHaveLength(norm.length);
    for (let i = 0; i < norm.length; i += 1) {
      const raw = TEXT[map[i]];
      if (norm[i] === " ") expect(/\s/.test(raw)).toBe(true);
      else if (norm[i] === '"') expect(/["“”]/.test(raw)).toBe(true);
      else expect(raw.toLowerCase()).toBe(norm[i]);
    }
  });
});

describe("locateQuote", () => {
  it("finds a quote that differs in case, spacing and quote style, as raw offsets", () => {
    const quote =
      'built the distributed "evaluation" harness used across the lab';
    expect(quoteAppearsIn(quote, TEXT)).toBe(true);
    const span = locateQuote(quote, TEXT);
    expect(span).not.toBeNull();
    expect(TEXT.slice(span!.start, span!.end)).toBe(
      "Built the   distributed “evaluation” harness\nused across the lab",
    );
  });
  it("agrees with the evidence check: absent means null, too short means null", () => {
    expect(locateQuote("Led a team of twelve engineers", TEXT)).toBeNull();
    expect(quoteAppearsIn("Led a team of twelve engineers", TEXT)).toBe(false);
    expect(locateQuote("Built", TEXT)).toBeNull();
    expect(quoteAppearsIn("Built", TEXT)).toBe(false);
  });
  it("returns the first occurrence", () => {
    const t = "alpha beta gamma. alpha beta gamma.";
    expect(locateQuote("alpha beta", t)).toEqual({ start: 0, end: 10 });
  });
});

describe("segmentSource", () => {
  it("covers the whole text once, in order, with marks where quotes are", () => {
    const segs = segmentSource("0123456789", [
      { itemIndex: 1, span: { start: 6, end: 8 } },
      { itemIndex: 0, span: { start: 2, end: 4 } },
    ]);
    expect(segs.map((s) => s.text).join("")).toBe("0123456789");
    expect(segs).toEqual([
      { text: "01", itemIndex: null },
      { text: "23", itemIndex: 0 },
      { text: "45", itemIndex: null },
      { text: "67", itemIndex: 1 },
      { text: "89", itemIndex: null },
    ]);
  });
  it("keeps the earlier of two overlapping quotes rather than drawing both", () => {
    const segs = segmentSource("abcdefgh", [
      { itemIndex: 0, span: { start: 1, end: 5 } },
      { itemIndex: 1, span: { start: 3, end: 7 } },
    ]);
    expect(segs.filter((s) => s.itemIndex !== null)).toEqual([
      { text: "bcde", itemIndex: 0 },
    ]);
    expect(segs.map((s) => s.text).join("")).toBe("abcdefgh");
  });
  it("handles no quotes and empty spans", () => {
    expect(segmentSource("abc", [])).toEqual([
      { text: "abc", itemIndex: null },
    ]);
    expect(
      segmentSource("abc", [{ itemIndex: 0, span: { start: 1, end: 1 } }]),
    ).toEqual([{ text: "abc", itemIndex: null }]);
  });
});

describe("ribbonPath", () => {
  it("is a closed band from the mark's edge to the item's edge", () => {
    const d = ribbonPath(
      { x: 100, y: 50, height: 20 },
      { x: 300, y: 120, height: 28 },
    );
    expect(d).toMatch(/^M 100 40 /);
    expect(d).toContain("300 106");
    expect(d).toContain("300 134");
    expect(d).toMatch(/ Z$/);
    expect((d.match(/ C /g) ?? []).length).toBe(2);
  });
});
