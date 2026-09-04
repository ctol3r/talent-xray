/**
 * Universal output contract (spec §9) and the A–H validation (spec §9/§18).
 */
import { z } from "zod";
import {
  researchClaimSchema,
  researchStatusSchema,
  type ResearchClaim,
} from "./research";

export const OWNERS = [
  "recruiter",
  "sourcer",
  "hiring_manager",
  "interviewer",
  "talent_leader",
  "unassigned",
] as const;

export const actionItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  description: z.string().default(""),
  owner: z.enum(OWNERS).default("unassigned"),
  status: z
    .enum(["open", "in_progress", "blocked", "completed", "dismissed"])
    .default("open"),
  targetDate: z.string().optional(),
  blockingReason: z.string().optional(),
  sourceOutputId: z.string(),
  completedAt: z.string().optional(),
  completionNote: z.string().optional(),
  initiativeId: z.string().optional(),
});
export type ActionItem = z.infer<typeof actionItemSchema>;

export const pivotProposalSchema = z.object({
  id: z.string(),
  trigger: z.string(),
  evidence: z.array(z.string()).default([]),
  proposedChange: z.string(),
  expectedEffect: z.string().default(""),
  risks: z.array(z.string()).default([]),
  status: z
    .enum(["proposed", "approved", "rejected", "expired"])
    .default("proposed"),
  decidedBy: z.string().optional(),
  decidedAt: z.string().optional(),
  /** Which module outputs a pivot would invalidate; required approver. */
  staleOutputs: z.array(z.string()).default([]),
  requiredApprover: z.enum(OWNERS).default("hiring_manager"),
  metric: z
    .object({
      label: z.string(),
      numerator: z.number(),
      denominator: z.number(),
    })
    .optional(),
});
export type PivotProposal = z.infer<typeof pivotProposalSchema>;

export const NEXT_STEP_LABELS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
] as const;
export type NextStepLabel = (typeof NEXT_STEP_LABELS)[number];

/**
 * Every action a suggested next step may route to. `confirm` marks the
 * ones that must never run without a human confirmation (spec §9 rule 6).
 * Nothing here sends anything: "send_outreach" opens the draft for the
 * recruiter to copy out, and that is still behind a confirmation.
 */
export const ACTION_TYPES = {
  navigate_module: { label: "Open a module", confirm: false },
  generate_module: { label: "Generate a module", confirm: false },
  regenerate_module: { label: "Regenerate a module", confirm: false },
  refresh_research: { label: "Refresh research", confirm: false },
  add_source: { label: "Add a research source", confirm: false },
  answer_question: {
    label: "Answer a hiring-manager question",
    confirm: false,
  },
  record_statement: {
    label: "Record a hiring-manager statement",
    confirm: false,
  },
  edit_context: { label: "Edit the search brief", confirm: false },
  open_action: { label: "Open an action item", confirm: false },
  complete_action: { label: "Mark an action complete", confirm: false },
  review_candidate: { label: "Review a candidate", confirm: false },
  add_candidate: { label: "Add a candidate", confirm: false },
  compile_queries: { label: "Compile search queries", confirm: false },
  copy_query: { label: "Copy a runnable query", confirm: false },
  run_golden: { label: "Run the Golden Test", confirm: false },
  create_initiative: { label: "Create an initiative", confirm: false },
  propose_pivot: { label: "Draft a pivot proposal", confirm: false },
  approve_pivot: { label: "Approve a pivot", confirm: true },
  reject_pivot: { label: "Reject a pivot", confirm: true },
  advance_stage: { label: "Move a candidate's stage", confirm: true },
  send_outreach: {
    label: "Prepare outreach to send (you send it)",
    confirm: true,
  },
  external_communication: {
    label: "Send a stakeholder update (you send it)",
    confirm: true,
  },
  record_decision: { label: "Record a hiring-manager decision", confirm: true },
} as const;
export type ActionType = keyof typeof ACTION_TYPES;
export const actionTypeSchema = z.enum(
  Object.keys(ACTION_TYPES) as [ActionType, ...ActionType[]],
);

export const suggestedNextStepSchema = z.object({
  label: z.enum(NEXT_STEP_LABELS),
  title: z.string().min(1),
  description: z.string().default(""),
  actionType: actionTypeSchema,
  targetId: z.string().optional(),
  recommended: z.boolean().optional(),
});
export type SuggestedNextStep = z.infer<typeof suggestedNextStepSchema>;

