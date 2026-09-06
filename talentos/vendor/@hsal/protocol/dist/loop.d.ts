/**
 * Decision-loop ontology (domain-general).
 *
 * DecisionCase → State → Belief → Evidence → ExplanatoryModel → Intervention
 * → Trajectory → BeliefRevision. Domain vocabulary (recruiting, health, …)
 * travels as opaque tags: `scopeRef`, `kind`, `actionType`, `sourceKind`,
 * `sourceRef`, and JSON `parameters`. HSAL stores and audits; it does not
 * interpret the domain.
 */
import { z } from "zod";
/** Client-suppliable object id (e.g. DC-SP104, M-SP104-PROFILE). */
export declare const objectId: z.ZodString;
export declare const scalar: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
export type Scalar = z.infer<typeof scalar>;
export declare const Level: z.ZodEnum<{
    low: "low";
    medium: "medium";
    high: "high";
}>;
export type Level = z.infer<typeof Level>;
export declare const DecisionCaseStatus: z.ZodEnum<{
    exploring: "exploring";
    ready: "ready";
    decided: "decided";
    resolved: "resolved";
}>;
export type DecisionCaseStatus = z.infer<typeof DecisionCaseStatus>;
export declare const DecisionCase: z.ZodObject<{
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
export type DecisionCase = z.infer<typeof DecisionCase>;
export declare const StateStatus: z.ZodEnum<{
    actual: "actual";
    historical: "historical";
    estimated: "estimated";
    simulated: "simulated";
    counterfactual: "counterfactual";
}>;
export type StateStatus = z.infer<typeof StateStatus>;
export declare const DimensionEpistemicStatus: z.ZodEnum<{
    observed: "observed";
    user_asserted: "user_asserted";
    inferred: "inferred";
    simulated: "simulated";
}>;
export type DimensionEpistemicStatus = z.infer<typeof DimensionEpistemicStatus>;
export declare const StateDimension: z.ZodObject<{
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
}, z.core.$strip>;
export type StateDimension = z.infer<typeof StateDimension>;
export declare const Uncertainty: z.ZodObject<{
    level: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    notes: z.ZodOptional<z.ZodString>;
    unknowns: z.ZodDefault<z.ZodArray<z.ZodString>>;
}, z.core.$strip>;
export type Uncertainty = z.infer<typeof Uncertainty>;
export declare const State: z.ZodObject<{
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
export type State = z.infer<typeof State>;
export declare const ModelStatus: z.ZodEnum<{
    active: "active";
    rejected: "rejected";
    candidate: "candidate";
    weakened: "weakened";
    strengthened: "strengthened";
}>;
export type ModelStatus = z.infer<typeof ModelStatus>;
export declare const ModelAssumption: z.ZodObject<{
    statement: z.ZodString;
    confidence: z.ZodOptional<z.ZodNumber>;
    sensitivity: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
}, z.core.$strip>;
export type ModelAssumption = z.infer<typeof ModelAssumption>;
export declare const ModelPrediction: z.ZodObject<{
    statement: z.ZodString;
    validationCondition: z.ZodString;
    resolved: z.ZodOptional<z.ZodBoolean>;
    outcome: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export type ModelPrediction = z.infer<typeof ModelPrediction>;
/** Support is a qualitative judgement, deliberately not an objective probability. */
export declare const ModelSupport: z.ZodObject<{
    support: z.ZodEnum<{
        low: "low";
        medium: "medium";
        high: "high";
    }>;
    confidence: z.ZodOptional<z.ZodNumber>;
    reasoning: z.ZodString;
}, z.core.$strip>;
export type ModelSupport = z.infer<typeof ModelSupport>;
export declare const ExplanatoryModel: z.ZodObject<{
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
export type ExplanatoryModel = z.infer<typeof ExplanatoryModel>;
export declare const InterventionStatus: z.ZodEnum<{
    proposed: "proposed";
    selected: "selected";
    executing: "executing";
    completed: "completed";
    cancelled: "cancelled";
}>;
export type InterventionStatus = z.infer<typeof InterventionStatus>;
export declare const Reversibility: z.ZodEnum<{
    easy: "easy";
    moderate: "moderate";
    difficult: "difficult";
    irreversible: "irreversible";
}>;
export type Reversibility = z.infer<typeof Reversibility>;
/** Present when the intervention is designed as an experiment to reduce uncertainty. */
export declare const ExperimentDesign: z.ZodObject<{
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
}, z.core.$strip>;
export type ExperimentDesign = z.infer<typeof ExperimentDesign>;
export declare const Intervention: z.ZodObject<{
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
export type Intervention = z.infer<typeof Intervention>;
export declare const TrajectoryStatus: z.ZodEnum<{
    active: "active";
    completed: "completed";
    invalidated: "invalidated";
}>;
export type TrajectoryStatus = z.infer<typeof TrajectoryStatus>;
export declare const TrajectoryOutcome: z.ZodObject<{
    key: z.ZodString;
    before: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
    after: z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull]>;
    interpretation: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TrajectoryOutcome = z.infer<typeof TrajectoryOutcome>;
export declare const Trajectory: z.ZodObject<{
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
export type Trajectory = z.infer<typeof Trajectory>;
export declare const BeliefRevision: z.ZodObject<{
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
export type BeliefRevision = z.infer<typeof BeliefRevision>;
