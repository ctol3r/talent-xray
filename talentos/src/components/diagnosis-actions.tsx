"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions/helpers";

type Action = (input: unknown) => Promise<ActionResult<unknown>>;

/** One explicit human action against the HSAL loop. Renders pending/error states honestly. */
export function DiagnosisAction({
  action,
  input,
  label,
  tone = "primary",
  confirm,
}: {
  action: Action;
  input: Record<string, unknown>;
  label: string;
  tone?: "primary" | "secondary";
  confirm?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const cls =
    tone === "primary"
      ? "rounded bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
      : "rounded border border-edge2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink disabled:opacity-50";
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        className={cls}
        disabled={pending}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          startTransition(async () => {
            setError(null);
            const r = await action(input);
            if (r.ok) router.refresh();
            else setError(r.error);
          });
        }}
      >
        {pending ? "Working…" : label}
      </button>
      {error && <span className="text-xs text-bad">{error}</span>}
    </span>
  );
}

/** Explicit belief revision form. The recruiter states the current value they are revising from. */
export function ReviseBeliefForm({
  action,
  searchProjectId,
  beliefId,
  currentConfidence,
  suggestedConfidence,
  suggestedReason,
  evidenceIds,
}: {
  action: Action;
  searchProjectId: string;
  beliefId: string;
  currentConfidence: number;
  suggestedConfidence?: number;
  suggestedReason?: string;
  evidenceIds: string[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(
    Math.round((suggestedConfidence ?? currentConfidence) * 100),
  );
  const [reason, setReason] = useState(suggestedReason ?? "");
  const router = useRouter();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await action({
            searchProjectId,
            beliefId,
            previousConfidence: currentConfidence,
            newConfidence: confidence / 100,
            reason,
            evidenceIds,
          });
          if (r.ok) router.refresh();
          else setError(r.error);
        });
      }}
    >
      <label className="text-xs text-ink-muted">
        New confidence: <strong className="text-ink">{confidence}%</strong>{" "}
        (currently {Math.round(currentConfidence * 100)}%)
        <input
          type="range"
          min={0}
          max={100}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
      <textarea
        className="rounded border border-edge2 bg-panel p-2 text-xs"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why are you changing your confidence?"
        required
      />
      <div>
        <button
          type="submit"
          disabled={pending || !reason}
          className="rounded bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Revise my confidence"}
        </button>
      </div>
      {error && <span className="text-xs text-bad">{error}</span>}
    </form>
  );
}

/** Capture the recruiter's current belief. */
export function CaptureBeliefForm({
  action,
  searchProjectId,
  defaultStatement,
  defaultConfidence,
  id,
}: {
  action: Action;
  searchProjectId: string;
  defaultStatement?: string;
  defaultConfidence?: number;
  id?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [statement, setStatement] = useState(defaultStatement ?? "");
  const [confidence, setConfidence] = useState(
    Math.round((defaultConfidence ?? 0.5) * 100),
  );
  const router = useRouter();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await action({
            searchProjectId,
            statement,
            confidence: confidence / 100,
            ...(id ? { id } : {}),
          });
          if (r.ok) router.refresh();
          else setError(r.error);
        });
      }}
    >
      <textarea
        className="rounded border border-edge2 bg-panel p-2 text-sm"
        rows={2}
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        placeholder="What do you currently think is causing the search problem?"
        required
      />
      <label className="text-xs text-ink-muted">
        Your confidence: <strong className="text-ink">{confidence}%</strong>
        <input
          type="range"
          min={0}
          max={100}
          value={confidence}
          onChange={(e) => setConfidence(Number(e.target.value))}
          className="mt-1 w-full"
        />
      </label>
      <div>
        <button
          type="submit"
          disabled={pending || !statement}
          className="rounded bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Record what I think"}
        </button>
      </div>
      {error && <span className="text-xs text-bad">{error}</span>}
    </form>
  );
}
