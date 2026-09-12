"use client";

import { useState, useTransition } from "react";
import { saveDiscoveryResultAction } from "@/lib/actions/discovery";

/**
 * Save somebody a structured source returned, into a job.
 *
 * The loop the sourcing page was missing: you could find a person and then do
 * nothing with them. This is also the only point at which anything found is
 * written down — everything else on the page is ranked and discarded, and a row
 * becomes a record exactly when a human presses this (product rule 2).
 *
 * It goes through the same action a saved link-out uses, so a person found here
 * carries the same provenance as one found any other way, rather than a second
 * shape of record that reports differently.
 */
export function SaveFoundPerson({
  jobs,
  name,
  url,
  snippet,
  engine,
  query,
}: {
  jobs: { id: string; name: string }[];
  name: string;
  url: string;
  snippet: string | null;
  engine: string;
  query: string;
}) {
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [state, setState] = useState<"idle" | "saved" | string>("idle");
  const [pending, start] = useTransition();

  if (jobs.length === 0) {
    return (
      <span className="text-[11px] text-ink-muted">
        no open job to save into
      </span>
    );
  }

  if (state === "saved") {
    return <span className="text-[11px] text-accent">saved ✓</span>;
  }

  return (
    <span className="flex flex-wrap items-center gap-1">
      <select
        value={jobId}
        onChange={(e) => setJobId(e.target.value)}
        aria-label={`Job to save ${name} into`}
        className="max-w-[12rem] rounded border border-edge2 bg-panel px-1 py-0.5 text-[11px] text-ink-muted"
      >
        {jobs.map((job) => (
          <option key={job.id} value={job.id}>
            {job.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await saveDiscoveryResultAction({
              searchProjectId: jobId,
              url,
              title: name,
              snippet: snippet ?? undefined,
              provider: "open-index",
              engine,
              query,
              candidateName: name,
            });
            setState(result.ok ? "saved" : result.error);
          })
        }
        className="rounded border border-accent/40 bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent disabled:opacity-50"
      >
        {pending ? "saving…" : "＋ save"}
      </button>
      {state !== "idle" && state !== "saved" && (
        <span className="text-[11px] text-warn">{state}</span>
      )}
    </span>
  );
}
