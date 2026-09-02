/**
 * Canonical hiring-intelligence IR (D-011).
 *
 * One typed interpretation of the search that every agent consumes. The JD
 * and hiring-manager statements are raw inputs; they are distilled into
 * these objects once (plus explicit revisions), so no two agents ever hold
 * different private readings of the same phrase.
 *
 * Discipline encoded here:
 * - Vague evaluative language ("research taste", "scrappy") must become a
 *   RequirementIR — label + verbatim source statement + concrete definition
 *   + observable evidence spec — or an open UncertaintyIR driving the next
 *   intake question. It never remains an unexplained string.
 * - ManagerStatements are verbatim and append-only; the service layer owns
 *   the log. Model-output schemas below deliberately exclude it.
 * - Claims carry provenance; supply estimates admit "unknown" (NO FAKE
 *   DATA — nothing here lets a model assert certainty it doesn't have).
 */
import { z } from "zod";

export const irProvenanceSchema = z.enum([
  "jd",
  "manager_statement",
  "research",
  "recruiter",
  "model_inference",
]);
export type IrProvenance = z.infer<typeof irProvenanceSchema>;

/** A claim whose origin is tracked. */
export const irClaimSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  provenance: irProvenanceSchema,
});
export type IrClaim = z.infer<typeof irClaimSchema>;

/** One verbatim hiring-manager utterance. Append-only; never model-edited. */
export const managerStatementSchema = z.object({
  id: z.string(),
  at: z.string(),
  /** "hiring_manager" unless the recruiter records someone else. */
  speaker: z.string(),
  text: z.string(),
  /** What prompted it — usually the question that was asked. */
  context: z.string().optional(),
});
export type ManagerStatement = z.infer<typeof managerStatementSchema>;

export const uncertaintyIRSchema = z.object({
  id: z.string().optional(),
  /** What is uncertain. */
  about: z.string(),
  kind: z.enum([
    "ambiguity",
    "missing_information",
    "conflicting_information",
    "assumption",
  ]),
  /** What goes wrong in the search if this stays unresolved. */
  consequence: z.string(),
  /** Would resolving it change sourcing or screening decisions? */
  consequential: z.boolean(),
  status: z.enum(["open", "resolved"]),
  resolution: z.string().optional(),
});
export type UncertaintyIR = z.infer<typeof uncertaintyIRSchema>;

export const contradictionIRSchema = z.object({
  id: z.string().optional(),
  claimA: irClaimSchema,
  claimB: irClaimSchema,
  note: z.string().optional(),
  status: z.enum(["open", "resolved"]),
  resolution: z.string().optional(),
});
export type ContradictionIR = z.infer<typeof contradictionIRSchema>;

export const requirementIRSchema = z.object({
  id: z.string().optional(),
  /** Short handle, e.g. "Research taste". */
  label: z.string(),
  /** The source phrase, verbatim — nothing cleaned up. */
  statement: z.string(),
  /** What it concretely means for THIS search. Never left implicit. */
  definition: z.string(),
  kind: z.enum(["must_have", "preferred", "trainable", "disqualifier"]),
  origin: irProvenanceSchema,
  /** Observable evidence that would satisfy the requirement. */
  evidenceSpec: z.array(z.string()),
  /** Signals that look like evidence for it but are not. */
  falseSignals: z.array(z.string()),
  status: z.enum(["explicit", "needs_clarification", "assumed"]),
  linkedUncertaintyIds: z.array(z.string()),
});
export type RequirementIR = z.infer<typeof requirementIRSchema>;

export const hiringNeedIRSchema = z.object({
  /** Why the role exists — the business problem, not the job title. */
  businessProblem: z.string(),
  triggeringEvent: z.string().optional(),
  costOfVacancy: z.string().optional(),
  successHorizon: z.string().optional(),
  roleSummary: z.string(),
  /** Raw extracted claims, each with provenance. */
  claims: z.array(irClaimSchema),
  /** Things the sources simply do not say. */
  unknowns: z.array(z.string()),
});
export type HiringNeedIR = z.infer<typeof hiringNeedIRSchema>;

export const hiringIntentIRSchema = z.object({
  need: hiringNeedIRSchema,
  requirements: z.array(requirementIRSchema),
  uncertainties: z.array(uncertaintyIRSchema),
  contradictions: z.array(contradictionIRSchema),
  /** Verbatim, append-only; owned by the service layer, never the model. */
  statements: z.array(managerStatementSchema),
  /** Bumped by every intake-loop update; never regenerated from scratch. */
  revision: z.number(),
});
export type HiringIntentIR = z.infer<typeof hiringIntentIRSchema>;

