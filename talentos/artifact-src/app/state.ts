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
import type { ActionItem, Initiative, OutputEnvelope } from "../core/envelope";
import type { PipelineEvent } from "../core/pipeline";
import {
  allModuleStates,
  affectedByChanges,
  MODULES,
  type ModuleKey,
  type ModuleState,
} from "../core/dependencies";
import type { IntentPayload, HiringNeedPayload } from "../core/payloads";
import { nowIso } from "../core/dom";
import {
  NAV,
  researchEntryStatus,
  type EntryStatus,
  type Mode,
} from "../core/phases";
import { nextBestAction, type NextBestAction } from "../core/next-best-action";
import { asOf } from "../core/dom";
import type { IntakePayload } from "../core/payloads";

const MODE_KEY = "talentos-mode";

/** A per-viewer display preference — never part of the search's data. */
function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "expert" ? "expert" : "guided";
  } catch {
    return "guided";
  }
}

export function setMode(mode: Mode): void {
  state.mode = mode;
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* private mode */
  }
}

export interface AppState {
  searches: SearchFacts[];
  current: SearchFacts | null;
  contexts: SearchContext[];
  artifacts: Record<string, StoredRecord>;
  candidates: StoredCandidate[];
  research: ResearchSnapshot[];
  actions: ActionItem[];
  initiatives: Initiative[];
  events: PipelineEvent[];
  module: string;
  /** Guided hides advanced entries; Expert shows everything. Per viewer. */
  mode: Mode;
  inflight: Partial<Record<ModuleKey, "researching" | "generating">>;
  /** Per-search acknowledgement of generating without current research. */
  acknowledgedNoResearch: Set<string>;
  /** "as of" for derived views — updated on every render. */
  now: string;
  /**
   * W18: a benchmark run swaps in a throwaway search. While this is true
   * nothing is written to the store — a corpus fixture must never end up
   * in the recruiter's saved searches.
   */
  ephemeral: boolean;
}

