/**
 * TalentOSHSALAdapter — the only place TalentOS talks to HSAL, via @hsal/sdk.
 *
 * Every method leaves an auditable trail in HSAL's event log. No method ever
 * writes belief confidence except `reviseBelief`, which requires an explicit
 * human actor and the currently-held confidence.
 */
import type {
  Belief,
  ExplanatoryModel,
  HSALClient,
  Intervention,
  State,
  Trajectory,
  TrajectoryOutcome,
  BeliefRevision as HSALBeliefRevision,
} from "@hsal/sdk";
import { computePipelineMetrics, largestDrop, type StageDrop } from "./metrics";
import { toDecisionCaseRequest } from "./mapping/decision-case";
import {
  candidateEvidenceRequests,
  experimentEvidenceRequests,
  hmFeedbackEvidenceRequests,
  toEvidenceView,
} from "./mapping/evidence";
import { dimensionValue, toHSALStateRequest } from "./mapping/state";
import { generateDeterministicModels, strongestModel } from "./diagnosis/rules";
import {
  generateCandidateTests,
  rankTests,
  TEST_SCORE_WEIGHTS,
  type RankedTest,
} from "./diagnosis/tests";
import { mergeAIModels, type DiagnosisReasoningProvider } from "./diagnosis/ai";
import { decisionCaseIdFor, stateIdForSnapshot, trajectoryIdFor } from "./refs";
import { rankLearnings, type BindingStore, type LearningStore } from "./stores";
import {
  beliefRevisionInputSchema,
  candidateSearchEvidenceSchema,
  experimentResultSchema,
  hiringManagerFeedbackSchema,
  recruiterBeliefInputSchema,
  searchLearningSchema,
  type BeliefRevisionInput,
  type CandidateSearchEvidence,
  type ExperimentResult,
  type HSALEvidenceView,
  type HiringManagerFeedback,
  type PipelineSnapshot,
  type RecruiterBeliefInput,
  type SearchDiagnosisModel,
  type SearchHSALBinding,
  type SearchLearning,
  type SearchLearningQuery,
  type SearchProject,
  type SuccessProfile,
  type TestScoreWeights,
  type CandidateTest,
} from "./types";

export interface BestNextTest {
  id: string;
  decisionCaseId: string;
  title: string;
  hypothesis: string;
  discriminatesBetweenModelIds: string[];
  intervention: Intervention;
  expectedInformationGain: "low" | "medium" | "high";
  cost: "low" | "medium" | "high";
  reversibility: Intervention["reversibility"];
  durationEstimate?: string;
  rationale: string;
  successConditions: string[];
  failureConditions: string[];
  protocol: string[];
  score: number;
}

export interface SearchDiagnosisResult {
  searchProjectId: string;
  decisionCaseId: string;
  currentState: State;
  activeBeliefs: Belief[];
  models: SearchDiagnosisModel[];
  strongestModelId?: string;
  recommendedNextTest?: BestNextTest;
  candidateTests: BestNextTest[];
  largestDrop?: StageDrop;
  evidence: HSALEvidenceView[];
  missingEvidence: string[];
  generatedAt: string;
}

/** What TalentOS must supply about its own domain. */
export interface DomainSource {
  getSearchProject(searchProjectId: string): Promise<SearchProject | undefined>;
  getLatestSnapshot(
    searchProjectId: string,
  ): Promise<PipelineSnapshot | undefined>;
  getCandidateEvidence(
    searchProjectId: string,
  ): Promise<CandidateSearchEvidence[]>;
  getHMFeedback(searchProjectId: string): Promise<HiringManagerFeedback[]>;
}

