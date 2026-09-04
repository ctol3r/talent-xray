/**
 * The page's single state object and the derivations every view reads:
 * the current versioned SearchContext, the latest research snapshot and its
 * live status, and every module's ONE derived state.
 */
import type {
  SearchContext,
  SearchFacts,
  ContextChange,
} from "../core/search-context";
import {
  contextFromFacts,
  diffContexts,
  describeDependencyDiff,
} from "../core/search-context";
import type { StoredRecord, StoredCandidate } from "../core/store";
import { store, setDb, storageMode, type DbLike } from "../core/store";
import type { ResearchSnapshot, ResearchStatus } from "../core/research";
import { researchStatusOf } from "../core/research";
import type { ActionItem } from "../core/envelope";
import {
  allModuleStates,
  affectedByChanges,
  MODULES,
  type ModuleKey,
  type ModuleState,
} from "../core/dependencies";
import type { IntentPayload, HiringNeedPayload } from "../core/payloads";
import { nowIso } from "../core/dom";

export interface AppState {
  searches: SearchFacts[];
  current: SearchFacts | null;
  contexts: SearchContext[];
  artifacts: Record<string, StoredRecord>;
  candidates: StoredCandidate[];
  research: ResearchSnapshot[];
  actions: ActionItem[];
  module: string;
  inflight: Partial<Record<ModuleKey, "researching" | "generating">>;
  /** Per-search acknowledgement of generating without current research. */
  acknowledgedNoResearch: Set<string>;
  /** "as of" for derived views — updated on every render. */
  now: string;
}

export const state: AppState = {
  searches: [],
  current: null,
  contexts: [],
  artifacts: {},
  candidates: [],
  research: [],
  actions: [],
  module: "overview",
  inflight: {},
  acknowledgedNoResearch: new Set(),
  now: nowIso(),
};

export function attachDb(db: DbLike | null): void {
  setDb(db);
}
export function currentStorageMode(): "db" | "local" {
  return storageMode();
}

/** The evolving intent (IR + statement log), or the derived IR, or null. */
export function currentIntent(): IntentPayload | null {
  const stored = state.artifacts.intent?.payload as IntentPayload | undefined;
  if (stored) return stored;
  const derived = state.artifacts.hiring_need?.payload as
    HiringNeedPayload | undefined;
  if (!derived) return null;
  return {
    need: derived.need,
    requirements: derived.requirements,
    uncertainties: derived.uncertainties,
    contradictions: derived.contradictions,
    statements: [],
    revision: 0,
    nextQuestion: null,
  };
}

export function currentContext(): SearchContext | null {
  if (!state.current) return null;
  const statements = currentIntent()?.statements ?? [];
  return contextFromFacts(state.current, statements, state.now);
}

export function latestSnapshot(): ResearchSnapshot | undefined {
  return state.research.length
    ? state.research[state.research.length - 1]
    : undefined;
}

export function liveResearchStatus(): ResearchStatus {
  return researchStatusOf(latestSnapshot(), state.now);
}

/**
 * Persist a context revision when the version moved, and return the
 * human-readable dependency diff (empty when nothing consequential changed).
 */
export async function recordContextRevision(): Promise<{
  ctx: SearchContext;
  changes: ContextChange[];
  affected: ModuleKey[];
  message: string;
} | null> {
  const ctx = currentContext();
  if (!ctx) return null;
  const prev = state.contexts.length
    ? state.contexts[state.contexts.length - 1]
    : undefined;
  if (prev && prev.searchVersion === ctx.searchVersion) {
    return { ctx, changes: [], affected: [], message: "" };
  }
  const changes = diffContexts(prev, ctx);
  await store.saveContext(ctx);
  state.contexts = [...state.contexts, ctx];
  const affected = affectedByChanges(changes).filter((k) => {
    const rec = state.artifacts[k === "intake_loop" ? "intent" : k];
    return Boolean(rec?.payload);
  });
  const candidateAssessments = changes.length
    ? state.candidates.filter((c) => c.evidence?.payload).length
    : 0;
  const message = describeDependencyDiff(changes, {
    moduleLabels: affected.map((k) => MODULES[k].label),
    candidateAssessments,
  });
  return { ctx, changes, affected, message };
}

