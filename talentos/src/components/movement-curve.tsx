"use client";

import { useState } from "react";
import {
  MIN_FOR_A_SHAPE,
  curvePath,
  densityCurve,
  type CurvePoint,
} from "../../artifact-src/core/movement";

const W = 232;
const H = 62;

export interface MovementTick {
  jobId: string;
  name: string;
  value: number;
  says: string;
  /** The window agreed at intake, said plainly. */
  clock: string;
  /** True when there is no agreed date and the default was assumed. */
  unclocked: boolean;
}

/**
 * The shape a deskful of jobs makes.
 *
 * Each job is a tick along the axis and the curve is where they bunch: most of
 * them at the quiet end is a different week from most of them at the busy end,
 * and neither is visible in a list of twenty rows.
 *
 * It says movement and not progress, and the distinction is the point. This
 * counts rows that exist — tasks ticked, people moved, people added, each worth
 * less the older it is. It does not know whether any of that was worth doing.
 * A job can be busy and going nowhere, and this will say busy.
 *
 * Every job is measured on its OWN clock, from the start date agreed at
 * intake, which is what makes putting them on one axis defensible at all: a
 * fortnight of quiet is a crisis on a two-week search and a Tuesday on a
 * two-year one, so the axis is "against what this job needs" rather than
 * "against a calendar".
 *
 * Below four jobs there is no curve, only ticks. A curve through two points is
 * a picture of two jobs pretending to be a distribution.
 */
export function MovementCurve({
  ticks,
  median,
  says,
  unclocked = 0,
}: {
  ticks: MovementTick[];
  median: number;
  says: string;
  /** How many of these have no agreed date behind them. */
  unclocked?: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const values = ticks.map((tick) => tick.value);
  const curve: CurvePoint[] =
    ticks.length >= MIN_FOR_A_SHAPE ? densityCurve(values) : [];
  const shown = ticks.find((tick) => tick.jobId === hovered);

  return (
    <figure
      data-testid="movement-curve"
      className="w-full rounded-lg border border-edge bg-panel p-3 sm:w-[248px]"
    >
      <figcaption className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink">📈 Movement</span>
        <span className="text-[11.5px] text-ink-faint">{says}</span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H + 14}`}
        className="w-full"
        role="img"
        aria-label={`Movement across ${ticks.length} open jobs. ${says}. Each mark is one job; further right is more recorded activity.`}
      >
        {curve.length > 0 && (
          <path
            d={curvePath(curve, W, H)}
            className="fill-accent/20 stroke-accent/70"
            strokeWidth={1.25}
          />
        )}

        {/* The middle job. Not the mean: one very busy job moves a mean, and
            the question this answers is where the typical job sits. */}
        <line
          x1={median * W}
          y1={2}
          x2={median * W}
          y2={H}
          className="stroke-ink-faint"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <line
          x1={0}
          y1={H}
          x2={W}
          y2={H}
          className="stroke-edge2"
          strokeWidth={1}
        />

        {ticks.map((tick) => (
          <line
            key={tick.jobId}
            x1={tick.value * W}
            y1={H - 6}
            x2={tick.value * W}
            y2={H + 5}
            strokeWidth={hovered === tick.jobId ? 2.5 : 1.5}
            className={
              hovered === tick.jobId ? "stroke-accent" : "stroke-ink-muted"
            }
            onPointerEnter={() => setHovered(tick.jobId)}
            onPointerLeave={() => setHovered(null)}
          >
            <title>{`${tick.name} — ${tick.says} · ${tick.clock}`}</title>
          </line>
        ))}

        <text x={0} y={H + 13} className="fill-ink-faint text-[9px]">
          quiet
        </text>
        <text
          x={W}
          y={H + 13}
          textAnchor="end"
          className="fill-ink-faint text-[9px]"
        >
          busy
        </text>
      </svg>

      <p className="mt-1 h-8 text-[11.5px] leading-4 text-ink-muted">
        {shown ? (
          <>
            <span className="text-ink">{shown.name}</span> — {shown.says}
            <span className={shown.unclocked ? "text-warn" : "text-ink-faint"}>
              {" · "}
              {shown.clock}
            </span>
          </>
        ) : ticks.length < MIN_FOR_A_SHAPE ? (
          "Fewer than four open jobs, so there is no shape to draw — the marks are the jobs."
        ) : unclocked > 0 ? (
          // A measure resting on an assumption says which jobs it is assuming
          // about. The fix is a conversation, not a setting.
          `Each job against the date agreed at intake. ${unclocked} of ${ticks.length} ${unclocked === 1 ? "has" : "have"} no agreed date, so a fortnight was assumed.`
        ) : (
          "Each job against the date agreed at intake — tasks ticked and people moved, counting for less the older they are on that job's own clock."
        )}
      </p>
    </figure>
  );
}
