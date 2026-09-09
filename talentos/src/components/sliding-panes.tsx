"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PRODUCT_NAME } from "@/lib/product";
import { useRibbonsOn } from "./parallel-ribbons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { graphNodeForRoute } from "@/lib/core/panes";
import {
  MENU_OPEN_WIDTH,
  NARROW_MAX,
  useIsNarrow,
  useMenuWidth,
  usePaneSizes,
  useViewportWidth,
} from "./workspace-layout";

export { useViewportWidth };
import {
  movePane,
  paneFallbackTitle,
  paneForRoute,
  paneIcon,
  paneTarget,
  parsePane,
  routeForPane,
} from "@/lib/core/panes";

/**
 * Stacked panes, in the manner of Andy Matuschak's notes and azlen's.
 *
 * Open a page beside your work instead of replacing it. Open another from
 * inside that one and it lands to the right of it. Scroll right and the ones
 * behind pin to the left edge, collapsed to a spine with their title running
 * vertically, so the whole trail of thought stays on screen and stays
 * clickable. There is no limit on how many are open.
 *
 * Two mechanics do all the work:
 *
 *  - Each pane is `position: sticky` at `left: index × spine`, so pane three
 *    comes to rest 120px from the left while four and five slide over it.
 *    A rising z-index makes later panes cover earlier ones.
 *  - Opening from pane *i* truncates everything after *i* before appending.
 *    That is what makes it a trail rather than a pile: going back and taking
 *    a different turning replaces the rest of the path, exactly as it would
 *    in your head.
 *
 * The stack lives in the URL (`?panes=a,b,c`), so a trail survives a reload,
 * works with the back button, and can be sent to someone. Nothing about a
 * pane is stored on the server.
 *
 * **A pane holds the real page.** It used to hold a summary of one, assembled
 * by `/api/pane` into rows of label-and-detail, which meant every page in the
 * product had two implementations: itself, and a hand-written projection that
 * had to be extended whenever the page grew and never was. So a pane could be
 * read and not worked in — you could see today's note beside a job and not
 * write in it, see the tasks and not tick one.
 *
 * Now the page is loaded into a same-origin frame and arrives without the
 * workspace around it (see `AppShell`'s framed branch). Everything on it
 * works, because it is the page: the forms, the server actions, the outliner,
 * the graph. There is nothing to keep in step, because there is one of each.
 *
 * The URL alone was not enough. Clicking any ordinary link navigates to a path
 * with no `panes` parameter, so the whole trail vanished — and a pane you
 * opened beside your work is the one thing that should still be there when you
 * go and look at something else. So the stack is also kept in `sessionStorage`
 * and put back whenever a page arrives without one. The URL still wins when it
 * has panes, which is what keeps a shared link and the back button honest, and
 * closing a pane clears the memory, so an X stays X'd.
 *
 * Session, not local: a trail of thought belongs to this sitting and this tab.
 * Two tabs keep separate trails, and tomorrow starts empty rather than
 * reopening a path you had already finished walking.
 */

/**
 * Whether this window is a pane rather than the workspace.
 *
 * Asked wherever the two have to behave differently — chiefly "open beside",
 * which from inside a pane has to reach the rail that owns the frame rather
 * than build a rail of its own inside it.
 */
