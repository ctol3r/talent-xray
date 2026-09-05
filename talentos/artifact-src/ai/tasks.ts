/**
 * Everything that talks to the model. One boundary (`normalizeGenerated`)
 * turns provider output into owned objects; every failure is persisted as
 * `lastError` on the module's record; substantive modules pass the
 * Research Gate and come back wrapped in an OutputEnvelope whose A–H steps
 * are validated (one repair pass, then `needs_review`).
 */
import { scanPayloadForProtectedTraits } from "@/lib/domain/fair-hiring";
import { applyIntakeHygiene } from "@/lib/domain/intake-hygiene";
import type { ManagerStatement } from "@/lib/core/ir";
import type { SearchFacts } from "../core/search-context";
import { clip, nowIso, uid } from "../core/dom";
import {
  PAYLOAD_SCHEMAS,
  PayloadShapeError,
  deepCopy,
  downgradeVerified,
  normalizeGenerated,
  type EvidencePayload,
  type IntentPayload,
  type HiringNeedPayload,
  type PayloadOf,
  type PayloadTaskKey,
} from "../core/payloads";
import type {
  StoredRecord,
  StoredCandidate,
  Critique,
  RecordMeta,
} from "../core/store";
import {
  ACTION_TYPES,
  actionItemSchema,
  guardClaims,
  outputEnvelopeSchema,
  pivotProposalSchema,
  suggestedNextStepSchema,
  validateEnvelope,
  type OutputEnvelope,
  type ValidationIssue,
} from "../core/envelope";
import {
  gateDecision,
  type GateDecision,
  type ResearchClaim,
} from "../core/research";
import {
  planExecution,
  ProgressTracker,
  type ExecutionPlan,
} from "../core/execution-plan";
import { MODULES, type ModuleKey } from "../core/dependencies";
import { sourcesFor } from "../core/evidence";
import {
  checkTurn,
  projectFacts,
  type CorpusTurnOutcome,
  type ParsedConversation,
} from "../core/corpus";
import {
  currentContext,
  currentIntent,
  latestSnapshot,
  putArtifact,
  putCandidate,
  state,
  withEphemeralSearch,
} from "../app/state";
import { renderContext } from "./context";
import {
  CANDIDATE_TASKS,
  CRITIC_RULES,
  INTAKE_REASONER_RULES,
  INTAKE_REASONER_SHAPE,
  TASKS,
  envelopeRules,
  systemPrelude,
} from "./prompts";

// ── Sample plumbing ─────────────────────────────────────────────────────────

export interface SampleOptions {
  signal?: AbortSignal;
  cache?: boolean;
  onText?: (e: { text: string; delta?: string }) => void;
  modelTier?: "quick" | "default" | "complex";
}
export interface SampleApi {
  json(input: string, opts?: SampleOptions): Promise<unknown>;
}

let sampleApi: SampleApi | null = null;
export function setSample(api: SampleApi | null): void {
  sampleApi = api;
}
export function hasSample(): boolean {
  return sampleApi !== null;
}

/** Generation quality knob: "complex" = most capable tier. */
export const MODEL_TIER: SampleOptions["modelTier"] = "complex";

export interface UiHooks {
  bindStop?: (ctl: AbortController) => void;
  onText?: (e: { text: string }) => void;
  step?: (name: string) => void;
}

export class GenerationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly text?: string,
  ) {
    super(message);
    this.name = "GenerationError";
  }
}

export function errorCode(e: unknown): string {
  if (e instanceof GenerationError) return e.code;
  if (
    e &&
    typeof e === "object" &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string"
  ) {
    return (e as { code: string }).code;
  }
  return "upstream_error";
}
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e)
    return String((e as { message: unknown }).message);
  return String(e);
}

async function sampleJson(
  prompt: string,
  ui: UiHooks | undefined,
  cache: boolean,
): Promise<unknown> {
  if (!sampleApi)
    throw new GenerationError(
      "not_granted",
      "Claude access is not available in this view.",
    );
  const ctl = new AbortController();
  ui?.bindStop?.(ctl);
  return sampleApi.json(prompt, {
    signal: ctl.signal,
    cache,
    onText: ui?.onText,
    modelTier: MODEL_TIER,
  });
}

function traitWarningsOf(payload: unknown): string[] {
  return Array.from(
    new Set(scanPayloadForProtectedTraits(payload).map((h) => h.trait)),
  );
}

