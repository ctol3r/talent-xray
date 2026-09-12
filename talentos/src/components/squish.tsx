"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

/**
 * Focus and context: the day you are reading at full size, the rest squeezed.
 *
 * A long scroll answers "where is the thing I wrote" with "keep scrolling",
 * which is the complaint this exists for. So everything away from the reading
 * position is compressed vertically — the words stop being readable and the
 * *shape* of the day does not: its length, its indentation, the coloured marks
 * of its tags. A month fits on a screen and you steer by shape, then the band
 * you scroll into opens back up.
 *
 * Two rules keep it from being a gimmick.
 *
 * **The day you are writing in never squeezes.** A field that compresses under
 * the caret is unusable, so a section holding the focus is held at full size
 * whatever the arithmetic says.
 *
 * **`prefers-reduced-motion` turns it off entirely.** This is motion tied to
 * scrolling, which is the kind that makes some people ill; the scroll works
 * perfectly well without it and simply stays long.
 */

/** Full size within this much of the reading line, in pixels. */
const BAND = 260;
/** How far past the band the squeeze reaches its smallest. */
const FALL = 900;
/** Never smaller than this, or a day becomes a line nobody can aim at. */
export const MIN_SQUISH = 0.16;

export function squishFor(distance: number): number {
  const past = Math.abs(distance) - BAND;
  if (past <= 0) return 1;
  const t = Math.min(1, past / FALL);
  // Cosine rather than linear: the fall starts gently, so a day just outside
  // the band is slightly smaller rather than visibly snapped.
  const eased = (1 - Math.cos((1 - t) * Math.PI)) / 2;
  return MIN_SQUISH + (1 - MIN_SQUISH) * eased;
}

const MOTION = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  // Read through the store rather than in an effect: it is a fact about the
  // browser, not state this component owns, and the first render should
  // already know rather than flashing the motion on and then off.
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia(MOTION);
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => window.matchMedia(MOTION).matches,
    () => false,
  );
}

/**
 * One section of the scroll, squeezed by how far it is from the reading line.
 *
 * The wrapper's height is the content's height times the scale, and the
 * content is scaled from its top edge, so the page's own length shrinks with
 * it — a transform alone would leave the gaps behind and change nothing about
 * how far there is to scroll.
 */
export function Squish({
  on,
  name,
  children,
}: {
  on: boolean;
  /** What this section is, so it can be addressed from outside. */
  name?: string;
  children: React.ReactNode;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [natural, setNatural] = useState<number | null>(null);
  const pending = useRef<number | null>(null);

  const measure = useCallback(() => {
    const box = outer.current;
    const body = inner.current;
    if (!box || !body) return;
    const height = body.offsetHeight;
    setNatural((current) => (current === height ? current : height));
    if (!on) {
      setScale((current) => (current === 1 ? current : 1));
      return;
    }
    // Writing wins over arithmetic: a field that compresses under the caret is
    // a field nobody can use.
    if (box.contains(document.activeElement)) {
      setScale((current) => (current === 1 ? current : 1));
      return;
    }
    const rect = box.getBoundingClientRect();
    const middle = rect.top + rect.height / 2;
    const reading = window.innerHeight / 2;
    const next = Math.round(squishFor(middle - reading) * 1000) / 1000;
    setScale((current) => (Math.abs(current - next) < 0.004 ? current : next));
  }, [on]);

  const schedule = useCallback(() => {
    if (pending.current !== null) return;
    pending.current = window.requestAnimationFrame(() => {
      pending.current = null;
      measure();
    });
  }, [measure]);

  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    const grows = new ResizeObserver(schedule);
    if (inner.current) grows.observe(inner.current);
    return () => {
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      grows.disconnect();
      // Cleared as well as cancelled: a leftover id makes every later
      // `schedule()` return early, and the section silently stops measuring
      // for the rest of the page's life. An effect cleanup runs on every
      // dependency change, not only on unmount, so this is the ordinary path.
      if (pending.current !== null) {
        window.cancelAnimationFrame(pending.current);
        pending.current = null;
      }
    };
  }, [schedule]);

  const squeezed = on && scale < 1;
  return (
    <div
      ref={outer}
      data-squish-for={name}
      data-squish={squeezed ? scale : undefined}
      style={
        squeezed && natural !== null
          ? { height: Math.round(natural * scale), overflow: "hidden" }
          : undefined
      }
      // Not `aria-hidden` and not `inert`: this is a picture of the same words,
      // and a screen reader has no reading line to be away from.
      className="transition-[height] duration-100 ease-out"
    >
      <div
        ref={inner}
        style={
          squeezed
            ? { transform: `scaleY(${scale})`, transformOrigin: "top" }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}
