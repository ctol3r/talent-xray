/**
 * Zod schemas for every rich generated document in the system.
 *
 * These are the single contract shared by:
 *  - structured model generation (output_config.format)
 *  - the database JSON columns (drizzle .$type<...>())
 *  - the UI editors
 *
 * `id` fields on list items are optional at generation time and are filled in
 * by `ensureIds` before persisting, so items stay addressable when edited.
 */
import { z } from "zod";
import {
  breadthSchema,
  certaintySchema,
  channelKindSchema,
  channelPrioritySchema,
  evidenceStatusSchema,
  outreachStepKindSchema,
  provenanceSourceSchema,
} from "./enums";

/** A criterion/claim whose origin is tracked. */
export const tracedItemSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  provenance: provenanceSourceSchema,
  note: z.string().optional(),
});
export type TracedItem = z.infer<typeof tracedItemSchema>;

/** A factual claim that must carry a certainty label (NO FAKE DATA rule). */
export const claimSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  certainty: certaintySchema,
  sourceUrl: z.string().optional(),
  note: z.string().optional(),
});
export type Claim = z.infer<typeof claimSchema>;

// ── Module 1: Role Intelligence ──────────────────────────────────────────────

export const roleIntelligencePayloadSchema = z.object({
  canonicalTitle: z.string(),
  alternateTitles: z.array(z.string()),
  seniority: z.string(),
  profession: z.string(),
  occupationFamily: z.string(),
  industry: z.string(),
  jobFunction: z.string(),
  responsibilities: z.array(z.string()),
  businessOutcomes: z.array(z.string()),
  technologies: z.array(z.string()),
  domainKnowledge: z.array(z.string()),
  certifications: z.array(z.string()),
  licenses: z.array(z.string()),
  education: z.string().optional(),
  experienceSummary: z.string().optional(),
  travel: z.string().optional(),
  workArrangement: z.string().optional(),
  managementScope: z.string().optional(),
  compensationNote: z.string().optional(),
  likelyTalentCompetitors: z.array(z.string()),
  /** Explicitly stated, non-negotiable. Vague JD language must NOT land here. */
  hardRequirements: z.array(tracedItemSchema),
  preferences: z.array(tracedItemSchema),
  /** Positive indicators that are neither required nor preferred per se. */
  signals: z.array(tracedItemSchema),
  /** Things the model inferred but the JD does not state. */
  assumptions: z.array(tracedItemSchema),
  unresolvedQuestions: z.array(tracedItemSchema),
  roleHypothesis: z.string(),
});
export type RoleIntelligencePayload = z.infer<
  typeof roleIntelligencePayloadSchema
>;

// ── Module 2: Hiring Manager Intake ─────────────────────────────────────────

export const intakeQuestionSchema = z.object({
  id: z.string().optional(),
  question: z.string(),
  whyItMatters: z.string(),
  answer: z.string().optional(),
  answeredAt: z.string().optional(),
});
export type IntakeQuestion = z.infer<typeof intakeQuestionSchema>;

export const intakeCategorySchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  rationale: z.string(),
  questions: z.array(intakeQuestionSchema),
});
export type IntakeCategory = z.infer<typeof intakeCategorySchema>;

/** "Let me summarize the search as I now understand it." */
export const intakePlaybackSchema = z.object({
  target: z.string(),
  hardRequirements: z.array(z.string()),
  flexibleRequirements: z.array(z.string()),
  idealPhenotype: z.string(),
  adjacentPhenotypes: z.array(z.string()),
  disqualifiers: z.array(z.string()),
  unresolvedQuestions: z.array(z.string()),
});
export type IntakePlayback = z.infer<typeof intakePlaybackSchema>;

export const intakePayloadSchema = z.object({
  categories: z.array(intakeCategorySchema),
  playback: intakePlaybackSchema.optional(),
});
export type IntakePayload = z.infer<typeof intakePayloadSchema>;

// ── Module 3: Success Profile ───────────────────────────────────────────────

