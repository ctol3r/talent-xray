"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { keywordHue } from "@/lib/core/keyword-colour";

/** Join explicit keyword references across the real pages already open.
 * Same words are a recorded connection, never an assessment of candidate fit.
 * No inferred matches, additional records, or network requests are created.
 */
const ON_KEY = "talentos.ribbons";
const ON_EVENT = "talentos:ribbons";

/**
 * Whether the bands are drawn.
 *
 * A preference rather than a setting: it is about how somebody likes to read,
 * it outlives the tab, and it is one click from the rail the bands are drawn
 * across. Read through the store rather than in an effect so the first render
 * already knows — bands that appear and then vanish are worse than either.
 *
 * Cached because `useSyncExternalStore` compares snapshots by identity.
 */
let onCache: { raw: string | null; value: boolean } | null = null;

function subscribeOn(listener: () => void): () => void {
  window.addEventListener(ON_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(ON_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function readOn(): boolean {
  try {
    const raw = window.localStorage.getItem(ON_KEY);
    if (!onCache || onCache.raw !== raw)
      onCache = { raw, value: raw !== "off" };
    return onCache.value;
  } catch {
    return true;
  }
}

export function useRibbonsOn(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribeOn, readOn, () => true);
  const set = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(ON_KEY, next ? "on" : "off");
    } catch {
      // A browser that refuses storage still gets the switch, just one that
      // forgets which way it was left.
    }
    window.dispatchEvent(new Event(ON_EVENT));
  }, []);
  return [on, set];
}

