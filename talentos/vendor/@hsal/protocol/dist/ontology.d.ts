/**
 * HSAL canonical ontology.
 *
 * These schemas are the single source of truth for the shapes shared by the
 * Gateway, the Chrome extension, the SDK and the MCP server. Nothing in here
 * knows about any particular AI provider: a model is just an Actor of type
 * "model", and its opinions live in ModelAssessment, never inside Belief.
 */
import { z } from "zod";
export declare const isoDateTime: z.ZodString;
/** Confidence is always a probability-like number in [0, 1]. */
export declare const confidence: z.ZodNumber;
export declare const ActorType: z.ZodEnum<{
    human: "human";
    model: "model";
    browser: "browser";
    agent: "agent";
    system: "system";
}>;
export type ActorType = z.infer<typeof ActorType>;
export declare const Actor: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<{
        human: "human";
        model: "model";
        browser: "browser";
        agent: "agent";
        system: "system";
    }>;
    host: z.ZodOptional<z.ZodString>;
    modelLabel: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type Actor = z.infer<typeof Actor>;
export declare const BeliefStatus: z.ZodEnum<{
    active: "active";
    contested: "contested";
    rejected: "rejected";
    confirmed: "confirmed";
    superseded: "superseded";
}>;
export type BeliefStatus = z.infer<typeof BeliefStatus>;
export declare const Belief: z.ZodObject<{
    id: z.ZodString;
    decisionCaseId: z.ZodOptional<z.ZodString>;
    statement: z.ZodString;
    holderActorId: z.ZodString;
    confidence: z.ZodNumber;
    status: z.ZodEnum<{
        active: "active";
        contested: "contested";
        rejected: "rejected";
        confirmed: "confirmed";
        superseded: "superseded";
    }>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export type Belief = z.infer<typeof Belief>;
export declare const EvidenceSourceType: z.ZodEnum<{
    webpage: "webpage";
    user_statement: "user_statement";
    document: "document";
    observation: "observation";
    external_source: "external_source";
}>;
export type EvidenceSourceType = z.infer<typeof EvidenceSourceType>;
export declare const EpistemicStatus: z.ZodEnum<{
    observed: "observed";
    user_asserted: "user_asserted";
    inferred: "inferred";
}>;
export type EpistemicStatus = z.infer<typeof EpistemicStatus>;
export declare const Evidence: z.ZodObject<{
    id: z.ZodString;
    decisionCaseId: z.ZodOptional<z.ZodString>;
    content: z.ZodString;
    sourceType: z.ZodEnum<{
        webpage: "webpage";
        user_statement: "user_statement";
        document: "document";
        observation: "observation";
        external_source: "external_source";
    }>;
    sourceKind: z.ZodOptional<z.ZodString>;
    sourceRef: z.ZodOptional<z.ZodString>;
    sourceUrl: z.ZodOptional<z.ZodString>;
    sourceTitle: z.ZodOptional<z.ZodString>;
    observedAt: z.ZodOptional<z.ZodString>;
    capturedAt: z.ZodString;
    capturedByActorId: z.ZodString;
    epistemicStatus: z.ZodEnum<{
        observed: "observed";
        user_asserted: "user_asserted";
        inferred: "inferred";
    }>;
}, z.core.$strip>;
export type Evidence = z.infer<typeof Evidence>;
export declare const EvidenceRelation: z.ZodEnum<{
    supports: "supports";
    contradicts: "contradicts";
    mixed: "mixed";
    unknown: "unknown";
}>;
export type EvidenceRelation = z.infer<typeof EvidenceRelation>;
export declare const RelationStatus: z.ZodEnum<{
    rejected: "rejected";
    proposed: "proposed";
    accepted: "accepted";
}>;
export type RelationStatus = z.infer<typeof RelationStatus>;
export declare const BeliefEvidenceRelation: z.ZodObject<{
    id: z.ZodString;
    beliefId: z.ZodString;
    evidenceId: z.ZodString;
    relation: z.ZodEnum<{
        supports: "supports";
        contradicts: "contradicts";
        mixed: "mixed";
        unknown: "unknown";
    }>;
    confidence: z.ZodOptional<z.ZodNumber>;
    proposedByActorId: z.ZodString;
    status: z.ZodEnum<{
        rejected: "rejected";
        proposed: "proposed";
        accepted: "accepted";
    }>;
    reasoning: z.ZodOptional<z.ZodString>;
    createdAt: z.ZodString;
    reviewedAt: z.ZodOptional<z.ZodString>;
    reviewedByActorId: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type BeliefEvidenceRelation = z.infer<typeof BeliefEvidenceRelation>;
export declare const AssessmentStance: z.ZodEnum<{
    supports: "supports";
    contradicts: "contradicts";
    mixed: "mixed";
    uncertain: "uncertain";
}>;
export type AssessmentStance = z.infer<typeof AssessmentStance>;
export declare const ModelAssessment: z.ZodObject<{
    id: z.ZodString;
    targetBeliefId: z.ZodString;
    actorId: z.ZodString;
    stance: z.ZodEnum<{
        supports: "supports";
        contradicts: "contradicts";
        mixed: "mixed";
        uncertain: "uncertain";
    }>;
    confidence: z.ZodOptional<z.ZodNumber>;
    reasoningSummary: z.ZodString;
    evidenceIds: z.ZodArray<z.ZodString>;
    missingEvidence: z.ZodArray<z.ZodString>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type ModelAssessment = z.infer<typeof ModelAssessment>;
export declare const Scope: z.ZodEnum<{
    "belief:read": "belief:read";
    "belief:create": "belief:create";
    "belief:update-confidence": "belief:update-confidence";
    "belief:revise": "belief:revise";
    "evidence:read": "evidence:read";
    "evidence:capture": "evidence:capture";
    "relation:review": "relation:review";
    "assessment:read": "assessment:read";
    "assessment:create": "assessment:create";
    "events:read": "events:read";
    "events:append": "events:append";
    "case:read": "case:read";
    "case:write": "case:write";
    "actor:ensure": "actor:ensure";
}>;
export type Scope = z.infer<typeof Scope>;
export declare const ALL_SCOPES: ("belief:read" | "belief:create" | "belief:update-confidence" | "belief:revise" | "evidence:read" | "evidence:capture" | "relation:review" | "assessment:read" | "assessment:create" | "events:read" | "events:append" | "case:read" | "case:write" | "actor:ensure")[];
export declare const Capability: z.ZodObject<{
    id: z.ZodString;
    clientId: z.ZodString;
    actorId: z.ZodString;
    scopes: z.ZodArray<z.ZodEnum<{
        "belief:read": "belief:read";
        "belief:create": "belief:create";
        "belief:update-confidence": "belief:update-confidence";
        "belief:revise": "belief:revise";
        "evidence:read": "evidence:read";
        "evidence:capture": "evidence:capture";
        "relation:review": "relation:review";
        "assessment:read": "assessment:read";
        "assessment:create": "assessment:create";
        "events:read": "events:read";
        "events:append": "events:append";
        "case:read": "case:read";
        "case:write": "case:write";
        "actor:ensure": "actor:ensure";
    }>>;
    allowedObjectIds: z.ZodOptional<z.ZodArray<z.ZodString>>;
    expiresAt: z.ZodOptional<z.ZodString>;
    issuedAt: z.ZodString;
}, z.core.$strip>;
export type Capability = z.infer<typeof Capability>;
export declare const HSALEvent: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodString;
    actorId: z.ZodString;
    objectType: z.ZodString;
    objectId: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    createdAt: z.ZodString;
}, z.core.$strip>;
export type HSALEvent = z.infer<typeof HSALEvent>;
/** Well-known event types. Free-form strings are allowed, but these are the canonical ones. */
export declare const EventTypes: {
    readonly actorCreated: "actor.created";
    readonly beliefCreated: "belief.created";
    readonly beliefConfidenceChanged: "belief.confidence_changed";
    readonly beliefStatusChanged: "belief.status_changed";
    readonly evidenceCaptured: "evidence.captured";
    readonly evidenceRelationProposed: "evidence_relation.proposed";
    readonly evidenceRelationAccepted: "evidence_relation.accepted";
    readonly evidenceRelationRejected: "evidence_relation.rejected";
    readonly assessmentCreated: "assessment.created";
    readonly authTokenIssued: "auth.token_issued";
    readonly authTokenRevoked: "auth.token_revoked";
    readonly authPairingCodeIssued: "auth.pairing_code_issued";
    readonly authPaired: "auth.paired";
    readonly decisionCaseCreated: "decision_case.created";
    readonly decisionCaseStatusChanged: "decision_case.status_changed";
    readonly stateRecorded: "state.recorded";
    readonly modelProposed: "model.proposed";
    readonly modelUpdated: "model.updated";
    readonly interventionProposed: "intervention.proposed";
    readonly interventionUpdated: "intervention.updated";
    readonly interventionSelected: "intervention.selected";
    readonly trajectoryCreated: "trajectory.created";
};
export type EventType = (typeof EventTypes)[keyof typeof EventTypes];