function baseContext(): string {
  const ctx = currentContext();
  if (!ctx) throw new GenerationError("upstream_error", "No search selected.");
  return renderContext({
    ctx,
    artifacts: state.artifacts,
    intent: currentIntent(),
    snapshot: latestSnapshot(),
    nowIso: state.now,
  });
}

/** Persist a failure on the module's record so it survives re-render (P0-B). */
export async function recordFailure(task: string, e: unknown): Promise<void> {
  const existing = state.artifacts[task];
  const record: StoredRecord = existing
    ? {
        ...existing,
        lastError: {
          at: nowIso(),
          message: errorMessage(e),
          code: errorCode(e),
        },
      }
    : {
        meta: { provider: "claude-artifact", generatedAt: "" },
        traitWarnings: [],
        lastError: {
          at: nowIso(),
          message: errorMessage(e),
          code: errorCode(e),
        },
      };
  await putArtifact(task, record);
}

// ── Envelope assembly ───────────────────────────────────────────────────────

interface RawClaim {
  text?: unknown;
  kind?: unknown;
  sourceIds?: unknown;
  confidence?: unknown;
  limitations?: unknown;
  contradictions?: unknown;
}

function toClaims(
  raw: unknown,
  bucket:
    | "facts"
    | "hiringManagerStatements"
    | "estimates"
    | "inferences"
    | "unknowns"
    | "contradictions",
  knownSourceIds: Set<string>,
  gate: GateDecision,
): ResearchClaim[] {
  if (!Array.isArray(raw)) return [];
  const kindFor = {
    facts: "source_fact",
    hiringManagerStatements: "hiring_manager_statement",
    estimates: "estimate",
    inferences: "model_inference",
    unknowns: "unknown",
    contradictions: "model_inference",
  } as const;
  return raw
    .map((item): ResearchClaim | null => {
      const c = (typeof item === "string" ? { text: item } : item) as RawClaim;
      if (typeof c.text !== "string" || !c.text.trim()) return null;
      const sourceIds = Array.isArray(c.sourceIds)
        ? c.sourceIds.filter(
            (s): s is string => typeof s === "string" && knownSourceIds.has(s),
          )
        : [];
      const kind = kindFor[bucket];
      let evidenceState: ResearchClaim["evidenceState"] =
        bucket === "facts"
          ? sourceIds.length > 0
            ? gate.researchStatus === "aging"
              ? "aging"
              : gate.researchStatus === "stale"
                ? "stale"
                : "source_backed"
            : "self_attested"
          : bucket === "unknowns"
            ? "not_yet_known"
            : bucket === "contradictions"
              ? "contradicted"
              : "self_attested";
      if (bucket === "facts" && gate.researchStatus === "blocked")
        evidenceState = "self_attested";
      const confidence = ["high", "medium", "low", "not_assessed"].includes(
        String(c.confidence),
      )
        ? (c.confidence as ResearchClaim["confidence"])
        : "not_assessed";
      return {
        id: uid(),
        text: c.text.trim(),
        kind,
        evidenceState,
        sourceIds,
        observedAt: sourceIds.length ? gate.asOf : undefined,
        confidence,
        limitations: Array.isArray(c.limitations)
          ? c.limitations.filter((x): x is string => typeof x === "string")
          : [],
        contradictions: Array.isArray(c.contradictions)
          ? c.contradictions.filter((x): x is string => typeof x === "string")
          : [],
      };
    })
    .filter((c): c is ResearchClaim => c !== null);
}

function resolvableIds(): Set<string> {
  const ids = new Set<string>([
    "overview",
    "research",
    "intake_loop",
    "candidates",
    "golden_test",
    ...Object.keys(MODULES),
  ]);
  for (const c of state.candidates) ids.add(c.id);
  for (const a of state.actions) ids.add(a.id);
  const intent = currentIntent();
  for (const u of intent?.uncertainties ?? []) if (u.id) ids.add(u.id);
  const intake = state.artifacts.intake?.payload as
    { categories?: Array<{ questions?: Array<{ id?: string }> }> } | undefined;
  for (const cat of intake?.categories ?? [])
    for (const q of cat.questions ?? []) if (q.id) ids.add(q.id);
  return ids;
}

interface BuiltEnvelope {
  envelope: OutputEnvelope;
  issues: ValidationIssue[];
  relabelled: number;
}