/**
 * A metric is never a bare number (spec §13): it carries its formula, its
 * numerator and denominator, and distinguishes 0 from not-enough-data.
 */
export const metricResultSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    formula: z.string().min(1),
    numerator: z.number().optional(),
    denominator: z.number().optional(),
    value: z.number().nullable(),
    unit: z.string().optional(),
    status: z.enum(["measured", "not_enough_data", "not_applicable"]),
    minimumSample: z.number().optional(),
    asOf: z.string(),
    note: z.string().optional(),
  })
  .superRefine((m, ctx) => {
    if (m.status === "measured") {
      if (typeof m.denominator !== "number") {
        ctx.addIssue({
          code: "custom",
          path: ["denominator"],
          message: "A measured metric must state its denominator.",
        });
      } else if (m.denominator <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["denominator"],
          message:
            "A measured metric's denominator must be positive; use not_enough_data for 0.",
        });
      }
      if (m.value === null) {
        ctx.addIssue({
          code: "custom",
          path: ["value"],
          message: "A measured metric must have a value.",
        });
      }
    }
  });
export type MetricResult = z.infer<typeof metricResultSchema>;

/** Build a rate metric truthfully: 0/0 is not-enough-data, never zero. */
export function rateMetric(input: {
  id: string;
  label: string;
  formula: string;
  numerator: number;
  denominator: number;
  minimumSample?: number;
  unit?: string;
  asOf: string;
  note?: string;
}): MetricResult {
  const min = input.minimumSample ?? 1;
  if (input.denominator < min) {
    return metricResultSchema.parse({
      ...input,
      value: null,
      status: "not_enough_data",
      minimumSample: min,
    });
  }
  return metricResultSchema.parse({
    ...input,
    value: input.numerator / input.denominator,
    status: "measured",
    minimumSample: min,
  });
}

export const outputEnvelopeSchema = z.object({
  id: z.string(),
  searchId: z.string(),
  searchVersion: z.string(),
  moduleType: z.string(),
  generatedAt: z.string(),
  researchSnapshotId: z.string().optional(),
  researchStatus: researchStatusSchema,
  headline: z.string().min(1),
  executiveSummary: z.string().min(1),
  facts: z.array(researchClaimSchema).default([]),
  hiringManagerStatements: z.array(researchClaimSchema).default([]),
  estimates: z.array(researchClaimSchema).default([]),
  inferences: z.array(researchClaimSchema).default([]),
  unknowns: z.array(researchClaimSchema).default([]),
  contradictions: z.array(researchClaimSchema).default([]),
  metrics: z.array(metricResultSchema).default([]),
  implications: z.array(z.string()).default([]),
  actionItems: z.array(actionItemSchema).default([]),
  pivotProposals: z.array(pivotProposalSchema).default([]),
  content: z.unknown(),
  suggestedNextSteps: z.array(suggestedNextStepSchema),
});
export type OutputEnvelope<T = unknown> = Omit<
  z.infer<typeof outputEnvelopeSchema>,
  "content"
> & { content: T };

export interface ValidationIssue {
  code:
    | "labels"
    | "duplicate_label"
    | "missing_label"
    | "unknown_action"
    | "unresolvable_target"
    | "not_actionable"
    | "too_many_recommended"
    | "filler"
    | "unsafe_without_confirmation"
    | "schema"
    | "research_currency";
  message: string;
}

export interface NextStepContext {
  /** ids the page can resolve (module keys, candidate ids, action ids, question ids). */
  resolvableIds: Set<string>;
  /** Action types that make sense for this output (empty = all). */
  allowedActions?: Set<ActionType>;
}

const FILLER =
  /^(consider|think about|explore|review|look into|continue|proceed|keep going|next steps?|do more|further)\b/i;

/**
 * Exactly A–H once each; every step actionable, resolvable, related to
 * this output; only genuinely preferred steps recommended; unsafe action
 * types are allowed only because the router confirms them — they are
 * flagged here so the renderer shows the confirmation affordance.
 */