export const successProfilePayloadSchema = z.object({
  mission: z.string(),
  outcomes: z.array(tracedItemSchema),
  responsibilities: z.array(tracedItemSchema),
  mustHave: z.array(tracedItemSchema),
  preferred: z.array(tracedItemSchema),
  trainable: z.array(tracedItemSchema),
  evidenceSignals: z.array(tracedItemSchema),
  negativeSignals: z.array(tracedItemSchema),
  adjacentBackgrounds: z.array(tracedItemSchema),
  exemplarPeople: z.array(tracedItemSchema),
  exemplarCompanies: z.array(tracedItemSchema),
  targetIndustries: z.array(tracedItemSchema),
  targetCompanies: z.array(tracedItemSchema),
  alternateTitles: z.array(tracedItemSchema),
  targetGeographies: z.array(tracedItemSchema),
  compensationNote: z.string().optional(),
  candidateMotivators: z.array(tracedItemSchema),
  sellingPoints: z.array(tracedItemSchema),
  risks: z.array(tracedItemSchema),
  unresolvedQuestions: z.array(tracedItemSchema),
});
export type SuccessProfilePayload = z.infer<typeof successProfilePayloadSchema>;

// ── Module 4: Market Intelligence ───────────────────────────────────────────

export const marketResearchPayloadSchema = z.object({
  difficulty: z.object({
    rating: z.number().min(1).max(5),
    rationale: z.string(),
  }),
  sections: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string(),
      claims: z.array(claimSchema),
    }),
  ),
  assumptions: z.array(z.string()),
  missingInformation: z.array(z.string()),
});
export type MarketResearchPayload = z.infer<typeof marketResearchPayloadSchema>;

// ── Module 5: Sourcing Strategy ─────────────────────────────────────────────

export const sourcingStrategyPayloadSchema = z.object({
  primaryTargetProfile: z.string(),
  secondaryTargetProfiles: z.array(z.string()),
  adjacentPossibilities: z.array(
    z.object({
      id: z.string().optional(),
      text: z.string(),
      rationale: z.string(),
    }),
  ),
  targetTitles: z.array(z.string()),
  excludedTitles: z.array(z.string()),
  targetCompanies: z.array(z.string()),
  feederCompanies: z.array(z.string()),
  targetIndustries: z.array(z.string()),
  targetGeographies: z.array(z.string()),
  rationale: z.string(),
  risks: z.array(z.string()),
});
export type SourcingStrategyPayload = z.infer<
  typeof sourcingStrategyPayloadSchema
>;

// ── Modules 6–7: Channels ───────────────────────────────────────────────────

export const channelSuggestionSchema = z.object({
  name: z.string(),
  kind: channelKindSchema,
  url: z.string().optional(),
  audience: z.string().optional(),
  whyRelevant: z.string(),
  geography: z.string().optional(),
  costModel: z.enum(["free", "paid", "unknown"]),
  priority: channelPrioritySchema,
  certainty: certaintySchema,
  note: z.string().optional(),
});
export type ChannelSuggestion = z.infer<typeof channelSuggestionSchema>;

export const channelSuggestionsPayloadSchema = z.object({
  channels: z.array(channelSuggestionSchema),
  reasoningSummary: z.string(),
});
export type ChannelSuggestionsPayload = z.infer<
  typeof channelSuggestionsPayloadSchema
>;

// ── Model-output restrictions (NO FAKE DATA, enforced in the schema) ────────
// "verified" is reserved for claims a human confirmed against a source; model
// output can never carry it. Generation tasks use these narrowed schemas, so
// both API structured outputs and session responses are constrained; the wide
// schemas above remain the storage/edit contract where humans may verify.

export const modelCertaintySchema = z.enum([
  "estimated",
  "inferred",
  "unknown",
]);

export const modelClaimSchema = claimSchema.extend({
  certainty: modelCertaintySchema,
});

export const modelMarketResearchPayloadSchema =
  marketResearchPayloadSchema.extend({
    sections: z.array(
      z.object({
        id: z.string().optional(),
        title: z.string(),
        claims: z.array(modelClaimSchema),
      }),
    ),
  });