export interface TalentOSHSALAdapter {
  initializeSearchCase(
    searchProject: SearchProject,
  ): Promise<SearchHSALBinding>;
  syncPipelineState(
    searchProject: SearchProject,
    snapshot: PipelineSnapshot,
  ): Promise<State>;
  captureRecruiterBelief(input: RecruiterBeliefInput): Promise<Belief>;
  ingestCandidateEvidence(
    input: CandidateSearchEvidence,
  ): Promise<HSALEvidenceView[]>;
  ingestHMFeedback(input: HiringManagerFeedback): Promise<HSALEvidenceView[]>;
  diagnoseSearch(searchProjectId: string): Promise<SearchDiagnosisResult>;
  selectIntervention(
    interventionId: string,
    actorId: string,
  ): Promise<Intervention>;
  ingestExperimentResult(result: ExperimentResult): Promise<HSALEvidenceView[]>;
  recordSuccessProfileChange(
    searchProjectId: string,
    before: SuccessProfile,
    after: SuccessProfile,
    actorId: string,
    interventionId?: string,
  ): Promise<HSALEvidenceView>;
  recordPostInterventionState(
    searchProject: SearchProject,
    snapshot: PipelineSnapshot,
    interventionId: string,
  ): Promise<Trajectory>;
  reviseBelief(input: BeliefRevisionInput): Promise<HSALBeliefRevision>;
  createSearchLearning(input: SearchLearning): Promise<SearchLearning>;
  findRelevantSearchLearnings(
    query: SearchLearningQuery,
  ): Promise<SearchLearning[]>;
  getBinding(searchProjectId: string): Promise<SearchHSALBinding | undefined>;
}

export interface AdapterOptions {
  client: HSALClient;
  domain: DomainSource;
  bindings: BindingStore;
  learnings: LearningStore;
  /** Actor id of this TalentOS instance in HSAL. Must match the capability token's actor. */
  agentActorId?: string;
  reasoning?: DiagnosisReasoningProvider;
  weights?: TestScoreWeights;
  now?: () => string;
}

export const TALENTOS_EVENTS = {
  caseBound: "talentos.search_case.bound",
  pipelineIngested: "pipeline.state.ingested",
  candidateEvidence: "candidate.evidence.ingested",
  hmEvidence: "hm_feedback.evidence.ingested",
  modelsGenerated: "diagnosis.models.generated",
  experimentIngested: "experiment.result.ingested",
  profileChanged: "talentos.success_profile.changed",
  learningCreated: "search_learning.created",
} as const;

