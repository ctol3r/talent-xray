/**
 * W12 runner (W12_EVAL_SPEC.md §4): drives every conversation through the
 * real services against a throwaway database, runs the deterministic
 * checks after each step, re-plans where the expectation requires it, and
 * asks the judge once per conversation. Resumable under the session
 * provider: state is persisted after every step and a parked request is
 * recorded, so re-running after fulfilment continues where it stopped.
 */
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { hiringIntelligence, searchProjects } from "@/lib/db/schema";
import type {
  HiringIntentIR,
  HiringNeedOutput,
  IntakeReasoningOutput,
  SearchPlanOutput,
  AudiencePersonaIR,
} from "@/lib/core/ir";
import { SessionFulfillmentPendingError } from "@/lib/ai/session";
import { runAiTask } from "@/lib/ai/run";
import { createMockResearchProvider } from "@/lib/research/mock-research";
import {
  createSearchProject,
  saveJobDescription,
} from "@/lib/services/search-projects";
import {
  composeDiscoveryQueries,
  deriveHiringNeed,
  derivePersonas,
  deriveSearchPlan,
  getIntelligence,
  recordManagerStatement,
} from "@/lib/services/intelligence";
import {
  checkReplan,
  checkTurn,
  type CheckResult,
  type TurnInputs,
} from "./checks";
import {
  expectationText,
  judgeTask,
  type JudgeOutput,
  type JudgeTurnView,
} from "./judge";
import type { ParsedConversation } from "./schema";

export interface TurnRecord {
  turnIndex: number;
  status: "done" | "pending" | "error";
  pendingRequest?: string;
  check?: CheckResult;
  replan?: CheckResult;
  replanRan?: boolean;
  personasRan?: boolean;
  error?: string;
}

export interface ConversationRecord {
  id: string;
  occupation: string;
  fixtureLetter?: string;
  categories: number[];
  status: "done" | "pending" | "error" | "not_started";
  projectId?: string;
  initial?: TurnRecord;
  turns: TurnRecord[];
  judge?: JudgeOutput;
  judgePending?: string;
  error?: string;
}

export interface RunState {
  runName: string;
  startedAt: string;
  provider: string;
  conversations: Record<string, ConversationRecord>;
}

export interface RunOptions {
  db: Db;
  runName: string;
  resultsDir: string;
  conversations: ParsedConversation[];
  judge: boolean;
  providerLabel: string;
  /** When set, only these conversations run their expected re-plans. */
  replanOnly?: string[];
}

/** The stratified live subset (§5): every special fixture, two each, all 20 categories. */
export const STRATIFIED_SUBSET = [
  "a-01",
  "a-03",
  "b-02",
  "b-05",
  "c-01",
  "c-03",
  "d-01",
  "d-02",
  "e-02",
  "e-05",
  "f-02",
  "f-05",
  "g-04",
  "g-05",
  "h-02",
  "h-03",
  "i-02",
  "i-04",
  "j-02",
  "j-04",
];

function statePath(dir: string): string {
  return path.join(dir, "state.json");
}

export function loadState(
  dir: string,
  runName: string,
  provider: string,
): RunState {
  const p = statePath(dir);
  if (fs.existsSync(p))
    return JSON.parse(fs.readFileSync(p, "utf8")) as RunState;
  return {
    runName,
    startedAt: new Date().toISOString(),
    provider,
    conversations: {},
  };
}

function saveState(dir: string, state: RunState): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(statePath(dir), JSON.stringify(state, null, 2));
}

function snapshotPath(dir: string, id: string, step: string): string {
  return path.join(dir, "snapshots", id, `${step}.json`);
}

