/**
 * HTTP DTOs for the HSAL State Gateway (v1).
 */
import { z } from "zod";
import { AssessmentStance, Belief, BeliefEvidenceRelation, Capability, Evidence, EvidenceSourceType, HSALEvent, ModelAssessment, Scope, confidence, isoDateTime, } from "./ontology.js";
export const ErrorResponse = z.object({
    error: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.unknown().optional(),
});
export const HealthResponse = z.object({
    ok: z.literal(true),
    service: z.literal("hsal-gateway"),
    version: z.string(),
    time: isoDateTime,
});
// ---------------------------------------------------------------- auth
export const PairRequest = z.object({
    code: z.string().regex(/^\d{6}$/, "pairing code is 6 digits"),
});
export const PairResponse = z.object({
    token: z.string(),
    capability: Capability,
});
export const WhoAmIResponse = z.object({
    capability: Capability,
});
// ---------------------------------------------------------------- beliefs
export const BeliefListResponse = z.object({ beliefs: z.array(Belief) });
export const BeliefResponse = z.object({ belief: Belief });
/** An evidence relation joined with the evidence it points at. */
export const EvidenceWithRelation = z.object({
    relation: BeliefEvidenceRelation,
    evidence: Evidence,
});
export const BeliefEvidenceResponse = z.object({
    beliefId: z.string(),
    items: z.array(EvidenceWithRelation),
});
export const BeliefContext = z.object({
    belief: Belief,
    /** Convenience mirror of belief.confidence, made explicit for model consumers. */
    confidence,
    evidence: z.array(Evidence),
    relations: z.array(BeliefEvidenceRelation),
    assessments: z.array(ModelAssessment),
    /** Human-readable reminder of the epistemic contract. */
    notice: z.string(),
});
export const UpdateConfidenceRequest = z.object({
    confidence,
    reason: z.string().optional(),
});
// ---------------------------------------------------------------- evidence
export const CaptureEvidenceRequest = z.object({
    content: z.string().min(1).max(20_000),
    sourceType: EvidenceSourceType.default("webpage"),
    sourceUrl: z.string().optional(),
    sourceTitle: z.string().optional(),
    /** Client capture time. Server records receipt time separately in the event log. */
    capturedAt: isoDateTime.optional(),
});
export const ProposedRelation = z.object({
    relation: BeliefEvidenceRelation,
    belief: Belief,
});
export const CaptureEvidenceResponse = z.object({
    evidence: Evidence,
    /** True if this content had already been captured and the existing record was returned. */
    deduplicated: z.boolean(),
    proposedRelations: z.array(ProposedRelation),
    notice: z.string(),
});
export const EvidenceResponse = z.object({ evidence: Evidence });
// ---------------------------------------------------------------- relations
export const RelationResponse = z.object({ relation: BeliefEvidenceRelation });
export const ReviewRelationRequest = z.object({
    decision: z.enum(["accept", "reject"]),
    note: z.string().optional(),
});
// ---------------------------------------------------------------- assessments
export const CreateAssessmentRequest = z.object({
    targetBeliefId: z.string().min(1),
    stance: AssessmentStance,
    confidence: confidence.optional(),
    reasoningSummary: z.string().min(1).max(10_000),
    evidenceIds: z.array(z.string()).default([]),
    missingEvidence: z.array(z.string()).default([]),
});
export const AssessmentResponse = z.object({
    assessment: ModelAssessment,
    /** The belief as it stands AFTER the assessment was stored: unchanged by design. */
    belief: Belief,
    notice: z.string(),
});
export const AssessmentListResponse = z.object({ assessments: z.array(ModelAssessment) });
// ---------------------------------------------------------------- events
export const EventsQuery = z.object({
    objectId: z.string().optional(),
    type: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(200),
});
export const EventsResponse = z.object({ events: z.array(HSALEvent) });
// ---------------------------------------------------------------- misc
export const ScopeList = z.array(Scope);
export const HUMAN_AUTHORITY_NOTICE = "Evidence relations and model assessments never change the human's belief confidence. " +
    "Only the belief holder changes it, explicitly.";
