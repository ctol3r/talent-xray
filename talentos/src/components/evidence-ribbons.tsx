"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { ribbonPath } from "../../artifact-src/core/parallel";

/**
 * Says who?
 *
 * The dossier reads down the left, the evidence sits on the right, and a
 * ribbon runs from every claim to the sources behind it. Hover either side to
 * light up what it connects to; click to pin that connection and dim the rest,
 * which is the only way to read a person with fifteen claims and thirty
 * sources without losing your place.
 *
 * It runs in both directions on purpose. Reading left to right answers "what
 * is this claim based on"; reading right to left answers "what is this source
 * being used to support", which is the question you ask when a source looks
 * thin. Clicking either side scrolls its counterpart into view.
 *
 * Geometry is measured from the rendered rows rather than assumed, so it
 * survives text of any length, and it is remeasured on resize: a ribbon that
 * no longer lands on its row is worse than no ribbon.
 */

export interface RibbonClaim {
  id: string;
  /** What is being asserted, in the words of whoever asserted it. */
  text: string;
  /** Ids of the evidence rows that support it. */
  evidenceIds: string[];
  /** Set when this claim is adjacent support rather than the thing asked for. */
  adjacent?: boolean;
}

export interface RibbonEvidence {
  id: string;
  label: string;
  detail?: string;
  domain: string;
  url: string;
  quote?: string | null;
  date?: string | null;
}

type Anchor = { side: "claim" | "evidence"; id: string } | null;

function sameAnchor(a: Anchor, b: Anchor): boolean {
  return a !== null && b !== null && a.side === b.side && a.id === b.id;
}

