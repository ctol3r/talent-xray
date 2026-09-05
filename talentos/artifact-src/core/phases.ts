/**
 * The five-phase information architecture (spec §5) and the two modes.
 *
 * This is navigation over the state machine in `dependencies.ts` — it adds
 * no new truth. A phase's status is derived from the module states it
 * contains, and readiness is derived from the phases before it. Guided mode
 * hides advanced entries; it never hides a phase, because a recruiter who
 * wants to jump ahead is allowed to, and is told why it is early.
 */
import { MODULES, type ModuleKey, type ModuleStateName } from "./dependencies";
import type { ResearchStatus } from "./research";

export const PHASE_KEYS = [
  "define",
  "research",
  "plan",
  "execute",
  "learn",
] as const;
export type PhaseKey = (typeof PHASE_KEYS)[number];

export interface Phase {
  key: PhaseKey;
  label: string;
  /** The question this phase answers. Shown under the phase strip. */
  question: string;
  purpose: string;
}

export const PHASES: Record<PhaseKey, Phase> = {
  define: {
    key: "define",
    label: "Define",
    question: "What are we actually hiring for?",
    purpose:
      "Turn the brief and the hiring manager's words into one canonical interpretation everything downstream consumes.",
  },
  research: {
    key: "research",
    label: "Research",
    question: "What does the outside world say?",
    purpose:
      "Attach evidence with a date on it, and be explicit about what is model knowledge rather than current research.",
  },
  plan: {
    key: "plan",
    label: "Plan",
    question: "Where are these people and how do we reach them?",
    purpose:
      "Turn the profile into a strategy, a channel map and queries that actually run on the platform you selected.",
  },
  execute: {
    key: "execute",
    label: "Execute",
    question: "Who have we found, and what happens next?",
    purpose:
      "Work the queue: evidence against the profile, drafts you send yourself, actions with an owner.",
  },
  learn: {
    key: "learn",
    label: "Learn",
    question: "Is any of this actually working?",
    purpose:
      "Check the system against deliberate defects, and record what the search taught you.",
  },
};

export type Audience = "core" | "advanced";

export interface NavEntry {
  /** Route key — what `state.module` holds. */
  key: string;
  label: string;
  phase: PhaseKey;
  audience: Audience;
  /** Present when the entry has a derived module state. */
  moduleKey?: ModuleKey;
  /** Counts towards its phase's completion. */
  required: boolean;
  /** One line shown in Guided mode under the entry. */
  hint: string;
}

const mod = (
  key: ModuleKey,
  phase: PhaseKey,
  hint: string,
  opts: { audience?: Audience; required?: boolean } = {},
): NavEntry => ({
  key,
  label: MODULES[key].label,
  phase,
  audience: opts.audience ?? "core",
  moduleKey: key,
  required: opts.required ?? true,
  hint,
});

export const NAV: NavEntry[] = [
  {
    key: "overview",
    label: "Brief",
    phase: "define",
    audience: "core",
    required: false,
    hint: "The shared context every module reads. Editing it re-versions the search.",
  },
  mod("hiring_need", "define", "One canonical interpretation of the need."),
  mod(
    "intake_loop",
    "define",
    "Record what the hiring manager said; reason over it once.",
  ),
  mod("intake", "define", "The interview to run with the hiring manager."),
  mod(
    "role_intelligence",
    "define",
    "The pre-IR role read. Superseded by the Canonical IR.",
    {
      audience: "advanced",
      required: false,
    },
  ),
  mod(
    "success_profile",
    "define",
    "The hiring contract: outcomes, must-haves, evidence signals.",
  ),
  {
    key: "research",
    label: "Research",
    phase: "research",
    audience: "core",
    required: true,
    hint: "Sources with a date on them. Nothing here browses the web for you.",
  },
  mod(
    "market_intelligence",
    "research",
    "What the market looks like, labelled by how you know it.",
  ),
  mod("sourcing_strategy", "plan", "Who to target, who to exclude, and why."),
  mod("channels", "plan", "Where this population actually is."),
  mod(
    "search_strings",
    "plan",
    "Queries compiled against each platform's real limits.",
  ),
  mod(
    "candidates",
    "execute",
    "Evidence against the profile. You decide; nothing sends.",
  ),
  {
    key: "pipeline",
    label: "Pipeline",
    phase: "execute",
    audience: "core",
    required: false,
    hint: "What actually happened to the people you approached, and what that measures.",
  },
  {
    key: "actions",
    label: "Actions",
    phase: "execute",
    audience: "core",
    required: false,
    hint: "The queue: what you accepted from a draft, who owns it, what is blocked.",
  },
  mod(
    "golden_test",
    "learn",
    "Eleven deliberate defects, and whether the system catches them.",
    {
      audience: "advanced",
      required: false,
    },
  ),
];

export const NAV_ORDER: string[] = NAV.map((e) => e.key);

export function navEntry(key: string): NavEntry | undefined {
  return NAV.find((e) => e.key === key);
}

