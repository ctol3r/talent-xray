/**
 * HSAL canonical ontology.
 *
 * These schemas are the single source of truth for the shapes shared by the
 * Gateway, the Chrome extension, the SDK and the MCP server. Nothing in here
 * knows about any particular AI provider: a model is just an Actor of type
 * "model", and its opinions live in ModelAssessment, never inside Belief.
 */
import { z } from "zod";
export const isoDateTime = z.string().datetime({ offset: true });
/** Confidence is always a probability-like number in [0, 1]. */
export const confidence = z.number().min(0).max(1);
// ---------------------------------------------------------------- Actor
export const ActorType = z.enum(["human", "model", "browser", "agent", "system"]);
export const Actor = z.object({
    id: z.string().min(1),
    type: ActorType,
    host: z.string().optional(),
    modelLabel: z.string().optional(),
    createdAt: isoDateTime,
});
// ---------------------------------------------------------------- Belief
export const BeliefStatus = z.enum(["active", "contested", "rejected", "confirmed", "superseded"]);
export const Belief = z.object({
    id: z.string().min(1),
    /** Optional decision case this belief belongs to. */
    decisionCaseId: z.string().optional(),
    statement: z.string().min(1),
    holderActorId: z.string().min(1),
    /** Human-owned. Only the holder (or an actor with belief:update-confidence) may change it. */
    confidence,
    status: BeliefStatus,
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
});
// ---------------------------------------------------------------- Evidence
export const EvidenceSourceType = z.enum([
    "webpage",
    "user_statement",
    "document",
    "observation",
    "external_source",
]);
export const EpistemicStatus = z.enum(["observed", "user_asserted", "inferred"]);
export const Evidence = z.object({
    id: z.string().min(1),
    /** Optional decision case this evidence belongs to. */
    decisionCaseId: z.string().optional(),
    content: z.string().min(1),
    sourceType: EvidenceSourceType,
    /** Domain-specific source tag (e.g. talentos_hm_feedback). Opaque to HSAL. */
    sourceKind: z.string().optional(),
    /** Opaque reference into the source system (e.g. talentos:candidate:C31). */
    sourceRef: z.string().optional(),
    sourceUrl: z.string().optional(),
    sourceTitle: z.string().optional(),
    /** When the underlying fact was observed, if different from capture time. */
    observedAt: isoDateTime.optional(),
    capturedAt: isoDateTime,
    capturedByActorId: z.string().min(1),
    epistemicStatus: EpistemicStatus,
});
// ---------------------------------------------------------------- BeliefEvidenceRelation
export const EvidenceRelation = z.enum(["supports", "contradicts", "mixed", "unknown"]);
export const RelationStatus = z.enum(["proposed", "accepted", "rejected"]);
export const BeliefEvidenceRelation = z.object({
    id: z.string().min(1),
    beliefId: z.string().min(1),
    evidenceId: z.string().min(1),
    relation: EvidenceRelation,
    /** Classification confidence. This is NOT the belief's confidence. */
    confidence: confidence.optional(),
    proposedByActorId: z.string().min(1),
    status: RelationStatus,
    reasoning: z.string().optional(),
    createdAt: isoDateTime,
    reviewedAt: isoDateTime.optional(),
    reviewedByActorId: z.string().optional(),
});
// ---------------------------------------------------------------- ModelAssessment
export const AssessmentStance = z.enum(["supports", "contradicts", "mixed", "uncertain"]);
export const ModelAssessment = z.object({
    id: z.string().min(1),
    targetBeliefId: z.string().min(1),
    /** The model actor (e.g. model:claude). Never a human. */
    actorId: z.string().min(1),
    stance: AssessmentStance,
    confidence: confidence.optional(),
    reasoningSummary: z.string().min(1),
    evidenceIds: z.array(z.string()),
    missingEvidence: z.array(z.string()),
    createdAt: isoDateTime,
});
// ---------------------------------------------------------------- Capability
export const Scope = z.enum([
    "belief:read",
    "belief:create",
    "belief:update-confidence",
    "belief:revise",
    "evidence:read",
    "evidence:capture",
    "relation:review",
    "assessment:read",
    "assessment:create",
    "events:read",
    "events:append",
    "case:read",
    "case:write",
    "actor:ensure",
]);
export const ALL_SCOPES = Scope.options;
export const Capability = z.object({
    /** Token id (not the secret). */
    id: z.string().min(1),
    clientId: z.string().min(1),
    /** The actor this client acts as (browser:chrome-extension, model:claude, ...). */
    actorId: z.string().min(1),
    scopes: z.array(Scope),
    allowedObjectIds: z.array(z.string()).optional(),
    expiresAt: isoDateTime.optional(),
    issuedAt: isoDateTime,
});
// ---------------------------------------------------------------- HSALEvent
export const HSALEvent = z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    actorId: z.string().min(1),
    objectType: z.string().min(1),
    objectId: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
    createdAt: isoDateTime,
});
/** Well-known event types. Free-form strings are allowed, but these are the canonical ones. */
export const EventTypes = {
    actorCreated: "actor.created",
    beliefCreated: "belief.created",
    beliefConfidenceChanged: "belief.confidence_changed",
    beliefStatusChanged: "belief.status_changed",
    evidenceCaptured: "evidence.captured",
    evidenceRelationProposed: "evidence_relation.proposed",
    evidenceRelationAccepted: "evidence_relation.accepted",
    evidenceRelationRejected: "evidence_relation.rejected",
    assessmentCreated: "assessment.created",
    authTokenIssued: "auth.token_issued",
    authTokenRevoked: "auth.token_revoked",
    authPairingCodeIssued: "auth.pairing_code_issued",
    authPaired: "auth.paired",
    decisionCaseCreated: "decision_case.created",
    decisionCaseStatusChanged: "decision_case.status_changed",
    stateRecorded: "state.recorded",
    modelProposed: "model.proposed",
    modelUpdated: "model.updated",
    interventionProposed: "intervention.proposed",
    interventionUpdated: "intervention.updated",
    interventionSelected: "intervention.selected",
    trajectoryCreated: "trajectory.created",
};
