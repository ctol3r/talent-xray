"use client";

import { useState } from "react";
import {
  paneWidth,
  railWidthOf,
  useBottomPane,
  usePanes,
  useViewportWidth,
} from "./sliding-panes";
import {
  MIN_PAGE_WIDTH,
  PAGE_INSET_MAX,
  useIsNarrow,
  useMenuWidth,
  usePaneSizes,
} from "./workspace-layout";
import { PageContextPanel } from "./page-context";

/**
 * The page you are on, as a pane.
 *
 * The menu is the only constant surface in the workspace. Everything else — the
 * page included — is a bounded thing sitting on the canvas with its own edge,
 * rather than a field of colour running to the edges of the window with panes
 * floating over it. That was the difference between a workspace of panes and a
 * page that happens to have panes on top of it.
 *
 * Two consequences, and both are the point:
 *  - the page reserves room for the rail, so a pane sits BESIDE the work rather
 *    than covering it. A pane that covers what you opened it next to is not a
 *    pane, it is a dialog.
 *  - the canvas shows in the gaps, so the number of open things is legible at a
 *    glance without reading a single word.
 *
 * **And the page has handles of its own.** Every other surface in the
 * workspace could be resized and the one you spend the day reading could not,
 * which was an odd thing to have shipped: the usual reason to want them is
 * measure — a paragraph across 1600px is a line nobody's eye tracks — and the
 * other is simply to see more of what is behind on one side. Both edges drag,
 * independently, and double-clicking either puts both back.
 */

/**
 * One draggable edge of the page.
 *
 * Wide enough to hit and invisible until you go near it, because a page with
 * two permanent grey bars down its sides is a page with two grey bars down
 * its sides. Keyboard-operable for the same reason every other handle here is:
 * a resize you can only do by dragging is a resize half the people cannot do.
 */
function PageEdge({
  side,
  value,
  room,
  onChange,
  onReset,
}: {
  side: "left" | "right";
  value: number;
  /** How far this edge may be pulled in before the page hits its minimum. */
  room: number;
  onChange: (next: number) => void;
  onReset: () => void;
}) {
  const [grab, setGrab] = useState<{ x: number; from: number } | null>(null);
  const limit = Math.max(0, Math.min(PAGE_INSET_MAX, room + value));

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize the page from the ${side}`}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={limit}
      tabIndex={0}
      data-testid={`page-edge-${side}`}
      title="Drag to resize the page · double-click to reset"
      onDoubleClick={onReset}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setGrab({ x: event.clientX, from: value });
      }}
      onPointerMove={(event) => {
        if (!grab) return;
        const moved = event.clientX - grab.x;
        // Pulling the left edge right, or the right edge left, makes the
        // gutter bigger. Each edge grows towards the middle.
        onChange(grab.from + (side === "left" ? moved : -moved));
      }}
      onPointerUp={() => setGrab(null)}
      onPointerCancel={() => setGrab(null)}
      onKeyDown={(event) => {
        const towards = side === "left" ? 1 : -1;
        const by =
          event.key === "ArrowRight"
            ? 24 * towards
            : event.key === "ArrowLeft"
              ? -24 * towards
              : 0;
        if (by === 0) {
          if (event.key === "Home") {
            event.preventDefault();
            onReset();
          }
          return;
        }
        event.preventDefault();
        onChange(value + by);
      }}
      className={`absolute inset-y-0 z-10 w-2 cursor-col-resize touch-none focus:outline-none ${
        side === "left" ? "left-0" : "right-0"
      } ${
        grab
          ? "bg-accent/60"
          : "hover:bg-accent/40 focus-visible:bg-accent focus-visible:w-2.5"
      }`}
    />
  );
}

export function PaneStage({ children }: { children: React.ReactNode }) {
  const { panes } = usePanes();
  const { target: bottom } = useBottomPane();
  const viewport = useViewportWidth();
  const narrow = useIsNarrow();
  // Narrow: the menu and the rail lie over the page rather than beside it, so
  // the page reserves nothing for either and has the whole window.
  const menuWidth = useMenuWidth();
  const menu = narrow ? 0 : menuWidth;
  const {
    widthOf,
    bottomHeight,
    pageLeft,
    pageRight,
    setPageInset,
    resetPageInsets,
  } = usePaneSizes();

  // Room reserved for all three of the other surfaces, from the same numbers
  // they size themselves with. Every one of them can now be moved by the
  // reader, so the page has to be told rather than assume.
  const rail = narrow
    ? 0
    : railWidthOf(
        panes.map((target) => widthOf(target) ?? paneWidth(viewport)),
        viewport,
        menu,
      );
  // On narrow the dock lies over the page like the rail, so the page reserves
  // nothing for it — it was reserving 278px for a box it did not need to
  // avoid.
  const floor = bottom && !narrow ? bottomHeight + 18 : 0;

  // What the page has before its own edges are moved, and therefore how much
  // of that it can give away. On a phone there is nothing to give: the page is
  // already the window, and a gutter there is a page you cannot read.
  const available = Math.max(0, viewport - menu - rail);
  const spare = Math.max(0, available - MIN_PAGE_WIDTH);
  const left = narrow ? 0 : Math.min(pageLeft, spare);
  const right = narrow ? 0 : Math.min(pageRight, Math.max(0, spare - left));

  return (
    <main
      data-testid="page-pane"
      data-page-left={left}
      data-page-right={right}
      style={{
        marginLeft: menu + left,
        marginRight: rail + right,
        marginBottom: floor,
      }}
      className="relative min-w-0 flex-1 p-2 transition-[margin] duration-150 sm:p-3"
    >
      {!narrow && (
        <>
          <PageEdge
            side="left"
            value={left}
            room={Math.max(0, spare - left - right)}
            onChange={(next) => setPageInset("left", next)}
            onReset={resetPageInsets}
          />
          <PageEdge
            side="right"
            value={right}
            room={Math.max(0, spare - left - right)}
            onChange={(next) => setPageInset("right", next)}
            onReset={resetPageInsets}
          />
        </>
      )}
      <div
        style={{ minHeight: `calc(100vh - 1.5rem - ${floor}px)` }}
        className="rounded-lg border border-edge bg-panel/40 px-3 py-4 shadow-[0_1px_20px_-16px_rgba(0,0,0,0.9)] sm:px-6 sm:py-5"
      >
        {children}
        {/* Every page ends with what it is connected to. It is the same
            question on all of them, so it is answered in one place rather
            than by each page remembering to ask. */}
        <PageContextPanel />
      </div>
    </main>
  );
}