export function EvidenceRibbons({
  claims,
  evidence,
}: {
  claims: RibbonClaim[];
  evidence: RibbonEvidence[];
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const claimEls = useRef(new Map<string, HTMLElement>());
  const evidenceEls = useRef(new Map<string, HTMLElement>());
  const [paths, setPaths] = useState<
    { key: string; d: string; opacity: number }[]
  >([]);
  const [hovered, setHovered] = useState<Anchor>(null);
  const [pinned, setPinned] = useState<Anchor>(null);

  const active = pinned ?? hovered;

  const measure = useCallback(() => {
    const container = wrap.current;
    if (!container) return;
    const base = container.getBoundingClientRect();
    const next: { key: string; d: string; opacity: number }[] = [];

    for (const claim of claims) {
      const claimEl = claimEls.current.get(claim.id);
      if (!claimEl?.isConnected) continue;
      const claimBox = claimEl.getBoundingClientRect();

      for (const evidenceId of claim.evidenceIds) {
        const evidenceEl = evidenceEls.current.get(evidenceId);
        if (!evidenceEl?.isConnected) continue;
        const evidenceBox = evidenceEl.getBoundingClientRect();

        const lit =
          active === null ||
          (active.side === "claim" && active.id === claim.id) ||
          (active.side === "evidence" && active.id === evidenceId);

        next.push({
          key: `${claim.id}->${evidenceId}`,
          d: ribbonPath(
            {
              x: claimBox.right - base.left,
              y: claimBox.top - base.top + claimBox.height / 2,
              height: Math.min(claimBox.height, 40),
            },
            {
              x: evidenceBox.left - base.left,
              y: evidenceBox.top - base.top + evidenceBox.height / 2,
              height: Math.min(evidenceBox.height, 40),
            },
          ),
          opacity: active === null ? 0.5 : lit ? 0.95 : 0.08,
        });
      }
    }
    setPaths(next);
  }, [claims, active]);

  useLayoutEffect(measure, [measure]);

  useEffect(() => {
    const onChange = () => measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("scroll", onChange, { passive: true });
    return () => {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("scroll", onChange);
    };
  }, [measure]);

  /** Bring the other side of a connection into view, so pinning is readable. */
  function scrollCounterpart(anchor: NonNullable<Anchor>) {
    if (anchor.side === "claim") {
      const claim = claims.find((c) => c.id === anchor.id);
      const target = claim
        ? evidenceEls.current.get(claim.evidenceIds[0] ?? "")
        : undefined;
      target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } else {
      const claim = claims.find((c) => c.evidenceIds.includes(anchor.id));
      const target = claim ? claimEls.current.get(claim.id) : undefined;
      target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function bind(side: "claim" | "evidence", id: string) {
    const anchor = { side, id } as const;
    return {
      onMouseEnter: () => setHovered(anchor),
      onMouseLeave: () => setHovered(null),
      onClick: (event: React.MouseEvent) => {
        if ((event.target as HTMLElement).closest("a")) return;
        const same = sameAnchor(pinned, anchor);
        setPinned(same ? null : anchor);
        if (!same) scrollCounterpart(anchor);
      },
    };
  }

  function linked(side: "claim" | "evidence", id: string): boolean {
    if (active === null) return false;
    if (active.side === side) return active.id === id;
    if (side === "evidence") {
      const claim = claims.find((c) => c.id === active.id);
      return claim?.evidenceIds.includes(id) ?? false;
    }
    const claim = claims.find((c) => c.id === id);
    return claim?.evidenceIds.includes(active.id) ?? false;
  }

  function tone(side: "claim" | "evidence", id: string): string {
    if (active === null) return "border-edge2";
    if (sameAnchor(active, { side, id })) return "border-accent bg-accent-soft";
    if (linked(side, id)) return "border-accent/50";
    return "border-edge2 opacity-45";
  }

  if (claims.length === 0 || evidence.length === 0) {
    return (
      <p className="text-[13px] text-ink-muted">
        Nothing to join yet — a ribbon needs a claim on one side and a source on
        the other.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-[12px] text-ink-muted">
        {pinned
          ? "Pinned. Click it again to release."
          : "Hover to trace a claim to its sources. Click to pin it, either direction."}
      </p>
      <div ref={wrap} className="relative grid gap-6 sm:grid-cols-2">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {paths.map((p) => (
            <path
              key={p.key}
              d={p.d}
              className="fill-accent"
              opacity={p.opacity}
            />
          ))}
        </svg>

        <ul className="relative space-y-1.5">
          {claims.map((claim) => (
            <li
              key={claim.id}
              ref={(el) => {
                if (el) claimEls.current.set(claim.id, el);
                else claimEls.current.delete(claim.id);
              }}
              {...bind("claim", claim.id)}
              className={`cursor-pointer rounded border bg-panel2 p-2 text-[13px] transition-opacity ${tone("claim", claim.id)}`}
            >
              <span className="mr-1 text-ink-muted">
                {claim.adjacent ? "↔" : "✓"}
              </span>
              <span className={claim.adjacent ? "text-ink-muted" : "text-ink"}>
                {claim.text}
              </span>
              <span className="ml-1 text-[11px] text-ink-muted">
                {claim.evidenceIds.length} source
                {claim.evidenceIds.length === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>

        <ul className="relative space-y-1.5">
          {evidence.map((item) => (
            <li
              key={item.id}
              ref={(el) => {
                if (el) evidenceEls.current.set(item.id, el);
                else evidenceEls.current.delete(item.id);
              }}
              {...bind("evidence", item.id)}
              className={`cursor-pointer rounded border bg-panel2 p-2 text-[13px] transition-opacity ${tone("evidence", item.id)}`}
            >
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="text-ink">{item.label}</span>
                {item.date && (
                  <span className="font-mono text-[11px] text-ink-muted">
                    {item.date}
                  </span>
                )}
              </div>
              {item.detail && (
                <p className="mt-0.5 text-[12px] text-ink-muted">
                  {item.detail}
                </p>
              )}
              {item.quote && (
                <p className="mt-0.5 border-l-2 border-edge2 pl-2 text-[12px] italic text-ink-muted">
                  {item.quote}
                </p>
              )}
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-block font-mono text-[11px] text-accent hover:underline"
              >
                {item.domain || "on file"} ↗
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