export type ModelMarketResearchPayload = z.infer<
  typeof modelMarketResearchPayloadSchema
>;

export const modelChannelSuggestionsPayloadSchema =
  channelSuggestionsPayloadSchema.extend({
    channels: z.array(
      channelSuggestionSchema.extend({ certainty: modelCertaintySchema }),
    ),
  });
export type ModelChannelSuggestionsPayload = z.infer<
  typeof modelChannelSuggestionsPayloadSchema
>;

// ── Module 8: Search strings (AI expansion output) ──────────────────────────

export const querySuggestionSchema = z.object({
  platform: z.string(),
  query: z.string(),
  purpose: z.string(),
  breadth: breadthSchema,
  expectedPrecision: z.enum(["high", "medium", "low"]).optional(),
  targetPhenotype: z.string().optional(),
});
export type QuerySuggestion = z.infer<typeof querySuggestionSchema>;

/**
 * Decision-to-query calibration (Wave B, D-030). One decision per
 * vocabulary term that recruiter review decisions moved, supported or
 * blocked, with the reason rendered verbatim in the String Lab. Persisted
 * per row on `search_queries.calibration`, filtered to the terms present in
 * that row's text.
 */
export const TERM_DECISION_ACTIONS = [
  "promoted_to_must_have",
  "supported",
  "added_any_of",
  "demoted_to_any_of",
  "flagged",
  "removed",
  "added_exclusion",
  "blocked",
] as const;
export const termDecisionActionSchema = z.enum(TERM_DECISION_ACTIONS);
export type TermDecisionAction = z.infer<typeof termDecisionActionSchema>;

export const termDecisionSchema = z.object({
  term: z.string(),
  action: termDecisionActionSchema,
  /** Human-readable reason, e.g. "3 accepted anchors across 2 candidates, 0 dismissed (R: Publication record)". */
  reason: z.string(),
  requirementIds: z.array(z.string()),
  accepted: z.number().int().min(0),
  dismissed: z.number().int().min(0),
  contradictory: z.number().int().min(0),
  corrected: z.number().int().min(0),
  candidates: z.number().int().min(0),
  provenance: z.literal("recruiter"),
});
export type TermDecision = z.infer<typeof termDecisionSchema>;

export const queryCalibrationSchema = z.object({
  generatedAt: z.string(),
  /** Reviewed links across the search when this row was generated. */
  reviewedLinks: z.number().int().min(0),
  /**
   * Fingerprint of the review decisions this row was generated from, so a
   * changed decision on the same link (accept → dismiss) reads as stale
   * even though the count did not move.
   */
  signalsHash: z.string().optional(),
  decisions: z.array(termDecisionSchema),
});
export type QueryCalibration = z.infer<typeof queryCalibrationSchema>;

export const querySuggestionsPayloadSchema = z.object({
  queries: z.array(querySuggestionSchema),
  synonymGroups: z.array(
    z.object({ concept: z.string(), synonyms: z.array(z.string()) }),
  ),
});
export type QuerySuggestionsPayload = z.infer<
  typeof querySuggestionsPayloadSchema
>;

// ── Module 10: Evidence alignment ───────────────────────────────────────────

export const evidenceItemSchema = z.object({
  id: z.string().optional(),
  criterion: z.string(),
  criterionProvenance: provenanceSourceSchema.optional(),
  status: evidenceStatusSchema,
  evidenceText: z.string(),
  sourceUrl: z.string().optional(),
});
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;

export const evidenceAlignmentPayloadSchema = z.object({
  items: z.array(evidenceItemSchema),
  reviewPriority: z.object({
    suggestion: z.enum([
      "review_first",
      "review_soon",
      "review_later",
      "insufficient_information",
    ]),
    rationale: z.string(),
  }),
  questionsToValidate: z.array(z.string()),
  outreachAngle: z.string().optional(),
});
export type EvidenceAlignmentPayload = z.infer<
  typeof evidenceAlignmentPayloadSchema
>;

// ── Module 12: Outreach ─────────────────────────────────────────────────────