export function insideAPane(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/** What a framed page tells the pane around it. */
const PANE_MESSAGE = "talentos:pane";
/** What a framed page asks the pane rail around it to do. */
const OPEN_MESSAGE = "talentos:open-pane";

interface PaneMessage {
  type: typeof PANE_MESSAGE;
  title: string;
  path: string;
}

interface OpenMessage {
  type: typeof OPEN_MESSAGE;
  target: string;
}

/**
 * Tell the workspace what this framed page is now called, and where it is.
 *
 * The title comes from the page rather than from a table of pane titles,
 * because the page is the only thing that knows — and it keeps being right as
 * the reader follows links inside the pane, which a table never could.
 */
export function reportPane(): void {
  if (!insideAPane()) return;
  try {
    window.parent.postMessage(
      {
        type: PANE_MESSAGE,
        title: document.title,
        path: window.location.pathname + window.location.search,
      } satisfies PaneMessage,
      window.location.origin,
    );
  } catch {
    // A parent we cannot post to is a parent that cannot show a title. The
    // pane keeps the fallback one and everything else still works.
  }
}

/** Ask the workspace to open a pane, from inside one. */
function askParentToOpen(target: string): void {
  try {
    window.parent.postMessage(
      { type: OPEN_MESSAGE, target } satisfies OpenMessage,
      window.location.origin,
    );
  } catch {
    // Nothing to do: the reader stays where they are rather than losing the
    // click to a rail that does not exist in here.
  }
}

const PARAM = "panes";
const STORE_KEY = "talentos.panes";
/**
 * The dock along the bottom, in the manner of Obsidian's.
 *
 * One pane, not a stack: the bottom is where you put the thing you want under
 * everything while you work above it — the day's note, a task list, the person
 * you are writing about. A stack down there would be a second rail, and two
 * rails is a window with no room left in it.
 */
const BOTTOM_PARAM = "bottom";
const BOTTOM_STORE_KEY = "talentos.bottom";
/** How much of a covered pane stays visible. Enough for a title, no more. */
export const SPINE = 40;
/**
 * How wide one pane is.
 *
 * It was a flat 380, which is a column of text and not much else — a table, a
 * scorecard or a document read badly in it, so panes were for looking things up
 * rather than for working in. A pane you can work in has to be closer to a page.
 *
 * So it scales with the window and is bounded at both ends: never narrower than
 * it used to be, because a small screen has nothing to spare, and never wider
 * than a comfortable measure, because past that a pane is a page with the menu
 * hidden. The rail still stops growing before it squeezes the page below
 * `MIN_PAGE_WIDTH`, which is what the collapsing spines were always for.
 */
export const PANE_WIDTH_MIN = 380;
export const PANE_WIDTH_MAX = 620;
const PANE_SHARE = 0.34;

export function paneWidth(viewport = 1440): number {
  // On a narrow window a pane is the window. Anything else is a pane you have
  // to scroll sideways to read, beside a page you cannot see anyway.
  if (viewport <= NARROW_MAX) return Math.max(240, viewport - GUTTER * 2);
  return Math.max(
    PANE_WIDTH_MIN,
    Math.min(PANE_WIDTH_MAX, Math.round(viewport * PANE_SHARE)),
  );
}
/** Breathing room around every pane, so the canvas shows between them. */
const GUTTER = 12;
/**
 * Room for the "close all" control at the end of the row.
 *
 * Left out of the width, the rail was exactly one pane wide and the control
 * came to rest on top of that pane's own ✕ — so closing one pane closed the
 * lot. Anything sharing a row has to be in the sum.
 */
const CLOSE_ALL_WIDTH = 92;

/** The page never gets narrower than this, however many panes are open. */
const MIN_PAGE_WIDTH = 420;

/**
 * How wide the rail is with `count` panes open.
 *
 * ONE source of truth, used by the rail to size itself and by the page to
 * reserve the room — so the panes sit BESIDE the work rather than over it. A
 * pane that covers what you opened it next to is not a pane, it is a dialog,
 * and two components each guessing this independently is exactly how it ends up
 * being one.
 *
 * Past the point where the rail would squeeze the page, it stops growing and
 * scrolls inside itself instead: that is what the collapsing spines are for.
 */
export function railWidthOf(
  widths: number[],
  viewport = 1440,
  menu = MENU_OPEN_WIDTH,
): number {
  if (widths.length === 0) return 0;
  // Narrow: the rail is the window, and the page behind it is not asked to
  // reserve anything, because there is nothing left to reserve.
  if (viewport <= NARROW_MAX) return Math.max(0, viewport - GUTTER * 2);
  const wanted =
    widths.reduce((total, width) => total + width, 0) +
    GUTTER * 2 +
    CLOSE_ALL_WIDTH;
  // The floor is the DEFAULT pane width, not the widest pane open. A pane
  // somebody dragged out to a thousand pixels should scroll inside the rail,
  // not push the page off the screen — widening one pane is a request about
  // that pane, not about the whole window.
  const allowed = Math.max(
    paneWidth(viewport) + GUTTER * 2 + CLOSE_ALL_WIDTH,
    viewport - menu - MIN_PAGE_WIDTH,
  );
  return Math.min(wanted, allowed);
}

export function railWidth(
  count: number,
  viewport = 1440,
  menu = MENU_OPEN_WIDTH,
): number {
  return railWidthOf(
    Array.from({ length: count }, () => paneWidth(viewport)),
    viewport,
    menu,
  );
}

/** The stack from the URL, deduped. No cap: the trail is as long as it is. */
export function readPanes(raw: string | null): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Where a newly opened page goes.
 *
 * The origin decides first: opening from pane `after` drops everything
 * beyond it, because taking a different turning means the rest of the path
 * is no longer the path. Only then does an already-open page move rather
 * than duplicate — and it can only move within what survived the truncation,
 * which is what stops a stack quietly keeping panes you have walked away
 * from.
 */
export function nextStack(
  current: string[],
  slug: string,
  after?: number,
): string[] {
  const base =
    after === undefined ? current : current.slice(0, Math.max(0, after + 1));
  const existing = base.indexOf(slug);
  if (existing !== -1) return base.slice(0, existing + 1);
  return [...base, slug];
}

/**
 * Remember the stack for the rest of this sitting.
 *
 * Every read and write is guarded: a private window, blocked site data, or a
 * thumbnail capture can make `sessionStorage` throw on access rather than
 * return null, and panes failing to persist must never take the page with them.
 */
function remember(stack: string[]): void {
  try {
    if (stack.length === 0) window.sessionStorage.removeItem(STORE_KEY);
    else window.sessionStorage.setItem(STORE_KEY, stack.join(","));
  } catch {
    // Storage is unavailable; the URL still carries the stack for this page.
  }
}

function recall(): string[] {
  try {
    return readPanes(window.sessionStorage.getItem(STORE_KEY));
  } catch {
    return [];
  }
}

function rememberBottom(target: string | null): void {
  try {
    if (target) window.sessionStorage.setItem(BOTTOM_STORE_KEY, target);
    else window.sessionStorage.removeItem(BOTTOM_STORE_KEY);
  } catch {
    // As above: the URL still carries it for this page.
  }
}

function recallBottom(): string | null {
  try {
    return window.sessionStorage.getItem(BOTTOM_STORE_KEY);
  } catch {
    return null;
  }
}

/**
 * The pane docked along the bottom.
 *
 * Kept in the URL beside the stack and mirrored into the same session memory,
 * for the same two reasons: a trail you can send someone has to include what
 * was open at the bottom of it, and an ordinary link elsewhere must not empty
 * the workspace.
 */
export function useBottomPane() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const raw = params.get(BOTTOM_PARAM);
  const target = raw ? paneTargetOf(raw) : null;

  const write = useCallback(
    (next: string | null) => {
      const query = new URLSearchParams(params.toString());
      if (next) query.set(BOTTOM_PARAM, next);
      else query.delete(BOTTOM_PARAM);
      const search = query.toString();
      rememberBottom(next);
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router],
  );

  return {
    target,
    dock: (slug: string) => write(paneTargetOf(slug)),
    close: () => write(null),
    restore: useCallback(() => {
      if (raw) {
        rememberBottom(paneTargetOf(raw));
        return;
      }
      const remembered = recallBottom();
      if (remembered) write(remembered);
    }, [raw, write]),
  };
}

