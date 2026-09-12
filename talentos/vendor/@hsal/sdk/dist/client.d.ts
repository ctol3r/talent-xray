import type { AppendEventRequest, CreateBeliefRequest, CreateBeliefResponse, CreateDecisionCaseRequest, CreateEvidenceRequest, CreateStateRequest, CreateTrajectoryRequest, DecisionCase, DecisionCaseContext, DecisionCaseResponse, EnsureActorRequest, EnsureActorResponse, EventResponse, ExplanatoryModel, Intervention, InterventionResponse, ModelResponse, ReviseBeliefRequest, ReviseBeliefResponse, SelectInterventionRequest, State, StateResponse, Trajectory, TrajectoryResponse, UpsertInterventionRequest, UpsertModelRequest, AssessmentResponse, Belief, BeliefContext, BeliefEvidenceResponse, CaptureEvidenceRequest, CaptureEvidenceResponse, CreateAssessmentRequest, ErrorResponse, EventsQuery, EventsResponse, Evidence, HealthResponse, PairResponse, RelationResponse, ReviewRelationRequest, UpdateConfidenceRequest, WhoAmIResponse } from "@hsal/protocol";
export declare const DEFAULT_GATEWAY_URL = "http://127.0.0.1:4271";
export interface HSALClientOptions {
    baseUrl?: string;
    token?: string;
    fetch?: typeof fetch;
}
export declare class HSALClientError extends Error {
    readonly status: number;
    readonly code: string;
    readonly details: unknown;
    constructor(status: number, body: Partial<ErrorResponse> | undefined, fallback: string);
}
/**
 * Thin typed client for the HSAL State Gateway. Works in browsers (extension)
 * and Node (MCP server, CLI, tests). No provider-specific logic lives here.
 */
export declare class HSALClient {
    readonly baseUrl: string;
    private token;
    private readonly fetchImpl;
    constructor(options?: HSALClientOptions);
    setToken(token: string | undefined): void;
    private request;
    health(): Promise<HealthResponse>;
    /** Exchange a pairing code for a token. Also installs the token on this client. */
    pair(code: string): Promise<PairResponse>;
    whoami(): Promise<WhoAmIResponse>;
    listBeliefs(): Promise<Belief[]>;
    getBelief(beliefId: string): Promise<Belief>;
    getBeliefEvidence(beliefId: string): Promise<BeliefEvidenceResponse>;
    getBeliefContext(beliefId: string): Promise<BeliefContext>;
    listAssessments(beliefId: string): Promise<{
        id: string;
        targetBeliefId: string;
        actorId: string;
        stance: "supports" | "contradicts" | "mixed" | "uncertain";
        reasoningSummary: string;
        evidenceIds: string[];
        missingEvidence: string[];
        createdAt: string;
        confidence?: number | undefined;
    }[]>;
    /** Human-only. Requires belief:update-confidence. */
    updateConfidence(beliefId: string, body: UpdateConfidenceRequest): Promise<Belief>;
    getEvidence(evidenceId: string): Promise<Evidence>;
    captureEvidence(body: CaptureEvidenceRequest): Promise<CaptureEvidenceResponse>;
    getRelation(relationId: string): Promise<RelationResponse>;
    reviewRelation(relationId: string, body: ReviewRelationRequest): Promise<RelationResponse>;
    createAssessment(body: CreateAssessmentRequest): Promise<AssessmentResponse>;
    ensureActor(body: EnsureActorRequest): Promise<EnsureActorResponse>;
    createDecisionCase(body: CreateDecisionCaseRequest): Promise<DecisionCaseResponse>;
    getDecisionCase(id: string): Promise<DecisionCase>;
    getDecisionCaseContext(id: string): Promise<DecisionCaseContext>;
    listModels(decisionCaseId: string): Promise<ExplanatoryModel[]>;
    listInterventions(decisionCaseId: string): Promise<Intervention[]>;
    createState(body: CreateStateRequest): Promise<StateResponse>;
    getState(id: string): Promise<State>;
    createBelief(body: CreateBeliefRequest): Promise<CreateBeliefResponse>;
    reviseBelief(beliefId: string, body: ReviseBeliefRequest): Promise<ReviseBeliefResponse>;
    listRevisions(beliefId: string): Promise<{
        id: string;
        beliefId: string;
        previousConfidence: number;
        newConfidence: number;
        reason: string;
        evidenceIds: string[];
        actorId: string;
        createdAt: string;
        viaActorId?: string | undefined;
    }[]>;
    createEvidence(body: CreateEvidenceRequest): Promise<CaptureEvidenceResponse>;
    upsertModel(body: UpsertModelRequest): Promise<ModelResponse>;
    getModel(id: string): Promise<ExplanatoryModel>;
    upsertIntervention(body: UpsertInterventionRequest): Promise<InterventionResponse>;
    getIntervention(id: string): Promise<Intervention>;
    selectIntervention(id: string, body: SelectInterventionRequest): Promise<InterventionResponse>;
    createTrajectory(body: CreateTrajectoryRequest): Promise<TrajectoryResponse>;
    getTrajectory(id: string): Promise<Trajectory>;
    appendEvent(body: AppendEventRequest): Promise<EventResponse>;
    listEvents(query?: Partial<EventsQuery>): Promise<EventsResponse["events"]>;
}