export const successIRSchema = z.object({
  mission: z.string(),
  outcomes: z.array(
    z.object({
      id: z.string().optional(),
      text: z.string(),
      /** e.g. "90 days", "1 year". */
      horizon: z.string().optional(),
      provenance: irProvenanceSchema,
      linkedRequirementIds: z.array(z.string()),
    }),
  ),
  goodVsExceptional: z.string(),
});
export type SuccessIR = z.infer<typeof successIRSchema>;

export const evidenceIRSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().optional(),
      requirementId: z.string(),
      /** The observable thing that would demonstrate the requirement. */
      observable: z.string(),
      /** Public surfaces where that evidence lives. */
      whereToLook: z.array(z.string()),
      strongLooksLike: z.string(),
      weakLooksLike: z.string(),
    }),
  ),
});
export type EvidenceIR = z.infer<typeof evidenceIRSchema>;

export const talentPopulationIRSchema = z.object({
  segments: z.array(
    z.object({
      id: z.string().optional(),
      label: z.string(),
      description: z.string(),
      /** Honest supply estimate — "unknown" is a legal, expected value. */
      estimatedSupply: z.enum(["abundant", "adequate", "scarce", "unknown"]),
      whereTheyAre: z.array(z.string()),
      provenance: irProvenanceSchema,
    }),
  ),
  adjacentSegments: z.array(
    z.object({
      id: z.string().optional(),
      label: z.string(),
      description: z.string(),
      tradeoff: z.string(),
    }),
  ),
  exclusions: z.array(z.string()),
});
export type TalentPopulationIR = z.infer<typeof talentPopulationIRSchema>;

/**
 * SearchPlanIR: per-segment query plans shaped to feed the deterministic
 * composer (domain/search-strings.ts StringLabInput) — the model plans
 * concepts; the composer builds the strings; the user always sees both.
 */
export const searchPlanIRSchema = z.object({
  queryPlans: z.array(
    z.object({
      id: z.string().optional(),
      segmentLabel: z.string(),
      titles: z.array(z.string()),
      alternateTitles: z.array(z.string()),
      adjacentTitles: z.array(z.string()),
      mustHaveTerms: z.array(z.string()),
      anyOfTerms: z.array(z.string()),
      credentials: z.array(z.string()),
      locations: z.array(z.string()),
      exclusions: z.array(z.string()),
      linkedRequirementIds: z.array(z.string()),
      rationale: z.string(),
    }),
  ),
  /** Recommended execution order and why. */
  sequencing: z.array(z.string()),
});
export type SearchPlanIR = z.infer<typeof searchPlanIRSchema>;

/** The full canonical document stored per search (hiring_intelligence). */
export const canonicalIntelligenceSchema = z.object({
  intent: hiringIntentIRSchema,
  success: successIRSchema.optional(),
  evidence: evidenceIRSchema.optional(),
  population: talentPopulationIRSchema.optional(),
  searchPlan: searchPlanIRSchema.optional(),
});
export type CanonicalIntelligence = z.infer<typeof canonicalIntelligenceSchema>;

// ── Model-output contracts (what generation tasks may return) ───────────────
// The statement log and revision counter are service-owned; model output
// schemas exclude them so no generation can rewrite either.

export const hiringNeedOutputSchema = z.object({
  need: hiringNeedIRSchema,
  requirements: z.array(requirementIRSchema),
  uncertainties: z.array(uncertaintyIRSchema),
  contradictions: z.array(contradictionIRSchema),
});
export type HiringNeedOutput = z.infer<typeof hiringNeedOutputSchema>;

export const nextQuestionSchema = z.object({
  question: z.string(),
  whyItMatters: z.string(),
  /** Which open uncertainties this question is designed to reduce. */
  targetsUncertaintyIds: z.array(z.string()),
  /** What the answer changes about the search — the information value. */
  informationValue: z.string(),
});
export type NextQuestion = z.infer<typeof nextQuestionSchema>;

export const intakeReasoningOutputSchema = z.object({
  /** Claims extracted from the new statement (provenance: manager_statement). */
  extractedClaims: z.array(irClaimSchema),
  /** The full updated sets — clarified, added, re-classified. */
  requirements: z.array(requirementIRSchema),
  uncertainties: z.array(uncertaintyIRSchema),
  contradictions: z.array(contradictionIRSchema),
  /** Highest-information next question; null when nothing consequential is open. */
  nextQuestion: nextQuestionSchema.nullable(),
});
export type IntakeReasoningOutput = z.infer<typeof intakeReasoningOutputSchema>;

export const searchPlanOutputSchema = z.object({
  success: successIRSchema,
  evidence: evidenceIRSchema,
  population: talentPopulationIRSchema,
  searchPlan: searchPlanIRSchema,
});
export type SearchPlanOutput = z.infer<typeof searchPlanOutputSchema>;
