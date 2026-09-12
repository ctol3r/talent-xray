/**
 * HTTP DTOs for the HSAL State Gateway (v1).
 */
import { z } from "zod";
export declare const ErrorResponse: z.ZodObject<{
    error: z.ZodString;
    message: z.ZodString;
    statusCode: z.ZodNumber;
    details: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export type ErrorResponse = z.infer<typeof ErrorResponse>;
export declare const HealthResponse: z.ZodObject<{
    ok: z.ZodLiteral<true>;
    service: z.ZodLiteral<"hsal-gateway">;
    version: z.ZodString;
    time: z.ZodString;
}, z.core.$strip>;
export type HealthResponse = z.infer<typeof HealthResponse>;
export declare const PairRequest: z.ZodObject<{
    code: z.ZodString;
}, z.core.$strip>;
export type PairRequest = z.infer<typeof PairRequest>;
export declare const PairResponse: z.ZodObject<{
    token: z.ZodString;
    capability: z.ZodObject<{
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
}, z.core.$strip>;
export type PairResponse = z.infer<typeof PairResponse>;
export declare const WhoAmIResponse: z.ZodObject<{
    capability: z.ZodObject<{
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
}, z.core.$strip>;
export type WhoAmIResponse = z.infer<typeof WhoAmIResponse>;
export declare const BeliefListResponse: z.ZodObject<{
    beliefs: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
}, z.core.$strip>;
export type BeliefListResponse = z.infer<typeof BeliefListResponse>;
export declare const BeliefResponse: z.ZodObject<{
    belief: z.ZodObject<{
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
}, z.core.$strip>;
export type BeliefResponse = z.infer<typeof BeliefResponse>;
/** An evidence relation joined with the evidence it points at. */
export declare const EvidenceWithRelation: z.ZodObject<{
    relation: z.ZodObject<{
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
    evidence: z.ZodObject<{
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
}, z.core.$strip>;
export type EvidenceWithRelation = z.infer<typeof EvidenceWithRelation>;
export declare const BeliefEvidenceResponse: z.ZodObject<{
    beliefId: z.ZodString;
    items: z.ZodArray<z.ZodObject<{
        relation: z.ZodObject<{
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
        evidence: z.ZodObject<{
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
    }, z.core.$strip>>;
}, z.core.$strip>;
export type BeliefEvidenceResponse = z.infer<typeof BeliefEvidenceResponse>;
export declare const BeliefContext: z.ZodObject<{
    belief: z.ZodObject<{
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
    confidence: z.ZodNumber;
    evidence: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
    relations: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
    assessments: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
    notice: z.ZodString;
}, z.core.$strip>;
export type BeliefContext = z.infer<typeof BeliefContext>;
export declare const UpdateConfidenceRequest: z.ZodObject<{
    confidence: z.ZodNumber;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type UpdateConfidenceRequest = z.infer<typeof UpdateConfidenceRequest>;
export declare const CaptureEvidenceRequest: z.ZodObject<{
    content: z.ZodString;
    sourceType: z.ZodDefault<z.ZodEnum<{
        webpage: "webpage";
        user_statement: "user_statement";
        document: "document";
        observation: "observation";
        external_source: "external_source";
    }>>;
    sourceUrl: z.ZodOptional<z.ZodString>;
    sourceTitle: z.ZodOptional<z.ZodString>;
    capturedAt: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type CaptureEvidenceRequest = z.infer<typeof CaptureEvidenceRequest>;
export declare const ProposedRelation: z.ZodObject<{
    relation: z.ZodObject<{
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
    belief: z.ZodObject<{
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
}, z.core.$strip>;
export type ProposedRelation = z.infer<typeof ProposedRelation>;
export declare const CaptureEvidenceResponse: z.ZodObject<{
    evidence: z.ZodObject<{
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
    deduplicated: z.ZodBoolean;
    proposedRelations: z.ZodArray<z.ZodObject<{
        relation: z.ZodObject<{
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
        belief: z.ZodObject<{
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
    }, z.core.$strip>>;
    notice: z.ZodString;
}, z.core.$strip>;
export type CaptureEvidenceResponse = z.infer<typeof CaptureEvidenceResponse>;
export declare const EvidenceResponse: z.ZodObject<{
    evidence: z.ZodObject<{
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
}, z.core.$strip>;
export type EvidenceResponse = z.infer<typeof EvidenceResponse>;
export declare const RelationResponse: z.ZodObject<{
    relation: z.ZodObject<{
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
}, z.core.$strip>;
export type RelationResponse = z.infer<typeof RelationResponse>;
export declare const ReviewRelationRequest: z.ZodObject<{
    decision: z.ZodEnum<{
        accept: "accept";
        reject: "reject";
    }>;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ReviewRelationRequest = z.infer<typeof ReviewRelationRequest>;
export declare const CreateAssessmentRequest: z.ZodObject<{
    targetBeliefId: z.ZodString;
    stance: z.ZodEnum<{
        supports: "supports";
        contradicts: "contradicts";
        mixed: "mixed";
        uncertain: "uncertain";
    }>;
    confidence: z.ZodOptional<z.ZodNumber>;
    reasoningSummary: z.ZodString;
    evidenceIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    missingEvidence: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type CreateAssessmentRequest = z.infer<typeof CreateAssessmentRequest>;
export declare const AssessmentResponse: z.ZodObject<{
    assessment: z.ZodObject<{
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
    belief: z.ZodObject<{
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
    notice: z.ZodString;
}, z.core.$strip>;
export type AssessmentResponse = z.infer<typeof AssessmentResponse>;
export declare const AssessmentListResponse: z.ZodObject<{
    assessments: z.ZodArray<z.ZodObject<{
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
    }, z.core.$strip>>;
}, z.core.$strip>;
export type AssessmentListResponse = z.infer<typeof AssessmentListResponse>;
export declare const EventsQuery: z.ZodObject<{
    objectId: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type EventsQuery = z.infer<typeof EventsQuery>;
export declare const EventsResponse: z.ZodObject<{
    events: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        type: z.ZodString;
        actorId: z.ZodString;
        objectType: z.ZodString;
        objectId: z.ZodString;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type EventsResponse = z.infer<typeof EventsResponse>;
export declare const ScopeList: z.ZodArray<z.ZodEnum<{
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
export declare const HUMAN_AUTHORITY_NOTICE: string;
