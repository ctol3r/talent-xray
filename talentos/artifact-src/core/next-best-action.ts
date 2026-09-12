/**
 * One next best action, derived (spec §5). It reads the same module states
 * the rail shows, the live research status, the intake loop's own next
 * question and the action queue — and picks the FIRST rule that fires, in
 * a fixed order. Nothing here is a model call, and nothing here acts: it
 * returns a step the human clicks, routed through the same confirmation
 * rules as every other suggested step.
 */
import type { ActionItem, SuggestedNextStep } from "./envelope";
import type { ModuleKey, ModuleState } from "./dependencies";
import { MODULES } from "./dependencies";
import type { ResearchStatus } from "./research";
import { NAV, phaseOf, type PhaseKey } from "./phases";

export interface NbaInput {
  hasSearch: boolean;
  states: Record<ModuleKey, ModuleState>;
  researchStatus: ResearchStatus;
  acknowledgedNoResearch: boolean;
  candidateCount: number;
  candidatesWithoutEvidence: number;
  actions: ActionItem[];
  /** Intake questions generated but not yet answered. */
  unansweredIntake: number;
  /** The intake loop's own next question, when it has one. */
  nextQuestion: string | null;
  /** Recorded pipeline events. Zero with candidates means nothing is measurable. */
  pipelineEvents: number;
  goldenRun: boolean;
  /** When false, no rule may suggest a generation. */
  aiAvailable: boolean;
}

export type Urgency = "blocked" | "attention" | "normal" | "done";

export interface NextBestAction {
  step: SuggestedNextStep;
  /** Why this and not something else. Shown next to the button. */
  why: string;
  phase: PhaseKey;
  urgency: Urgency;
}

const CORE_MODULE_ORDER: ModuleKey[] = NAV.filter(
  (e) => e.moduleKey && e.required && e.audience === "core",
).map((e) => e.moduleKey as ModuleKey);

function make(
  step: Omit<SuggestedNextStep, "label" | "description"> &
    Partial<Pick<SuggestedNextStep, "description">>,
  why: string,
  urgency: Urgency,
): NextBestAction {
  return {
    step: { label: "A", description: "", ...step },
    why,
    phase: phaseOf(step.targetId ?? "") ?? "define",
    urgency,
  };
}

