/**
 * Read-only view model for the Diagnosis page. Reading never mutates HSAL;
 * generation happens only through explicit actions.
 */
import type {
  Belief,
  BeliefRevision,
  DecisionCaseContext,
  Evidence,
  ExplanatoryModel,
  Intervention,
  State,
  Trajectory,
} from "@hsal/sdk";
import {
  computePipelineMetrics,
  largestDrop,
  SUPPORT_RANK,
  type PipelineSnapshot,
  type SearchLearning,
  type StageDrop,
} from "@talentos/hsal-adapter";
import type { Db } from "@/lib/db/client";
import { getHSALStatus, type HSALStatus } from "./client";
import { getAppAdapter } from "./adapter";
import { DrizzleBindingStore, DrizzleLearningStore } from "./stores";
import { AppDomainSource } from "./domain-source";

export interface DiagnosisView {
  status: HSALStatus;
  bound: boolean;
  decisionCaseId?: string;
  snapshot?: PipelineSnapshot;
  metrics?: ReturnType<typeof computePipelineMetrics>;
  largestDrop?: StageDrop;
  currentState?: State;
  beliefs: Belief[];
  revisions: BeliefRevision[];
  models: ExplanatoryModel[];
  interventions: Intervention[];
  recommended?: Intervention;
  evidence: Evidence[];
  trajectories: Trajectory[];
  learnings: SearchLearning[];
  events: {
    type: string;
    actorId: string;
    objectId: string;
    createdAt: string;
  }[];
}

export async function loadDiagnosisView(
  db: Db,
  searchProjectId: string,
): Promise<DiagnosisView> {
  const status = await getHSALStatus();
  const domain = new AppDomainSource(db);
  const snapshot = await domain.getLatestSnapshot(searchProjectId);
  const learnings = (await new DrizzleLearningStore(db).list()).filter(
    (l) => l.sourceSearchProjectId === searchProjectId,
  );
  const base: DiagnosisView = {
    status,
    bound: false,
    beliefs: [],
    revisions: [],
    models: [],
    interventions: [],
    evidence: [],
    trajectories: [],
    learnings,
    events: [],
    ...(snapshot
      ? { snapshot, metrics: computePipelineMetrics(snapshot.counts) }
      : {}),
    ...(snapshot && largestDrop(snapshot.counts)
      ? { largestDrop: largestDrop(snapshot.counts)! }
      : {}),
  };
  if (!status.configured || !status.reachable) return base;
  const binding = await new DrizzleBindingStore(db).get(searchProjectId);
  if (!binding) return base;
  const { adapter } = getAppAdapter(db);
  void adapter;
  const { getHSALClient } = await import("./client");
  const client = getHSALClient();
  let ctx: DecisionCaseContext;
  try {
    ctx = await client.getDecisionCaseContext(binding.hsalDecisionCaseId);
  } catch (err) {
    return {
      ...base,
      status: {
        ...status,
        error: err instanceof Error ? err.message : String(err),
      },
    };
  }
  const models = [...ctx.models].sort(
    (a, b) =>
      SUPPORT_RANK[b.assessment?.support ?? "low"] -
      SUPPORT_RANK[a.assessment?.support ?? "low"],
  );
  const score = (i: Intervention) =>
    typeof i.parameters["score"] === "number"
      ? (i.parameters["score"] as number)
      : 0;
  const interventions = [...ctx.interventions].sort(
    (a, b) => score(b) - score(a),
  );
  const recommended =
    interventions.find((i) => i.status === "selected") ??
    interventions.find((i) => i.status === "proposed");
  const currentState = [...ctx.states].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  )[0];
  const events = (await client.listEvents({ limit: 300 })).filter(
    (e) =>
      e.objectId.includes(searchProjectId) ||
      e.objectId === binding.hsalDecisionCaseId ||
      ctx.beliefs.some((b) => b.id === e.objectId) ||
      ctx.interventions.some((i) => i.id === e.objectId) ||
      ctx.models.some((m) => m.id === e.objectId),
  );
  return {
    ...base,
    bound: true,
    decisionCaseId: binding.hsalDecisionCaseId,
    ...(currentState ? { currentState } : {}),
    beliefs: ctx.beliefs,
    revisions: ctx.revisions,
    models,
    interventions,
    ...(recommended ? { recommended } : {}),
    evidence: ctx.evidence,
    trajectories: ctx.trajectories,
    events: events.map((e) => ({
      type: e.type,
      actorId: e.actorId,
      objectId: e.objectId,
      createdAt: e.createdAt,
    })),
  };
}