export function createTalentOSHSALAdapter(
  options: AdapterOptions,
): TalentOSHSALAdapter {
  const { client, domain, bindings, learnings } = options;
  const agent = options.agentActorId ?? "agent:talentos";
  const now = options.now ?? (() => new Date().toISOString());
  const weights = options.weights ?? TEST_SCORE_WEIGHTS;

  const log = (
    type: string,
    objectType: string,
    objectId: string,
    metadata?: Record<string, unknown>,
  ) =>
    client.appendEvent({
      type,
      objectType,
      objectId,
      ...(metadata ? { metadata } : {}),
    });

  async function requireBinding(
    searchProjectId: string,
  ): Promise<SearchHSALBinding> {
    const existing = await bindings.get(searchProjectId);
    if (existing) return existing;
    const project = await domain.getSearchProject(searchProjectId);
    if (!project)
      throw new Error(`search project ${searchProjectId} not found`);
    return adapter.initializeSearchCase(project);
  }

  async function ensureHuman(actorId: string): Promise<void> {
    if (!actorId.startsWith("human:"))
      throw new Error(
        `actorId must be a human actor (human:…), got ${actorId}`,
      );
    await client.ensureActor({ id: actorId, type: "human" });
  }

  const toBest = (
    r: RankedTest,
    intervention: Intervention,
    decisionCaseId: string,
  ): BestNextTest => ({
    id: r.test.id,
    decisionCaseId,
    title: r.test.title,
    hypothesis: r.test.hypothesis,
    discriminatesBetweenModelIds: r.test.discriminatesBetweenModelIds,
    intervention,
    expectedInformationGain: r.test.expectedInformationGain,
    cost: r.test.cost,
    reversibility: r.test.reversibility,
    durationEstimate: r.test.durationEstimate,
    rationale: r.test.rationale,
    successConditions: r.test.successConditions,
    failureConditions: r.test.failureConditions,
    protocol: r.test.protocol,
    score: r.score,
  });

  const adapter: TalentOSHSALAdapter = {
    getBinding: (id) => bindings.get(id),

    async initializeSearchCase(project) {
      const existing = await bindings.get(project.id);
      if (existing) return existing;
      await client.ensureActor({ id: agent, type: "agent", host: "talentos" });
      const res = await client.createDecisionCase(
        toDecisionCaseRequest(project),
      );
      const ts = now();
      const binding: SearchHSALBinding = {
        searchProjectId: project.id,
        hsalDecisionCaseId: res.decisionCase.id,
        createdAt: ts,
        updatedAt: ts,
      };
      await bindings.save(binding);
      await log(TALENTOS_EVENTS.caseBound, "search_project", project.id, {
        decisionCaseId: res.decisionCase.id,
        created: res.created ?? false,
        source: "talentos",
      });
      return binding;
    },

    async syncPipelineState(project, snapshot) {
      const binding = await requireBinding(project.id);
      const req = toHSALStateRequest(project, snapshot);
      req.decisionCaseId = binding.hsalDecisionCaseId;
      const res = await client.createState(req);
      if (res.created) {
        await log(
          TALENTOS_EVENTS.pipelineIngested,
          "pipeline_snapshot",
          snapshot.id,
          {
            stateId: res.state.id,
            source: snapshot.source,
            metrics: computePipelineMetrics(snapshot.counts),
          },
        );
      }
      return res.state;
    },

    async captureRecruiterBelief(raw) {
      const input = recruiterBeliefInputSchema.parse(raw);
      const binding = await requireBinding(input.searchProjectId);
      await ensureHuman(input.actorId);
      const res = await client.createBelief({
        ...(input.id ? { id: input.id } : {}),
        decisionCaseId: binding.hsalDecisionCaseId,
        statement: input.statement,
        holderActorId: input.actorId,
        confidence: input.confidence,
        status: "active",
      });
      return res.belief;
    },

    async ingestCandidateEvidence(raw) {
      const input = candidateSearchEvidenceSchema.parse(raw);
      const binding = await requireBinding(input.searchProjectId);
      const out: HSALEvidenceView[] = [];
      let created = 0;
      for (const req of candidateEvidenceRequests(input)) {
        req.decisionCaseId = binding.hsalDecisionCaseId;
        const res = await client.createEvidence(req);
        if (!res.deduplicated) created += 1;
        out.push(toEvidenceView(res.evidence));
      }
      if (created > 0)
        await log(
          TALENTOS_EVENTS.candidateEvidence,
          "candidate",
          input.candidateId,
          {
            searchProjectId: input.searchProjectId,
            evidenceIds: out.map((e) => e.id),
            created,
            source: "talentos",
          },
        );
      return out;
    },

    async ingestHMFeedback(raw) {
      const input = hiringManagerFeedbackSchema.parse(raw);
      const binding = await requireBinding(input.searchProjectId);
      const out: HSALEvidenceView[] = [];
      let created = 0;
      for (const req of hmFeedbackEvidenceRequests(input)) {
        req.decisionCaseId = binding.hsalDecisionCaseId;
        const res = await client.createEvidence(req);
        if (!res.deduplicated) created += 1;
        out.push(toEvidenceView(res.evidence));
      }
      if (created > 0)
        await log(TALENTOS_EVENTS.hmEvidence, "hm_feedback", input.id, {
          searchProjectId: input.searchProjectId,
          candidateId: input.candidateId ?? null,
          disposition: input.disposition ?? null,
          evidenceIds: out.map((e) => e.id),
          source: "talentos",
        });
      return out;
    },

    async diagnoseSearch(searchProjectId) {
      const project = await domain.getSearchProject(searchProjectId);
      if (!project)
        throw new Error(`search project ${searchProjectId} not found`);
      const snapshot = await domain.getLatestSnapshot(searchProjectId);
      if (!snapshot)
        throw new Error(`no pipeline snapshot for ${searchProjectId}`);
      const binding = await requireBinding(searchProjectId);
      const currentState = await adapter.syncPipelineState(project, snapshot);
      const [candidates, hmFeedback] = await Promise.all([
        domain.getCandidateEvidence(searchProjectId),
        domain.getHMFeedback(searchProjectId),
      ]);
      const ctx = await client.getDecisionCaseContext(
        binding.hsalDecisionCaseId,
      );
      const knownEvidenceIds = new Set(ctx.evidence.map((e) => e.id));
      const beliefsBefore = ctx.beliefs.map((b) => ({
        id: b.id,
        confidence: b.confidence,
      }));

      let models = generateDeterministicModels({
        project,
        snapshot,
        candidates,
        hmFeedback,
        knownEvidenceIds,
      });
      let missingEvidence: string[] = [];
      if (options.reasoning) {
        try {
          const raw = await options.reasoning.generateDiagnosisModels({
            state: currentState,
            beliefs: ctx.beliefs,
            evidence: ctx.evidence.map(toEvidenceView),
            deterministicCandidates: models,
          });
          const merged = mergeAIModels(
            searchProjectId,
            models,
            raw,
            knownEvidenceIds,
          );
          models = merged.models;
          missingEvidence = merged.missingEvidence;
        } catch {
          // Provider failure never blocks the deterministic path.
        }
      }

      const stored: ExplanatoryModel[] = [];
      for (const m of models) {
        const res = await client.upsertModel({
          id: m.id,
          decisionCaseId: binding.hsalDecisionCaseId,
          kind: m.type,
          name: m.name,
          explanation: m.explanation,
          assumptions: m.assumptions,
          predictions: m.predictions,
          evidenceForIds: m.evidenceForIds,
          evidenceAgainstIds: m.evidenceAgainstIds,
          ...(m.assessment ? { assessment: m.assessment } : {}),
          status: m.status,
        });
        stored.push(res.model);
      }

      const candidateTests: CandidateTest[] = generateCandidateTests(
        searchProjectId,
        models,
      );
      const ranked = rankTests(candidateTests, models, weights);
      const existingInterventions = new Map(
        (await client.listInterventions(binding.hsalDecisionCaseId)).map(
          (i) => [i.id, i],
        ),
      );
      const tests: BestNextTest[] = [];
      for (const r of ranked) {
        const t = r.test;
        const res = await client.upsertIntervention({
          id: t.id,
          decisionCaseId: binding.hsalDecisionCaseId,
          name: t.title,
          description: t.description,
          sourceStateId: currentState.id,
          actionType: t.actionType,
          parameters: {
            ...t.parameters,
            protocol: t.protocol,
            score: r.score,
            normalized: r.normalized,
          },
          intendedOutcome: t.hypothesis,
          affectedDimensions: t.affectedDimensions,
          cost: t.cost,
          reversibility: t.reversibility,
          status: "proposed",
          experiment: {
            hypothesis: t.hypothesis,
            discriminatesBetweenModelIds: t.discriminatesBetweenModelIds,
            expectedInformationGain: t.expectedInformationGain,
            durationEstimate: t.durationEstimate,
            rationale: t.rationale,
            successConditions: t.successConditions,
            failureConditions: t.failureConditions,
          },
        });
        tests.push(
          toBest(
            r,
            existingInterventions.get(t.id) ?? res.intervention,
            binding.hsalDecisionCaseId,
          ),
        );
      }
      const recommended = tests.find(
        (t) =>
          t.intervention.status === "proposed" ||
          t.intervention.status === "selected",
      );

      await log(
        TALENTOS_EVENTS.modelsGenerated,
        "decision_case",
        binding.hsalDecisionCaseId,
        {
          searchProjectId,
          stateId: currentState.id,
          modelIds: stored.map((m) => m.id),
          support: Object.fromEntries(
            models.map((m) => [m.id, m.assessment?.support ?? null]),
          ),
          recommendedTestId: recommended?.id ?? null,
          provider: options.reasoning?.name ?? "deterministic",
          beliefsUnchanged: beliefsBefore,
        },
      );

      const after = await client.getDecisionCaseContext(
        binding.hsalDecisionCaseId,
      );
      const strongest = strongestModel(models);
      return {
        searchProjectId,
        decisionCaseId: binding.hsalDecisionCaseId,
        currentState,
        activeBeliefs: after.beliefs.filter(
          (b) => b.status === "active" || b.status === "contested",
        ),
        models,
        ...(strongest ? { strongestModelId: strongest.id } : {}),
        ...(recommended ? { recommendedNextTest: recommended } : {}),
        candidateTests: tests,
        ...(largestDrop(snapshot.counts)
          ? { largestDrop: largestDrop(snapshot.counts)! }
          : {}),
        evidence: after.evidence.map(toEvidenceView),
        missingEvidence,
        generatedAt: now(),
      };
    },

    async selectIntervention(interventionId, actorId) {
      await ensureHuman(actorId);
      const res = await client.selectIntervention(interventionId, {
        actorId,
        note: "Selected in TalentOS diagnosis view",
      });
      return res.intervention;
    },

    async ingestExperimentResult(raw) {
      const result = experimentResultSchema.parse(raw);
      const binding = await requireBinding(result.searchProjectId);
      const out: HSALEvidenceView[] = [];
      let created = 0;
      for (const req of experimentEvidenceRequests(result)) {
        req.decisionCaseId = binding.hsalDecisionCaseId;
        const res = await client.createEvidence(req);
        if (!res.deduplicated) created += 1;
        out.push(toEvidenceView(res.evidence));
      }
      if (created > 0) {
        await log(
          TALENTOS_EVENTS.experimentIngested,
          "intervention",
          result.interventionId,
          {
            resultId: result.id,
            searchProjectId: result.searchProjectId,
            evidenceIds: out.map((e) => e.id),
            metrics: result.metrics,
            summary: result.summary,
            source: "talentos",
          },
        );
        // Resolve predictions on the models this experiment discriminates between. Belief untouched.
        const intervention = await client.getIntervention(
          result.interventionId,
        );
        const advanceRate = result.metrics["advanceRate"];
        if (intervention.experiment && advanceRate !== undefined) {
          for (const modelId of intervention.experiment
            .discriminatesBetweenModelIds) {
            const m = await client.getModel(modelId).catch(() => undefined);
            if (!m) continue;
            const isProfile = m.kind === "success_profile";
            const isSupply = m.kind === "talent_supply";
            if (!isProfile && !isSupply) continue;
            const outcome = isProfile ? advanceRate >= 0.5 : advanceRate < 0.5;
            await client.upsertModel({
              ...m,
              predictions: m.predictions.map((p) => ({
                ...p,
                resolved: true,
                outcome,
              })),
              evidenceForIds: outcome
                ? [...new Set([...m.evidenceForIds, ...out.map((e) => e.id)])]
                : m.evidenceForIds,
              evidenceAgainstIds: outcome
                ? m.evidenceAgainstIds
                : [
                    ...new Set([
                      ...m.evidenceAgainstIds,
                      ...out.map((e) => e.id),
                    ]),
                  ],
              status: outcome ? "strengthened" : "weakened",
              ...(m.assessment
                ? {
                    assessment: {
                      ...m.assessment,
                      reasoning: `${m.assessment.reasoning} Experiment ${result.id}: ${result.summary}`,
                    },
                  }
                : {}),
            });
          }
        }
      }
      return out;
    },

    async recordSuccessProfileChange(
      searchProjectId,
      before,
      after,
      actorId,
      interventionId,
    ) {
      const binding = await requireBinding(searchProjectId);
      await ensureHuman(actorId);
      const removed = before.mustHave
        .filter((c) => !after.mustHave.some((a) => a.id === c.id))
        .map((c) => c.label);
      const added = after.mustHave
        .filter((c) => !before.mustHave.some((b) => b.id === c.id))
        .map((c) => c.label);
      const transferable = after.transferable
        .filter((c) => !before.transferable.some((b) => b.id === c.id))
        .map((c) => c.label);
      const content = `Recruiter changed the Success Profile. Must-have removed: ${removed.join("; ") || "none"}. Must-have added: ${added.join("; ") || "none"}. Now transferable: ${transferable.join("; ") || "none"}.`;
      const res = await client.createEvidence({
        id: `E-${searchProjectId}-PROFILE-CHANGE-${(await client.getDecisionCaseContext(binding.hsalDecisionCaseId)).evidence.filter((e) => e.sourceRef?.startsWith("talentos:success-profile-change")).length + 1}`,
        decisionCaseId: binding.hsalDecisionCaseId,
        content,
        sourceType: "user_statement",
        sourceKind: "talentos_pipeline",
        sourceRef: `talentos:success-profile-change:${searchProjectId}${interventionId ? `:${interventionId}` : ""}`,
        epistemicStatus: "user_asserted",
        propose: false,
      });
      await log(
        TALENTOS_EVENTS.profileChanged,
        "search_project",
        searchProjectId,
        {
          actorId,
          interventionId: interventionId ?? null,
          removed,
          added,
          transferable,
          evidenceId: res.evidence.id,
          source: "talentos",
          statement: "Applied by a human in TalentOS; not by HSAL or an AI.",
        },
      );
      return toEvidenceView(res.evidence);
    },

    async recordPostInterventionState(project, snapshot, interventionId) {
      const binding = await requireBinding(project.id);
      const intervention = await client.getIntervention(interventionId);
      const origin = await client.getState(intervention.sourceStateId);
      const state = await adapter.syncPipelineState(project, snapshot);
      const outcomes: TrajectoryOutcome[] = [];
      for (const dim of state.dimensions) {
        const before = dimensionValue(origin.dimensions, dim.key);
        if (before === undefined || dim.key.startsWith("bottleneck.")) continue;
        const outcome: TrajectoryOutcome = {
          key: dim.key,
          before,
          after: dim.value,
        };
        if (
          typeof before === "number" &&
          typeof dim.value === "number" &&
          before !== dim.value
        ) {
          outcome.interpretation = dim.key.startsWith("rate.")
            ? `${dim.label}: ${(before * 100).toFixed(1)}% → ${(dim.value * 100).toFixed(1)}%`
            : `${dim.label}: ${before} → ${dim.value}`;
        }
        outcomes.push(outcome);
      }
      const res = await client.createTrajectory({
        id: trajectoryIdFor(interventionId),
        decisionCaseId: binding.hsalDecisionCaseId,
        originStateId: origin.id,
        interventionIds: [interventionId],
        stateIds: [state.id],
        startedAt: intervention.selectedAt ?? intervention.createdAt,
        status: "active",
        outcomes,
      });
      return res.trajectory;
    },

    async reviseBelief(raw) {
      const input = beliefRevisionInputSchema.parse(raw);
      await ensureHuman(input.actorId);
      const res = await client.reviseBelief(input.beliefId, {
        previousConfidence: input.previousConfidence,
        newConfidence: input.newConfidence,
        reason: input.reason,
        evidenceIds: input.evidenceIds,
        actorId: input.actorId,
      });
      return res.revision;
    },

    async createSearchLearning(raw) {
      const learning = searchLearningSchema.parse(raw);
      const existing = await learnings.get(learning.id);
      if (existing) return existing;
      await learnings.save(learning);
      await log(
        TALENTOS_EVENTS.learningCreated,
        "search_learning",
        learning.id,
        {
          sourceSearchProjectId: learning.sourceSearchProjectId,
          category: learning.category,
          confidence: learning.confidence,
          evidenceIds: learning.evidenceIds,
          originatingBeliefIds: learning.originatingBeliefIds,
          originatingModelIds: learning.originatingModelIds,
          source: "talentos",
        },
      );
      return learning;
    },

    async findRelevantSearchLearnings(query) {
      return rankLearnings(await learnings.list(), query);
    },
  };
  return adapter;
}

/** Product-neutral aliases (the host app enforces that its own sources never hardcode the product name). */
export type HSALAdapter = TalentOSHSALAdapter;
export const createHSALAdapter = createTalentOSHSALAdapter;

export { stateIdForSnapshot, decisionCaseIdFor };