export function nextBestAction(input: NbaInput): NextBestAction {
  const st = (k: ModuleKey): ModuleState | undefined => input.states[k];

  if (!input.hasSearch) {
    return make(
      {
        title: "Start a search by filling in the brief",
        actionType: "edit_context",
        targetId: "overview",
      },
      "Nothing is loaded yet. Everything downstream reads the brief.",
      "normal",
    );
  }

  // 1. Something broke. Nothing else matters while an output is failed.
  const failed = CORE_MODULE_ORDER.find((k) => st(k)?.state === "failed");
  if (failed) {
    return make(
      {
        title: `Retry ${MODULES[failed].label} — the last attempt failed`,
        actionType: "regenerate_module",
        targetId: failed,
      },
      st(failed)?.reason ?? "The last attempt failed.",
      "attention",
    );
  }

  // 2. A safety flag outranks progress.
  const review = CORE_MODULE_ORDER.find((k) => st(k)?.state === "needs_review");
  if (review) {
    return make(
      {
        title: `Review ${MODULES[review].label} before using it`,
        actionType: "navigate_module",
        targetId: review,
      },
      st(review)?.reason ?? "The output needs a human read.",
      "attention",
    );
  }

  // 3. A blocked action is a person waiting on something.
  const blocked = input.actions.find((a) => a.status === "blocked");
  if (blocked) {
    return make(
      {
        title: `Unblock: ${blocked.title}`,
        actionType: "open_action",
        targetId: blocked.id,
      },
      blocked.blockingReason || "This action is marked blocked.",
      "blocked",
    );
  }

  // 4. Work the phases in order. The first required module with no output wins.
  for (const key of CORE_MODULE_ORDER) {
    const state = st(key);
    if (!state || state.state !== "not_started") continue;
    if (key === "intake_loop") continue; // driven by rule 5, not by generation
    if (key === "candidates") {
      return make(
        {
          title: "Add the first candidate",
          actionType: "add_candidate",
          targetId: "candidates",
        },
        "The plan is ready; nothing has been assessed against it yet.",
        "normal",
      );
    }
    const needsResearch = MODULES[key].requiresResearch;
    const gateShut =
      needsResearch &&
      (input.researchStatus === "blocked" ||
        input.researchStatus === "stale" ||
        input.researchStatus === "failed");
    if (gateShut && !input.acknowledgedNoResearch) {
      return make(
        {
          title: "Add a research source before the market work",
          actionType: "add_source",
          targetId: "research",
        },
        `${MODULES[key].label} makes market claims, and no current research is attached. Add a source you checked yourself, or generate anyway and accept the model-knowledge label.`,
        "blocked",
      );
    }
    if (!input.aiAvailable) {
      return make(
        {
          title:
            "Fill in the brief — AI generation is unavailable in this view",
          actionType: "edit_context",
          targetId: "overview",
        },
        "Claude is not available here, so nothing can be generated. The brief, research sources, candidates and the action queue all still work.",
        "blocked",
      );
    }
    return make(
      {
        title: `Generate ${MODULES[key].label}`,
        actionType: "generate_module",
        targetId: key,
      },
      state.reason,
      "normal",
    );
  }

  // 5. The loop's own question is the highest-value thing a recruiter can do.
  if (input.nextQuestion) {
    return make(
      {
        title: `Ask the hiring manager: ${input.nextQuestion}`,
        actionType: "record_statement",
        targetId: "intake_loop",
      },
      "The intake loop derived this question from an open, consequential uncertainty.",
      "normal",
    );
  }

  // 6. Stale beats aging; both beat new work.
  const stale = CORE_MODULE_ORDER.find((k) => st(k)?.state === "stale");
  if (stale && input.aiAvailable) {
    return make(
      {
        title: `Regenerate ${MODULES[stale].label} — its inputs changed`,
        actionType: "regenerate_module",
        targetId: stale,
      },
      st(stale)?.reason ?? "An input changed since this was generated.",
      "attention",
    );
  }

  if (input.researchStatus === "aging" || input.researchStatus === "stale") {
    return make(
      {
        title: "Refresh the research before relying on it",
        actionType: "refresh_research",
        targetId: "research",
      },
      "The attached sources are past their freshness window for what they claim.",
      "attention",
    );
  }

  const blockedModule = CORE_MODULE_ORDER.find(
    (k) => st(k)?.state === "blocked",
  );
  if (blockedModule) {
    return make(
      {
        title: "Attach a source to replace model knowledge",
        actionType: "add_source",
        targetId: "research",
      },
      `${MODULES[blockedModule].label} was generated on model knowledge only. A source would move it off "blocked".`,
      "blocked",
    );
  }

  // 7. Intake answers left on the table.
  if (input.unansweredIntake > 0) {
    return make(
      {
        title: `Record ${input.unansweredIntake} outstanding intake answer${input.unansweredIntake === 1 ? "" : "s"}`,
        actionType: "answer_question",
        targetId: "intake",
      },
      "Answers feed every downstream module; unanswered questions are the search's open assumptions.",
      "normal",
    );
  }

  // 8. Execute.
  if (input.candidatesWithoutEvidence > 0) {
    return make(
      {
        title: `Review ${input.candidatesWithoutEvidence} candidate${input.candidatesWithoutEvidence === 1 ? "" : "s"} against the profile`,
        actionType: "review_candidate",
        targetId: "candidates",
      },
      "Evidence alignment is advisory: it shows what is supported and what is missing. You decide.",
      "normal",
    );
  }

  if (input.candidateCount > 0 && input.pipelineEvents === 0) {
    return make(
      {
        title: "Record what actually happened to these candidates",
        actionType: "navigate_module",
        targetId: "pipeline",
      },
      "Nothing is measurable until the pipeline has events. Every metric is computed from what you record — there is no seeded history.",
      "normal",
    );
  }

  const open = input.actions.filter(
    (a) => a.status === "open" || a.status === "in_progress",
  );
  if (open.length > 0) {
    return make(
      {
        title: `Work the action queue — ${open.length} open`,
        actionType: "open_action",
        targetId: open[0].id,
      },
      `Next: ${open[0].title}`,
      "normal",
    );
  }

  if (input.candidateCount === 0) {
    if (input.states.search_strings?.state === "current") {
      return make(
        {
          title: "Run a compiled query on Talent X-Ray, then add who you find",
          actionType: "copy_query",
          targetId: "search_strings",
        },
        "The queries are current. The engines open in a new tab; nothing here reads the results — you add the people you choose to keep.",
        "normal",
      );
    }
    return make(
      {
        title: "Add the first candidate",
        actionType: "add_candidate",
        targetId: "candidates",
      },
      "Everything is current; nothing has been assessed against the profile yet.",
      "normal",
    );
  }

  if (!input.goldenRun) {
    return make(
      {
        title: "Run the defect checks",
        actionType: "run_golden",
        targetId: "golden_test",
      },
      "Eleven deliberate defects, no model call. It reports exactly which checks executed.",
      "normal",
    );
  }

  return make(
    {
      title: "Nothing is waiting — review the brief or add candidates",
      actionType: "navigate_module",
      targetId: "overview",
    },
    "Every module is current, research is in date, the queue is clear.",
    "done",
  );
}