function writeSnapshot(
  dir: string,
  id: string,
  step: string,
  data: unknown,
): void {
  const p = snapshotPath(dir, id, step);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function readSnapshot<T>(dir: string, id: string, step: string): T | undefined {
  const p = snapshotPath(dir, id, step);
  return fs.existsSync(p)
    ? (JSON.parse(fs.readFileSync(p, "utf8")) as T)
    : undefined;
}

function projectFacts(c: ParsedConversation): string {
  return Object.values(c.project).filter(Boolean).join("\n");
}

function isPending(error: unknown): error is SessionFulfillmentPendingError {
  return error instanceof SessionFulfillmentPendingError;
}

interface StepSnapshot {
  before?: HiringIntentIR;
  after: HiringIntentIR;
  output: IntakeReasoningOutput | HiringNeedOutput;
  plan?: SearchPlanOutput;
  composed?: {
    segmentLabel: string;
    queries: { platform: string; breadth: string; query: string }[];
  }[];
  personas?: AudiencePersonaIR[];
}

async function currentIntent(
  db: Db,
  projectId: string,
): Promise<HiringIntentIR> {
  const row = await getIntelligence(db, projectId);
  if (!row) throw new Error("no intelligence row");
  return row.payload.intent;
}

/**
 * Run (or resume) one conversation. Returns when it is done, parked on a
 * request, or errored; the state is persisted either way.
 */
export async function runConversation(
  opts: RunOptions,
  state: RunState,
  c: ParsedConversation,
): Promise<ConversationRecord> {
  const { db, resultsDir } = opts;
  const rec: ConversationRecord = state.conversations[c.id] ?? {
    id: c.id,
    occupation: c.occupation,
    fixtureLetter: c.fixtureLetter,
    categories: c.categories,
    status: "not_started",
    turns: [],
  };
  state.conversations[c.id] = rec;
  const persist = () => saveState(resultsDir, state);
  const inputs = (uptoTurn: number): TurnInputs => ({
    jd: c.jd,
    projectFacts: projectFacts(c),
    statements: c.turns.slice(0, uptoTurn + 1).map((t) => t.text),
  });

  try {
    if (!rec.projectId) {
      const project = await createSearchProject(db, {
        name: `${c.id} · ${c.project.name}`,
        companyName: c.project.companyName,
        roleTitle: c.project.roleTitle,
        geography: c.project.geography,
        country: c.project.country,
        industry: c.project.industry,
        seniority: c.project.seniority,
        businessObjective: c.project.businessObjective,
      });
      rec.projectId = project.id;
      await saveJobDescription(db, {
        searchProjectId: project.id,
        rawText: c.jd,
        source: "pasted",
      });
      persist();
    }
    const projectId = rec.projectId;

    // ── initial derivation ────────────────────────────────────────────────
    if (rec.initial?.status !== "done") {
      rec.status = "pending";
      try {
        const existing = await getIntelligence(db, projectId);
        const intent = existing
          ? existing.payload.intent
          : (await deriveHiringNeed(db, projectId)).intent;
        const output: HiringNeedOutput = {
          need: intent.need,
          requirements: intent.requirements,
          uncertainties: intent.uncertainties,
          contradictions: intent.contradictions,
        };
        const check = checkTurn({
          conversation: c,
          turnIndex: -1,
          expectation: c.initial,
          after: intent,
          output,
          inputs: { jd: c.jd, projectFacts: projectFacts(c), statements: [] },
        });
        writeSnapshot(resultsDir, c.id, "initial", {
          after: intent,
          output,
        } satisfies StepSnapshot);
        rec.initial = { turnIndex: -1, status: "done", check };
        persist();
      } catch (error) {
        if (isPending(error)) {
          rec.initial = {
            turnIndex: -1,
            status: "pending",
            pendingRequest: error.requestPath,
          };
          persist();
          return rec;
        }
        throw error;
      }
    }

    // ── turns ─────────────────────────────────────────────────────────────
    for (let i = 0; i < c.turns.length; i += 1) {
      const turn = c.turns[i];
      const existingRec = rec.turns[i];
      if (
        existingRec?.status === "done" &&
        (existingRec.replanRan || !turn.expect.replan?.required)
      )
        continue;
      const before =
        i === 0
          ? readSnapshot<StepSnapshot>(resultsDir, c.id, "initial")!.after
          : readSnapshot<StepSnapshot>(resultsDir, c.id, `turn-${i - 1}`)!
              .after;
      const turnRec: TurnRecord = existingRec ?? {
        turnIndex: i,
        status: "pending",
      };
      rec.turns[i] = turnRec;
      rec.status = "pending";

      let snapshot = readSnapshot<StepSnapshot>(resultsDir, c.id, `turn-${i}`);
      if (turnRec.status !== "done") {
        try {
          const live = await currentIntent(db, projectId);
          const alreadyReasoned =
            live.statements.length === i + 1 && live.statements[i]?.reasonedAt;
          const result = alreadyReasoned
            ? { intent: live, nextQuestion: null }
            : await recordManagerStatement(db, {
                searchProjectId: projectId,
                text: turn.text,
                speaker: turn.speaker,
                context: turn.context,
              });
          const after = result.intent;
          const output: IntakeReasoningOutput = {
            extractedClaims: after.need.claims.slice(before.need.claims.length),
            requirements: after.requirements,
            uncertainties: after.uncertainties,
            contradictions: after.contradictions,
            nextQuestion: result.nextQuestion,
          };
          const check = checkTurn({
            conversation: c,
            turnIndex: i,
            expectation: turn.expect,
            before,
            after,
            output,
            inputs: inputs(i),
          });
          snapshot = { before, after, output };
          writeSnapshot(resultsDir, c.id, `turn-${i}`, snapshot);
          turnRec.status = "done";
          turnRec.check = check;
          turnRec.pendingRequest = undefined;
          persist();
        } catch (error) {
          if (isPending(error)) {
            turnRec.status = "pending";
            turnRec.pendingRequest = error.requestPath;
            persist();
            return rec;
          }
          throw error;
        }
      }

      // ── re-plan where the expectation requires it ───────────────────────
      const replanAllowed = !opts.replanOnly || opts.replanOnly.includes(c.id);
      if (
        turn.expect.replan?.required &&
        replanAllowed &&
        !turnRec.replanRan &&
        snapshot
      ) {
        try {
          const { payload } = await deriveSearchPlan(db, projectId);
          const plan: SearchPlanOutput = {
            success: payload.success!,
            evidence: payload.evidence!,
            population: payload.population!,
            searchPlan: payload.searchPlan!,
          };
          const composedFull = await composeDiscoveryQueries(db, projectId);
          const composed = composedFull.map((p) => ({
            segmentLabel: p.segmentLabel,
            queries: p.queries,
          }));
          let personas: AudiencePersonaIR[] | undefined;
          if (
            turn.expect.replan.changes.some((ch) => ch.dimension === "persona")
          ) {
            const derived = await derivePersonas(db, projectId, {
              researchProvider: createMockResearchProvider(),
            });
            personas = derived.personas;
            turnRec.personasRan = true;
          }
          const proxyTerms = turn.expect.requirements.flatMap(
            (r) => r.proxyTerms ?? [],
          );
          const replan = checkReplan({
            expectation: turn.expect,
            plan,
            composed,
            personas,
            proxyTerms,
          });
          snapshot.plan = plan;
          snapshot.composed = composed.map((s) => ({
            segmentLabel: s.segmentLabel,
            queries: s.queries.map((q) => ({
              platform: q.platform,
              breadth: q.breadth,
              query: q.query,
            })),
          }));
          snapshot.personas = personas;
          writeSnapshot(resultsDir, c.id, `turn-${i}`, snapshot);
          turnRec.replan = replan;
          turnRec.replanRan = true;
          turnRec.pendingRequest = undefined;
          persist();
        } catch (error) {
          if (isPending(error)) {
            turnRec.pendingRequest = error.requestPath;
            persist();
            return rec;
          }
          throw error;
        }
      }
    }

    // ── judge ─────────────────────────────────────────────────────────────
    if (opts.judge && !rec.judge) {
      const views: JudgeTurnView[] = [];
      const initial = readSnapshot<StepSnapshot>(resultsDir, c.id, "initial")!;
      views.push({
        turnIndex: -1,
        expectationText: expectationText(c.initial),
        intent: initial.after,
        nextQuestion: null,
      });
      for (let i = 0; i < c.turns.length; i += 1) {
        const snap = readSnapshot<StepSnapshot>(resultsDir, c.id, `turn-${i}`)!;
        views.push({
          turnIndex: i,
          statement: {
            speaker: c.turns[i].speaker,
            text: c.turns[i].text,
            context: c.turns[i].context,
          },
          expectationText: expectationText(c.turns[i].expect),
          intent: snap.after,
          nextQuestion:
            "nextQuestion" in snap.output ? snap.output.nextQuestion : null,
          plan: snap.plan
            ? {
                population: snap.plan.population,
                searchPlan: snap.plan.searchPlan,
                composed: (snap.composed ?? []).flatMap((s) =>
                  s.queries.map(
                    (q) =>
                      `[${s.segmentLabel} · ${q.platform} · ${q.breadth}] ${q.query}`,
                  ),
                ),
              }
            : undefined,
        });
      }
      try {
        const { output } = await runAiTask(
          judgeTask,
          { conversation: c, turns: views },
          { db, searchProjectId: projectId },
        );
        rec.judge = output;
        rec.judgePending = undefined;
        persist();
      } catch (error) {
        if (isPending(error)) {
          rec.judgePending = error.requestPath;
          persist();
          return rec;
        }
        throw error;
      }
    }

    rec.status = "done";
    persist();
    return rec;
  } catch (error) {
    rec.status = "error";
    rec.error = error instanceof Error ? error.message : String(error);
    persist();
    return rec;
  }
}

export async function runAll(opts: RunOptions): Promise<RunState> {
  const state = loadState(opts.resultsDir, opts.runName, opts.providerLabel);
  for (const c of opts.conversations) {
    await runConversation(opts, state, c);
  }
  saveState(opts.resultsDir, state);
  return state;
}

/** Project rows created by a run (for inspection). */
export async function listRunProjects(db: Db, state: RunState) {
  const ids = Object.values(state.conversations)
    .map((r) => r.projectId)
    .filter((x): x is string => Boolean(x));
  const rows = [];
  for (const id of ids) {
    const [p] = await db
      .select()
      .from(searchProjects)
      .where(eq(searchProjects.id, id));
    const [h] = await db
      .select()
      .from(hiringIntelligence)
      .where(eq(hiringIntelligence.searchProjectId, id));
    rows.push({ project: p?.name, revision: h?.payload.intent.revision });
  }
  return rows;
}
