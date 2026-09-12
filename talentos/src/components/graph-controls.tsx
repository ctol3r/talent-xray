"use client";

import { useState } from "react";
import { graphKinds, type GraphKind } from "@/lib/core/knowledge-graph";
import { FORCE_RANGES, type GraphForces } from "@/lib/core/graph-layout";
import {
  DEFAULT_VIEW,
  DISPLAY_RANGES,
  normalizeView,
  type GraphViewSettings,
} from "@/lib/core/graph-view-settings";

/**
 * The graph's control panel.
 *
 * Three groups, named the way Obsidian names them, because that is the
 * vocabulary anyone who has used a graph view already has: what is on screen,
 * how it is drawn, how it arranges itself.
 *
 * Settings live in this browser and nowhere else. They are a preference about
 * looking, not a fact about recruiting, so they never reach the database —
 * and a graph that opens the way you left it is worth more than one that is
 * the same for everybody.
 */

const KIND_LABEL: Record<GraphKind, string> = {
  search: "💼 Jobs",
  candidate: "👤 People",
  requirement: "🎯 Requirements",
  document: "📄 Documents",
  comparison: "⚖️ Comparisons",
  channel: "📡 Channels",
  source: "🔗 Sources",
  tag: "🏷️ Tags",
};

const STORAGE_KEY = "graph-view";

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="text-[13px] text-ink-muted">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`h-4 w-8 shrink-0 rounded-full border transition-colors ${
          on ? "border-accent bg-accent" : "border-edge2 bg-panel2"
        }`}
      >
        <span
          className={`block h-3 w-3 rounded-full bg-canvas transition-transform ${
            on ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="block py-1">
      <span className="mb-0.5 flex items-center justify-between text-[13px] text-ink-muted">
        {label}
        <span className="text-[11.5px] text-ink-faint">{value}</span>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-accent"
      />
    </label>
  );
}

function Group({
  title,
  children,
  open = true,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="border-b border-edge last:border-0">
      <summary className="cursor-pointer py-1.5 text-[13px] font-medium text-ink">
        {title}
      </summary>
      <div className="pb-2">{children}</div>
    </details>
  );
}

export function GraphControls({
  value,
  onChange,
  counts,
}: {
  value: GraphViewSettings;
  onChange: (next: GraphViewSettings) => void;
  counts: { shown: number; hidden: number; edges: number };
}) {
  const setFilters = (patch: Partial<GraphViewSettings["filters"]>) =>
    onChange({ ...value, filters: { ...value.filters, ...patch } });
  const setDisplay = (patch: Partial<GraphViewSettings["display"]>) =>
    onChange({ ...value, display: { ...value.display, ...patch } });
  const setForces = (patch: Partial<GraphForces>) =>
    onChange({ ...value, forces: { ...value.forces, ...patch } });

  return (
    <div
      data-testid="graph-controls"
      className="w-full shrink-0 sm:w-60 rounded-lg border border-edge bg-panel px-3 py-2"
    >
      <div className="flex items-center justify-between pb-1">
        <span className="text-[12px] tracking-wider text-ink-faint uppercase">
          Graph view
        </span>
        <button
          type="button"
          onClick={() => onChange(DEFAULT_VIEW)}
          title="Back to the defaults"
          className="text-[12px] text-ink-faint hover:text-ink"
        >
          reset
        </button>
      </div>

      <Group title="Filters">
        <input
          type="search"
          aria-label="Search the graph"
          value={value.filters.search}
          onChange={(event) => setFilters({ search: event.target.value })}
          placeholder="Search records…"
          className="mb-1.5 w-full rounded border border-edge2 bg-panel2 px-2 py-1 text-[13px] text-ink"
        />
        {value.filters.search.trim() !== "" && (
          <p className="mb-1 text-[11.5px] text-ink-faint">
            Matches stay lit; the rest dim rather than disappear, so you can
            still see what they sit next to.
          </p>
        )}
        {graphKinds.map((kind) => (
          <Toggle
            key={kind}
            label={KIND_LABEL[kind]}
            on={value.filters.kinds[kind]}
            onChange={(on) =>
              setFilters({ kinds: { ...value.filters.kinds, [kind]: on } })
            }
          />
        ))}
        <div className="mt-1 border-t border-edge pt-1">
          <Toggle
            label="Unconnected records"
            on={value.filters.orphans}
            onChange={(on) => setFilters({ orphans: on })}
          />
          <Toggle
            label="Links you drew"
            on={value.filters.recruiterLinks}
            onChange={(on) => setFilters({ recruiterLinks: on })}
          />
          <Toggle
            label="Links from the records"
            on={value.filters.storedLinks}
            onChange={(on) => setFilters({ storedLinks: on })}
          />
        </div>
        <p className="mt-1.5 text-[11.5px] text-ink-faint">
          {counts.shown} shown · {counts.hidden} hidden · {counts.edges} links
        </p>
      </Group>

      <Group title="Display" open={false}>
        <Toggle
          label="Arrows"
          on={value.display.arrows}
          onChange={(on) => setDisplay({ arrows: on })}
        />
        <Slider
          label="Hide labels below"
          value={value.display.labelThreshold}
          {...DISPLAY_RANGES.labelThreshold}
          onChange={(labelThreshold) => setDisplay({ labelThreshold })}
        />
        <Slider
          label="Node size"
          value={value.display.nodeSize}
          {...DISPLAY_RANGES.nodeSize}
          onChange={(nodeSize) => setDisplay({ nodeSize })}
        />
        <Slider
          label="Link thickness"
          value={value.display.linkThickness}
          {...DISPLAY_RANGES.linkThickness}
          onChange={(linkThickness) => setDisplay({ linkThickness })}
        />
      </Group>

      <Group title="Forces" open={false}>
        <Slider
          label="Centre force"
          value={value.forces.centre}
          {...FORCE_RANGES.centre}
          onChange={(centre) => setForces({ centre })}
        />
        <Slider
          label="Repel force"
          value={value.forces.repel}
          {...FORCE_RANGES.repel}
          onChange={(repel) => setForces({ repel })}
        />
        <Slider
          label="Link force"
          value={value.forces.linkForce}
          {...FORCE_RANGES.linkForce}
          onChange={(linkForce) => setForces({ linkForce })}
        />
        <Slider
          label="Link distance"
          value={value.forces.linkDistance}
          {...FORCE_RANGES.linkDistance}
          onChange={(linkDistance) => setForces({ linkDistance })}
        />
      </Group>
    </div>
  );
}

/**
 * Remembered per browser. Wrapped in try/catch because a private window, or
 * a browser set to block site data, throws on the accessor itself — and a
 * graph that will not render because it could not read a preference is a
 * worse bug than a graph that opens with the defaults.
 */
function readStored(): GraphViewSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeView(JSON.parse(raw)) : DEFAULT_VIEW;
  } catch {
    // A private window, or a browser set to block site data, throws on the
    // accessor itself. Defaults are a perfectly good answer.
    return DEFAULT_VIEW;
  }
}

export function useGraphView(): [
  GraphViewSettings,
  (next: GraphViewSettings) => void,
] {
  // Read lazily on the first client render rather than in an effect: an
  // effect that sets state immediately renders the defaults, then the stored
  // value, which flickers.
  const [view, setView] = useState<GraphViewSettings>(() =>
    typeof window === "undefined" ? DEFAULT_VIEW : readStored(),
  );

  const update = (next: GraphViewSettings) => {
    setView(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Not being able to remember is not a reason to refuse the change.
    }
  };

  return [view, update];
}
