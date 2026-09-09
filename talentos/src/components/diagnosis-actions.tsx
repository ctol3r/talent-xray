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
      ? "rounded bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-canvas disabled:opacity-50"
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
          className="rounded bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-canvas disabled:opacity-50"
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
          className="rounded bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-canvas disabled:opacity-50"
        >
          {pending ? "Saving…" : "Record what I think"}
        </button>
      </div>
      {error && <span className="text-xs text-bad">{error}</span>}
    </form>
  );
}

const inputCls = "rounded border border-edge2 bg-panel p-2 text-xs";
const submitCls =
  "rounded bg-accent px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-canvas disabled:opacity-50";

/** Record what an experiment showed, for any search: a summary, distinct observations, and an advance count. */
export function ExperimentResultForm({
  action,
  searchProjectId,
  interventionId,
  showAdvance = false,
}: {
  action: Action;
  searchProjectId: string;
  interventionId: string;
  /** Calibration tests only: an advanced/total pair resolves model predictions. */
  showAdvance?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [observations, setObservations] = useState("");
  const [advanced, setAdvanced] = useState("");
  const [total, setTotal] = useState("");
  const router = useRouter();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const lines = observations
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
          if (lines.length === 0) {
            setError("Enter at least one observation.");
            return;
          }
          if ((advanced === "") !== (total === "")) {
            setError("Enter both advanced and total, or neither.");
            return;
          }
          const r = await action({
            searchProjectId,
            interventionId,
            summary: summary.trim(),
            observations: lines,
            ...(advanced && total ? { advanced, total } : {}),
          });
          if (r.ok) router.refresh();
          else setError(r.error);
        });
      }}
    >
      <input
        className={inputCls}
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="What did the test show? (one line)"
        required
      />
      <textarea
        className={inputCls}
        rows={3}
        value={observations}
        onChange={(e) => setObservations(e.target.value)}
        placeholder="Distinct observations, one per line. Each becomes its own evidence record."
        required
      />
      {showAdvance && (
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          Advanced
          <input
            className={`${inputCls} w-16`}
            inputMode="numeric"
            aria-label="Candidates advanced"
            value={advanced}
            onChange={(e) => setAdvanced(e.target.value.replace(/\D/g, ""))}
            placeholder="7"
          />
          of
          <input
            className={`${inputCls} w-16`}
            inputMode="numeric"
            aria-label="Candidates reviewed"
            value={total}
            onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))}
            placeholder="10"
          />
          <span className="text-ink-faint">
            (optional; resolves the models this test discriminates between)
          </span>
        </div>
      )}
      <div>
        <button
          type="submit"
          disabled={pending || !summary.trim() || !observations.trim()}
          className={submitCls}
        >
          {pending ? "Saving…" : "Record result"}
        </button>
      </div>
      {error && <span className="text-xs text-bad">{error}</span>}
    </form>
  );
}

/** The human edits the Success Profile criteria (one per line). The workstation applies it; HSAL records that a human did. */
export function ProfileChangeForm({
  action,
  searchProjectId,
  interventionId,
  initial,
  knownCriteria = [],
  confirm,
}: {
  action: Action;
  searchProjectId: string;
  interventionId?: string;
  initial: { mustHave: string; preferred: string; transferable: string };
  /** Criteria whose labels must keep their exact ids/categories (e.g. a seeded profile). */
  knownCriteria?: {
    id: string;
    label: string;
    category: string;
    rationale?: string;
  }[];
  confirm?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mustHave, setMustHave] = useState(initial.mustHave);
  const [preferred, setPreferred] = useState(initial.preferred);
  const [transferable, setTransferable] = useState(initial.transferable);
  const router = useRouter();
  const field = (
    name: "mustHave" | "preferred" | "transferable",
    label: string,
    value: string,
    set: (v: string) => void,
    hint: string,
  ) => (
    <label className="flex flex-col gap-1 text-xs text-ink-muted">
      <span>
        <strong className="text-ink">{label}</strong> · {hint}
      </span>
      <textarea
        name={name}
        className={inputCls}
        rows={4}
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        startTransition(async () => {
          setError(null);
          const r = await action({
            searchProjectId,
            ...(interventionId ? { interventionId } : {}),
            mustHave,
            preferred,
            transferable,
            knownCriteria,
          });
          if (r.ok) router.refresh();
          else setError(r.error);
        });
      }}
    >
      {field(
        "mustHave",
        "Must have",
        mustHave,
        setMustHave,
        "one criterion per line",
      )}
      {field("preferred", "Preferred", preferred, setPreferred, "one per line")}
      {field(
        "transferable",
        "Transferable",
        transferable,
        setTransferable,
        "skills a strong candidate can pick up; move lines here to relax a must-have",
      )}
      <div>
        <button type="submit" disabled={pending} className={submitCls}>
          {pending ? "Applying…" : "Apply profile change"}
        </button>
      </div>
      {error && <span className="text-xs text-bad">{error}</span>}
    </form>
  );
}