/** Labels of context fields that changed between a record's version and now. */
function changedSince(
  inputVersion: string | undefined,
  ctx: SearchContext,
): string[] {
  if (!inputVersion) return [];
  const then = state.contexts.find((c) => c.searchVersion === inputVersion);
  if (!then) return ["the search brief"];
  return diffContexts(then, ctx).map((c) => c.label);
}

export function moduleStates(): Record<ModuleKey, ModuleState> {
  const ctx = currentContext();
  const version = ctx?.searchVersion ?? "v0";
  const snap = latestSnapshot();
  const research = liveResearchStatus();
  return allModuleStates((key) => {
    const recordKey = key === "intake_loop" ? "intent" : key;
    const record = state.artifacts[recordKey];
    const hasContent =
      key === "candidates"
        ? state.candidates.length > 0
        : key === "intake_loop"
          ? ((record?.payload as IntentPayload | undefined)?.statements
              ?.length ?? 0) > 0
          : key === "golden_test"
            ? Boolean(record?.payload)
            : Boolean(record?.payload);
    return {
      record,
      currentVersion: version,
      changedSince: ctx ? changedSince(record?.meta?.inputVersion, ctx) : [],
      researchStatus: research,
      researchSnapshotId: snap?.id,
      inflight: state.inflight[key],
      hasContent,
    };
  });
}

export async function selectSearch(id: string): Promise<void> {
  state.current = state.searches.find((s) => s.id === id) ?? null;
  state.module = "overview";
  state.inflight = {};
  if (!state.current) {
    state.artifacts = {};
    state.candidates = [];
    state.contexts = [];
    state.research = [];
    state.actions = [];
    return;
  }
  const [artifacts, candidates, contexts, research, actions] =
    await Promise.all([
      store.loadArtifacts(id),
      store.listCandidates(id),
      store.listContexts(id),
      store.listResearch(id),
      store.listActions(id),
    ]);
  state.artifacts = artifacts;
  state.candidates = candidates;
  state.contexts = contexts;
  state.research = research;
  state.actions = actions;
  // First load of a legacy search: seed its first context revision.
  await recordContextRevision();
}

export async function reloadSearches(): Promise<void> {
  state.searches = await store.listSearches();
}

/** Copy-on-write helpers so nothing mutates a stored object in place. */
export async function putArtifact(
  task: string,
  record: StoredRecord,
): Promise<void> {
  state.artifacts = { ...state.artifacts, [task]: record };
  if (state.current) await store.saveArtifact(state.current.id, task, record);
}

export async function putCandidate(cand: StoredCandidate): Promise<void> {
  state.candidates = state.candidates.some((c) => c.id === cand.id)
    ? state.candidates.map((c) => (c.id === cand.id ? cand : c))
    : [...state.candidates, cand];
  if (state.current) await store.saveCandidate(state.current.id, cand);
}

export async function putResearch(snapshot: ResearchSnapshot): Promise<void> {
  state.research = [
    ...state.research.filter((s) => s.id !== snapshot.id),
    snapshot,
  ];
  await store.saveResearch(snapshot);
}

export async function putAction(action: ActionItem): Promise<void> {
  state.actions = state.actions.some((a) => a.id === action.id)
    ? state.actions.map((a) => (a.id === action.id ? action : a))
    : [...state.actions, action];
  if (state.current) await store.saveAction(state.current.id, action);
}

export async function saveFacts(facts: SearchFacts): Promise<void> {
  const stamped = { ...facts, updatedAt: nowIso() };
  await store.saveSearch(stamped);
  state.searches = state.searches.some((s) => s.id === stamped.id)
    ? state.searches.map((s) => (s.id === stamped.id ? stamped : s))
    : [stamped, ...state.searches];
  if (state.current?.id === stamped.id) state.current = stamped;
}
