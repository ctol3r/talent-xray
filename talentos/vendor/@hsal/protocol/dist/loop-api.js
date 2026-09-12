/**
 * HTTP DTOs for the decision-loop routes.
 */
import { z } from "zod";
import { Actor, ActorType, Belief, BeliefEvidenceRelation, BeliefStatus, EpistemicStatus, Evidence, EvidenceSourceType, HSALEvent, ModelAssessment, confidence, isoDateTime, } from "./ontology.js";
import { DecisionCase, DecisionCaseStatus, ExperimentDesign, ExplanatoryModel, Intervention, InterventionStatus, Level, ModelAssumption, ModelPrediction, ModelStatus, ModelSupport, Reversibility, State, StateDimension, StateStatus, Trajectory, TrajectoryOutcome, TrajectoryStatus, Uncertainty, BeliefRevision, objectId, } from "./loop.js";
// ---------------------------------------------------------------- actors
export const EnsureActorRequest = z.object({
    id: objectId,
    type: ActorType,
    host: z.string().optional(),
    modelLabel: z.string().optional(),
});
export const EnsureActorResponse = z.object({ actor: Actor, created: z.boolean() });
// ---------------------------------------------------------------- decision cases
export const CreateDecisionCaseRequest = z.object({
    id: objectId.optional(),
    title: z.string().min(1),
    question: z.string().min(1),
    objective: z.string().min(1),
    scopeRef: z.string().min(1),
    status: DecisionCaseStatus.default("exploring"),
});
export const DecisionCaseResponse = z.object({ decisionCase: DecisionCase, created: z.boolean().optional() });
export const DecisionCaseContext = z.object({
    decisionCase: DecisionCase,
    states: z.array(State),
    beliefs: z.array(Belief),
    evidence: z.array(Evidence),
    relations: z.array(BeliefEvidenceRelation),
    models: z.array(ExplanatoryModel),
    interventions: z.array(Intervention),
    trajectories: z.array(Trajectory),
    assessments: z.array(ModelAssessment),
    revisions: z.array(BeliefRevision),
    notice: z.string(),
});
// ---------------------------------------------------------------- states
export const CreateStateRequest = z.object({
    id: objectId.optional(),
    decisionCaseId: z.string().min(1),
    label: z.string().min(1),
    timestamp: isoDateTime.optional(),
    status: StateStatus,
    dimensions: z.array(StateDimension),
    uncertainty: Uncertainty,
    sourceRefs: z.array(z.string()).default([]),
});
export const StateResponse = z.object({ state: State, created: z.boolean().optional() });
// ---------------------------------------------------------------- beliefs
export const CreateBeliefRequest = z.object({
    id: objectId.optional(),
    decisionCaseId: z.string().optional(),
    statement: z.string().min(1),
    /** Must be an existing human actor. */
    holderActorId: z.string().min(1),
    confidence,
    status: BeliefStatus.default("active"),
});
export const CreateBeliefResponse = z.object({ belief: Belief, created: z.boolean() });
export const ReviseBeliefRequest = z.object({
    /** Optimistic-concurrency guard: must equal the belief's current confidence. */
    previousConfidence: confidence,
    newConfidence: confidence,
    reason: z.string().min(1),
    evidenceIds: z.array(z.string()).default([]),
    /** The human doing the revising (must be the holder). */
    actorId: z.string().min(1),
});
export const ReviseBeliefResponse = z.object({ revision: BeliefRevision, belief: Belief });
export const RevisionListResponse = z.object({ revisions: z.array(BeliefRevision) });
// ---------------------------------------------------------------- evidence (generic create)
export const CreateEvidenceRequest = z.object({
    id: objectId.optional(),
    decisionCaseId: z.string().optional(),
    content: z.string().min(1).max(20_000),
    sourceType: EvidenceSourceType.default("observation"),
    sourceKind: z.string().optional(),
    sourceRef: z.string().optional(),
    sourceUrl: z.string().optional(),
    sourceTitle: z.string().optional(),
    observedAt: isoDateTime.optional(),
    capturedAt: isoDateTime.optional(),
    epistemicStatus: EpistemicStatus.default("observed"),
    /** Skip the relation proposer (default true for domain ingestion). */
    propose: z.boolean().default(false),
});
// ---------------------------------------------------------------- models
export const UpsertModelRequest = z.object({
    id: objectId,
    decisionCaseId: z.string().min(1),
    kind: z.string().min(1),
    name: z.string().min(1),
    explanation: z.string().min(1),
    assumptions: z.array(ModelAssumption).default([]),
    predictions: z.array(ModelPrediction).default([]),
    evidenceForIds: z.array(z.string()).default([]),
    evidenceAgainstIds: z.array(z.string()).default([]),
    assessment: ModelSupport.optional(),
    status: ModelStatus.default("candidate"),
});
export const ModelResponse = z.object({ model: ExplanatoryModel, created: z.boolean().optional() });
export const ModelListResponse = z.object({ models: z.array(ExplanatoryModel) });
// ---------------------------------------------------------------- interventions
export const UpsertInterventionRequest = z.object({
    id: objectId,
    decisionCaseId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    sourceStateId: z.string().min(1),
    actionType: z.string().min(1),
    parameters: z.record(z.string(), z.unknown()).default({}),
    intendedOutcome: z.string().min(1),
    affectedDimensions: z.array(z.string()).default([]),
    cost: Level,
    reversibility: Reversibility,
    /** Applied on create only; lifecycle changes go through dedicated routes. */
    status: InterventionStatus.default("proposed"),
    experiment: ExperimentDesign.optional(),
});
export const InterventionResponse = z.object({ intervention: Intervention, created: z.boolean().optional() });
export const InterventionListResponse = z.object({ interventions: z.array(Intervention) });
export const SelectInterventionRequest = z.object({
    /** The human selecting. */
    actorId: z.string().min(1),
    note: z.string().optional(),
});
// ---------------------------------------------------------------- trajectories
export const CreateTrajectoryRequest = z.object({
    id: objectId.optional(),
    decisionCaseId: z.string().min(1),
    originStateId: z.string().min(1),
    interventionIds: z.array(z.string()).default([]),
    stateIds: z.array(z.string()).default([]),
    startedAt: isoDateTime.optional(),
    status: TrajectoryStatus.default("active"),
    outcomes: z.array(TrajectoryOutcome).default([]),
});
export const TrajectoryResponse = z.object({ trajectory: Trajectory, created: z.boolean().optional() });
// ---------------------------------------------------------------- events (append)
export const AppendEventRequest = z.object({
    type: z.string().min(1).max(120),
    objectType: z.string().min(1),
    objectId: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
});
export const EventResponse = z.object({ event: HSALEvent });
