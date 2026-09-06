/**
 * HTTP DTOs for the decision-loop routes.
 */
import { z } from "zod";
export declare const EnsureActorRequest: z.ZodObject<{
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
}, z.core.$strip>;
export type EnsureActorRequest = z.infer<typeof EnsureActorRequest>;
export declare const EnsureActorResponse: z.ZodObject<{
    actor: z.ZodObject<{
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
    created: z.ZodBoolean;
}, z.core.$strip>;
export type EnsureActorResponse = z.infer<typeof EnsureActorResponse>;
export declare const CreateDecisionCaseRequest: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    question: z.ZodString;
    objective: z.ZodString;
    scopeRef: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<{
        exploring: "exploring";
        ready: "ready";
        decided: "decided";
        resolved: "resolved";
    }>>;
}, z.core.$strip>;
export type CreateDecisionCaseRequest = z.infer<typeof CreateDecisionCaseRequest>;
export declare const DecisionCaseResponse: z.ZodObject<{
    decisionCase: z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        question: z.ZodString;
        objective: z.ZodString;
        scopeRef: z.ZodString;
        status: z.ZodEnum<{
            exploring: "exploring";
            ready: "ready";
            decided: "decided";
            resolved: "resolved";
        }>;
        createdByActorId: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    created: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type DecisionCaseResponse = z.infer<typeof DecisionCaseResponse>;
export declare const DecisionCaseContext: z.ZodObject<{
    decisionCase: z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        question: z.ZodString;
        objective: z.ZodString;
        scopeRef: z.ZodString;
        status: z.ZodEnum<{
            exploring: "exploring";
            ready: "ready";
            decided: "decided";
            resolved: "resolved";
        }>;
        createdByActorId: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    states: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        decisionCaseId: z.ZodString;
        label: z.ZodString;
        timestamp: z.ZodString;
        status: z.ZodEnum<{
            actual: "actual";
            historical: "historical";
            estimated: "estimated";
            simulated: "simulated";
            counterfactual: "counterfactual";
        }>;
        dimensions: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
            unit: z.ZodOptional<z.ZodString>;
            epistemicStatus: z.ZodEnum<{
                observed: "observed";
                user_asserted: "user_asserted";
                inferred: "inferred";
                simulated: "simulated";
            }>;
        }, z.core.$strip>>;
        uncertainty: z.ZodObject<{
            level: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
            notes: z.ZodOptional<z.ZodString>;
            unknowns: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
        sourceRefs: z.ZodArray<z.ZodString>;
        createdByActorId: z.ZodString;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
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
    models: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        decisionCaseId: z.ZodString;
        kind: z.ZodString;
        name: z.ZodString;
        explanation: z.ZodString;
        assumptions: z.ZodArray<z.ZodObject<{
            statement: z.ZodString;
            confidence: z.ZodOptional<z.ZodNumber>;
            sensitivity: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
        }, z.core.$strip>>;
        predictions: z.ZodArray<z.ZodObject<{
            statement: z.ZodString;
            validationCondition: z.ZodString;
            resolved: z.ZodOptional<z.ZodBoolean>;
            outcome: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
        evidenceForIds: z.ZodArray<z.ZodString>;
        evidenceAgainstIds: z.ZodArray<z.ZodString>;
        assessment: z.ZodOptional<z.ZodObject<{
            support: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
            confidence: z.ZodOptional<z.ZodNumber>;
            reasoning: z.ZodString;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            active: "active";
            rejected: "rejected";
            candidate: "candidate";
            weakened: "weakened";
            strengthened: "strengthened";
        }>;
        proposedByActorId: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
    interventions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        decisionCaseId: z.ZodString;
        name: z.ZodString;
        description: z.ZodString;
        sourceStateId: z.ZodString;
        actionType: z.ZodString;
        parameters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        intendedOutcome: z.ZodString;
        affectedDimensions: z.ZodArray<z.ZodString>;
        cost: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        reversibility: z.ZodEnum<{
            easy: "easy";
            moderate: "moderate";
            difficult: "difficult";
            irreversible: "irreversible";
        }>;
        status: z.ZodEnum<{
            proposed: "proposed";
            selected: "selected";
            executing: "executing";
            completed: "completed";
            cancelled: "cancelled";
        }>;
        experiment: z.ZodOptional<z.ZodObject<{
            hypothesis: z.ZodString;
            discriminatesBetweenModelIds: z.ZodArray<z.ZodString>;
            expectedInformationGain: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
            durationEstimate: z.ZodOptional<z.ZodString>;
            rationale: z.ZodString;
            successConditions: z.ZodArray<z.ZodString>;
            failureConditions: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        proposedByActorId: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        selectedAt: z.ZodOptional<z.ZodString>;
        selectedByActorId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    trajectories: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        decisionCaseId: z.ZodString;
        originStateId: z.ZodString;
        interventionIds: z.ZodArray<z.ZodString>;
        stateIds: z.ZodArray<z.ZodString>;
        startedAt: z.ZodString;
        status: z.ZodEnum<{
            active: "active";
            completed: "completed";
            invalidated: "invalidated";
        }>;
        outcomes: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            before: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
            after: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
            interpretation: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        createdByActorId: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
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
    revisions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        beliefId: z.ZodString;
        previousConfidence: z.ZodNumber;
        newConfidence: z.ZodNumber;
        reason: z.ZodString;
        evidenceIds: z.ZodArray<z.ZodString>;
        actorId: z.ZodString;
        viaActorId: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
    notice: z.ZodString;
}, z.core.$strip>;
export type DecisionCaseContext = z.infer<typeof DecisionCaseContext>;
export declare const CreateStateRequest: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    decisionCaseId: z.ZodString;
    label: z.ZodString;
    timestamp: z.ZodOptional<z.ZodString>;
    status: z.ZodEnum<{
        actual: "actual";
        historical: "historical";
        estimated: "estimated";
        simulated: "simulated";
        counterfactual: "counterfactual";
    }>;
    dimensions: z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        label: z.ZodString;
        value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
        unit: z.ZodOptional<z.ZodString>;
        epistemicStatus: z.ZodEnum<{
            observed: "observed";
            user_asserted: "user_asserted";
            inferred: "inferred";
            simulated: "simulated";
        }>;
    }, z.core.$strip>>;
    uncertainty: z.ZodObject<{
        level: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        notes: z.ZodOptional<z.ZodString>;
        unknowns: z.ZodDefault<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>;
    sourceRefs: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type CreateStateRequest = z.infer<typeof CreateStateRequest>;
export declare const StateResponse: z.ZodObject<{
    state: z.ZodObject<{
        id: z.ZodString;
        decisionCaseId: z.ZodString;
        label: z.ZodString;
        timestamp: z.ZodString;
        status: z.ZodEnum<{
            actual: "actual";
            historical: "historical";
            estimated: "estimated";
            simulated: "simulated";
            counterfactual: "counterfactual";
        }>;
        dimensions: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            label: z.ZodString;
            value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
            unit: z.ZodOptional<z.ZodString>;
            epistemicStatus: z.ZodEnum<{
                observed: "observed";
                user_asserted: "user_asserted";
                inferred: "inferred";
                simulated: "simulated";
            }>;
        }, z.core.$strip>>;
        uncertainty: z.ZodObject<{
            level: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
            notes: z.ZodOptional<z.ZodString>;
            unknowns: z.ZodDefault<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
        sourceRefs: z.ZodArray<z.ZodString>;
        createdByActorId: z.ZodString;
        createdAt: z.ZodString;
    }, z.core.$strip>;
    created: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type StateResponse = z.infer<typeof StateResponse>;
export declare const CreateBeliefRequest: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    decisionCaseId: z.ZodOptional<z.ZodString>;
    statement: z.ZodString;
    holderActorId: z.ZodString;
    confidence: z.ZodNumber;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        contested: "contested";
        rejected: "rejected";
        confirmed: "confirmed";
        superseded: "superseded";
    }>>;
}, z.core.$strip>;
export type CreateBeliefRequest = z.infer<typeof CreateBeliefRequest>;
export declare const CreateBeliefResponse: z.ZodObject<{
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
    created: z.ZodBoolean;
}, z.core.$strip>;
export type CreateBeliefResponse = z.infer<typeof CreateBeliefResponse>;
export declare const ReviseBeliefRequest: z.ZodObject<{
    previousConfidence: z.ZodNumber;
    newConfidence: z.ZodNumber;
    reason: z.ZodString;
    evidenceIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    actorId: z.ZodString;
}, z.core.$strip>;
export type ReviseBeliefRequest = z.infer<typeof ReviseBeliefRequest>;
export declare const ReviseBeliefResponse: z.ZodObject<{
    revision: z.ZodObject<{
        id: z.ZodString;
        beliefId: z.ZodString;
        previousConfidence: z.ZodNumber;
        newConfidence: z.ZodNumber;
        reason: z.ZodString;
        evidenceIds: z.ZodArray<z.ZodString>;
        actorId: z.ZodString;
        viaActorId: z.ZodOptional<z.ZodString>;
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
}, z.core.$strip>;
export type ReviseBeliefResponse = z.infer<typeof ReviseBeliefResponse>;
export declare const RevisionListResponse: z.ZodObject<{
    revisions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        beliefId: z.ZodString;
        previousConfidence: z.ZodNumber;
        newConfidence: z.ZodNumber;
        reason: z.ZodString;
        evidenceIds: z.ZodArray<z.ZodString>;
        actorId: z.ZodString;
        viaActorId: z.ZodOptional<z.ZodString>;
        createdAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type RevisionListResponse = z.infer<typeof RevisionListResponse>;
export declare const CreateEvidenceRequest: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    decisionCaseId: z.ZodOptional<z.ZodString>;
    content: z.ZodString;
    sourceType: z.ZodDefault<z.ZodEnum<{
        webpage: "webpage";
        user_statement: "user_statement";
        document: "document";
        observation: "observation";
        external_source: "external_source";
    }>>;
    sourceKind: z.ZodOptional<z.ZodString>;
    sourceRef: z.ZodOptional<z.ZodString>;
    sourceUrl: z.ZodOptional<z.ZodString>;
    sourceTitle: z.ZodOptional<z.ZodString>;
    observedAt: z.ZodOptional<z.ZodString>;
    capturedAt: z.ZodOptional<z.ZodString>;
    epistemicStatus: z.ZodDefault<z.ZodEnum<{
        observed: "observed";
        user_asserted: "user_asserted";
        inferred: "inferred";
    }>>;
    propose: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strip>;
export type CreateEvidenceRequest = z.infer<typeof CreateEvidenceRequest>;
export declare const UpsertModelRequest: z.ZodObject<{
    id: z.ZodString;
    decisionCaseId: z.ZodString;
    kind: z.ZodString;
    name: z.ZodString;
    explanation: z.ZodString;
    assumptions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        statement: z.ZodString;
        confidence: z.ZodOptional<z.ZodNumber>;
        sensitivity: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
    }, z.core.$strip>>>;
    predictions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        statement: z.ZodString;
        validationCondition: z.ZodString;
        resolved: z.ZodOptional<z.ZodBoolean>;
        outcome: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strip>>>;
    evidenceForIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    evidenceAgainstIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    assessment: z.ZodOptional<z.ZodObject<{
        support: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        confidence: z.ZodOptional<z.ZodNumber>;
        reasoning: z.ZodString;
    }, z.core.$strip>>;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        rejected: "rejected";
        candidate: "candidate";
        weakened: "weakened";
        strengthened: "strengthened";
    }>>;
}, z.core.$strip>;
export type UpsertModelRequest = z.infer<typeof UpsertModelRequest>;
export declare const ModelResponse: z.ZodObject<{
    model: z.ZodObject<{
        id: z.ZodString;
        decisionCaseId: z.ZodString;
        kind: z.ZodString;
        name: z.ZodString;
        explanation: z.ZodString;
        assumptions: z.ZodArray<z.ZodObject<{
            statement: z.ZodString;
            confidence: z.ZodOptional<z.ZodNumber>;
            sensitivity: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
        }, z.core.$strip>>;
        predictions: z.ZodArray<z.ZodObject<{
            statement: z.ZodString;
            validationCondition: z.ZodString;
            resolved: z.ZodOptional<z.ZodBoolean>;
            outcome: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
        evidenceForIds: z.ZodArray<z.ZodString>;
        evidenceAgainstIds: z.ZodArray<z.ZodString>;
        assessment: z.ZodOptional<z.ZodObject<{
            support: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
            confidence: z.ZodOptional<z.ZodNumber>;
            reasoning: z.ZodString;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            active: "active";
            rejected: "rejected";
            candidate: "candidate";
            weakened: "weakened";
            strengthened: "strengthened";
        }>;
        proposedByActorId: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    created: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type ModelResponse = z.infer<typeof ModelResponse>;
export declare const ModelListResponse: z.ZodObject<{
    models: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        decisionCaseId: z.ZodString;
        kind: z.ZodString;
        name: z.ZodString;
        explanation: z.ZodString;
        assumptions: z.ZodArray<z.ZodObject<{
            statement: z.ZodString;
            confidence: z.ZodOptional<z.ZodNumber>;
            sensitivity: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
        }, z.core.$strip>>;
        predictions: z.ZodArray<z.ZodObject<{
            statement: z.ZodString;
            validationCondition: z.ZodString;
            resolved: z.ZodOptional<z.ZodBoolean>;
            outcome: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>>;
        evidenceForIds: z.ZodArray<z.ZodString>;
        evidenceAgainstIds: z.ZodArray<z.ZodString>;
        assessment: z.ZodOptional<z.ZodObject<{
            support: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
            confidence: z.ZodOptional<z.ZodNumber>;
            reasoning: z.ZodString;
        }, z.core.$strip>>;
        status: z.ZodEnum<{
            active: "active";
            rejected: "rejected";
            candidate: "candidate";
            weakened: "weakened";
            strengthened: "strengthened";
        }>;
        proposedByActorId: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type ModelListResponse = z.infer<typeof ModelListResponse>;
export declare const UpsertInterventionRequest: z.ZodObject<{
    id: z.ZodString;
    decisionCaseId: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    sourceStateId: z.ZodString;
    actionType: z.ZodString;
    parameters: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    intendedOutcome: z.ZodString;
    affectedDimensions: z.ZodDefault<z.ZodArray<z.ZodString>>;
    cost: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    reversibility: z.ZodEnum<{
        easy: "easy";
        moderate: "moderate";
        difficult: "difficult";
        irreversible: "irreversible";
    }>;
    status: z.ZodDefault<z.ZodEnum<{
        proposed: "proposed";
        selected: "selected";
        executing: "executing";
        completed: "completed";
        cancelled: "cancelled";
    }>>;
    experiment: z.ZodOptional<z.ZodObject<{
        hypothesis: z.ZodString;
        discriminatesBetweenModelIds: z.ZodArray<z.ZodString>;
        expectedInformationGain: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        durationEstimate: z.ZodOptional<z.ZodString>;
        rationale: z.ZodString;
        successConditions: z.ZodArray<z.ZodString>;
        failureConditions: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type UpsertInterventionRequest = z.infer<typeof UpsertInterventionRequest>;
export declare const InterventionResponse: z.ZodObject<{
    intervention: z.ZodObject<{
        id: z.ZodString;
        decisionCaseId: z.ZodString;
        name: z.ZodString;
        description: z.ZodString;
        sourceStateId: z.ZodString;
        actionType: z.ZodString;
        parameters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        intendedOutcome: z.ZodString;
        affectedDimensions: z.ZodArray<z.ZodString>;
        cost: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        reversibility: z.ZodEnum<{
            easy: "easy";
            moderate: "moderate";
            difficult: "difficult";
            irreversible: "irreversible";
        }>;
        status: z.ZodEnum<{
            proposed: "proposed";
            selected: "selected";
            executing: "executing";
            completed: "completed";
            cancelled: "cancelled";
        }>;
        experiment: z.ZodOptional<z.ZodObject<{
            hypothesis: z.ZodString;
            discriminatesBetweenModelIds: z.ZodArray<z.ZodString>;
            expectedInformationGain: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
            durationEstimate: z.ZodOptional<z.ZodString>;
            rationale: z.ZodString;
            successConditions: z.ZodArray<z.ZodString>;
            failureConditions: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        proposedByActorId: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        selectedAt: z.ZodOptional<z.ZodString>;
        selectedByActorId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    created: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type InterventionResponse = z.infer<typeof InterventionResponse>;
export declare const InterventionListResponse: z.ZodObject<{
    interventions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        decisionCaseId: z.ZodString;
        name: z.ZodString;
        description: z.ZodString;
        sourceStateId: z.ZodString;
        actionType: z.ZodString;
        parameters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        intendedOutcome: z.ZodString;
        affectedDimensions: z.ZodArray<z.ZodString>;
        cost: z.ZodEnum<{
            low: "low";
            medium: "medium";
            high: "high";
        }>;
        reversibility: z.ZodEnum<{
            easy: "easy";
            moderate: "moderate";
            difficult: "difficult";
            irreversible: "irreversible";
        }>;
        status: z.ZodEnum<{
            proposed: "proposed";
            selected: "selected";
            executing: "executing";
            completed: "completed";
            cancelled: "cancelled";
        }>;
        experiment: z.ZodOptional<z.ZodObject<{
            hypothesis: z.ZodString;
            discriminatesBetweenModelIds: z.ZodArray<z.ZodString>;
            expectedInformationGain: z.ZodEnum<{
                low: "low";
                medium: "medium";
                high: "high";
            }>;
            durationEstimate: z.ZodOptional<z.ZodString>;
            rationale: z.ZodString;
            successConditions: z.ZodArray<z.ZodString>;
            failureConditions: z.ZodArray<z.ZodString>;
        }, z.core.$strip>>;
        proposedByActorId: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
        selectedAt: z.ZodOptional<z.ZodString>;
        selectedByActorId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type InterventionListResponse = z.infer<typeof InterventionListResponse>;
export declare const SelectInterventionRequest: z.ZodObject<{
    actorId: z.ZodString;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SelectInterventionRequest = z.infer<typeof SelectInterventionRequest>;
export declare const CreateTrajectoryRequest: z.ZodObject<{
    id: z.ZodOptional<z.ZodString>;
    decisionCaseId: z.ZodString;
    originStateId: z.ZodString;
    interventionIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    stateIds: z.ZodDefault<z.ZodArray<z.ZodString>>;
    startedAt: z.ZodOptional<z.ZodString>;
    status: z.ZodDefault<z.ZodEnum<{
        active: "active";
        completed: "completed";
        invalidated: "invalidated";
    }>>;
    outcomes: z.ZodDefault<z.ZodArray<z.ZodObject<{
        key: z.ZodString;
        before: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
        after: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
        interpretation: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type CreateTrajectoryRequest = z.infer<typeof CreateTrajectoryRequest>;
export declare const TrajectoryResponse: z.ZodObject<{
    trajectory: z.ZodObject<{
        id: z.ZodString;
        decisionCaseId: z.ZodString;
        originStateId: z.ZodString;
        interventionIds: z.ZodArray<z.ZodString>;
        stateIds: z.ZodArray<z.ZodString>;
        startedAt: z.ZodString;
        status: z.ZodEnum<{
            active: "active";
            completed: "completed";
            invalidated: "invalidated";
        }>;
        outcomes: z.ZodArray<z.ZodObject<{
            key: z.ZodString;
            before: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
            after: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
            interpretation: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
        createdByActorId: z.ZodString;
        createdAt: z.ZodString;
        updatedAt: z.ZodString;
    }, z.core.$strip>;
    created: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type TrajectoryResponse = z.infer<typeof TrajectoryResponse>;
export declare const AppendEventRequest: z.ZodObject<{
    type: z.ZodString;
    objectType: z.ZodString;
    objectId: z.ZodString;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type AppendEventRequest = z.infer<typeof AppendEventRequest>;
export declare const EventResponse: z.ZodObject<{
    event: z.ZodObject<{
        id: z.ZodString;
        type: z.ZodString;
        actorId: z.ZodString;
        objectType: z.ZodString;
        objectId: z.ZodString;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        createdAt: z.ZodString;
    }, z.core.$strip>;
}, z.core.$strip>;
export type EventResponse = z.infer<typeof EventResponse>;