/** Canonicalised once, so the same thing cannot be docked under two spellings. */
function paneTargetOf(slug: string): string {
  const ref = parsePane(slug);
  return paneTarget(ref.kind, ref.id);
}

export function usePanes() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  // Memoised on the raw string, not rebuilt per render: `restore` closes over
  // this list, and a fresh array each render would re-run its effect — and its
  // storage write — on every single render.
  const raw = params.get(PARAM) ?? "";
  const panes = useMemo(() => readPanes(raw), [raw]);

  const write = useCallback(
    (next: string[]) => {
      const query = new URLSearchParams(params.toString());
      if (next.length === 0) query.delete(PARAM);
      else query.set(PARAM, next.join(","));
      const search = query.toString();
      remember(next);
      router.replace(search ? `${pathname}?${search}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router],
  );

  return {
    panes,
    /**
     * Put the remembered stack back on a page that arrived without one.
     *
     * Called once, from the rail rather than from `usePanes` itself, because
     * every open pane calls this hook and they would otherwise all try to
     * restore the same stack at once.
     */
    restore: useCallback(() => {
      if (raw) {
        // A URL that names its panes is the authority — a shared link, or the
        // back button — so it seeds the memory rather than being overruled by it.
        remember(panes);
        return;
      }
      const remembered = recall();
      if (remembered.length > 0) write(remembered);
    }, [raw, panes, write]),
    /**
     * Canonicalised on the way in, so the same pane cannot be opened twice
     * under two spellings — `pane-alpha` and `page:pane-alpha` are one thing,
     * and a stack that held both would show it twice and close it once.
     */
    open: (slug: string, after?: number) => {
      const ref = parsePane(slug);
      const target = paneTarget(ref.kind, ref.id);
      // From inside a pane there is no rail to add to — the rail is in the
      // window that owns this frame. Building one in here would nest a
      // workspace inside a pane, which is the thing the framed page exists
      // not to be.
      if (insideAPane()) return askParentToOpen(target);
      return write(nextStack(panes, target, after));
    },
    close: (slug: string) => write(panes.filter((entry) => entry !== slug)),
    /** Drag a pane from one slot to another without changing what is open. */
    move: (target: string, toIndex: number) =>
      write(movePane(panes, target, toIndex)),
    /** Everything from this one rightwards. Closing a turning closes the rest. */
    closeFrom: (index: number) => write(panes.slice(0, index)),
    closeAll: () => write([]),
  };
}

/**
 * What a pane holds: the page itself.
 *
 * A same-origin frame, so everything on the page works exactly as it does at
 * full size — its forms, its server actions, its outliner, its graph. The
 * page detects that it is framed and arrives without the workspace around it.
 *
 * Two messages travel back up. The page reports its own title, which is the
 * only place that stays right when the reader follows a link inside the pane;
 * and it asks the rail to open a pane when somebody presses "open beside" in
 * there, so a trail started inside a pane still lands in the stack.
 *
 * Split out of `Pane` because the dock along the bottom shows the same thing
 * in a different frame, and two copies of this drifting apart is how a
 * workspace ends up with a pane that can do something the dock cannot for no
 * reason anybody can name.
 */
function PaneFrame({
  target,
  focus,
  title,
  onTitle,
}: {
  target: string;
  /** For the one pane that follows you: what the page you are on is about. */
  focus?: string | null;
  /** Shown as the frame's accessible name until the page says its own. */
  title: string;
  onTitle: (title: string) => void;
}) {
  const ref = parsePane(target);
  const src = routeForPane(ref, focus);
  const frame = useRef<HTMLIFrameElement>(null);
  /**
   * Whether the page in here has said hello.
   *
   * Which is to say: whether it has hydrated, and therefore whether the
   * things that need JavaScript — shift-click to open beside, the outliner,
   * every form — are live yet. Marked on the element because "the page has
   * loaded" and "the page is working" are different moments, and a test that
   * cannot tell them apart is a test that is flaky exactly as often as the
   * machine is busy.
   *
   * Held as the address that said hello rather than as a flag, so pointing
   * the frame somewhere else makes it stale with nothing to reset.
   */
  const [greeted, setGreeted] = useState<string | null>(null);
  const ready = greeted === src;

  useEffect(() => {
    const heard = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frame.current?.contentWindow) return;
      const payload: unknown = event.data;
      if (
        payload &&
        typeof payload === "object" &&
        (payload as PaneMessage).type === PANE_MESSAGE
      ) {
        onTitle((payload as PaneMessage).title);
        setGreeted(src);
      }
    };
    window.addEventListener("message", heard);
    return () => window.removeEventListener("message", heard);
  }, [onTitle, src]);

  return (
    <iframe
      ref={frame}
      data-testid="pane-frame"
      data-pane-src={src}
      data-pane-ready={ready ? "1" : undefined}
      src={src}
      title={title}
      className="min-h-0 w-full flex-1 border-0 bg-panel"
    />
  );
}

/**
 * What a pane calls itself.
 *
 * The page's own `<title>` once it has said so, and the kind's name until
 * then, so a pane is never a blank strip while it loads. A document title is
 * written as `Thing · <product>`; the suffix belongs to the window, not to
 * this pane, and repeating it in every spine would make eight panes read as
 * eight copies of the same word.
 */
function usePaneTitle(target: string): {
  title: string;
  onTitle: (raw: string) => void;
} {
  const ref = parsePane(target);
  const fallback = paneFallbackTitle(ref);
  const [said, setSaid] = useState<{ target: string; title: string } | null>(
    null,
  );
  const onTitle = useCallback(
    (raw: string) => {
      const cleaned = raw.split(" · ")[0].trim();
      // A page that never set a title reports the product name, which names
      // every pane the same thing. The kind's own fallback is more use.
      if (cleaned && cleaned !== PRODUCT_NAME)
        setSaid({ target, title: cleaned });
    },
    [target],
  );
  return {
    title: said?.target === target ? said.title : fallback,
    onTitle,
  };
}

function Pane({
  target,
  index,
  width,
  onDragStart,
  onDropOn,
  dragging,
}: {
  target: string;
  index: number;
  /** Measured once by the rail and handed down. Two components each deriving
   *  it independently is exactly how they end up disagreeing (D-079). */
  width: number;
  onDragStart: (target: string) => void;
  onDropOn: (index: number) => void;
  dragging: string | null;
}) {
  const [over, setOver] = useState(false);
  const { open, close } = usePanes();
  const { dock } = useBottomPane();
  const { widthOf, setWidthOf, clearWidthOf } = usePaneSizes();
  const [grab, setGrab] = useState<{ x: number; width: number } | null>(null);
  const ref = parsePane(target);
  const here = usePathname();
  // Only the graph follows you. Every other pane is about the thing you opened
  // it on, and one that changed under you as you navigated would be a pane you
  // could not put anything in.
  const focus = ref.kind === "graph" ? graphNodeForRoute(here) : null;
  const shown = widthOf(target) ?? width;

  const { title, onTitle } = usePaneTitle(target);
  const icon = paneIcon(ref.kind);
  const href = routeForPane(ref, focus);

  return (
    <section
      data-testid="sliding-pane"
      data-pane-target={target}
      data-pane-index={index}
      onDragOver={(event) => {
        if (!dragging || dragging === target) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onDropOn(index);
      }}
      style={{
        left: index * SPINE,
        width: shown,
        zIndex: 10 + index,
      }}
      // Every pane carries its own edge and its own ground. Nothing here bleeds
      // to the viewport: the canvas shows between panes and around them, which
      // is what makes a stack read as a row of things rather than one slab.
      className={`sticky flex h-full shrink-0 overflow-hidden rounded-lg border bg-panel shadow-[-10px_0_22px_-14px_rgba(0,0,0,0.7)] ${
        over ? "border-accent" : "border-edge"
      } ${dragging === target ? "opacity-50" : ""}`}
    >
      {/*
        The spine. All that remains visible once this pane is covered, and
        the handle you drag to move the pane to another slot — a pane you can
        only move by its header would be unmovable the moment it is covered.
      */}
      <div
        draggable
        onDragStart={(event) => {
          onDragStart(target);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", target);
        }}
        onDragEnd={() => onDragStart("")}
        title={`${title} — drag to move this pane`}
        style={{ width: SPINE }}
        className="flex shrink-0 cursor-grab flex-col items-center gap-2 border-r border-edge bg-panel2 py-3 text-ink-muted active:cursor-grabbing hover:text-ink"
      >
        <span aria-hidden className="text-[14px]">
          {icon}
        </span>
        <span aria-hidden className="text-[11px] text-ink-faint">
          ⠿
        </span>
        <button
          type="button"
          onClick={() => open(target, index - 1)}
          className="max-h-[60%] overflow-hidden text-left text-[12px] tracking-wide"
          style={{ writingMode: "vertical-rl" }}
        >
          {title}
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-start justify-between gap-2 border-b border-edge px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-ink">{title}</p>
            {/* The page is right here, so this is "take it over there" rather
                than "go and get the real one". A plain link, because the pane
                is the same address and a reader who wants it full width
                should be able to middle-click it like anything else. */}
            <Link
              href={href}
              className="text-[12px] text-accent hover:underline"
            >
              Open full width →
            </Link>
          </div>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              aria-label={`Dock ${title} along the bottom`}
              title="Dock along the bottom"
              onClick={() => {
                dock(target);
                close(target);
              }}
              className="rounded px-1.5 text-[13px] text-ink-faint hover:text-ink"
            >
              ⤓
            </button>
            <button
              type="button"
              aria-label={`Close ${title}`}
              onClick={() => close(target)}
              className="rounded px-1.5 text-[14px] text-ink-faint hover:text-ink"
            >
              ✕
            </button>
          </div>
        </header>

        <PaneFrame
          target={target}
          focus={focus}
          title={title}
          onTitle={onTitle}
        />
      </div>

      {/*
        The right edge, as a handle.
        On the right rather than the left because the left edge is the spine,
        which is already the handle you drag to MOVE the pane — one edge cannot
        mean two things. Double-click puts it back to whatever the window says
        it should be, so a pane dragged somewhere silly is one gesture from
        sensible again.
      */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${title}`}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setGrab({ x: event.clientX, width: shown });
        }}
        onPointerMove={(event) => {
          if (!grab) return;
          setWidthOf(target, grab.width + (event.clientX - grab.x));
        }}
        onPointerUp={() => setGrab(null)}
        onPointerCancel={() => setGrab(null)}
        onDoubleClick={() => clearWidthOf(target)}
        onKeyDown={(event) => {
          const by =
            event.key === "ArrowLeft"
              ? -24
              : event.key === "ArrowRight"
                ? 24
                : 0;
          if (!by) return;
          event.preventDefault();
          setWidthOf(target, shown + by);
        }}
        className={`absolute inset-y-0 right-0 z-20 w-1.5 cursor-col-resize rounded-r-lg focus:outline-none ${
          grab
            ? "bg-accent"
            : "hover:bg-accent/50 focus-visible:w-2 focus-visible:bg-accent"
        }`}
      />
    </section>
  );
}

