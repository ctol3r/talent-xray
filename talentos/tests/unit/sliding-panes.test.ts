/**
 * The pane stack, in the manner of Andy Matuschak's notes.
 *
 * The behaviour that makes it a trail rather than a pile is entirely in
 * `nextStack`, so that is what is tested. Opening from a pane replaces
 * everything beyond it — take a different turning and the rest of the path
 * goes with it, the way it would in your head. Opening something already
 * open moves to it rather than duplicating it. And there is no limit.
 */
import { describe, expect, it } from "vitest";
import {
  nextStack,
  paneWidth,
  PANE_WIDTH_MAX,
  PANE_WIDTH_MIN,
  railWidth,
  railWidthOf,
  readPanes,
} from "@/components/sliding-panes";
import {
  MENU_OPEN_WIDTH,
  MENU_SHUT_WIDTH,
} from "@/components/workspace-layout";

describe("reading the stack out of the URL", () => {
  it("takes the list in order and drops repeats", () => {
    expect(readPanes("a,b,c")).toEqual(["a", "b", "c"]);
    expect(readPanes("a, b ,a")).toEqual(["a", "b"]);
    expect(readPanes(null)).toEqual([]);
    expect(readPanes("")).toEqual([]);
  });

  it("has no cap, because a trail is as long as it is", () => {
    const many = Array.from({ length: 40 }, (_, i) => `p${i}`);
    expect(readPanes(many.join(","))).toHaveLength(40);
  });
});

describe("opening a page", () => {
  it("appends when opened from the end", () => {
    expect(nextStack(["a", "b"], "c", 1)).toEqual(["a", "b", "c"]);
  });

  it("replaces the rest of the trail when opened from further back", () => {
    // Standing on 'a' and taking a different turning: b and c are no longer
    // on the path, so they leave with it.
    expect(nextStack(["a", "b", "c"], "d", 0)).toEqual(["a", "d"]);
  });

  it("appends to the end when no origin is given", () => {
    expect(nextStack(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });

  it("moves to a page already open rather than duplicating it", () => {
    expect(nextStack(["a", "b", "c"], "b", 2)).toEqual(["a", "b"]);
    expect(nextStack(["a", "b", "c"], "a")).toEqual(["a"]);
  });

  it("lets the origin win over an already-open page further along", () => {
    // From 'a', opening 'c' means a→c, not a→b→c. Keeping 'b' would leave a
    // pane on the trail that the trail no longer goes through.
    expect(nextStack(["a", "b", "c"], "c", 0)).toEqual(["a", "c"]);
  });

  it("opens from an empty stack", () => {
    expect(nextStack([], "a")).toEqual(["a"]);
    expect(nextStack([], "a", 5)).toEqual(["a"]);
  });

  it("grows without limit", () => {
    let stack: string[] = [];
    for (let i = 0; i < 30; i += 1) {
      stack = nextStack(stack, `p${i}`, stack.length - 1);
    }
    expect(stack).toHaveLength(30);
    expect(stack[29]).toBe("p29");
  });
});

describe("how wide a pane is", () => {
  it("grows with the window, between a floor and a ceiling", () => {
    // The floor is what a pane used to be, so nothing regresses on a small
    // screen; the ceiling is where a pane stops being one and becomes a page.
    expect(paneWidth(1024)).toBe(PANE_WIDTH_MIN);
    expect(paneWidth(1440)).toBeGreaterThan(PANE_WIDTH_MIN);
    expect(paneWidth(2560)).toBe(PANE_WIDTH_MAX);
    expect(paneWidth(1680)).toBeGreaterThan(paneWidth(1280));
  });

  it("still leaves the page its minimum wherever both can have theirs", () => {
    for (const viewport of [1280, 1440, 1920, 2560]) {
      for (const count of [1, 2, 3, 6]) {
        const page = viewport - 208 - railWidth(count, viewport);
        expect(page).toBeGreaterThanOrEqual(420);
      }
    }
  });

  it("keeps a whole pane rather than a whole page on a small window", () => {
    // Below about 1150px the page's 420 and one usable pane do not both fit,
    // and something has to give. It is the page: a pane cut off down its right
    // edge is not a pane, whereas a narrower page is still a page. Pinned here
    // because it is a choice, not an accident of the arithmetic.
    const rail = railWidth(1, 1024);
    expect(rail).toBeGreaterThanOrEqual(paneWidth(1024));
    expect(1024 - 208 - rail).toBeLessThan(420);
  });

  it("fits one whole pane in the rail wherever there is room for one", () => {
    for (const viewport of [1280, 1440, 1920]) {
      expect(railWidth(1, viewport)).toBeGreaterThanOrEqual(
        paneWidth(viewport),
      );
    }
  });
});

describe("the rail, once the reader can move things", () => {
  it("sums the widths it is actually given, not a count times a default", () => {
    // A pane dragged wider has to be in the sum, or the page reserves room for
    // a rail narrower than the one that gets drawn and the two overlap.
    const wide = railWidthOf([600, 600], 1920, MENU_OPEN_WIDTH);
    const narrow = railWidthOf([300, 300], 1920, MENU_OPEN_WIDTH);
    expect(wide).toBeGreaterThan(narrow);
  });

  it("gives the page the room a shut menu hands back", () => {
    // Six panes is past the point where the rail stops growing, so the extra
    // 160px goes to the rail rather than being left on the floor.
    const open = railWidth(6, 1440, MENU_OPEN_WIDTH);
    const shut = railWidth(6, 1440, MENU_SHUT_WIDTH);
    expect(shut - open).toBe(MENU_OPEN_WIDTH - MENU_SHUT_WIDTH);
  });

  it("does not let one widened pane push the page off the screen", () => {
    // Widening one pane is a request about that pane. The floor stays the
    // default width, so an over-wide pane scrolls inside the rail instead.
    const silly = railWidthOf([1100], 1440, MENU_OPEN_WIDTH);
    expect(1440 - MENU_OPEN_WIDTH - silly).toBeGreaterThanOrEqual(420);
  });

  it("is nothing at all with nothing open", () => {
    expect(railWidthOf([], 1440)).toBe(0);
  });
});
