/**
 * TalentOS recruiting-domain contracts for the HSAL integration.
 *
 * HSAL objects (Belief, Evidence, State, ExplanatoryModel, Intervention,
 * Trajectory, BeliefRevision, DecisionCase) are NOT redefined here; they are
 * re-exported from @hsal/sdk (which re-exports @hsal/protocol types). This
 * file holds only TalentOS-side domain types and adapter views.
 */
import { z } from "zod";

export type SearchProjectId = string;
export type CandidateId = string;
export type HiringManagerFeedbackId = string;

const isoDate = z.string().min(4);

// ---------------------------------------------------------------- search project

export const CRITERION_CATEGORIES = [
  "skill",
  "experience",
  "title",
  "industry",
  "geography",
  "education",
  "other",
] as const;
export const criterionCategorySchema = z.enum(CRITERION_CATEGORIES);
export type CriterionCategory = z.infer<typeof criterionCategorySchema>;

export const successCriterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: criterionCategorySchema,
  rationale: z.string().optional(),
});
export type SuccessCriterion = z.infer<typeof successCriterionSchema>;

export const successProfileSchema = z.object({
  mustHave: z.array(successCriterionSchema),
  preferred: z.array(successCriterionSchema),
  transferable: z.array(successCriterionSchema),
});
export type SuccessProfile = z.infer<typeof successProfileSchema>;

export const compensationRangeSchema = z.object({
  currency: z.literal("USD"),
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
});
export type CompensationRange = z.infer<typeof compensationRangeSchema>;

export const geographyConstraintSchema = z.object({
  locations: z.array(z.string()),
  remoteAllowed: z.boolean(),
});
export type GeographyConstraint = z.infer<typeof geographyConstraintSchema>;

export const SEARCH_PROJECT_STATUSES = [
  "intake",
  "active",
  "paused",
  "closed",
] as const;
export const searchProjectStatusSchema = z.enum(SEARCH_PROJECT_STATUSES);
export type SearchProjectStatus = z.infer<typeof searchProjectStatusSchema>;

export const searchProjectSchema = z.object({
  id: z.string().min(1),
  companyName: z.string().min(1),
  roleTitle: z.string().min(1),
  status: searchProjectStatusSchema,
  createdAt: isoDate,
  updatedAt: isoDate,
  successProfile: successProfileSchema,
  compensation: compensationRangeSchema.optional(),
  geography: geographyConstraintSchema.optional(),
});
export type SearchProject = z.infer<typeof searchProjectSchema>;

// ---------------------------------------------------------------- pipeline

export const PIPELINE_STAGES = [
  "sourced",
  "outreach_sent",
  "reply",
  "positive_reply",
  "recruiter_screen",
  "hm_screen",
  "onsite",
  "offer",
  "hire",
] as const;
export const pipelineStageSchema = z.enum(PIPELINE_STAGES);
export type PipelineStage = z.infer<typeof pipelineStageSchema>;

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  sourced: "Sourced",
  outreach_sent: "Outreach sent",
  reply: "Replies",
  positive_reply: "Positive replies",
  recruiter_screen: "Recruiter screens",
  hm_screen: "HM screens",
  onsite: "Onsites",
  offer: "Offers",
  hire: "Hires",
};

export const SNAPSHOT_SOURCES = ["seed", "ats", "manual", "import"] as const;
export const snapshotSourceSchema = z.enum(SNAPSHOT_SOURCES);
export type SnapshotSource = z.infer<typeof snapshotSourceSchema>;

export const pipelineCountsSchema = z.object(
  Object.fromEntries(
    PIPELINE_STAGES.map((s) => [s, z.number().int().nonnegative()]),
  ) as Record<PipelineStage, z.ZodNumber>,
);
export type PipelineCounts = Record<PipelineStage, number>;

export const pipelineSnapshotSchema = z.object({
  id: z.string().min(1),
  searchProjectId: z.string().min(1),
  periodStart: isoDate,
  periodEnd: isoDate,
  counts: pipelineCountsSchema,
  observedAt: isoDate,
  source: snapshotSourceSchema,
});
export type PipelineSnapshot = z.infer<typeof pipelineSnapshotSchema>;

export interface PipelineMetrics {
  outreachReplyRate?: number;
  positiveReplyRate?: number;
  recruiterScreenToHMRate?: number;
  hmToOnsiteRate?: number;
  onsiteToOfferRate?: number;
  offerToHireRate?: number;
}

// ---------------------------------------------------------------- binding