export function SlidingPanes() {
  const { panes, move, closeAll, restore } = usePanes();
  const [ribbons, setRibbons] = useRibbonsOn();
  const [dragging, setDragging] = useState<string | null>(null);
  const viewport = useViewportWidth();
  const menu = useMenuWidth();
  const { widthOf, bottomHeight } = usePaneSizes();
  const { target: bottom } = useBottomPane();
  /**
   * What is actually on screen.
   *
   * A navigation lands on a URL with no `panes` parameter, so `panes` is
   * momentarily empty before `restore` puts it back. Rendering that directly
   * unmounted every pane and remounted it a frame later — a visible flash, and
   * every pane re-fetching its contents, on every single click.
   *
   * So the last stack is held until it is clear the panes were CLOSED rather
   * than merely navigated away from, and the memory says which: closing empties
   * it, navigating does not. The effect only ever *shrinks* the stack, and only
   * when the memory is empty, so a navigation never triggers a re-render at all
   * — which is why the lint rule's usual objection to setting state from an
   * effect does not apply here. Deriving this during render instead would mean
   * writing a ref while rendering, which is the same trade with worse rules.
   */
  const [shown, setShown] = useState<string[]>(panes);

  useEffect(() => {
    if (panes.length > 0) {
      if (panes.join(",") !== shown.join(",")) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
        setShown(panes);
      }
      return;
    }
    if (recall().length === 0 && shown.length > 0) setShown([]);
  }, [panes, shown]);

  // Reopen the trail on a page that was navigated to by an ordinary link,
  // which carries no `panes` parameter of its own.
  useEffect(restore, [restore]);

  // Keep the newest pane in view when one is added.
  useEffect(() => {
    const rail = document.querySelector("[data-testid='sliding-panes']");
    if (rail) rail.scrollLeft = rail.scrollWidth;
  }, [shown.length]);

  if (shown.length === 0) return null;

  return (
    <aside
      data-testid="sliding-panes"
      aria-label={`${shown.length} open panes`}
      // Sized to its content, not to the viewport: with two panes open the
      // work behind them stays visible, which is the point of opening one
      // beside your work rather than on top of it.
      style={{
        width: railWidthOf(
          shown.map((target) => widthOf(target) ?? paneWidth(viewport)),
          viewport,
          menu,
        ),
        // The rail stops above the dock rather than sliding under it: a pane
        // whose last rows are behind another surface is a pane you cannot read
        // the end of.
        bottom: bottom ? bottomHeight + 18 : 12,
      }}
      className="fixed top-3 right-3 z-30 flex overflow-x-auto overscroll-x-contain"
    >
      {shown.map((target, index) => (
        <Pane
          key={target}
          target={target}
          index={index}
          width={paneWidth(viewport)}
          dragging={dragging}
          onDragStart={(value) => setDragging(value || null)}
          onDropOn={(toIndex) => {
            if (dragging) move(dragging, toIndex);
            setDragging(null);
          }}
        />
      ))}
      <div className="sticky top-2 right-2 z-50 ml-2 flex shrink-0 flex-col items-end gap-1 self-start">
        {/* The bands are drawn across this rail, so the switch for them is on
            it. One click, remembered, and nothing else about the panes
            changes when it is off. */}
        <button
          type="button"
          aria-pressed={ribbons}
          title={
            ribbons
              ? "Lines are drawn between the same word on two open pages"
              : "Draw lines between the same word on two open pages"
          }
          onClick={() => setRibbons(!ribbons)}
          className={`h-6 rounded border px-1.5 text-[11px] ${
            ribbons
              ? "border-accent/40 bg-accent-soft text-accent"
              : "border-edge2 bg-panel/90 text-ink-faint hover:text-ink"
          }`}
        >
          {ribbons ? "🔗 linked" : "🔗 off"}
        </button>
        <button
          type="button"
          onClick={closeAll}
          className="h-6 rounded border border-edge2 bg-panel/90 px-1.5 text-[11px] text-ink-faint hover:text-ink"
        >
          close all {shown.length}
        </button>
      </div>
    </aside>
  );
}