/** Pipeline counts for any search (baseline or post-intervention). Pre-filled from pipeline events when the workstation has them. */
export function PipelineCountsForm({
  action,
  searchProjectId,
  interventionId,
  stages,
  initial,
  note,
  submitLabel = "Record pipeline",
}: {
  action: Action;
  searchProjectId: string;
  interventionId?: string;
  submitLabel?: string;
  stages: { key: string; label: string }[];
  initial: {
    periodStart: string;
    periodEnd: string;
    /** Stages missing here are left blank for the recruiter to fill; nothing is assumed to be 0. */
    counts: Partial<Record<string, number>>;
    source: "seed" | "ats" | "manual" | "import";
    /** Seeded snapshot identity, kept only while the recruiter leaves the numbers untouched. */
    preset?: { id: string; observedAt: string };
  };
  note?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [periodStart, setPeriodStart] = useState(initial.periodStart);
  const [periodEnd, setPeriodEnd] = useState(initial.periodEnd);
  const [counts, setCounts] = useState<Record<string, string>>(
    Object.fromEntries(
      stages.map((s) => {
        const v = initial.counts[s.key];
        return [s.key, v === undefined ? "" : String(v)];
      }),
    ),
  );
  const [touched, setTouched] = useState(false);
  const complete = stages.every((s) => /^\d+$/.test(counts[s.key] ?? ""));
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
            ...(interventionId ? { interventionId } : {}),
            periodStart,
            periodEnd,
            counts,
            source: touched ? "manual" : initial.source,
            ...(!touched && initial.preset ? initial.preset : {}),
          });
          if (r.ok) router.refresh();
          else setError(r.error);
        });
      }}
    >
      {note && <p className="text-xs text-ink-muted">{note}</p>}
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        Period
        <input
          type="date"
          className={inputCls}
          aria-label="Period start"
          value={periodStart}
          onChange={(e) => {
            setTouched(true);
            setPeriodStart(e.target.value);
          }}
          required
        />
        →
        <input
          type="date"
          className={inputCls}
          aria-label="Period end"
          value={periodEnd}
          onChange={(e) => {
            setTouched(true);
            setPeriodEnd(e.target.value);
          }}
          required
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {stages.map((s) => (
          <label key={s.key} className="flex flex-col text-xs text-ink-muted">
            {s.label}
            <input
              className={inputCls}
              inputMode="numeric"
              placeholder="—"
              value={counts[s.key] ?? ""}
              onChange={(e) => {
                setTouched(true);
                setCounts((c) => ({
                  ...c,
                  [s.key]: e.target.value.replace(/\D/g, ""),
                }));
              }}
            />
          </label>
        ))}
      </div>
      <div>
        <button
          type="submit"
          disabled={pending || !complete}
          className={submitCls}
        >
          {pending ? "Recording…" : submitLabel}
        </button>
      </div>
      {error && <span className="text-xs text-bad">{error}</span>}
    </form>
  );
}

/** WHAT DID WE LEARN? — a recruiter-written learning that references HSAL ids. */
export function LearningForm({
  action,
  searchProjectId,
  categories,
  initial,
  refs,
}: {
  action: Action;
  searchProjectId: string;
  categories: readonly string[];
  initial: {
    id?: string;
    title: string;
    statement: string;
    category: string;
    confidence: number;
    applicability: Record<string, string>;
  };
  refs: {
    evidenceIds: string[];
    originatingBeliefIds: string[];
    originatingModelIds: string[];
  };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(initial.title);
  const [statement, setStatement] = useState(initial.statement);
  const [category, setCategory] = useState(initial.category);
  const [confidence, setConfidence] = useState(
    Math.round(initial.confidence * 100),
  );
  const [applicability, setApplicability] = useState(initial.applicability);
  const router = useRouter();
  const tag = (key: string, label: string) => (
    <label key={key} className="flex flex-col text-xs text-ink-muted">
      {label}
      <input
        className={inputCls}
        value={applicability[key] ?? ""}
        onChange={(e) =>
          setApplicability((a) => ({ ...a, [key]: e.target.value }))
        }
        placeholder="comma-separated"
      />
    </label>
  );
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          setError(null);
          const r = await action({
            searchProjectId,
            ...(initial.id ? { id: initial.id } : {}),
            title,
            statement,
            category,
            confidence: confidence / 100,
            applicability,
            ...refs,
          });
          if (r.ok) router.refresh();
          else setError(r.error);
        });
      }}
    >
      <input
        className={inputCls}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        required
      />
      <textarea
        className={inputCls}
        rows={3}
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        placeholder="What should the next similar search do differently?"
        required
      />
      <div className="flex flex-wrap items-center gap-3 text-xs text-ink-muted">
        <label>
          Category{" "}
          <select
            className={inputCls}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex-1">
          Confidence <strong className="text-ink">{confidence}%</strong>
          <input
            type="range"
            min={0}
            max={100}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {tag("roleFamilies", "Role families")}
        {tag("skills", "Skills")}
        {tag("seniority", "Seniority")}
        {tag("industries", "Industries")}
        {tag("geographies", "Geographies")}
      </div>
      <p className="text-xs text-ink-faint">
        Links to {refs.evidenceIds.length} evidence,{" "}
        {refs.originatingBeliefIds.length} belief(s),{" "}
        {refs.originatingModelIds.length} model(s) in HSAL.
      </p>
      <div>
        <button
          type="submit"
          disabled={pending || !title || !statement}
          className={submitCls}
        >
          {pending ? "Saving…" : "Save learning"}
        </button>
      </div>
      {error && <span className="text-xs text-bad">{error}</span>}
    </form>
  );
}
