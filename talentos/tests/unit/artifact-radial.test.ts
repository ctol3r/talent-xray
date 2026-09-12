/**
 * Wheel geometry (W20.2): eight equal segments, A at the top, reading
 * clockwise, with a hub that fits inside the hole.
 */
import { describe, expect, it } from "vitest";
import {
  hubRadius,
  polar,
  segmentAt,
  segmentPath,
  wheelSegments,
} from "../../artifact-src/core/radial";

const SPEC = { size: 360, thickness: 0.42, count: 8 };

describe("polar", () => {
  it("puts angle 0 at twelve o'clock and 90 at three o'clock", () => {
    const c = { x: 100, y: 100 };
    expect(polar(c, 50, 0)).toEqual({ x: 100, y: 50 });
    expect(polar(c, 50, 90)).toEqual({ x: 150, y: 100 });
    expect(polar(c, 50, 180)).toEqual({ x: 100, y: 150 });
  });
});

describe("wheelSegments", () => {
  const segs = wheelSegments(SPEC);
  it("produces exactly eight, tiling the full circle", () => {
    expect(segs).toHaveLength(8);
    for (let i = 0; i < 8; i += 1) {
      expect(segs[i].endAngle - segs[i].startAngle).toBeCloseTo(45);
      if (i > 0) expect(segs[i].startAngle).toBeCloseTo(segs[i - 1].endAngle);
    }
    expect(segs[7].endAngle - segs[0].startAngle).toBeCloseTo(360);
  });
  it("centres segment A on the top and reads clockwise", () => {
    expect(segs[0].anchor.x).toBeCloseTo(180);
    expect(segs[0].anchor.y).toBeLessThan(180);
    expect(segs[2].anchor.x).toBeGreaterThan(180); // C at three o'clock
    expect(segs[2].anchor.y).toBeCloseTo(180);
    expect(segs[4].anchor.y).toBeGreaterThan(180); // E at six o'clock
  });
  it("draws each slice as a closed ring path", () => {
    for (const s of segs) {
      expect(s.path).toMatch(/^M /);
      expect(s.path).toMatch(/ Z$/);
      expect((s.path.match(/ A /g) ?? []).length).toBe(2);
    }
  });
  it("keeps every anchor inside the ring", () => {
    const outer = SPEC.size / 2 - 2;
    const inner = outer * (1 - SPEC.thickness);
    for (const s of segs) {
      const d = Math.hypot(s.anchor.x - 180, s.anchor.y - 180);
      expect(d).toBeGreaterThan(inner);
      expect(d).toBeLessThan(outer);
    }
  });
});

describe("segmentAt", () => {
  it("maps an angle back to the segment that owns it", () => {
    expect(segmentAt(0, 8)).toBe(0);
    expect(segmentAt(20, 8)).toBe(0);
    expect(segmentAt(45, 8)).toBe(1);
    expect(segmentAt(-30, 8)).toBe(7);
    expect(segmentAt(359, 8)).toBe(0);
  });
});

describe("segmentPath and hubRadius", () => {
  it("leaves a gap between slices and a hub inside the hole", () => {
    const p = segmentPath({ x: 0, y: 0 }, 100, 50, 0, 90, 2);
    expect(p).toContain("A 100 100");
    expect(p).toContain("A 50 50");
    expect(hubRadius(SPEC)).toBeLessThan(
      (SPEC.size / 2 - 2) * (1 - SPEC.thickness),
    );
  });
});
