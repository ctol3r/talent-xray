"use client";

import { updateSearchProjectAction } from "@/lib/actions/projects";
import { JOB_STATUSES } from "@/lib/domain/job-fields";
import { ErrorNote, useAction } from "./forms";

/**
 * Whether a job is still live.
 *
 * The column has existed since the first migration and the dashboard has
 * always read it — every count, every next-best-action and the movement curve
 * on the jobs page are computed over open jobs only. There was simply no way
 * to change it, so every job a desk ever opened stayed open forever and the
 * dashboard slowly became a list of work nobody is doing.
 *
 * Three states rather than a delete, because a filled job is the most useful
 * record on the desk: it is the one where the whole trail — the strings that
 * worked, the people who answered, the reason the hiring manager said yes —
 * is complete. Closing hides it from today's work and keeps all of it.
 *
 * On hold is not a slower kind of closed. It means the job is coming back, so
 * it stays out of the counts without reading as finished.
 */

const SAYS: Record<string, string> = {
  open: "Counted on the dashboard and on the desk's movement curve.",
  on_hold: "Paused: out of the counts, still on the list, nothing deleted.",
  closed: "Finished: out of the counts. Every record is kept and readable.",
};

const ICON: Record<string, string> = {
  open: "🟢",
  on_hold: "⏸️",
  closed: "🏁",
};

export function JobStatus({
  projectId,
  status,
}: {
  projectId: string;
  status: string;
}) {
  const { pending, error, submit } = useAction();
  return (
    <div className="flex flex-col items-end gap-1">
      <div
        role="group"
        aria-label="Job status"
        className="flex items-center overflow-hidden rounded border border-edge2"
      >
        {JOB_STATUSES.map((choice) => {
          const current = choice.value === status;
          return (
            // No `title`: a tooltip on a button becomes its accessible name,
            // so a screen reader would read the explanation and never the
            // word. The explanation is on the page underneath instead, where
            // it is also visible to people who never hover.
            <button
              key={choice.value}
              type="button"
              disabled={pending || current}
              aria-pressed={current}
              onClick={() =>
                submit(() =>
                  updateSearchProjectAction({
                    id: projectId,
                    status: choice.value,
                  }),
                )
              }
              className={`px-2.5 py-1 text-[13px] transition-colors ${
                current
                  ? "bg-accent font-medium text-canvas"
                  : "text-ink-muted hover:bg-panel2 disabled:opacity-50"
              }`}
            >
              <span aria-hidden="true">{ICON[choice.value]}</span>{" "}
              {choice.label}
            </button>
          );
        })}
      </div>
      <p className="text-right text-[12px] text-ink-faint">{SAYS[status]}</p>
      <ErrorNote error={error} />
    </div>
  );
}
