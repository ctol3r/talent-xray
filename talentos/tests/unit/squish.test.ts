/**
 * How hard a day is squeezed by how far it is from where you are reading.
 *
 * The arithmetic is separable from the DOM, and it is the part that decides
 * whether the effect reads as focus or as breakage: a fall that starts too
 * sharply snaps, and a floor that goes too low leaves a day nobody can aim at.
 */
import { describe, expect, it } from "vitest";
import { MIN_SQUISH, squishFor } from "@/components/squish";

describe("the squeeze", () => {
  it("leaves the reading band alone", () => {
    expect(squishFor(0)).toBe(1);
    expect(squishFor(200)).toBe(1);
    expect(squishFor(-200)).toBe(1);
  });

  it("is symmetrical: above and below read the same", () => {
    for (const at of [300, 600, 1200, 4000]) {
      expect(squishFor(at)).toBe(squishFor(-at));
    }
  });

  it("never squeezes past the floor", () => {
    for (const at of [1500, 5000, 100000]) {
      expect(squishFor(at)).toBeGreaterThanOrEqual(MIN_SQUISH);
    }
    expect(squishFor(100000)).toBeCloseTo(MIN_SQUISH, 5);
  });

  it("falls gently at first, so a day just outside the band does not snap", () => {
    // The first hundred pixels past the band cost less than the hundred after
    // them; a linear fall is what makes this look like a bug.
    const edge = squishFor(260);
    const near = squishFor(360);
    const further = squishFor(460);
    expect(edge - near).toBeLessThan(near - further);
  });

  it("shrinks all the way down as it goes", () => {
    let last = 1.1;
    for (let at = 0; at < 2000; at += 100) {
      const now = squishFor(at);
      expect(now).toBeLessThanOrEqual(last);
      last = now;
    }
  });
});
