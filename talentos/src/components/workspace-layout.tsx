"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * How big the workspace's surfaces are, and who is allowed to say.
 *
 * Three things had one answer each, decided in a constant: the menu was always
 * 208px, a pane was always the same width as every other pane, and there was
 * nowhere along the bottom to put anything. All three are now the reader's to
 * set, which means the numbers have to live somewhere every surface can see —
 * the menu, the pane rail and the page each reserve room based on the other
 * two, and a layout where two components disagree about a width is a layout
 * with a gap or an overlap in it.
 *
 * So: one store, read through `useSyncExternalStore`, written by whichever
 * handle was dragged. No provider, because a provider would have to wrap the
 * shell and every one of these is read by something outside it.
 *
 * Where each thing is kept is a judgement about how long it should last:
 *
 *  - the menu is a **preference** — you either work with it open or you do
 *    not — so it is in `localStorage` and survives the tab.
 *  - pane sizes belong to **this trail of thought**, like the panes themselves,
 *    so they are in `sessionStorage` and tomorrow starts at the default. A
 *    pane you widened to read one table should not still be wide next week.
 */

/**
 * Where the workspace stops being a workspace and becomes one column.
 *
 * Below this the menu, the page and the pane rail cannot all have their
 * minimum at once — 208 + 420 is already more than a phone has — so rather
 * than shrinking all three into uselessness, the menu and the rail stop
 * holding ground of their own and lie over the page when they are open.
 *
 * 768 rather than a phone width, because the arithmetic fails long before a
 * phone: at 700px the page is down to 70px once a pane is open.
 */
export const NARROW_MAX = 768;

const MENU_KEY = "talentos.menu";
const SIZES_KEY = "talentos.pane-sizes";
const EVENT = "talentos:layout";

/** Open: room for the words. */
export const MENU_OPEN_WIDTH = 208;
/**
 * Shut: room for the icons and nothing else.
 *
 * Not zero. A menu that vanishes takes navigation with it and leaves you
 * hunting for the way back, so "closed" here means the labels go and the icons
 * stay — 160px returned to the page, and everywhere still one click away.
 */
export const MENU_SHUT_WIDTH = 48;

export const PANE_MIN_WIDTH = 280;
export const PANE_MAX_WIDTH = 1100;
/**
 * How far the page's own edges can be pulled in.
 *
 * The menu and the rail decide where the page *may* go; these decide where
 * inside that it actually sits. It is the one surface that had no handles of
 * its own — everything else in the workspace could be resized and the thing
 * you spend the day reading could not — and the usual reason to want them is
 * measure: a page of prose at 1600px is a line nobody's eye tracks.
 *
 * Bounded rather than free: `MIN_PAGE_WIDTH` is enforced when they are
 * applied, so no combination of drags can squeeze the page to nothing.
 */
export const PAGE_INSET_MAX = 640;
export const MIN_PAGE_WIDTH = 420;

export const BOTTOM_MIN_HEIGHT = 120;
export const BOTTOM_MAX_HEIGHT = 720;
export const BOTTOM_DEFAULT_HEIGHT = 260;

interface Sizes {
  /** Per-pane width overrides, by pane target. Absent means the default. */
  widths: Record<string, number>;
  bottomHeight: number;
  /** Extra gutter the reader has dragged in on each side of the page. */
  pageLeft: number;
  pageRight: number;
}

const NO_SIZES: Sizes = {
  widths: {},
  bottomHeight: BOTTOM_DEFAULT_HEIGHT,
  pageLeft: 0,
  pageRight: 0,
};

// ---------------------------------------------------------------------------
// the store

const listeners = new Set<() => void>();

function announce(): void {
  for (const listener of listeners) listener();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab, or another component in this one. Storage events do not fire
  // in the tab that wrote, which is what the local set is for.
  window.addEventListener("storage", listener);
  window.addEventListener(EVENT, listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
    window.removeEventListener(EVENT, listener);
  };
}

/**
 * Snapshots are cached because `useSyncExternalStore` compares by identity: a
 * fresh object parsed on every read would report a change on every render and
 * loop forever.
 */
let menuCache: { raw: string | null; value: boolean } | null = null;
let sizesCache: { raw: string | null; value: Sizes } | null = null;

function readMenu(): boolean {
  try {
    const raw = window.localStorage.getItem(MENU_KEY);
    if (!menuCache || menuCache.raw !== raw) {
      menuCache = { raw, value: raw !== "shut" };
    }
    return menuCache.value;
  } catch {
    return true;
  }
}

function readSizes(): Sizes {
  try {
    const raw = window.sessionStorage.getItem(SIZES_KEY);
    if (!sizesCache || sizesCache.raw !== raw) {
      sizesCache = { raw, value: parseSizes(raw) };
    }
    return sizesCache.value;
  } catch {
    return NO_SIZES;
  }
}