export function phaseOf(key: string): PhaseKey | undefined {
  return navEntry(key)?.phase;
}

export type Mode = "guided" | "expert";

/** Guided shows core entries only; Expert shows everything. */
export function entriesFor(phase: PhaseKey, mode: Mode): NavEntry[] {
  return NAV.filter(
    (e) => e.phase === phase && (mode === "expert" || e.audience === "core"),
  );
}

export type PhaseStateName =
  "not_started" | "in_progress" | "needs_attention" | "complete";

export const PHASE_STATE_LABELS: Record<PhaseStateName, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  needs_attention: "Needs attention",
  complete: "Complete",
};

/** What a nav entry's chip says. `null` = the entry has no state of its own. */
export interface EntryStatus {
  state: ModuleStateName;
  reason: string;
}

export interface PhaseInput {
  /** Every entry that has one, by route key. */
  statuses: Record<string, EntryStatus | undefined>;
}

export interface PhaseStatus {
  key: PhaseKey;
  label: string;
  state: PhaseStateName;
  reason: string;
  /** False when an earlier phase has not produced what this one consumes. */
  ready: boolean;
  /** Why it is early, when it is. Empty when ready. */
  earlyReason: string;
  done: number;
  total: number;
}

const SETTLED: ModuleStateName[] = ["current", "aging"];
const ATTENTION: ModuleStateName[] = [
  "failed",
  "needs_review",
  "blocked",
  "stale",
];
const STARTED: ModuleStateName[] = [
  "current",
  "aging",
  "stale",
  "blocked",
  "generating",
  "researching",
  "needs_review",
];

/**
 * Phase status from the entry states inside it. A phase is complete only
 * when every REQUIRED entry is current or aging — "blocked" is a real
 * result, but it is not completion.
 */
export function phaseStatuses(input: PhaseInput): PhaseStatus[] {
  const out: PhaseStatus[] = [];
  let earlierGap = "";
  for (const key of PHASE_KEYS) {
    const required = NAV.filter((e) => e.phase === key && e.required);
    const states = required.map(
      (e) => input.statuses[e.key]?.state ?? "not_started",
    );
    const done = states.filter((s) => SETTLED.includes(s)).length;
    const attention = required.filter((e, i) => ATTENTION.includes(states[i]));
    let state: PhaseStateName;
    if (required.length === 0) state = "complete";
    else if (attention.length > 0) state = "needs_attention";
    else if (done === required.length) state = "complete";
    else if (states.some((s) => STARTED.includes(s))) state = "in_progress";
    else state = "not_started";

    const reason =
      state === "needs_attention"
        ? `${attention.map((e) => e.label).join(", ")} ${attention.length === 1 ? "needs" : "need"} attention.`
        : state === "complete"
          ? required.length
            ? `${done} of ${required.length} outputs current.`
            : "Nothing to produce here."
          : `${done} of ${required.length} outputs current.`;

    out.push({
      key,
      label: PHASES[key].label,
      state,
      reason,
      ready: earlierGap === "",
      earlyReason: earlierGap
        ? `${earlierGap} first — this phase reads its output.`
        : "",
      done,
      total: required.length,
    });

    if (!earlierGap) {
      const missing = required.find(
        (e, i) => !STARTED.includes(states[i]) && states[i] !== "failed",
      );
      const failed = required.find((e, i) => states[i] === "failed");
      if (failed) earlierGap = `${failed.label} failed — fix it`;
      else if (missing) earlierGap = `Generate ${missing.label}`;
    }
  }
  return out;
}

/**
 * The Research entry has no generated record, so its chip is the live
 * research status — the same value the gate reads. Stated as a module
 * state so the rail renders it exactly like everything else.
 */
export function researchEntryStatus(
  status: ResearchStatus,
  asOf: string | undefined,
): EntryStatus {
  switch (status) {
    case "current":
      return {
        state: "current",
        reason: `Sources attached and in date${asOf ? ` (as of ${asOf})` : ""}.`,
      };
    case "aging":
      return {
        state: "aging",
        reason: `Sources are ageing${asOf ? ` (as of ${asOf})` : ""} — refresh before relying on time-sensitive claims.`,
      };
    case "stale":
      return {
        state: "stale",
        reason: `The attached research is out of date${asOf ? ` (as of ${asOf})` : ""}.`,
      };
    case "failed":
      return { state: "failed", reason: "The last research attempt failed." };
    default:
      return {
        state: "blocked",
        reason:
          "No research attached. This runtime has no web access and no connector is wired — add a source you checked yourself, or generate on model knowledge and accept the label.",
      };
  }
}

/** The phase a recruiter is working in: the first that is not complete. */
export function activePhase(statuses: PhaseStatus[]): PhaseKey {
  return (
    statuses.find((p) => p.state === "needs_attention")?.key ??
    statuses.find((p) => p.state !== "complete")?.key ??
    "learn"
  );
}
