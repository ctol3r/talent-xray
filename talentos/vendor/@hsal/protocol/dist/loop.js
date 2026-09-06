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
import { confidence, isoDateTime } from "./ontology.js";
/** Client-suppliable object id (e.g. DC-SP104, M-SP104-PROFILE). */
export const objectId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/, "invalid object id");
export const scalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const Level = z.enum(["low", "medium", "high"]);
// ---------------------------------------------------------------- DecisionCase
export const DecisionCaseStatus = z.enum(["exploring", "ready", "decided", "resolved"]);
export const DecisionCase = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    question: z.string().min(1),
    objective: z.string().min(1),
    /** Opaque reference into the owning domain, e.g. talentos:search-project:SP104 */
    scopeRef: z.string().min(1),
    status: DecisionCaseStatus,
    createdByActorId: z.string().min(1),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
});
// ---------------------------------------------------------------- State
export const StateStatus = z.enum(["actual", "historical", "estimated", "simulated", "counterfactual"]);
export const DimensionEpistemicStatus = z.enum(["observed", "user_asserted", "inferred", "simulated"]);
export const StateDimension = z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    value: scalar,
    unit: z.string().optional(),
    epistemicStatus: DimensionEpistemicStatus,
});
export const Uncertainty = z.object({
    level: Level,
    notes: z.string().optional(),
    unknowns: z.array(z.string()).default([]),
});
export const State = z.object({
    id: z.string().min(1),
    decisionCaseId: z.string().min(1),
    label: z.string().min(1),
    timestamp: isoDateTime,
    status: StateStatus,
    dimensions: z.array(StateDimension),
    uncertainty: Uncertainty,
    sourceRefs: z.array(z.string()),
    createdByActorId: z.string().min(1),
    createdAt: isoDateTime,
});
// ---------------------------------------------------------------- ExplanatoryModel
export const ModelStatus = z.enum(["candidate", "active", "weakened", "strengthened", "rejected"]);
export const ModelAssumption = z.object({
    statement: z.string().min(1),
    confidence: confidence.optional(),
    sensitivity: Level,
});
export const ModelPrediction = z.object({
    statement: z.string().min(1),
    validationCondition: z.string().min(1),
    resolved: z.boolean().optional(),
    outcome: z.boolean().optional(),
});
/** Support is a qualitative judgement, deliberately not an objective probability. */
export const ModelSupport = z.object({
    support: Level,
    confidence: confidence.optional(),
    reasoning: z.string().min(1),
});
export const ExplanatoryModel = z.object({
    id: z.string().min(1),
    decisionCaseId: z.string().min(1),
    /** Domain tag, e.g. success_profile, talent_supply. Opaque to HSAL. */
    kind: z.string().min(1),
    name: z.string().min(1),
    explanation: z.string().min(1),
    assumptions: z.array(ModelAssumption),
    predictions: z.array(ModelPrediction),
    evidenceForIds: z.array(z.string()),
    evidenceAgainstIds: z.array(z.string()),
    assessment: ModelSupport.optional(),
    status: ModelStatus,
    proposedByActorId: z.string().min(1),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
});
// ---------------------------------------------------------------- Intervention
export const InterventionStatus = z.enum(["proposed", "selected", "executing", "completed", "cancelled"]);
export const Reversibility = z.enum(["easy", "moderate", "difficult", "irreversible"]);
/** Present when the intervention is designed as an experiment to reduce uncertainty. */
export const ExperimentDesign = z.object({
    hypothesis: z.string().min(1),
    discriminatesBetweenModelIds: z.array(z.string()),
    expectedInformationGain: Level,
    durationEstimate: z.string().optional(),
    rationale: z.string().min(1),
    successConditions: z.array(z.string()),
    failureConditions: z.array(z.string()),
});
export const Intervention = z.object({
    id: z.string().min(1),
    decisionCaseId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    sourceStateId: z.string().min(1),
    /** Domain tag, e.g. calibration_test. Opaque to HSAL. */
    actionType: z.string().min(1),
    parameters: z.record(z.string(), z.unknown()),
    intendedOutcome: z.string().min(1),
    affectedDimensions: z.array(z.string()),
    cost: Level,
    reversibility: Reversibility,
    status: InterventionStatus,
    experiment: ExperimentDesign.optional(),
    proposedByActorId: z.string().min(1),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
    selectedAt: isoDateTime.optional(),
    selectedByActorId: z.string().optional(),
});
// ---------------------------------------------------------------- Trajectory
export const TrajectoryStatus = z.enum(["active", "completed", "invalidated"]);
export const TrajectoryOutcome = z.object({
    key: z.string().min(1),
    before: scalar,
    after: scalar,
    interpretation: z.string().optional(),
});
export const Trajectory = z.object({
    id: z.string().min(1),
    decisionCaseId: z.string().min(1),
    originStateId: z.string().min(1),
    interventionIds: z.array(z.string()),
    stateIds: z.array(z.string()),
    startedAt: isoDateTime,
    status: TrajectoryStatus,
    outcomes: z.array(TrajectoryOutcome),
    createdByActorId: z.string().min(1),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
});
// ---------------------------------------------------------------- BeliefRevision
export const BeliefRevision = z.object({
    id: z.string().min(1),
    beliefId: z.string().min(1),
    previousConfidence: confidence,
    newConfidence: confidence,
    reason: z.string(),
    evidenceIds: z.array(z.string()),
    /** The human who revised. */
    actorId: z.string().min(1),
    /** The client/agent that carried the human's decision, if any. */
    viaActorId: z.string().optional(),
    createdAt: isoDateTime,
});