/**
 * Shift-click anything to open it beside your work.
 *
 * Mounted once, listening on the document in the capture phase, so it covers
 * every link in the workspace — the nav, a job's name in a list, a tag written
 * inside a note — without each of them having to opt in. A link that had to be
 * taught individually would mean "every page is a pane" was only ever true of
 * the pages somebody remembered.
 *
 * Three links it deliberately leaves alone: anything off this origin, anything
 * with a `target` (a result link opens in a new tab, and that is the rule), and
 * a route with no pane of its own.
 */
export function PaneShortcuts() {
  const { open } = usePanes();
  const router = useRouter();

  /**
   * The page catches up when you come back to it.
   *
   * A pane holds a real page, so work done in one is real work — a task
   * ticked, a note written, a stage moved. The window behind it was rendered
   * before that happened and has no way to know, so the dashboard could sit
   * there showing a task you had just closed in the pane beside it.
   *
   * Returning focus to the page is the moment you look at it again, and it is
   * also the only moment a refresh cannot interrupt anything: you are, by
   * definition, not typing in the pane any more. Only while a pane is open,
   * so a window with nothing beside it is never refreshed for no reason.
   */
  useEffect(() => {
    if (insideAPane()) return;
    const catchUp = () => {
      if (document.querySelector("iframe[data-testid='pane-frame']")) {
        router.refresh();
      }
    };
    window.addEventListener("focus", catchUp);
    return () => window.removeEventListener("focus", catchUp);
  }, [router]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!event.shiftKey || event.defaultPrevented || event.button !== 0)
        return;
      const anchor = (event.target as HTMLElement | null)?.closest?.("a");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.origin !== window.location.origin) return;

      const target = paneForRoute(anchor.pathname, anchor.search);
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      open(target);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [open]);

  /**
   * "Open beside", pressed inside a pane.
   *
   * The rail lives in this window; the button was pressed in a frame. The
   * listener is here rather than on the rail because the rail unmounts when
   * the stack is empty, and the first pane opened from inside the dock is
   * exactly the case that would find nobody listening.
   */
  useEffect(() => {
    const heard = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const payload: unknown = event.data;
      if (
        !payload ||
        typeof payload !== "object" ||
        (payload as OpenMessage).type !== OPEN_MESSAGE
      ) {
        return;
      }
      const target = (payload as OpenMessage).target;
      if (typeof target !== "string" || !target) return;
      // Which pane it came from, so the trail still behaves like a trail:
      // opening from pane three replaces four and five rather than adding a
      // sixth. The frame does not have to say — it is the one whose window
      // sent this. The dock has no position in the stack, finds no index,
      // and appends, which is what it did before.
      let from: number | undefined;
      for (const frame of document.querySelectorAll<HTMLIFrameElement>(
        "iframe[data-testid='pane-frame']",
      )) {
        if (frame.contentWindow !== event.source) continue;
        const at = frame
          .closest("[data-pane-index]")
          ?.getAttribute("data-pane-index");
        if (at !== null && at !== undefined) from = Number(at);
      }
      open(target, from);
    };
    window.addEventListener("message", heard);
    return () => window.removeEventListener("message", heard);
  }, [open]);

  return null;
}

