"use client";

import {
  type CSSProperties,
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { keywordHue } from "@/lib/core/keyword-colour";
import { usePanes } from "./sliding-panes";

/**
 * Live preview on hover.
 *
 * Hovering a page reference fetches a small summary and shows it beside the
 * cursor: what the page is, how many things point at it, and the first
 * couple of places it was written. The point is to answer "is this worth
 * opening" without opening it, which is what makes a densely linked note
 * readable rather than a wall of blue.
 *
 * Three deliberate details. It waits before firing, so running the cursor
 * across a paragraph does not fetch six times. Each new hover reads current
 * saved facts, including changes made inside an adjacent pane. It never opens on a
 * touch device, where hovering does not exist and a card would just be a
 * misfire on the way to a tap.
 */

export interface PreviewData {
  target: string;
  title: string;
  kind: "tag" | "candidate" | "job";
  icon: string;
  subtitle?: string;
  href: string;
  facts: string[];
  lines: string[];
  tags: string[];
}

interface PreviewApi {
  show: (target: string, x: number, y: number) => void;
  hide: () => void;
}

const PreviewContext = createContext<PreviewApi | null>(null);

export function usePagePreview(): PreviewApi | null {
  return useContext(PreviewContext);
}

const OPEN_DELAY = 320;
const CARD_WIDTH = 320;

export function PagePreviewProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const request = useRef<AbortController | null>(null);
  const timer = useRef<number | null>(null);
  const wanted = useRef<string | null>(null);

  const hide = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    request.current?.abort();
    wanted.current = null;
    setData(null);
    setAt(null);
  }, []);

  const show = useCallback((target: string, x: number, y: number) => {
    if (window.matchMedia("(hover: none)").matches) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    request.current?.abort();
    setData(null);
    wanted.current = target;
    setAt({ x, y });
    timer.current = window.setTimeout(async () => {
      const controller = new AbortController();
      request.current = controller;
      try {
        const response = await fetch(
          `/api/preview?target=${encodeURIComponent(target)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as PreviewData;
        // The cursor may have moved on while this was in flight.
        if (!controller.signal.aborted && wanted.current === target)
          setData(payload);
      } catch {
        // A preview is a convenience; failing to fetch one is not an error
        // worth putting on screen.
      }
    }, OPEN_DELAY);
  }, []);

  // Keep the card on screen: flip it left or up when it would overflow.
  const left = at
    ? Math.max(8, Math.min(at.x + 14, window.innerWidth - CARD_WIDTH - 12))
    : 0;
  const top = at ? Math.min(at.y + 18, window.innerHeight - 240) : 0;

  return (
    <PreviewContext.Provider value={{ show, hide }}>
      {children}
      {data && at && (
        <div
          role="tooltip"
          data-testid="page-preview"
          style={{ left, top, width: CARD_WIDTH }}
          className="pointer-events-none fixed z-40 rounded-lg border border-edge2 bg-panel p-3 shadow-2xl"
        >
          <p className="text-[14px] font-medium text-ink">
            <span aria-hidden className="mr-1.5">
              {data.icon}
            </span>
            {data.title}
          </p>
          {data.subtitle && (
            <p className="mt-0.5 text-[12px] text-ink-faint">{data.subtitle}</p>
          )}
          {data.facts.length > 0 && (
            <p className="mt-1 text-[12.5px] text-ink-muted">
              {data.facts.join(" · ")}
            </p>
          )}
          {data.lines.length > 0 && (
            <ul className="mt-1.5 space-y-1">
              {data.lines.map((line, index) => (
                <li
                  key={index}
                  className="line-clamp-2 text-[12.5px] text-ink-muted"
                >
                  {line}
                </li>
              ))}
            </ul>
          )}
          {data.tags.length > 0 && (
            <p className="mt-1.5 truncate text-[12px] text-ink-faint">
              🏷️ {data.tags.join(", ")}
            </p>
          )}
        </div>
      )}
    </PreviewContext.Provider>
  );
}

/**
 * A link that previews on hover, and opens beside your work on shift-click.
 *
 * Use it for every internal link to a job, a person or a page. The first
 * version only wrapped written page references, which meant two links on a
 * page of seventy-four did anything — a preview you have to hunt for is not
 * a preview.
 *
 * Shift-click rather than a separate button, because a reference sits inside
 * a sentence and a button beside every one of them would make prose
 * unreadable. Plain click still navigates, which is what most clicks want.
 */
export function PreviewLink({
  target,
  href,
  children,
  className = "",
  title,
}: {
  /** `tag:<slug>`, `candidate:<id>` or `job:<id>`. */
  target: string;
  href: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  const preview = usePagePreview();
  const { open } = usePanes();
  const paneSlug = target.startsWith("tag:") ? target.slice(4) : null;
  return (
    <Link
      href={href}
      data-preview-target={target}
      title={
        title ?? (paneSlug ? "Shift-click to open beside your work" : undefined)
      }
      className={`${className} ${paneSlug ? "keyword-reference" : ""}`}
      style={
        paneSlug
          ? ({ "--keyword-hue": keywordHue(target) } as CSSProperties)
          : undefined
      }
      onMouseEnter={(event) =>
        preview?.show(target, event.clientX, event.clientY)
      }
      onMouseLeave={() => preview?.hide()}
      onClick={(event) => {
        preview?.hide();
        if (event.shiftKey && paneSlug) {
          event.preventDefault();
          open(paneSlug);
        }
      }}
    >
      {children}
    </Link>
  );
}

/** A written page reference: `[[a page]]` or `#a-tag`. */
export function PageLink({
  slug,
  href,
  children,
  className = "",
}: {
  slug: string;
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <PreviewLink target={`tag:${slug}`} href={href} className={className}>
      {children}
    </PreviewLink>
  );
}