export const state: AppState = {
  searches: [],
  current: null,
  contexts: [],
  artifacts: {},
  candidates: [],
  research: [],
  actions: [],
  initiatives: [],
  events: [],
  module: "overview",
  mode: readMode(),
  inflight: {},
  acknowledgedNoResearch: new Set(),
  now: nowIso(),
  ephemeral: false,
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

/** The chip every nav entry shows. Research has no record, so it reads live. */
export function entryStatuses(): Record<string, EntryStatus | undefined> {
  const states = moduleStates();
  const snap = latestSnapshot();
  const out: Record<string, EntryStatus | undefined> = {};
  for (const entry of NAV) {
    if (entry.moduleKey) {
      const st = states[entry.moduleKey];
      out[entry.key] = { state: st.state, reason: st.reason };
    } else if (entry.key === "research") {
      out[entry.key] = researchEntryStatus(
        liveResearchStatus(),
        snap ? asOf(snap.completedAt ?? snap.startedAt) : undefined,
      );
    }
  }
  return out;
}

/** Everything the next-best-action rules read, gathered from state. */
export function nextAction(aiAvailable: boolean): NextBestAction {
  const intake = state.artifacts.intake?.payload as IntakePayload | undefined;
  let unanswered = 0;
  for (const cat of intake?.categories ?? []) {
    for (const q of cat.questions ?? []) {
      if (!q.answer || !q.answer.trim()) unanswered += 1;
    }
  }
  const intent = currentIntent();
  return nextBestAction({
    hasSearch: Boolean(state.current),
    states: moduleStates(),
    researchStatus: liveResearchStatus(),
    acknowledgedNoResearch: state.acknowledgedNoResearch.has(
      state.current?.id ?? "",
    ),
    candidateCount: state.candidates.length,
    candidatesWithoutEvidence: state.candidates.filter(
      (c) => !c.evidence?.payload,
    ).length,
    actions: state.actions,
    unansweredIntake: unanswered,
    nextQuestion: intent?.nextQuestion?.question ?? null,
    pipelineEvents: state.events.length,
    goldenRun: Boolean(state.artifacts.golden_test?.payload),
    aiAvailable,
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
    state.initiatives = [];
    state.events = [];
    return;
  }
  const [
    artifacts,
    candidates,
    contexts,
    research,
    actions,
    initiatives,
    events,
  ] = await Promise.all([
    store.loadArtifacts(id),
    store.listCandidates(id),
    store.listContexts(id),
    store.listResearch(id),
    store.listActions(id),
    store.listInitiatives(id),
    store.listEvents(id),
  ]);
  state.artifacts = artifacts;
  state.candidates = candidates;
  state.contexts = contexts;
  state.research = research;
  state.actions = actions;
  state.initiatives = initiatives;
  state.events = events;
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
  if (state.current && !state.ephemeral)
    await store.saveArtifact(state.current.id, task, record);
}

export async function putCandidate(cand: StoredCandidate): Promise<void> {
  state.candidates = state.candidates.some((c) => c.id === cand.id)
    ? state.candidates.map((c) => (c.id === cand.id ? cand : c))
    : [...state.candidates, cand];
  if (state.current && !state.ephemeral)
    await store.saveCandidate(state.current.id, cand);
}

export async function putResearch(snapshot: ResearchSnapshot): Promise<void> {
  state.research = [
    ...state.research.filter((s) => s.id !== snapshot.id),
    snapshot,
  ];
  if (!state.ephemeral) await store.saveResearch(snapshot);
}

export async function putAction(action: ActionItem): Promise<void> {
  state.actions = state.actions.some((a) => a.id === action.id)
    ? state.actions.map((a) => (a.id === action.id ? action : a))
    : [...state.actions, action];
  if (state.current && !state.ephemeral)
    await store.saveAction(state.current.id, action);
}

export async function putInitiative(initiative: Initiative): Promise<void> {
  state.initiatives = state.initiatives.some((i) => i.id === initiative.id)
    ? state.initiatives.map((i) => (i.id === initiative.id ? initiative : i))
    : [...state.initiatives, initiative];
  if (state.current && !state.ephemeral)
    await store.saveInitiative(state.current.id, initiative);
}

/**
 * Action items a module DRAFTED, that the recruiter has not accepted into
 * the queue. Agents draft; humans decide — so an envelope's action item is
 * a suggestion until someone adds it.
 */
export function suggestedActions(): Array<{
  action: ActionItem;
  fromModule: string;
}> {
  const taken = new Set(state.actions.map((a) => a.id));
  const out: Array<{ action: ActionItem; fromModule: string }> = [];
  for (const [key, rec] of Object.entries(state.artifacts)) {
    const env = rec.envelope as OutputEnvelope | undefined;
    for (const action of env?.actionItems ?? []) {
      if (!taken.has(action.id)) out.push({ action, fromModule: key });
    }
  }
  return out;
}

/** Events are append-only; recording one never rewrites another. */
export async function appendEvent(event: PipelineEvent): Promise<void> {
  state.events = [...state.events, event].sort((a, b) =>
    a.at.localeCompare(b.at),
  );
  if (state.current && !state.ephemeral)
    await store.appendEvent(state.current.id, event);
}

/**
 * Run something against a throwaway search — the benchmark's fixtures.
 * Nothing is persisted, and the recruiter's own state is restored even if
 * the run throws.
 */
export async function withEphemeralSearch<T>(
  facts: SearchFacts,
  fn: () => Promise<T>,
): Promise<T> {
  const saved = {
    current: state.current,
    artifacts: state.artifacts,
    candidates: state.candidates,
    contexts: state.contexts,
    research: state.research,
    actions: state.actions,
    initiatives: state.initiatives,
    events: state.events,
    module: state.module,
    ephemeral: state.ephemeral,
  };
  state.current = facts;
  state.artifacts = {};
  state.candidates = [];
  state.contexts = [];
  state.research = [];
  state.actions = [];
  state.initiatives = [];
  state.events = [];
  state.ephemeral = true;
  const ctx = currentContext();
  if (ctx) state.contexts = [ctx];
  try {
    return await fn();
  } finally {
    Object.assign(state, saved);
  }
}

export async function saveFacts(facts: SearchFacts): Promise<void> {
  const stamped = { ...facts, updatedAt: nowIso() };
  await store.saveSearch(stamped);
  state.searches = state.searches.some((s) => s.id === stamped.id)
    ? state.searches.map((s) => (s.id === stamped.id ? stamped : s))
    : [stamped, ...state.searches];
  if (state.current?.id === stamped.id) state.current = stamped;
}