function buildEnvelope(input: {
  raw: Record<string, unknown>;
  task: string;
  content: unknown;
  gate: GateDecision;
  generatedAt: string;
}): BuiltEnvelope {
  const ctx = currentContext();
  if (!ctx) throw new GenerationError("upstream_error", "No search selected.");
  const snapshot = latestSnapshot();
  const known = new Set((snapshot?.sources ?? []).map((s) => s.id));
  const r = input.raw;
  const envelopeId = uid();
  const facts = guardClaims(toClaims(r.facts, "facts", known, input.gate));
  const actionItems = (Array.isArray(r.actionItems) ? r.actionItems : [])
    .map((a) => {
      const parsed = actionItemSchema.safeParse({
        id: uid(),
        sourceOutputId: envelopeId,
        status: "open",
        ...(typeof a === "object" && a ? a : {}),
        // owner is validated by the schema; unknown values fall to unassigned below
      });
      if (parsed.success) return parsed.data;
      const fallback = actionItemSchema.safeParse({
        id: uid(),
        sourceOutputId: envelopeId,
        status: "open",
        title: String((a as { title?: unknown })?.title ?? ""),
        description: String(
          (a as { description?: unknown })?.description ?? "",
        ),
        owner: "unassigned",
      });
      return fallback.success ? fallback.data : null;
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);
  const pivotProposals = (
    Array.isArray(r.pivotProposals) ? r.pivotProposals : []
  )
    .map((p) =>
      pivotProposalSchema.safeParse({
        id: uid(),
        status: "proposed",
        ...(typeof p === "object" && p ? p : {}),
      }),
    )
    .filter((p) => p.success)
    .map((p) => p.data);
  const steps = (
    Array.isArray(r.suggestedNextSteps) ? r.suggestedNextSteps : []
  ).map((s) => {
    const o = (typeof s === "object" && s ? s : {}) as Record<string, unknown>;
    return {
      ...o,
      label:
        typeof o.label === "string" ? o.label.trim().toUpperCase() : o.label,
      title: typeof o.title === "string" ? o.title : "",
      description: typeof o.description === "string" ? o.description : "",
      actionType:
        typeof o.actionType === "string" && o.actionType in ACTION_TYPES
          ? o.actionType
          : "navigate_module",
      targetId: typeof o.targetId === "string" ? o.targetId : undefined,
      recommended: o.recommended === true,
    };
  });
  const candidate = {
    id: envelopeId,
    searchId: ctx.searchId,
    searchVersion: ctx.searchVersion,
    moduleType: input.task,
    generatedAt: input.generatedAt,
    researchSnapshotId: input.gate.snapshotId,
    researchStatus: input.gate.researchStatus,
    headline:
      typeof r.headline === "string" && r.headline.trim()
        ? r.headline.trim()
        : "(no headline returned)",
    executiveSummary:
      typeof r.executiveSummary === "string" && r.executiveSummary.trim()
        ? r.executiveSummary.trim()
        : "(no executive summary returned)",
    facts: facts.claims,
    hiringManagerStatements: toClaims(
      r.hiringManagerStatements,
      "hiringManagerStatements",
      known,
      input.gate,
    ),
    estimates: toClaims(r.estimates, "estimates", known, input.gate),
    inferences: toClaims(r.inferences, "inferences", known, input.gate),
    unknowns: toClaims(r.unknowns, "unknowns", known, input.gate),
    contradictions: toClaims(
      r.contradictions,
      "contradictions",
      known,
      input.gate,
    ),
    metrics: [],
    implications: Array.isArray(r.implications)
      ? r.implications.filter((x): x is string => typeof x === "string")
      : [],
    actionItems,
    pivotProposals,
    content: input.content,
    suggestedNextSteps: steps.map((s) => {
      const parsed = suggestedNextStepSchema.safeParse(s);
      return parsed.success ? parsed.data : s;
    }),
  };
  const result = validateEnvelope(candidate, {
    resolvableIds: resolvableIds(),
  });
  const envelope =
    result.envelope ??
    (outputEnvelopeSchema.safeParse({ ...candidate, suggestedNextSteps: [] })
      .data as OutputEnvelope | undefined);
  return {
    envelope:
      envelope ??
      ({ ...candidate, suggestedNextSteps: [] } as unknown as OutputEnvelope),
    issues: result.issues,
    relabelled: facts.relabelled,
  };
}

// ── Module generation ───────────────────────────────────────────────────────

export interface RunOptions {
  regenerate?: boolean;
  acknowledgedNoResearch?: boolean;
  /** Extra section appended to the context (critic revision, contract repair). */
  extraContext?: string;
}

function isPayloadTask(key: string): key is PayloadTaskKey {
  return key in PAYLOAD_SCHEMAS;
}

/**
 * Generate one module. Returns the record; does NOT persist (callers do,
 * so the crew and the single-module button share one path).
 */
export async function runTask(
  taskKey: string,
  ui: UiHooks | undefined,
  opts: RunOptions = {},
): Promise<StoredRecord> {
  const task = TASKS[taskKey];
  if (!task || !isPayloadTask(taskKey))
    throw new GenerationError("upstream_error", `Unknown task ${taskKey}`);
  const ctx = currentContext();
  if (!ctx) throw new GenerationError("upstream_error", "No search selected.");
  const snapshot = latestSnapshot();
  const gate = task.envelope
    ? gateDecision(
        snapshot,
        state.now,
        opts.acknowledgedNoResearch ??
          state.acknowledgedNoResearch.has(ctx.searchId),
      )
    : undefined;
  if (gate && !gate.allowed) {
    throw new GenerationError("research_gate", gate.banner);
  }
  const started = Date.now();
  const contextText =
    baseContext() + (opts.extraContext ? `\n\n${opts.extraContext}` : "");
  const envelopeText = task.envelope
    ? `\n\n${envelopeRules({
        moduleType: task.label,
        actionTargets: Array.from(resolvableIds()).slice(0, 60),
        researchBlocked:
          gate?.researchStatus !== "current" &&
          gate?.researchStatus !== "aging",
      })}`
    : "";
  const outputFormat = task.envelope
    ? `Reply with ONLY one JSON object (no markdown fences, no commentary) of this shape:
{"headline": string, "executiveSummary": string, "facts": [...], "hiringManagerStatements": [...], "estimates": [...], "inferences": [...], "unknowns": [...], "contradictions": [...], "implications": string[], "actionItems": [...], "pivotProposals": [...], "content": <Module content shape>, "suggestedNextSteps": [8 items A–H]}

Module content shape:
${task.shape}`
    : `Reply with ONLY one JSON object (no markdown fences, no commentary) of this shape:
${task.shape}`;

  const prompt = `${systemPrelude(task.persona)}

${task.rules}

${contextText}${envelopeText}

## Task
${task.ask}

## Output format
${outputFormat}`;

  const raw = await sampleJson(prompt, ui, !opts.regenerate);
  const rawObj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const contentRaw =
    task.envelope && "content" in rawObj ? rawObj.content : raw;
  const { value: contentClean, downgrades } = downgradeVerified(
    deepCopy(contentRaw),
  );
  const payload = normalizeGenerated(taskKey, contentClean);
  const generatedAt = nowIso();
  const meta: RecordMeta = {
    provider: "claude-artifact",
    generatedAt,
    downgrades,
    inputVersion: ctx.searchVersion,
    researchSnapshotId: gate?.snapshotId,
    researchStatus: gate?.researchStatus,
    acknowledgedNoResearch: gate ? gate.acknowledgementRequired : undefined,
    durationMs: Date.now() - started,
  };
  const previous = state.artifacts[taskKey]?.payload
    ? {
        payload: state.artifacts[taskKey].payload,
        meta: state.artifacts[taskKey].meta,
      }
    : undefined;

  if (!task.envelope || !gate) {
    return { payload, meta, traitWarnings: traitWarningsOf(payload), previous };
  }

  let built = buildEnvelope({
    raw: rawObj,
    task: taskKey,
    content: payload,
    gate,
    generatedAt,
  });
  if (
    built.issues.length > 0 &&
    !opts.extraContext?.includes("Contract violations")
  ) {
    ui?.step?.(
      `${task.label} — repairing output contract (${built.issues.length} issue${built.issues.length === 1 ? "" : "s"})`,
    );
    const repair = `## Contract violations to fix (this is a REPAIR pass)\nYour previous reply violated the output contract. Produce the full envelope again and fix every item:\n${built.issues.map((i) => `- ${i.message}`).join("\n")}`;
    const retry = await sampleJson(
      prompt.replace("## Task", `${repair}\n\n## Task`),
      ui,
      false,
    );
    const retryObj = (
      retry && typeof retry === "object" ? retry : {}
    ) as Record<string, unknown>;
    const retryContent = "content" in retryObj ? retryObj.content : retry;
    try {
      const cleaned = downgradeVerified(deepCopy(retryContent));
      const retryPayload = normalizeGenerated(taskKey, cleaned.value);
      const rebuilt = buildEnvelope({
        raw: retryObj,
        task: taskKey,
        content: retryPayload,
        gate,
        generatedAt: nowIso(),
      });
      if (rebuilt.issues.length < built.issues.length) {
        built = rebuilt;
        return finish(retryPayload as PayloadOf<PayloadTaskKey>, {
          ...meta,
          generatedAt: rebuilt.envelope.generatedAt,
          downgrades: cleaned.downgrades,
        });
      }
    } catch {
      /* keep the first attempt and its issues */
    }
  }
  return finish(payload, meta);

  function finish(p: PayloadOf<PayloadTaskKey>, m: RecordMeta): StoredRecord {
    return {
      payload: p,
      meta: m,
      traitWarnings: traitWarningsOf({ payload: p, envelope: built.envelope }),
      validationIssues: built.issues.length
        ? built.issues.map((i) => i.message)
        : undefined,
      envelope: built.envelope,
      previous,
    };
  }
}

/** The single-module button and the crew both go through here. */
export async function generateModule(
  taskKey: ModuleKey,
  ui: UiHooks | undefined,
  opts: RunOptions = {},
): Promise<StoredRecord> {
  state.inflight = { ...state.inflight, [taskKey]: "generating" };
  try {
    const record = await runTask(taskKey, ui, {
      regenerate: Boolean(state.artifacts[taskKey]?.payload),
      ...opts,
    });
    await putArtifact(taskKey, record);
    return record;
  } catch (e) {
    await recordFailure(taskKey, e);
    throw e;
  } finally {
    const next = { ...state.inflight };
    delete next[taskKey];
    state.inflight = next;
  }
}

// ── Critic + crew ───────────────────────────────────────────────────────────

export async function runCritic(
  taskLabel: string,
  artifactJson: string,
  ui?: UiHooks,
): Promise<Critique> {
  const prompt = `${systemPrelude("an elite recruiting-deliverables reviewer (the crew's critic)")}

${CRITIC_RULES}

${baseContext()}

## Artifact under review: ${taskLabel}
${clip(artifactJson, 8000)}

## Output format
Reply with ONLY one JSON object: {"verdict": "accept"|"revise", "strengths": string[], "issues": string[]}`;
  const raw = await sampleJson(prompt, ui, false);
  const parsed = PAYLOAD_SCHEMAS.critique.safeParse(deepCopy(raw));
  if (!parsed.success) {
    const verdict = (raw as { verdict?: unknown })?.verdict;
    if (verdict !== "accept" && verdict !== "revise")
      throw new PayloadShapeError(
        "critique",
        ["bad critic verdict"],
        JSON.stringify(raw),
      );
    const r = raw as { strengths?: unknown; issues?: unknown };
    return {
      verdict,
      strengths: Array.isArray(r.strengths) ? r.strengths.map(String) : [],
      issues: Array.isArray(r.issues) ? r.issues.map(String) : [],
    };
  }
  return parsed.data;
}

/** hiring_need first: the crew now generates the IR every downstream agent consumes. */
export const CREW_ORDER: ModuleKey[] = [
  "hiring_need",
  "role_intelligence",
  "intake",
  "success_profile",
  "market_intelligence",
  "sourcing_strategy",
  "channels",
  "search_strings",
];

export function crewPlan(modules: ModuleKey[] = CREW_ORDER): ExecutionPlan {
  return planExecution({
    kind: "crew",
    modules: modules.map((k) => ({ key: k, label: MODULES[k].label })),
    withCritic: true,
  });
}

/**
 * Which crew modules still need work (W17). A module already `current` for
 * the CURRENT input version is skipped: regenerating it would spend a call
 * to produce the same thing. Anything else — never started, failed, stale,
 * blocked, needs review — is in the run.
 */
export function crewRemaining(
  states: Partial<Record<ModuleKey, { state: string }>>,
): ModuleKey[] {
  return CREW_ORDER.filter((key) => states[key]?.state !== "current");
}

export async function generateWithCritic(
  key: ModuleKey,
  ui: UiHooks,
  tracker?: ProgressTracker,
): Promise<StoredRecord> {
  const task = TASKS[key];
  tracker?.start(key, "generate");
  let record: StoredRecord;
  try {
    record = await generateModule(key, ui);
    tracker?.done(key, "generate");
  } catch (e) {
    tracker?.fail(key, "generate", errorMessage(e));
    throw e;
  }
  ui.step?.(`critic reviewing ${task.label.toLowerCase()}`);
  tracker?.start(key, "critic");
  let critique: Critique;
  try {
    critique = await runCritic(task.label, JSON.stringify(record.payload), ui);
    tracker?.done(key, "critic");
  } catch (e) {
    tracker?.fail(key, "critic", errorMessage(e));
    throw e;
  }
  record = { ...record, critique };
  await putArtifact(key, record);
  if (critique.verdict === "revise" && critique.issues.length > 0) {
    ui.step?.(
      `revising ${task.label.toLowerCase()} (${critique.issues.length} findings)`,
    );
    tracker?.start(key, "revise");
    try {
      const revised = await generateModule(key, ui, {
        regenerate: true,
        extraContext: `## Critic findings to address (this is a REVISION pass)\nA reviewer flagged the previous draft. Produce a full corrected artifact that resolves every finding:\n${critique.issues.map((i) => `- ${i}`).join("\n")}`,
      });
      record = { ...revised, critique: { ...critique, revised: true } };
      await putArtifact(key, record);
      tracker?.done(key, "revise");
    } catch (e) {
      tracker?.fail(key, "revise", errorMessage(e));
      throw e;
    }
  } else {
    tracker?.skip(key, "revise", "critic accepted");
  }
  return record;
}

export async function runCrewForSearch(
  ui: UiHooks,
  tracker: ProgressTracker,
  modules: ModuleKey[] = CREW_ORDER,
): Promise<void> {
  for (const key of modules) {
    ui.step?.(`${MODULES[key].label} agent`);
    await generateWithCritic(key, ui, tracker);
  }
  tracker.finish();
}

// ── W12 corpus fixture runner (W18) ─────────────────────────────────────────

/**
 * Run one corpus fixture through the ARTIFACT'S OWN prompts and score it.
 *
 * The generating model receives the fixture's project facts, JD and
 * scripted statements — and nothing else. The expectations stay here and
 * are applied afterwards by `checkTurn`. That is what makes the numbers
 * mean something: the model cannot be writing to the test.
 */
export async function runCorpusFixture(
  conversation: ParsedConversation,
  ui: UiHooks | undefined,
  onOutcome: (outcome: CorpusTurnOutcome) => void,
): Promise<void> {
  const facts: SearchFacts = {
    id: `w12-${conversation.id}`,
    createdAt: nowIso(),
    example: true,
    name: `Benchmark fixture ${conversation.id} — ${conversation.title}`,
    companyName: conversation.project.companyName ?? "",
    roleTitle: conversation.project.roleTitle,
    geography: conversation.project.geography ?? "",
    country: conversation.project.country ?? "",
    industry: conversation.project.industry ?? "",
    seniority: conversation.project.seniority ?? "",
    businessObjective: conversation.project.businessObjective ?? "",
    jd: conversation.jd,
  };
  const inputs = {
    jd: conversation.jd,
    projectFacts: projectFacts(conversation),
  };

  await withEphemeralSearch(facts, async () => {
    // Turn -1: derive the canonical IR from the job description.
    ui?.step?.(`${conversation.id} — canonical IR from the JD`);
    let intent: IntentPayload;
    try {
      const record = await runTask("hiring_need", ui, { regenerate: true });
      await putArtifact("hiring_need", record);
      const derived = record.payload as HiringNeedPayload;
      intent = {
        need: derived.need,
        requirements: derived.requirements,
        uncertainties: derived.uncertainties,
        contradictions: derived.contradictions,
        statements: [],
        revision: 0,
        nextQuestion: null,
      };
      await putArtifact("intent", { ...record, payload: intent });
      onOutcome({
        conversationId: conversation.id,
        turnIndex: -1,
        label: "Canonical IR from the JD",
        executed: true,
        notExecutedReason: "",
        ...scoreOne(
          conversation,
          -1,
          conversation.initial,
          undefined,
          intent,
          derived,
          {
            ...inputs,
            statements: [],
          },
        ),
      });
    } catch (e) {
      onOutcome({
        conversationId: conversation.id,
        turnIndex: -1,
        label: "Canonical IR from the JD",
        executed: false,
        notExecutedReason: `${errorCode(e)}: ${errorMessage(e)}`,
        findings: [],
        tally: {},
      });
      return; // Every later turn reasons over an IR that does not exist.
    }

    const statements: string[] = [];
    for (const [i, turn] of conversation.turns.entries()) {
      statements.push(turn.text);
      ui?.step?.(
        `${conversation.id} — turn ${i + 1} of ${conversation.turns.length}`,
      );
      const before = intent;
      try {
        const statement: ManagerStatement = {
          id: uid(),
          at: nowIso(),
          speaker: "hiring_manager",
          text: turn.text,
        };
        const record = await reasonOverStatement(statement, ui);
        const next = record.payload as IntentPayload;
        await putArtifact("intent", record);
        intent = next;
        onOutcome({
          conversationId: conversation.id,
          turnIndex: i,
          label: `Turn ${i + 1}`,
          executed: true,
          notExecutedReason: "",
          ...scoreOne(
            conversation,
            i,
            turn.expect,
            before,
            next,
            {
              extractedClaims: [],
              requirements: next.requirements,
              uncertainties: next.uncertainties,
              contradictions: next.contradictions,
              nextQuestion: next.nextQuestion ?? undefined,
            },
            { ...inputs, statements: [...statements] },
          ),
        });
      } catch (e) {
        onOutcome({
          conversationId: conversation.id,
          turnIndex: i,
          label: `Turn ${i + 1}`,
          executed: false,
          notExecutedReason: `${errorCode(e)}: ${errorMessage(e)}`,
          findings: [],
          tally: {},
        });
        return; // The conversation's state is now unknown; stop this fixture.
      }
    }
  });
}

/** Deterministic scoring of one turn. No model call; no expectations in a prompt. */
function scoreOne(
  conversation: ParsedConversation,
  turnIndex: number,
  expectation: ParsedConversation["initial"],
  before: IntentPayload | undefined,
  after: IntentPayload,
  output: unknown,
  inputs: { jd: string; projectFacts: string; statements: string[] },
): {
  findings: CorpusTurnOutcome["findings"];
  tally: CorpusTurnOutcome["tally"];
} {
  const toIR = (p: IntentPayload) => ({
    need: p.need,
    requirements: p.requirements,
    uncertainties: p.uncertainties,
    contradictions: p.contradictions,
  });
  const check = checkTurn({
    conversation,
    turnIndex,
    expectation,
    before: before ? (toIR(before) as never) : undefined,
    after: toIR(after) as never,
    output: output as never,
    inputs,
  });
  return { findings: check.findings, tally: check.tally };
}

// ── Adaptive intake reasoner ────────────────────────────────────────────────

export async function reasonOverStatement(
  statement: ManagerStatement,
  ui?: UiHooks,
): Promise<StoredRecord> {
  const intent = currentIntent();
  if (!intent)
    throw new GenerationError(
      "upstream_error",
      "Generate the Canonical IR first.",
    );
  const ctx = currentContext();
  if (!ctx) throw new GenerationError("upstream_error", "No search selected.");
  const prior = intent.statements ?? [];
  const prompt = `${systemPrelude("an elite recruiter running an adaptive hiring-manager intake")}

${INTAKE_REASONER_RULES}

${baseContext()}
## Current canonical intelligence
${clip(
  JSON.stringify(
    {
      need: intent.need,
      requirements: intent.requirements,
      uncertainties: intent.uncertainties,
      contradictions: intent.contradictions,
      priorStatements: prior,
    },
    null,
    1,
  ),
  14000,
)}
## New hiring-manager statement
${JSON.stringify(statement, null, 1)}

## Task
Run one turn of the intake loop now.

## Output format
Reply with ONLY one JSON object (no markdown fences, no commentary) of this shape:
${INTAKE_REASONER_SHAPE}`;

  const raw = await sampleJson(prompt, ui, false);
  const { value: cleaned, downgrades } = downgradeVerified(deepCopy(raw));
  const out = normalizeGenerated("intake_reasoning", cleaned);
  const statements = [...prior, statement];
  const hygienic = applyIntakeHygiene(
    out,
    {
      uncertainties: intent.uncertainties,
      contradictions: intent.contradictions,
    },
    ctx.jobDescription,
    statements,
  );
  const reasonedAt = nowIso();
  const next: IntentPayload = {
    need: {
      ...intent.need,
      claims: [
        ...(intent.need.claims ?? []),
        ...out.extractedClaims.map((c) => ({
          text: c.text,
          provenance: c.provenance,
        })),
      ],
    },
    requirements: hygienic.requirements,
    uncertainties: hygienic.uncertainties,
    contradictions: hygienic.contradictions,
    statements: statements.map((st) =>
      st.id === statement.id ? { ...st, reasonedAt } : st,
    ),
    revision: (intent.revision ?? 0) + 1,
    nextQuestion: out.nextQuestion ?? null,
  };
  return {
    payload: next,
    meta: {
      provider: "claude-artifact",
      generatedAt: reasonedAt,
      downgrades,
      inputVersion: ctx.searchVersion,
    },
    traitWarnings: traitWarningsOf({
      requirements: next.requirements,
      uncertainties: next.uncertainties,
    }),
    previous: state.artifacts.intent?.payload
      ? {
          payload: state.artifacts.intent.payload,
          meta: state.artifacts.intent.meta,
        }
      : undefined,
  };
}

// ── Candidates ──────────────────────────────────────────────────────────────

export function candidateContext(cand: StoredCandidate): string {
  const lines = [
    `Name: ${cand.name}`,
    cand.currentTitle ? `Current title: ${cand.currentTitle}` : "",
    cand.currentCompany ? `Current company: ${cand.currentCompany}` : "",
    cand.geography ? `Geography: ${cand.geography}` : "",
    cand.notes ? `Recruiter notes: ${cand.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Sources are listed with their ids so an evidence item can name the one
  // it quotes, and a link is explicitly marked as content this page does
  // not hold — nothing is ever fetched.
  const sources = sourcesFor(cand);
  const rendered = sources
    .map((src) =>
      src.kind === "link"
        ? `### Source id: ${src.id} (LINK — contents NOT available; never quote from this)\n${src.url ?? src.label}`
        : `### Source id: ${src.id} (${src.label})\n${clip(src.text, 6000)}`,
    )
    .join("\n\n");

  return `## Candidate\n${lines}\n\n## Attached sources\n${
    sources.length
      ? `Quote only from these, verbatim, and name the source id you quoted.\n\n${rendered}`
      : 'None. Nothing has been supplied about this person, so every criterion is "unknown" with no quote.'
  }`;
}

export async function runCandidateTask(
  kind: "evidence" | "outreach",
  cand: StoredCandidate,
  ui?: UiHooks,
): Promise<StoredRecord> {
  const task = CANDIDATE_TASKS[kind];
  const ctx = currentContext();
  if (!ctx) throw new GenerationError("upstream_error", "No search selected.");
  const evidence = cand.evidence?.payload as EvidencePayload | undefined;
  const evidencePart =
    kind === "outreach" && evidence
      ? `\n## Evidence available for personalization\n${clip(JSON.stringify(evidence.items, null, 1), 4000)}`
      : "";
  const prompt = `${systemPrelude(task.persona)}

${task.rules}

${baseContext()}

${candidateContext(cand)}${evidencePart}

## Task
${task.ask}

## Output format
Reply with ONLY one JSON object (no markdown fences, no commentary) of this shape:
${task.shape}`;
  const raw = await sampleJson(prompt, ui, false);
  const { value: cleaned, downgrades } = downgradeVerified(deepCopy(raw));
  const payload = normalizeGenerated(kind, cleaned);
  return {
    payload,
    meta: {
      provider: "claude-artifact",
      generatedAt: nowIso(),
      downgrades,
      inputVersion: ctx.searchVersion,
    },
    traitWarnings: traitWarningsOf(payload),
  };
}

export async function runCandidateAgents(
  cand: StoredCandidate,
  ui: UiHooks,
): Promise<StoredCandidate> {
  ui.step?.("evidence agent");
  let next: StoredCandidate = {
    ...cand,
    evidence: await runCandidateTask("evidence", cand, ui),
  };
  await putCandidate(next);
  ui.step?.("outreach agent");
  next = { ...next, outreach: await runCandidateTask("outreach", next, ui) };
  await putCandidate(next);
  return next;
}

export function candidatePlan(): ExecutionPlan {
  return planExecution({
    kind: "candidate",
    modules: [
      { key: "evidence", label: "Evidence alignment" },
      { key: "outreach", label: "Outreach drafts" },
    ],
    withCritic: false,
  });
}