const FRAME = "iframe[data-testid='pane-frame']";
const MAX_RIBBONS = 60;
const MAX_ANCHORS = 500;
const EDGE = 10;
type Edge = "above" | "below" | null;
interface Anchor {
  target: string;
  surface: number;
  surfaceTop: number;
  surfaceBottom: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  edge: Edge;
}
interface Ribbon {
  id: string;
  path: string;
  target: string;
  hue: number;
  from: Anchor;
  to: Anchor;
  vertical: boolean;
}
function readable(frame: HTMLIFrameElement): Document | null {
  try {
    return frame.contentDocument;
  } catch {
    return null;
  }
}
function intersect(a: DOMRect, b: DOMRect): DOMRect {
  const x = Math.max(a.left, b.left);
  const y = Math.max(a.top, b.top);
  return new DOMRect(
    x,
    y,
    Math.max(0, Math.min(a.right, b.right) - x),
    Math.max(0, Math.min(a.bottom, b.bottom) - y),
  );
}
function anchorsIn(
  root: HTMLElement,
  surface: number,
  offset: { x: number; y: number },
  clip: DOMRect,
): Anchor[] {
  if (!clip.width || !clip.height) return [];
  const out: Anchor[] = [];
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  if (!win) return [];
  for (const node of root.querySelectorAll<HTMLElement>(
    "[data-preview-target^='tag:']",
  )) {
    if (out.length >= MAX_ANCHORS) break;
    if (
      node.closest(
        "nav, [data-testid='workspace-nav'], [role='tooltip'], [hidden], [aria-hidden='true']",
      )
    )
      continue;
    const target = node.dataset.previewTarget;
    if (!target) continue;
    const style = win.getComputedStyle(node);
    if (style.visibility !== "visible" || style.opacity === "0") continue;
    const box = node.getBoundingClientRect();
    if (!box.width || !box.height) continue;
    let localClip = new DOMRect(
      clip.left - offset.x,
      clip.top - offset.y,
      clip.width,
      clip.height,
    );
    // A scrolling note or table is its own viewport, even inside a page frame.
    for (
      let parent = node.parentElement;
      parent && parent !== doc.body;
      parent = parent.parentElement
    ) {
      const css = win.getComputedStyle(parent);
      if (
        /(auto|scroll|hidden|clip)/.test(`${css.overflowX} ${css.overflowY}`)
      ) {
        localClip = intersect(localClip, parent.getBoundingClientRect());
      }
    }
    if (
      !localClip.width ||
      !localClip.height ||
      box.right <= localClip.left ||
      box.left >= localClip.right
    )
      continue;
    const left = Math.max(box.left, localClip.left) + offset.x;
    const right = Math.min(box.right, localClip.right) + offset.x;
    const edge: Edge =
      box.bottom <= localClip.top
        ? "above"
        : box.top >= localClip.bottom
          ? "below"
          : null;
    let top = Math.max(box.top, localClip.top) + offset.y;
    let bottom = Math.min(box.bottom, localClip.bottom) + offset.y;
    if (edge === "above") {
      top = localClip.top + offset.y;
      bottom = top + EDGE;
    }
    if (edge === "below") {
      bottom = localClip.bottom + offset.y;
      top = bottom - EDGE;
    }
    // Hidden behind a menu, dock or another pane is not a visible endpoint.
    if (!edge) {
      const x = (left + right) / 2 - offset.x;
      const y = (top + bottom) / 2 - offset.y;
      const hit = doc.elementFromPoint(x, y);
      if (!hit || !(node.contains(hit) || hit.contains(node))) continue;
    }
    out.push({
      target,
      surface,
      surfaceTop: clip.top,
      surfaceBottom: clip.bottom,
      left,
      right,
      top,
      bottom,
      edge,
    });
  }
  return out;
}
function band(from: Anchor, to: Anchor, vertical: boolean): string {
  const x1 = vertical ? (from.left + from.right) / 2 : from.right;
  const y1 = vertical ? from.bottom : (from.top + from.bottom) / 2;
  const x2 = vertical ? (to.left + to.right) / 2 : to.left;
  const y2 = vertical ? to.top : (to.top + to.bottom) / 2;
  const half =
    Math.max(6, Math.min(22, from.bottom - from.top, to.bottom - to.top)) / 2;
  if (vertical) {
    const mid = (y1 + y2) / 2;
    return `M ${x1 - half} ${y1} C ${x1 - half} ${mid}, ${x2 - half} ${mid}, ${x2 - half} ${y2} L ${x2 + half} ${y2} C ${x2 + half} ${mid}, ${x1 + half} ${mid}, ${x1 + half} ${y1} Z`;
  }
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${y1 - half} C ${mid} ${y1 - half}, ${mid} ${y2 - half}, ${x2} ${y2 - half} L ${x2} ${y2 + half} C ${mid} ${y2 + half}, ${mid} ${y1 + half}, ${x1} ${y1 + half} Z`;
}

export function ParallelRibbons() {
  const [on] = useRibbonsOn();
  const [ribbons, setRibbons] = useState<Ribbon[]>([]);
  useEffect(() => {
    if (!on) return;
    let raf: number | null = null;
    let alive = true;
    let motionUntil = 0;
    const watchers = new Map<
      HTMLIFrameElement,
      { doc: Document | null; stop: () => void }
    >();
    const measure = () => {
      raf = null;
      if (!alive) return;
      const page = document.querySelector<HTMLElement>(
        "[data-testid='page-pane']",
      );
      const viewport = new DOMRect(0, 0, innerWidth, innerHeight);
      let pageClip = page
        ? intersect(page.getBoundingClientRect(), viewport)
        : viewport;
      const dock = document.querySelector<HTMLElement>(
        "[data-testid='bottom-pane']",
      );
      if (dock) {
        const box = dock.getBoundingClientRect();
        if (box.width && box.height && box.top > pageClip.top)
          pageClip = intersect(
            pageClip,
            new DOMRect(
              pageClip.left,
              pageClip.top,
              pageClip.width,
              box.top - pageClip.top - 6,
            ),
          );
      }
      const anchors: Anchor[] = page
        ? anchorsIn(page, 0, { x: 0, y: 0 }, pageClip)
        : [];
      for (const [element, watcher] of watchers) {
        const root = watcher.doc?.body;
        if (!root) continue;
        const box = element.getBoundingClientRect();
        const clip = intersect(box, viewport);
        if (!clip.width || !clip.height) continue;
        // A collapsed or covered frame must not contribute invisible references.
        const hit = document.elementFromPoint(
          clip.left + clip.width / 2,
          clip.top + clip.height / 2,
        );
        if (hit !== element) continue;
        anchors.push(
          ...anchorsIn(
            root,
            [...watchers.keys()].indexOf(element) + 1,
            { x: box.left, y: box.top },
            clip,
          ),
        );
      }
      const groups = new Map<string, Map<number, Anchor>>();
      for (const anchor of anchors) {
        const group = groups.get(anchor.target) ?? new Map<number, Anchor>();
        const held = group.get(anchor.surface);
        // Prefer actual visible text to an off-screen mention, then reading order.
        if (
          !held ||
          (held.edge && !anchor.edge) ||
          (Boolean(held.edge) === Boolean(anchor.edge) && anchor.top < held.top)
        )
          group.set(anchor.surface, anchor);
        groups.set(anchor.target, group);
      }
      const drawn: Ribbon[] = [];
      for (const [target, group] of groups) {
        const ordered = [...group.values()].sort(
          (a, b) => a.left - b.left || a.top - b.top,
        );
        for (
          let i = 0;
          i + 1 < ordered.length && drawn.length < MAX_RIBBONS;
          i++
        ) {
          let from = ordered[i];
          let to = ordered[i + 1];
          const vertical =
            from.surfaceBottom <= to.surfaceTop ||
            to.surfaceBottom <= from.surfaceTop;
          if (vertical && from.top > to.top) [from, to] = [to, from];
          if (
            (!vertical && to.left - from.right < 6) ||
            (vertical && to.top - from.bottom < 6)
          )
            continue;
          drawn.push({
            id: `${target}:${i}`,
            target,
            hue: keywordHue(target),
            path: band(from, to, vertical),
            from,
            to,
            vertical,
          });
        }
        if (drawn.length >= MAX_RIBBONS) break;
      }
      flushSync(() =>
        setRibbons((current) =>
          JSON.stringify(current) === JSON.stringify(drawn) ? current : drawn,
        ),
      );
      if (performance.now() < motionUntil) schedule();
    };
    const schedule = () => {
      if (alive && raf === null) raf = requestAnimationFrame(measure);
    };
    const animate = () => {
      motionUntil = performance.now() + 250;
      schedule();
    };
    const ownChange = (record: MutationRecord) => {
      const node =
        record.target.nodeType === Node.ELEMENT_NODE
          ? (record.target as Element)
          : record.target.parentElement;
      return (
        Boolean(node?.closest("[data-testid='parallel-ribbons']")) ||
        (record.type === "childList" &&
          [...record.addedNodes, ...record.removedNodes].every(
            (n) =>
              n instanceof Element &&
              n.matches("[data-testid='parallel-ribbons']"),
          ))
      );
    };
    const syncFrames = () => {
      const frames = new Set(
        document.querySelectorAll<HTMLIFrameElement>(FRAME),
      );
      for (const [element, watcher] of watchers) {
        if (!frames.has(element) || watcher.doc !== readable(element)) {
          watcher.stop();
          watchers.delete(element);
        }
      }
      for (const element of frames) {
        if (watchers.has(element)) continue;
        const doc = readable(element);
        const reloaded = () => {
          syncFrames();
          schedule();
        };
        element.addEventListener("load", reloaded);
        doc?.addEventListener("scroll", schedule, true);
        const mutations = new MutationObserver(schedule);
        const resize = new ResizeObserver(schedule);
        if (doc?.body) {
          mutations.observe(doc.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: [
              "style",
              "class",
              "hidden",
              "data-preview-target",
            ],
          });
          resize.observe(doc.body);
        }
        resize.observe(element);
        watchers.set(element, {
          doc,
          stop: () => {
            element.removeEventListener("load", reloaded);
            doc?.removeEventListener("scroll", schedule, true);
            mutations.disconnect();
            resize.disconnect();
          },
        });
      }
    };
    const mutations = new MutationObserver((records) => {
      if (records.every(ownChange)) return;
      syncFrames();
      schedule();
    });
    mutations.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden", "data-preview-target"],
    });
    const resize = new ResizeObserver(schedule);
    resize.observe(document.body);
    document.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    document.addEventListener("transitionrun", animate, true);
    document.addEventListener("transitionend", schedule, true);
    syncFrames();
    schedule();
    return () => {
      alive = false;
      if (raf !== null) cancelAnimationFrame(raf);
      mutations.disconnect();
      resize.disconnect();
      document.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("transitionrun", animate, true);
      document.removeEventListener("transitionend", schedule, true);
      for (const watcher of watchers.values()) watcher.stop();
    };
  }, [on]);

  if (!on || ribbons.length === 0) return null;
  return (
    <svg
      data-testid="parallel-ribbons"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 h-full w-full"
    >
      {ribbons.map((ribbon) => (
        <g key={ribbon.id}>
          <path
            d={ribbon.path}
            fill={`hsl(${ribbon.hue} 70% 60% / 0.24)`}
            stroke={`hsl(${ribbon.hue} 70% 65% / 0.5)`}
            strokeDasharray={
              ribbon.from.edge || ribbon.to.edge ? "4 4" : undefined
            }
            data-ribbon={ribbon.target}
            data-direction={ribbon.vertical ? "vertical" : "horizontal"}
          >
            <title>
              {ribbon.target.slice(4)} · shared keyword
              {ribbon.from.edge || ribbon.to.edge
                ? " · dashed edge continues off screen"
                : ""}
            </title>
          </path>
          {[ribbon.from, ribbon.to].map((anchor, index) =>
            anchor.edge ? (
              <text
                key={index}
                x={(anchor.left + anchor.right) / 2}
                y={anchor.top + 9}
                textAnchor="middle"
                fill={`hsl(${ribbon.hue} 78% 78%)`}
                fontSize="10"
                data-edge={anchor.edge}
              >
                {anchor.edge === "above" ? "▲" : "▼"}
              </text>
            ) : null,
          )}
        </g>
      ))}
    </svg>
  );
}