/**
 * The dock along the bottom, in the manner of Obsidian's.
 *
 * The rail is for the trail of thought — where you went, in order. The dock is
 * for the thing you keep referring back to while you work above it: today's
 * note, the task list, the person you are writing about. Those are different
 * jobs, and putting the second one in the rail is what made the rail long
 * enough to lose the first.
 *
 * One pane, not a stack. A stack down here would be a second rail, and two
 * rails is a window with nothing left in the middle of it.
 */
export function BottomPane() {
  const { target, close, restore } = useBottomPane();
  const { open } = usePanes();
  const menu = useMenuWidth();
  // Narrow: the menu is off-canvas, so there is nothing to sit beside.
  const narrow = useIsNarrow();
  const { bottomHeight, setBottomHeight } = usePaneSizes();
  const [grab, setGrab] = useState<{ y: number; height: number } | null>(null);
  const { title, onTitle } = usePaneTitle(target ?? "");

  useEffect(restore, [restore]);

  if (!target) return null;
  const ref = parsePane(target);
  const icon = paneIcon(ref.kind);
  const href = routeForPane(ref);

  return (
    <aside
      data-testid="bottom-pane"
      aria-label={`${title}, docked along the bottom`}
      style={{ left: narrow ? 12 : menu + 12, height: bottomHeight }}
      className="fixed right-3 bottom-3 z-20 flex flex-col overflow-hidden rounded-lg border border-edge bg-panel shadow-[0_-10px_22px_-16px_rgba(0,0,0,0.7)]"
    >
      {/* The top edge, as a handle. Up is bigger, which is the only direction
          this surface can grow in. */}
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label={`Resize ${title}`}
        tabIndex={0}
        title="Drag to resize"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setGrab({ y: event.clientY, height: bottomHeight });
        }}
        onPointerMove={(event) => {
          if (!grab) return;
          setBottomHeight(grab.height - (event.clientY - grab.y));
        }}
        onPointerUp={() => setGrab(null)}
        onPointerCancel={() => setGrab(null)}
        onKeyDown={(event) => {
          const by =
            event.key === "ArrowUp" ? 24 : event.key === "ArrowDown" ? -24 : 0;
          if (!by) return;
          event.preventDefault();
          setBottomHeight(bottomHeight + by);
        }}
        className={`h-1.5 shrink-0 cursor-row-resize focus:outline-none ${
          grab
            ? "bg-accent"
            : "hover:bg-accent/50 focus-visible:w-2 focus-visible:bg-accent"
        }`}
      />
      <header className="flex items-start justify-between gap-2 border-b border-edge px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-ink">
            <span aria-hidden className="mr-1.5">
              {icon}
            </span>
            {title}
          </p>
          <Link href={href} className="text-[12px] text-accent hover:underline">
            Open full width →
          </Link>
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            aria-label={`Move ${title} back to the side`}
            title="Back to the side"
            onClick={() => {
              open(target);
              close();
            }}
            className="rounded px-1.5 text-[13px] text-ink-faint hover:text-ink"
          >
            ⤒
          </button>
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={close}
            className="rounded px-1.5 text-[14px] text-ink-faint hover:text-ink"
          >
            ✕
          </button>
        </div>
      </header>
      <PaneFrame target={target} title={title} onTitle={onTitle} />
    </aside>
  );
}
