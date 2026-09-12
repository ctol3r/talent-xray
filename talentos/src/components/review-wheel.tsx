"use client";
import { wheelSegments } from "../../artifact-src/core/radial";
export type ReviewAction = { label: string; reason?: string; run: () => void };
export function ReviewWheel({ actions }: { actions: ReviewAction[] }) {
  const segments = wheelSegments({ size: 280, thickness: 0.46, count: 8 });
  return (
    <details className="review-wheel">
      <summary>Contextual action wheel A–H</summary>
      <div
        style={{
          position: "relative",
          width: 280,
          height: 280,
          margin: "auto",
        }}
      >
        <svg viewBox="0 0 280 280" aria-hidden="true">
          {segments.map((s) => (
            <path
              key={s.index}
              d={s.path}
              fill={actions[s.index].reason ? "#e5e7eb" : "#d5eae8"}
            />
          ))}
        </svg>
        <span
          style={{
            position: "absolute",
            inset: "42% 32%",
            textAlign: "center",
            fontSize: 12,
          }}
        >
          Review actions
        </span>
        {segments.map((s) => (
          <button
            key={s.index}
            type="button"
            title={actions[s.index].reason ?? actions[s.index].label}
            aria-label={`${String.fromCharCode(65 + s.index)}: ${actions[s.index].label}${actions[s.index].reason ? `. ${actions[s.index].reason}` : ""}`}
            aria-disabled={!!actions[s.index].reason}
            onClick={actions[s.index].run}
            style={{
              position: "absolute",
              left: s.anchor.x,
              top: s.anchor.y,
              transform: "translate(-50%, -50%)",
              width: 64,
              fontSize: 10,
              padding: 3,
            }}
          >
            {String.fromCharCode(65 + s.index)}
            <br />
            {actions[s.index].label}
          </button>
        ))}
      </div>
    </details>
  );
}