export function validateNextSteps(
  steps: SuggestedNextStep[],
  ctx: NextStepContext,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, number>();
  for (const s of steps) seen.set(s.label, (seen.get(s.label) ?? 0) + 1);
  for (const label of NEXT_STEP_LABELS) {
    const n = seen.get(label) ?? 0;
    if (n === 0)
      issues.push({
        code: "missing_label",
        message: `Missing next step ${label}.`,
      });
    if (n > 1)
      issues.push({
        code: "duplicate_label",
        message: `Next step ${label} appears ${n} times.`,
      });
  }
  if (steps.length !== 8) {
    issues.push({
      code: "labels",
      message: `Expected exactly 8 next steps, got ${steps.length}.`,
    });
  }
  const seenTitles = new Set<string>();
  for (const s of steps) {
    if (!(s.actionType in ACTION_TYPES)) {
      issues.push({
        code: "unknown_action",
        message: `${s.label}: unknown action "${s.actionType}".`,
      });
      continue;
    }
    if (
      ctx.allowedActions &&
      ctx.allowedActions.size > 0 &&
      !ctx.allowedActions.has(s.actionType)
    ) {
      issues.push({
        code: "not_actionable",
        message: `${s.label}: "${s.actionType}" does not relate to this output.`,
      });
    }
    if (s.targetId && !ctx.resolvableIds.has(s.targetId)) {
      issues.push({
        code: "unresolvable_target",
        message: `${s.label}: target "${s.targetId}" does not exist.`,
      });
    }
    const title = s.title.trim();
    if (
      title.length < 8 ||
      (FILLER.test(title) && title.split(/\s+/).length < 4)
    ) {
      issues.push({
        code: "filler",
        message: `${s.label}: "${title}" is not a specific action.`,
      });
    }
    const key = title.toLowerCase();
    if (seenTitles.has(key))
      issues.push({
        code: "filler",
        message: `${s.label}: duplicates another step.`,
      });
    seenTitles.add(key);
  }
  const recommended = steps.filter((s) => s.recommended).length;
  if (recommended > 2) {
    issues.push({
      code: "too_many_recommended",
      message: `${recommended} steps marked recommended; at most two may be.`,
    });
  }
  return issues;
}

/** Does this step need a human confirmation before its action runs? */
export function requiresConfirmation(
  step: Pick<SuggestedNextStep, "actionType">,
): boolean {
  return ACTION_TYPES[step.actionType]?.confirm === true;
}

export function validateEnvelope(
  envelope: unknown,
  ctx: NextStepContext,
): { ok: boolean; issues: ValidationIssue[]; envelope?: OutputEnvelope } {
  const parsed = outputEnvelopeSchema.safeParse(envelope);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.slice(0, 8).map((i) => ({
        code: "schema" as const,
        message: `${i.path.join(".") || "(root)"}: ${i.message}`,
      })),
    };
  }
  const env = parsed.data as OutputEnvelope;
  const issues = validateNextSteps(env.suggestedNextSteps, ctx);
  if (
    (env.researchStatus === "current" || env.researchStatus === "aging") &&
    !env.researchSnapshotId
  ) {
    issues.push({
      code: "research_currency",
      message: `An output cannot be "${env.researchStatus}" without a research snapshot attached.`,
    });
  }
  const unsupported = env.facts.filter(
    (f) => f.evidenceState === "source_backed" && f.sourceIds.length === 0,
  );
  for (const f of unsupported) {
    issues.push({
      code: "research_currency",
      message: `Fact "${f.text.slice(0, 60)}" claims to be source-backed but cites no source.`,
    });
  }
  return { ok: issues.length === 0, issues, envelope: env };
}

/** Claims that pretend to be facts without a source are relabelled, never silently accepted. */
export function guardClaims(claims: ResearchClaim[]): {
  claims: ResearchClaim[];
  relabelled: number;
} {
  let relabelled = 0;
  const out = claims.map((c) => {
    if (c.kind === "source_fact" && c.sourceIds.length === 0) {
      relabelled += 1;
      return {
        ...c,
        kind: "model_inference" as const,
        evidenceState: "self_attested" as const,
        limitations: [
          ...c.limitations,
          "Stated as a fact without a supporting source; relabelled as model inference.",
        ],
      };
    }
    if (
      (c.evidenceState === "source_backed" || c.evidenceState === "checked") &&
      c.sourceIds.length === 0
    ) {
      relabelled += 1;
      return {
        ...c,
        evidenceState: "self_attested" as const,
        limitations: [
          ...c.limitations,
          "No source cited; evidence state downgraded.",
        ],
      };
    }
    return c;
  });
  return { claims: out, relabelled };
}
