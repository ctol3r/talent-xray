/**
 * The execution graph is the single source for every count the UI shows
 * (spec P0-C). Nothing displays a literal call count; it asks the plan.
 */
import { nowIso } from "./dom";

export type StepKind = "research" | "generate" | "critic" | "revise";

export interface PlannedStep {
  /** Module key, or "evidence"/"outreach" for candidate tasks. */
  module: string;
  label: string;
  kind: StepKind;
  /** A revision pass only happens when the critic says "revise". */
  optional: boolean;
}

export interface ExecutionPlan {
  scope: string;
  steps: PlannedStep[];
  modules: string[];
  modelCalls: { min: number; max: number };
  researchOps: number;
  /** One line a human can read on a button. */
  summary: string;
}

export interface PlanScope {
  kind: "crew" | "golden" | "module" | "candidate" | "intake_turn";
  modules: Array<{ key: string; label: string }>;
  withCritic: boolean;
  researchOps?: number;
}

export function planExecution(scope: PlanScope): ExecutionPlan {
  const steps: PlannedStep[] = [];
  for (let i = 0; i < (scope.researchOps ?? 0); i++) {
    steps.push({
      module: "research",
      label: "Research",
      kind: "research",
      optional: false,
    });
  }
  for (const m of scope.modules) {
    steps.push({
      module: m.key,
      label: m.label,
      kind: "generate",
      optional: false,
    });
    if (scope.withCritic) {
      steps.push({
        module: m.key,
        label: `${m.label} — critic`,
        kind: "critic",
        optional: false,
      });
      steps.push({
        module: m.key,
        label: `${m.label} — revision`,
        kind: "revise",
        optional: true,
      });
    }
  }
  const modelSteps = steps.filter((s) => s.kind !== "research");
  const min = modelSteps.filter((s) => !s.optional).length;
  const max = modelSteps.length;
  const researchOps = steps.filter((s) => s.kind === "research").length;
  const calls = min === max ? `${min}` : `${min}–${max}`;
  return {
    scope: scope.kind,
    steps,
    modules: scope.modules.map((m) => m.key),
    modelCalls: { min, max },
    researchOps,
    summary: `${scope.modules.length} module${scope.modules.length === 1 ? "" : "s"} · ${calls} model call${max === 1 ? "" : "s"}${researchOps ? ` · ${researchOps} research op${researchOps === 1 ? "" : "s"}` : ""}`,
  };
}

export type StepStatus = "pending" | "running" | "done" | "skipped" | "failed";

export interface StepProgress {
  module: string;
  label: string;
  kind: StepKind;
  status: StepStatus;
  attempts: number;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export interface ProgressSnapshot {
  startedAt: string;
  elapsedMs: number;
  total: number;
  completed: number;
  skipped: number;
  retries: number;
  failures: number;
  running?: StepProgress;
  steps: StepProgress[];
  /** True while a failed run can be resumed from its last completed step. */
  resumable: boolean;
  finished: boolean;
}

/** Records what actually happened against the plan; the UI reads snapshots. */
export class ProgressTracker {
  readonly startedAt = nowIso();
  private readonly steps: StepProgress[];
  private retries = 0;
  private finishedAt: string | undefined;

  constructor(readonly plan: ExecutionPlan) {
    this.steps = plan.steps.map((s) => ({
      module: s.module,
      label: s.label,
      kind: s.kind,
      status: "pending",
      attempts: 0,
    }));
  }

  private find(module: string, kind: StepKind): StepProgress | undefined {
    return this.steps.find(
      (s) => s.module === module && s.kind === kind && s.status !== "done",
    );
  }

  start(module: string, kind: StepKind): void {
    const s = this.find(module, kind);
    if (!s) return;
    if (s.attempts > 0) this.retries += 1;
    s.attempts += 1;
    s.status = "running";
    s.startedAt = nowIso();
  }

  done(module: string, kind: StepKind): void {
    const s = this.find(module, kind);
    if (!s) return;
    s.status = "done";
    s.finishedAt = nowIso();
  }

  skip(module: string, kind: StepKind, reason?: string): void {
    const s = this.find(module, kind);
    if (!s) return;
    s.status = "skipped";
    s.finishedAt = nowIso();
    if (reason) s.error = reason;
  }

  fail(module: string, kind: StepKind, message: string): void {
    const s = this.find(module, kind);
    if (!s) return;
    s.status = "failed";
    s.finishedAt = nowIso();
    s.error = message;
  }

  finish(): void {
    this.finishedAt = nowIso();
  }

  snapshot(): ProgressSnapshot {
    const end = this.finishedAt ?? nowIso();
    const completed = this.steps.filter((s) => s.status === "done").length;
    const skipped = this.steps.filter((s) => s.status === "skipped").length;
    const failures = this.steps.filter((s) => s.status === "failed").length;
    return {
      startedAt: this.startedAt,
      elapsedMs: Math.max(
        0,
        new Date(end).getTime() - new Date(this.startedAt).getTime(),
      ),
      total: this.steps.length,
      completed,
      skipped,
      retries: this.retries,
      failures,
      running: this.steps.find((s) => s.status === "running"),
      steps: this.steps.map((s) => ({ ...s })),
      resumable: failures > 0 && completed > 0,
      finished: Boolean(this.finishedAt),
    };
  }
}

export function formatElapsed(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}