export const outreachStepSchema = z.object({
  id: z.string().optional(),
  kind: outreachStepKindSchema,
  dayOffset: z.number(),
  subjectVariants: z.array(z.string()),
  body: z.string(),
  /** Which stored evidence each personalization leans on. Never invented. */
  citations: z.array(
    z.object({ personalization: z.string(), evidence: z.string() }),
  ),
});
export type OutreachStep = z.infer<typeof outreachStepSchema>;

export const outreachSequencePayloadSchema = z.object({
  steps: z.array(outreachStepSchema),
  cadenceRationale: z.string(),
  /** The research-backed AudiencePersonaIR the sequence was written against (D-013). */
  personaLabel: z.string().optional(),
});
export type OutreachSequencePayload = z.infer<
  typeof outreachSequencePayloadSchema
>;

// ── Module 13: Recruiter screen ─────────────────────────────────────────────

export const screenQuestionSchema = z.object({
  id: z.string().optional(),
  question: z.string(),
  why: z.string(),
  strongEvidence: z.array(z.string()),
  weakEvidence: z.array(z.string()),
  redFlags: z.array(z.string()),
  followUps: z.array(z.string()),
});
export type ScreenQuestion = z.infer<typeof screenQuestionSchema>;

export const screenGuidePayloadSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string(),
      questions: z.array(screenQuestionSchema),
    }),
  ),
});
export type ScreenGuidePayload = z.infer<typeof screenGuidePayloadSchema>;

// ── Module 14: Interview plan ───────────────────────────────────────────────

export const interviewStageSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  purpose: z.string(),
  interviewer: z.string().optional(),
  competencies: z.array(z.string()),
  questions: z.array(z.string()),
  evidenceSought: z.array(z.string()),
  rubricNotes: z.string().optional(),
  doNotDuplicate: z.string().optional(),
});
export type InterviewStage = z.infer<typeof interviewStageSchema>;

export const interviewPlanPayloadSchema = z.object({
  stages: z.array(interviewStageSchema),
});
export type InterviewPlanPayload = z.infer<typeof interviewPlanPayloadSchema>;

// ── Module 20: Close plan ───────────────────────────────────────────────────

export const closePlanPayloadSchema = z.object({
  motivations: z.array(z.string()),
  competingOpportunities: z.array(z.string()),
  compensationExpectations: z.string().optional(),
  decisionCriteria: z.array(z.string()),
  concerns: z.array(z.string()),
  relocation: z.string().optional(),
  timing: z.string().optional(),
  counterofferRisk: z.string().optional(),
  stakeholders: z.array(z.string()),
  likelyObjections: z.array(
    z.object({ objection: z.string(), suggestedResponse: z.string() }),
  ),
  missingInformation: z.array(z.string()),
  recommendedTopics: z.array(z.string()),
  hmInvolvement: z.array(z.string()),
  riskOfDecline: z.object({
    level: z.enum(["low", "medium", "high", "unknown"]),
    rationale: z.string(),
  }),
  offerCallPrep: z.array(z.string()),
});
export type ClosePlanPayload = z.infer<typeof closePlanPayloadSchema>;

// ── Module 21: Onboarding ───────────────────────────────────────────────────

export const onboardingPlanPayloadSchema = z.object({
  checklist: z.array(
    z.object({
      id: z.string().optional(),
      label: z.string(),
      owner: z.string().optional(),
      dueOffsetDays: z.number().optional(),
      done: z.boolean().optional(),
    }),
  ),
  recruiterHandoff: z.array(z.string()),
  managerHandoff: z.array(z.string()),
  communicationSchedule: z.array(
    z.object({ day: z.string(), touchpoint: z.string() }),
  ),
  day1Prep: z.array(z.string()),
  day30FollowUp: z.array(z.string()),
  hmFollowUp: z.array(z.string()),
});
export type OnboardingPlanPayload = z.infer<typeof onboardingPlanPayloadSchema>;

// ── Candidate structured profile ────────────────────────────────────────────

