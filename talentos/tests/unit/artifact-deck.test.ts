/**
 * The candidate deck (W20.3): ordering and poses are pure. The front card
 * is whichever a human chose; everything else keeps the order it was added
 * in, and nothing here scores or ranks.
 */
import { describe, expect, it } from "vitest";
import {
  DECK_DEPTH,
  DECK_HUES,
  cardPose,
  deckOrder,
  hueFor,
  nextInDeck,
} from "../../artifact-src/core/deck";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

describe("deckOrder", () => {
  it("puts the chosen card first and keeps the rest in their order", () => {
    expect(deckOrder(items, "c").map((i) => i.id)).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
  });
  it("leaves the order alone with no choice or an unknown one", () => {
    expect(deckOrder(items, null).map((i) => i.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    expect(deckOrder(items, "zz").map((i) => i.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });
  it("never mutates the input", () => {
    const copy = [...items];
    deckOrder(items, "d");
    expect(items).toEqual(copy);
  });
});

describe("cardPose", () => {
  it("fans each card further up and right, slightly smaller, behind the last", () => {
    const front = cardPose(0);
    const next = cardPose(1);
    expect(front).toMatchObject({ x: 0, y: 0, scale: 1, visible: true });
    expect(next.x).toBeGreaterThan(front.x);
    expect(next.y).toBeLessThan(front.y);
    expect(next.scale).toBeLessThan(front.scale);
    expect(next.z).toBeLessThan(front.z);
  });
  it("hides cards past the visible depth instead of dropping them", () => {
    expect(cardPose(DECK_DEPTH - 1).visible).toBe(true);
    expect(cardPose(DECK_DEPTH).visible).toBe(false);
    expect(cardPose(-3).position).toBe(0);
  });
});

describe("nextInDeck", () => {
  it("cycles in both directions and starts at the first card", () => {
    expect(nextInDeck(items, "a", 1)).toBe("b");
    expect(nextInDeck(items, "d", 1)).toBe("a");
    expect(nextInDeck(items, "a", -1)).toBe("d");
    expect(nextInDeck(items, null, 1)).toBe("a");
    expect(nextInDeck([], null, 1)).toBeNull();
  });
});

describe("hueFor", () => {
  it("follows the record's own index and wraps", () => {
    expect(hueFor(0)).toBe(DECK_HUES[0]);
    expect(hueFor(DECK_HUES.length)).toBe(DECK_HUES[0]);
    expect(hueFor(-1)).toBe(DECK_HUES[DECK_HUES.length - 1]);
  });
});
