"use client";

import { useState, useTransition } from "react";
import { buttonClass, inputClass, subtleButtonClass } from "./forms";
import { editHillAction } from "@/lib/actions/hill";
import {
  clampPosition,
  hillPath,
  hillPoint,
  phaseMeaning,
  type HillChart,
  type HillSnapshot,
  type ScopeReading,
} from "../../artifact-src/core/hill";

const W = 720;
const H = 190;
const PAD = 26;

/** How far one arrow-key press moves a dot. A twentieth of the hill. */
const STEP = 0.05;

const SIGNAL_MARK: Record<ScopeReading["signal"], string> = {
  moving: "",
  still: "🕐",
  stuck: "✋",
  backslid: "↩️",
  done: "✓",
};

/**
 * The hill chart, after Shape Up chapter 13.
 *
 * Each scope is a dot you drag. Left of the crest it is still being figured
 * out; right of it, it is only unfinished. Nothing here moves a dot on its own
 * — a position is a judgement about what somebody still does not know, and
 * there is no measurement of that. What the app knows sits in the list beside
 * the chart, where it can inform the judgement without pretending to be it.
 *
 * The dots are labelled and every signal is also a word, so nothing here is
 * carried by colour alone.
 */
export function HillChartView({
  jobId,
  chart,
  readings,
  says,
  editable = true,
}: {
  jobId: string;
  chart: HillChart;
  readings: ScopeReading[];
  says: string;
  editable?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [dragging, setDragging] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [showTrail, setShowTrail] = useState(true);
  const [trouble, setTrouble] = useState<string | null>(null);

  const live = readings.filter((reading) => !reading.scope.doneAt);
  const done = readings.filter((reading) => reading.scope.doneAt);

  function positionOf(scopeId: string, fallback: number): number {
    return local[scopeId] ?? fallback;
  }

  /**
   * Every change to the hill goes through here, and every failure comes back.
   *
   * It used to await the action and throw the result away, which on a chart
   * whose dots move optimistically means a dot that slid, stayed where you
   * put it, and was back at the foot of the hill the next time the page
   * loaded. A chart that lies about where the work is is worse than no chart.
   */
  function send(edit: Record<string, unknown>) {
    startTransition(async () => {
      const result = await editHillAction({ jobId, edit });
      if (result.ok) {
        setTrouble(null);
        return;
      }
      setTrouble(result.error);
      // The optimistic position was a guess about what the server would say.
      // It said no, so stop showing the guess.
      setLocal({});
    });
  }

  function commit(scopeId: string, to: number) {
    setLocal((current) => ({ ...current, [scopeId]: to }));
    send({ kind: "move", scopeId, position: to });
  }

  function fromPointer(event: {
    clientX: number;
    currentTarget: SVGSVGElement | null;
  }): number | null {
    const svg = event.currentTarget;
    if (!svg) return null;
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * (W + PAD * 2) - PAD;
    return clampPosition(x / W);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[14px] text-ink-muted">⛰️ {says}</p>
        <button
          type="button"
          onClick={() => setShowTrail((on) => !on)}
          className={subtleButtonClass}
        >
          {showTrail ? "hide the trail" : "show the trail"}
        </button>
      </div>

      <svg
        viewBox={`${-PAD} ${-PAD} ${W + PAD * 2} ${H + PAD * 2}`}
        className="w-full touch-none select-none"
        role="group"
        aria-label="Hill chart. Each scope is a dot: left of the crest it is still being figured out, right of it the work is known and only unfinished. Select a dot and use the arrow keys to move it."
        onPointerMove={(event) => {
          if (!dragging || !editable) return;
          const to = fromPointer(event);
          if (to === null) return;
          setLocal((current) => ({ ...current, [dragging]: to }));
        }}
        onPointerUp={(event) => {
          if (!dragging) return;
          const to = fromPointer(event);
          if (to !== null) commit(dragging, to);
          setDragging(null);
        }}
        onPointerLeave={() => setDragging(null)}
      >
        <title>Where each part of this job stands</title>

        {/* The ground, so the feet of the hill read as the ground and not as
            an edge the dots could fall off. */}
        <line
          x1={0}
          y1={H}
          x2={W}
          y2={H}
          stroke="currentColor"
          className="text-edge2"
          strokeWidth={1}
        />
        <path
          d={hillPath(W, H)}
          fill="none"
          stroke="currentColor"
          className="text-edge2"
          strokeWidth={1.5}
        />
        {/* The crest, named. The one place on the picture that means something
            specific: everything to the left of it is unknown work. */}
        <line
          x1={W / 2}
          y1={0}
          x2={W / 2}
          y2={H}
          stroke="currentColor"
          className="text-edge2"
          strokeWidth={1}
          strokeDasharray="3 4"
        />
        <text
          x={W / 2}
          y={-8}
          textAnchor="middle"
          className="fill-ink-faint text-[11px]"
        >
          the crest — unknowns solved
        </text>
        <text x={0} y={H + 16} className="fill-ink-faint text-[11px]">
          ← figuring it out
        </text>
        <text
          x={W}
          y={H + 16}
          textAnchor="end"
          className="fill-ink-faint text-[11px]"
        >
          getting it done →
        </text>

        {showTrail && <Trail chart={chart} />}

        {live.map((reading) => {
          const at = positionOf(reading.scope.id, reading.scope.position);
          const { x, y } = hillPoint(at, W, H);
          const isSelected = selected === reading.scope.id;
          return (
            <g key={reading.scope.id}>
              <circle
                cx={x}
                cy={y}
                r={isSelected ? 11 : 8}
                fill={reading.scope.colour}
                stroke="currentColor"
                // A slider you can operate with the arrow keys and cannot see the focus
                // of is one nobody finds. The ring is drawn on the dot itself,
                // because an SVG outline is unreliable across browsers.
                className={`text-panel ${editable ? "cursor-grab" : ""} focus:outline-none focus-visible:stroke-accent focus-visible:[stroke-width:4]`}
                strokeWidth={2.5}
                role={editable ? "slider" : "img"}
                tabIndex={editable ? 0 : -1}
                aria-label={`${reading.scope.name}: ${reading.phase}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(at * 100)}
                aria-valuetext={`${reading.phase} — ${phaseMeaning(reading.phase)}`}
                onFocus={() => setSelected(reading.scope.id)}
                onPointerDown={(event) => {
                  if (!editable) return;
                  event.stopPropagation();
                  setSelected(reading.scope.id);
                  setDragging(reading.scope.id);
                }}
                onKeyDown={(event) => {
                  if (!editable) return;
                  const by =
                    event.key === "ArrowLeft"
                      ? -STEP
                      : event.key === "ArrowRight"
                        ? STEP
                        : 0;
                  if (!by) return;
                  event.preventDefault();
                  commit(reading.scope.id, clampPosition(at + by));
                }}
              />
              <text
                x={x}
                y={y - 15}
                textAnchor="middle"
                className={`text-[11px] ${isSelected ? "fill-ink" : "fill-ink-muted"}`}
              >
                {SIGNAL_MARK[reading.signal]} {reading.scope.name}
              </text>
            </g>
          );
        })}
      </svg>

      {trouble && (
        <p
          role="status"
          className="rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] text-bad"
        >
          The hill did not change: {trouble}
        </p>
      )}

      <ul className="space-y-1.5">
        {live.map((reading) => (
          <ScopeRow
            key={reading.scope.id}
            send={send}
            reading={reading}
            selected={selected === reading.scope.id}
            onHover={() => setSelected(reading.scope.id)}
            onToggle={() =>
              setSelected((current) =>
                current === reading.scope.id ? null : reading.scope.id,
              )
            }
            editable={editable}
            pending={pending}
          />
        ))}
      </ul>

      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[13px] text-ink-faint">
            ✓ {done.length} off the hill
          </summary>
          <ul className="mt-1.5 space-y-1">
            {done.map((reading) => (
              <li
                key={reading.scope.id}
                className="flex items-center justify-between gap-2 text-[13px] text-ink-faint"
              >
                <span>{reading.scope.name}</span>
                {editable && (
                  <button
                    type="button"
                    className={subtleButtonClass}
                    onClick={() =>
                      send({
                        kind: "finish",
                        scopeId: reading.scope.id,
                        done: false,
                      })
                    }
                  >
                    back on the hill
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      {editable && (
        <div>
          {adding ? (
            <form
              action={(data) => {
                const name = String(data.get("name") ?? "").trim();
                if (name) send({ kind: "add", name });
                setAdding(false);
              }}
              className="flex gap-2"
            >
              <input
                name="name"
                autoFocus
                placeholder="What else has to be worked out?"
                className={inputClass}
              />
              <button type="submit" className={buttonClass}>
                Add
              </button>
              <button
                type="button"
                className={subtleButtonClass}
                onClick={() => setAdding(false)}
              >
                Cancel
              </button>
            </form>
          ) : (
            <button
              type="button"
              className={subtleButtonClass}
              onClick={() => setAdding(true)}
            >
              + a scope
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Where the dots have been.
 *
 * One dot is an opinion; a fortnight of them is a fact about the work. Older
 * snapshots fade, so the eye reads direction without having to read dates.
 */
function Trail({ chart }: { chart: HillChart }) {
  const recent = chart.history.slice(-8);
  if (recent.length < 2) return null;
  return (
    <g aria-hidden="true">
      {recent.slice(0, -1).map((snap: HillSnapshot, index) =>
        (snap.scopes ?? chart.scopes).map((scope) => {
          const at = snap.positions[scope.id];
          if (at === undefined || scope.doneAt) return null;
          const { x, y } = hillPoint(at, W, H);
          return (
            <circle
              key={`${snap.at}-${scope.id}`}
              cx={x}
              cy={y}
              r={3}
              fill={scope.colour}
              opacity={0.1 + (index / recent.length) * 0.35}
            />
          );
        }),
      )}
    </g>
  );
}

/**
 * One scope, and the things you can do to it.
 *
 * Hovering a row used to be the only way to reach its buttons, which meant
 * that on a phone — where nothing hovers — the scopes could be read and never
 * changed. So the name is a button now: the mouse still reveals the actions
 * by moving over the row, and everybody else reveals them by pressing the
 * name, which is also how a keyboard gets there.
 */
function ScopeRow({
  send,
  reading,
  selected,
  onHover,
  onToggle,
  editable,
  pending,
}: {
  send: (edit: Record<string, unknown>) => void;
  reading: ScopeReading;
  selected: boolean;
  onHover: () => void;
  onToggle: () => void;
  editable: boolean;
  pending: boolean;
}) {
  const [splitting, setSplitting] = useState(false);
  const [dropping, setDropping] = useState(false);
  const raised = reading.signal === "stuck" || reading.signal === "backslid";

  return (
    <li
      onMouseEnter={onHover}
      className={`rounded border p-2 text-[13px] ${
        selected ? "border-accent bg-panel2" : "border-edge bg-panel2/40"
      }`}
    >
      <button
        type="button"
        onClick={() => {
          setDropping(false);
          onToggle();
        }}
        aria-expanded={selected}
        className="flex w-full items-baseline gap-2 text-left"
      >
        <span
          aria-hidden="true"
          className="mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: reading.scope.colour }}
        />
        <span className="font-medium text-ink">{reading.scope.name}</span>
        <span className="text-ink-faint">{reading.phase}</span>
      </button>
      <p className={`mt-0.5 pl-4.5 ${raised ? "text-warn" : "text-ink-muted"}`}>
        {SIGNAL_MARK[reading.signal]} {reading.says}
      </p>
      {reading.phase !== "downhill" &&
        reading.phase !== "as good as done" &&
        reading.scope.unknown && (
          // Only uphill. Past the crest there is nothing left to say about
          // what is unknown, because that is what the crest means.
          <p className="mt-0.5 pl-4.5 text-ink-faint">
            still unknown: {reading.scope.unknown}
          </p>
        )}

      {editable && selected && (
        <div className="mt-1.5 flex flex-wrap gap-2 pl-4.5">
          <button
            type="button"
            disabled={pending}
            className={subtleButtonClass}
            onClick={() =>
              send({ kind: "finish", scopeId: reading.scope.id, done: true })
            }
          >
            off the hill
          </button>
          <button
            type="button"
            className={subtleButtonClass}
            onClick={() => setSplitting((on) => !on)}
          >
            split in two
          </button>
          {/* Two presses, because this is the one button on the chart that
              destroys something: the scope goes and every position ever
              recorded for it goes with it. "off the hill" is the one people
              usually want and it keeps the trail, so the confirmation says so
              rather than only asking whether you are sure. */}
          {dropping ? (
            <>
              <button
                type="button"
                disabled={pending}
                className="rounded border border-bad/50 bg-bad-soft px-3 py-1.5 text-[14px] text-bad disabled:opacity-50"
                onClick={() => {
                  setDropping(false);
                  send({ kind: "drop", scopeId: reading.scope.id });
                }}
              >
                delete it and its trail
              </button>
              <button
                type="button"
                className={subtleButtonClass}
                onClick={() => setDropping(false)}
              >
                keep it
              </button>
            </>
          ) : (
            <button
              type="button"
              className={subtleButtonClass}
              onClick={() => setDropping(true)}
            >
              drop
            </button>
          )}
        </div>
      )}

      {splitting && (
        // The chapter's own remedy for a dot that will not move: if it holds
        // two problems, make it two dots so they can move separately.
        <form
          action={(data) => {
            const firstName = String(data.get("first") ?? "").trim();
            const secondName = String(data.get("second") ?? "").trim();
            if (firstName && secondName) {
              send({
                kind: "split",
                scopeId: reading.scope.id,
                firstName,
                secondName,
              });
            }
            setSplitting(false);
          }}
          className="mt-1.5 flex flex-wrap gap-2 pl-4.5"
        >
          <input
            name="first"
            defaultValue={reading.scope.name}
            className={inputClass}
          />
          <input
            name="second"
            placeholder="and the other half"
            className={inputClass}
          />
          <button type="submit" className={buttonClass}>
            Split
          </button>
        </form>
      )}
    </li>
  );
}