function parseSizes(raw: string | null): Sizes {
  if (!raw) return NO_SIZES;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return NO_SIZES;
    const value = parsed as Partial<Sizes>;
    const widths: Record<string, number> = {};
    for (const [target, width] of Object.entries(value.widths ?? {})) {
      if (typeof width === "number" && Number.isFinite(width)) {
        widths[target] = clamp(width, PANE_MIN_WIDTH, PANE_MAX_WIDTH);
      }
    }
    return {
      widths,
      bottomHeight: clamp(
        typeof value.bottomHeight === "number"
          ? value.bottomHeight
          : BOTTOM_DEFAULT_HEIGHT,
        BOTTOM_MIN_HEIGHT,
        BOTTOM_MAX_HEIGHT,
      ),
      pageLeft: clamp(value.pageLeft ?? 0, 0, PAGE_INSET_MAX),
      pageRight: clamp(value.pageRight ?? 0, 0, PAGE_INSET_MAX),
    };
  } catch {
    return NO_SIZES;
  }
}

export function clamp(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return low;
  return Math.min(high, Math.max(low, Math.round(value)));
}

function writeSizes(next: Sizes): void {
  try {
    window.sessionStorage.setItem(SIZES_KEY, JSON.stringify(next));
  } catch {
    // A browser that refuses storage still gets a working layout, just one
    // that forgets. Nothing here is worth failing a render over.
  }
  announce();
}

// ---------------------------------------------------------------------------
// the hooks

/**
 * Server-rendered and first-paint value: open. Guessing shut and correcting
 * would slide the whole page sideways on arrival for the people who left it
 * open, which is the more common case.
 */
export function useMenuOpen(): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(subscribe, readMenu, () => true);
  const set = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(MENU_KEY, next ? "open" : "shut");
    } catch {
      // Same as above: a forgotten preference beats a broken menu.
    }
    announce();
  }, []);
  return [open, set];
}

export function useMenuWidth(): number {
  const [open] = useMenuOpen();
  return open ? MENU_OPEN_WIDTH : MENU_SHUT_WIDTH;
}

export interface PaneSizes {
  /** Gutter dragged in on the page's left and right edges. */
  pageLeft: number;
  pageRight: number;
  setPageInset: (side: "left" | "right", value: number) => void;
  resetPageInsets: () => void;
  /** The width this pane was dragged to, or null for the default. */
  widthOf: (target: string) => number | null;
  setWidthOf: (target: string, width: number) => void;
  /** Back to whatever the window says it should be. */
  clearWidthOf: (target: string) => void;
  bottomHeight: number;
  setBottomHeight: (height: number) => void;
}

/** The window's width, remeasured as it changes. */
export function useViewportWidth(): number {
  const [width, setWidth] = useState(1440);
  useEffect(() => {
    const measure = () => {
      // A window that reports no width is not a narrow window — it is a
      // window nobody is looking at: a hidden tab, a detached frame, a
      // thumbnail capture. Treating zero as a phone collapses the whole
      // layout and then leaves it collapsed when the reader looks back.
      const measured = window.innerWidth;
      if (measured > 0) setWidth(measured);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return width;
}

/**
 * Whether the window is too small for three surfaces side by side.
 *
 * The first render says no, matching the server, so a wide window does not
 * flash a narrow layout on arrival. A phone corrects itself on the first
 * measurement, which is one frame.
 */
export function useIsNarrow(): boolean {
  return useViewportWidth() <= NARROW_MAX;
}

export function usePaneSizes(): PaneSizes {
  const sizes = useSyncExternalStore(subscribe, readSizes, () => NO_SIZES);
  return {
    widthOf: (target) => sizes.widths[target] ?? null,
    setWidthOf: (target, width) =>
      writeSizes({
        ...sizes,
        widths: {
          ...sizes.widths,
          [target]: clamp(width, PANE_MIN_WIDTH, PANE_MAX_WIDTH),
        },
      }),
    clearWidthOf: (target) => {
      const widths = { ...sizes.widths };
      delete widths[target];
      writeSizes({ ...sizes, widths });
    },
    bottomHeight: sizes.bottomHeight,
    setBottomHeight: (height) =>
      writeSizes({
        ...sizes,
        bottomHeight: clamp(height, BOTTOM_MIN_HEIGHT, BOTTOM_MAX_HEIGHT),
      }),
    pageLeft: sizes.pageLeft,
    pageRight: sizes.pageRight,
    setPageInset: (side, value) =>
      writeSizes({
        ...sizes,
        [side === "left" ? "pageLeft" : "pageRight"]: clamp(
          value,
          0,
          PAGE_INSET_MAX,
        ),
      }),
    resetPageInsets: () => writeSizes({ ...sizes, pageLeft: 0, pageRight: 0 }),
  };
}