export const searchHSALBindingSchema = z.object({
  searchProjectId: z.string().min(1),
  hsalDecisionCaseId: z.string().min(1),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type SearchHSALBinding = z.infer<typeof searchHSALBindingSchema>;

// ---------------------------------------------------------------- recruiter belief

export const recruiterBeliefInputSchema = z.object({
  /** Optional deterministic id (fixtures); otherwise HSAL assigns one. */
  id: z.string().min(1).optional(),
  searchProjectId: z.string().min(1),
  statement: z.string().min(1),
  confidence: z.number().min(0).max(1),
  /** Human actor id, e.g. human:recruiter-jane */
  actorId: z.string().min(1),
});
export type RecruiterBeliefInput = z.infer<typeof recruiterBeliefInputSchema>;

// ---------------------------------------------------------------- candidate evidence

export const CANDIDATE_OBSERVATION_TYPES = [
  "meets_requirement",
  "misses_requirement",
  "hm_rejected",
  "hm_advanced",
  "candidate_withdrew",
  "compensation_objection",
  "location_objection",
  "outreach_response",
  "other",
] as const;
export const candidateObservationTypeSchema = z.enum(
  CANDIDATE_OBSERVATION_TYPES,
);
export type CandidateObservationType = z.infer<
  typeof candidateObservationTypeSchema
>;

export const candidateObservationSchema = z.object({
  type: candidateObservationTypeSchema,
  statement: z.string().min(1),
  criterionId: z.string().optional(),
  observedAt: isoDate,
});
export type CandidateObservation = z.infer<typeof candidateObservationSchema>;

export const candidateSearchEvidenceSchema = z.object({
  candidateId: z.string().min(1),
  searchProjectId: z.string().min(1),
  observations: z.array(candidateObservationSchema),
});
export type CandidateSearchEvidence = z.infer<
  typeof candidateSearchEvidenceSchema
>;

// ---------------------------------------------------------------- HM feedback

export const HM_REASON_CATEGORIES = [
  "skill",
  "scope",
  "title",
  "industry",
  "communication",
  "compensation",
  "location",
  "other",
] as const;
export const hmReasonCategorySchema = z.enum(HM_REASON_CATEGORIES);
export type HMReasonCategory = z.infer<typeof hmReasonCategorySchema>;

export const hmFeedbackReasonSchema = z.object({
  category: hmReasonCategorySchema,
  statement: z.string().min(1),
  criterionId: z.string().optional(),
});
export type HMFeedbackReason = z.infer<typeof hmFeedbackReasonSchema>;

export const HM_DISPOSITIONS = ["advance", "reject", "hold"] as const;
export const hmDispositionSchema = z.enum(HM_DISPOSITIONS);
export type HMDisposition = z.infer<typeof hmDispositionSchema>;

export const hiringManagerFeedbackSchema = z.object({
  id: z.string().min(1),
  searchProjectId: z.string().min(1),
  candidateId: z.string().optional(),
  feedback: z.string().min(1),
  disposition: hmDispositionSchema.optional(),
  structuredReasons: z.array(hmFeedbackReasonSchema).optional(),
  createdAt: isoDate,
});
export type HiringManagerFeedback = z.infer<typeof hiringManagerFeedbackSchema>;

// ---------------------------------------------------------------- adapter view of HSAL evidence

export const TALENTOS_EVIDENCE_SOURCE_TYPES = [
  "talentos_pipeline",
  "talentos_candidate",
  "talentos_hm_feedback",
  "talentos_market",
  "experiment",
  "manual",
] as const;
export const talentosEvidenceSourceTypeSchema = z.enum(
  TALENTOS_EVIDENCE_SOURCE_TYPES,
);
export type TalentOSEvidenceSourceType = z.infer<
  typeof talentosEvidenceSourceTypeSchema
>;

/** Domain-facing projection of an HSAL Evidence record (sourceKind → sourceType). */
export interface HSALEvidenceView {
  id: string;
  decisionCaseId: string;
  content: string;
  sourceType: TalentOSEvidenceSourceType;
  sourceRef: string;
  epistemicStatus: "observed" | "user_asserted" | "inferred";
  observedAt: string;
  createdAt: string;
}

// ---------------------------------------------------------------- diagnosis models

export const DIAGNOSIS_MODEL_TYPES = [
  "talent_supply",
  "outreach",
  "success_profile",
  "compensation",
  "hiring_process",
  "geography",
  "other",
] as const;
export const diagnosisModelTypeSchema = z.enum(DIAGNOSIS_MODEL_TYPES);
export type DiagnosisModelType = z.infer<typeof diagnosisModelTypeSchema>;

export const levelSchema = z.enum(["low", "medium", "high"]);
export type Level = z.infer<typeof levelSchema>;

export const diagnosisAssumptionSchema = z.object({
  statement: z.string().min(1),
  confidence: z.number().min(0).max(1).optional(),
  sensitivity: levelSchema,
});
export type DiagnosisAssumption = z.infer<typeof diagnosisAssumptionSchema>;

export const diagnosisPredictionSchema = z.object({
  statement: z.string().min(1),
  validationCondition: z.string().min(1),
  resolved: z.boolean().optional(),
  outcome: z.boolean().optional(),
});
export type DiagnosisPrediction = z.infer<typeof diagnosisPredictionSchema>;

/** Qualitative support. Deliberately not an objective probability. */
export const modelAssessmentSummarySchema = z.object({
  support: levelSchema,
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().min(1),
});
export type ModelAssessmentSummary = z.infer<
  typeof modelAssessmentSummarySchema
>;

export const DIAGNOSIS_MODEL_STATUSES = [
  "candidate",
  "active",
  "weakened",
  "strengthened",
  "rejected",
] as const;
export const diagnosisModelStatusSchema = z.enum(DIAGNOSIS_MODEL_STATUSES);

export const searchDiagnosisModelSchema = z.object({
  id: z.string().min(1),
  decisionCaseId: z.string().min(1),
  type: diagnosisModelTypeSchema,
  name: z.string().min(1),
  explanation: z.string().min(1),
  assumptions: z.array(diagnosisAssumptionSchema),
  predictions: z.array(diagnosisPredictionSchema),
  evidenceForIds: z.array(z.string()),
  evidenceAgainstIds: z.array(z.string()),
  assessment: modelAssessmentSummarySchema.optional(),
  status: diagnosisModelStatusSchema,
});
export type SearchDiagnosisModel = z.infer<typeof searchDiagnosisModelSchema>;

// ---------------------------------------------------------------- best next test

export const REVERSIBILITIES = [
  "easy",
  "moderate",
  "difficult",
  "irreversible",
] as const;
export const reversibilitySchema = z.enum(REVERSIBILITIES);
export type Reversibility = z.infer<typeof reversibilitySchema>;

export const INTERVENTION_ACTION_TYPES = [
  "success_profile_change",
  "outreach_test",
  "calibration_test",
  "compensation_change",
  "geography_change",
  "process_change",
  "other",
] as const;
export const interventionActionTypeSchema = z.enum(INTERVENTION_ACTION_TYPES);
export type InterventionActionType = z.infer<
  typeof interventionActionTypeSchema
>;

/** Normalized 0..1 inputs to the deterministic ranking. */
export interface TestScore {
  informationGain: number;
  cost: number;
  reversibility: number;
  executionTime: number;
  discriminatoryPower: number;
}

export interface TestScoreWeights {
  informationGain: number;
  discriminatoryPower: number;
  reversibility: number;
  cost: number;
  executionTime: number;
}

/** Definition of a candidate experiment before it is stored as an HSAL Intervention. */
export interface CandidateTest {
  id: string;
  title: string;
  hypothesis: string;
  description: string;
  protocol: string[];
  actionType: InterventionActionType;
  discriminatesBetweenModelIds: string[];
  expectedInformationGain: Level;
  discriminatoryPower: Level;
  cost: Level;
  reversibility: Reversibility;
  durationDays: number;
  durationEstimate: string;
  rationale: string;
  successConditions: string[];
  failureConditions: string[];
  affectedDimensions: string[];
  parameters: Record<string, unknown>;
}

// ---------------------------------------------------------------- belief revision input

export const beliefRevisionInputSchema = z.object({
  beliefId: z.string().min(1),
  previousConfidence: z.number().min(0).max(1),
  newConfidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  evidenceIds: z.array(z.string()),
  actorId: z.string().min(1),
});
export type BeliefRevisionInput = z.infer<typeof beliefRevisionInputSchema>;

// ---------------------------------------------------------------- experiment result

export const experimentResultSchema = z.object({
  id: z.string().min(1),
  searchProjectId: z.string().min(1),
  interventionId: z.string().min(1),
  observedAt: isoDate,
  summary: z.string().min(1),
  /** Distinct observations, each becomes one Evidence record. */
  observations: z.array(z.string().min(1)),
  metrics: z.record(z.string(), z.number()).default({}),
});
export type ExperimentResult = z.infer<typeof experimentResultSchema>;

// ---------------------------------------------------------------- search learning

export const LEARNING_CATEGORIES = [
  "success_profile",
  "market",
  "outreach",
  "compensation",
  "process",
  "candidate_signal",
  "other",
] as const;
export const learningCategorySchema = z.enum(LEARNING_CATEGORIES);
export type LearningCategory = z.infer<typeof learningCategorySchema>;

export const searchLearningApplicabilitySchema = z.object({
  roleFamilies: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional(),
  seniority: z.array(z.string()).optional(),
  industries: z.array(z.string()).optional(),
  geographies: z.array(z.string()).optional(),
});
export type SearchLearningApplicability = z.infer<
  typeof searchLearningApplicabilitySchema
>;

export const searchLearningSchema = z.object({
  id: z.string().min(1),
  sourceSearchProjectId: z.string().min(1),
  title: z.string().min(1),
  statement: z.string().min(1),
  category: learningCategorySchema,
  evidenceIds: z.array(z.string()),
  originatingBeliefIds: z.array(z.string()),
  originatingModelIds: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  applicability: searchLearningApplicabilitySchema,
  createdAt: isoDate,
});
export type SearchLearning = z.infer<typeof searchLearningSchema>;

export const searchLearningQuerySchema = z.object({
  roleFamily: z.string().optional(),
  skills: z.array(z.string()).optional(),
  seniority: z.string().optional(),
  industry: z.string().optional(),
  geography: z.string().optional(),
});
export type SearchLearningQuery = z.infer<typeof searchLearningQuerySchema>;
