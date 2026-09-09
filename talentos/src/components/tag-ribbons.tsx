"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ribbonPath } from "../../artifact-src/core/parallel";
import { TagText } from "./tag-text";

/**
 * Every place a tag was written, joined to it by a ribbon.
 *
 * The same drawing already used to join a passage to the requirement it
 * supports on the document review page: a filled curve between two boxes,
 * rather than a line between two points, so a wide mention and a narrow one
 * read as connected rather than as pointing.
 *
 * It exists because a list of mentions tells you how many there are and a
 * picture tells you what shape they make — one job with six mentions and six
 * jobs with one each are the same list and very different situations.
 *
 * The geometry is measured from the rendered rows rather than assumed, so it
 * survives text of any length, and it is remeasured on resize because a
 * ribbon that no longer lands on its row is worse than no ribbon.
 */

export interface RibbonMention {
  id: string;
  kind: string;
  icon: string;
  label: string;
  searchName: string;
  context: string;
  href: string;
}

export function TagRibbons({
  title,
  mentions,
}: {
  title: string;
  mentions: RibbonMention[];
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLDivElement>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const [paths, setPaths] = useState<{ id: string; d: string }[]>([]);
  const [active, setActive] = useState<string | null>(null);

  function measure() {
    const container = wrap.current;
    const centre = hub.current;
    if (!container || !centre) return;
    const base = container.getBoundingClientRect();
    const hubBox = centre.getBoundingClientRect();
    const next: { id: string; d: string }[] = [];
    for (const [id, row] of rows.current) {
      if (!row.isConnected) continue;
      const box = row.getBoundingClientRect();
      next.push({
        id,
        d: ribbonPath(
          {
            x: box.right - base.left,
            y: box.top - base.top + box.height / 2,
            height: Math.min(box.height, 44),
          },
          {
            x: hubBox.left - base.left,
            y: hubBox.top - base.top + hubBox.height / 2,
            height: Math.min(hubBox.height, 44),
          },
        ),
      });
    }
    setPaths(next);
  }

  // Measured after layout, before paint, so the ribbons never appear offset
  // for a frame.
  useLayoutEffect(measure, [mentions]);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });

  if (mentions.length === 0) return null;

  return (
    <div
      ref={wrap}
      data-testid="tag-ribbons"
      className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]"
    >
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      >
        {paths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            className={
              active === null || active === path.id
                ? "fill-accent/25"
                : "fill-accent/5"
            }
          />
        ))}
      </svg>

      <ul className="relative z-10 space-y-2">
        {mentions.map((mention) => (
          <li
            key={mention.id}
            ref={(node) => {
              if (node) rows.current.set(mention.id, node);
              else rows.current.delete(mention.id);
            }}
            onMouseEnter={() => setActive(mention.id)}
            onMouseLeave={() => setActive(null)}
            className={`rounded border bg-panel px-2.5 py-1.5 transition-colors ${
              active === mention.id ? "border-accent" : "border-edge"
            }`}
          >
            <Link
              href={mention.href}
              className="text-[13.5px] font-medium text-ink hover:underline"
            >
              <span aria-hidden className="mr-1.5">
                {mention.icon}
              </span>
              {mention.label}
            </Link>
            <p className="text-[11.5px] text-ink-faint">{mention.searchName}</p>
            <TagText
              text={mention.context}
              className="mt-0.5 block text-[12.5px] text-ink-muted"
            />
          </li>
        ))}
      </ul>

      <div className="relative z-10 flex items-start">
        <div
          ref={hub}
          className="sticky top-6 w-full rounded-lg border border-accent/50 bg-panel px-3 py-2 text-center"
        >
          <p className="text-[14px] font-medium text-ink">🏷️ {title}</p>
          <p className="mt-0.5 text-[12px] text-ink-faint">
            {mentions.length} connection{mentions.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </div>
  );
}