export const candidateProfilePayloadSchema = z.object({
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      startYear: z.number().optional(),
      endYear: z.number().optional(),
      summary: z.string().optional(),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string().optional(),
      field: z.string().optional(),
      year: z.number().optional(),
    }),
  ),
  publications: z.array(
    z.object({
      title: z.string(),
      venue: z.string().optional(),
      year: z.number().optional(),
      url: z.string().optional(),
    }),
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      description: z.string().optional(),
      url: z.string().optional(),
    }),
  ),
  skills: z.array(z.string()),
  licenses: z.array(z.string()),
  certifications: z.array(z.string()),
  motivations: z.array(z.string()),
  concerns: z.array(z.string()),
});
export type CandidateProfilePayload = z.infer<
  typeof candidateProfilePayloadSchema
>;

export function emptyCandidateProfile(): CandidateProfilePayload {
  return {
    experience: [],
    education: [],
    publications: [],
    projects: [],
    skills: [],
    licenses: [],
    certifications: [],
    motivations: [],
    concerns: [],
  };
}

// ── Role knowledge (reusable, employer-agnostic) ────────────────────────────

export const roleKnowledgePayloadSchema = z.object({
  vocabulary: z.array(z.string()),
  commonTitles: z.array(z.string()),
  adjacentTitles: z.array(z.string()),
  evidenceSignals: z.array(z.string()),
  typicalQualifications: z.array(z.string()),
  ecosystems: z.array(
    z.object({
      name: z.string(),
      kind: z.string().optional(),
      why: z.string(),
    }),
  ),
  notes: z.string().optional(),
});
export type RoleKnowledgePayload = z.infer<typeof roleKnowledgePayloadSchema>;

// ── Utilities ───────────────────────────────────────────────────────────────

/**
 * Recursively fills missing `id` fields on objects that are array elements,
 * so generated list items stay addressable once the recruiter edits them.
 * Run after zod-parsing a generated payload, before persisting it.
 */
export function ensureIds<T>(value: T, isListItem = false): T {
  if (Array.isArray(value)) {
    return value.map((entry) => ensureIds(entry, true)) as T;
  }
  if (value !== null && typeof value === "object") {
    const record = { ...(value as Record<string, unknown>) };
    if (isListItem && typeof record.id !== "string") {
      record.id = crypto.randomUUID();
    }
    for (const key of Object.keys(record)) {
      record[key] = ensureIds(record[key]);
    }
    return record as T;
  }
  return value;
}

// ── W7: crew critic ─────────────────────────────────────────────────────────

/** The critic agent's structured review of one generated artifact. */
export const critiquePayloadSchema = z.object({
  verdict: z.enum(["accept", "revise"]),
  strengths: z.array(z.string()),
  issues: z.array(z.string()),
});
export type CritiquePayload = z.infer<typeof critiquePayloadSchema>;

// ── W9: two-sided guidance ──────────────────────────────────────────────────

/** HM-facing search brief: what we're hunting, how to calibrate, how to review. */
export const hmBriefPayloadSchema = z.object({
  headline: z.string(),
  whatWeAreLookingFor: z.array(tracedItemSchema),
  calibrationQuestions: z.array(
    z.object({ question: z.string(), whyItMatters: z.string() }),
  ),
  reviewInstructions: z.string(),
  processExpectations: z.array(z.string()),
  openQuestions: z.array(z.string()),
});
export type HmBriefPayload = z.infer<typeof hmBriefPayloadSchema>;

/** Candidate-facing packet the recruiter shares manually. */
export const candidatePacketPayloadSchema = z.object({
  title: z.string(),
  sections: z.array(z.object({ title: z.string(), body: z.string() })),
});
export type CandidatePacketPayload = z.infer<
  typeof candidatePacketPayloadSchema
>;

/** One evidence-anchored HM feedback entry (human input, appended). */
export const hmFeedbackEntrySchema = z.object({
  at: z.string(),
  decision: z.enum(["advance", "hold", "pass"]),
  evidenceNote: z.string(),
});
export type HmFeedbackEntry = z.infer<typeof hmFeedbackEntrySchema>;
