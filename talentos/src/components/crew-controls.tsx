"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { advanceCrewAction, kickoffCrewAction } from "@/lib/actions/crew";
import type { CrewAdvanceResult } from "@/lib/services/crew";

/**
 * Kickoff + advance controls for the per-search crew. Advancing runs every
 * runnable agent; with the session provider the crew parks on request
 * files, which the page lists for a Claude session to fulfill.
 */
export function CrewControls({
  projectId,
  hasActiveJobs,
}: {
  projectId: string;
  hasActiveJobs: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      setNote(null);
      await fn();
      router.refresh();
    });

  const kickoff = () =>
    run(async () => {
      const result = await kickoffCrewAction({ searchProjectId: projectId });
      setNote(
        result.ok
          ? `Crew queued: ${result.data.jobs} agents. Now advance the crew.`
          : result.error,
      );
    });

  const advance = () =>
    run(async () => {
      const result = await advanceCrewAction({ searchProjectId: projectId });
      if (!result.ok) {
        setNote(result.error);
        return;
      }
      const r: CrewAdvanceResult = result.data;
      setNote(
        r.remaining === 0
          ? `Crew finished: ${r.done} artifacts done${r.failed.length ? `, ${r.failed.length} failed` : ""}.`
          : r.pending.length > 0
            ? `${r.pending.length} generation(s) waiting on a Claude session — see the handoff list below.`
            : `Progressed ${r.ran} steps; ${r.remaining} jobs remaining — advance again.`,
      );
    });

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={kickoff}
          disabled={isPending}
          className="rounded border border-edge2 px-3 py-1.5 text-[13px] font-medium text-ink-muted hover:bg-panel2 disabled:opacity-50"
        >
          {hasActiveJobs ? "Restart crew" : "Kick off crew"}
        </button>
        <button
          type="button"
          onClick={advance}
          disabled={isPending || !hasActiveJobs}
          className="rounded bg-accent px-3 py-1.5 text-[13px] font-medium text-canvas hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Working…" : "Advance crew"}
        </button>
      </div>
      {note ? (
        <p className="max-w-md text-right text-[12px] text-ink-muted">{note}</p>
      ) : null}
    </div>
  );
}
