/**
 * Canonical hiring-intelligence service (D-011): owns the one
 * hiring_intelligence document per search and the adaptive-intake loop.
 *
 * Ownership rules enforced here, not just documented:
 * - intent.statements is append-only and verbatim; model output schemas
 *   cannot even express it (see core/ir.ts), so nothing generated can
 *   rewrite what the hiring manager said.
 * - The revision counter bumps on every intake-loop update; once statements
 *   exist the intent is updated, never regenerated from scratch.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { GenerationMeta } from "@/lib/core/enums";
import type { Db } from "@/lib/db/client";
import { hiringIntelligence } from "@/lib/db/schema";
import {
  type CanonicalIntelligence,
  type HiringIntentIR,
  type ManagerStatement,
  type NextQuestion,
} from "@/lib/core/ir";
import {
  composeQueries,
  type ComposedQuery,
} from "@/lib/domain/search-strings";
import { loadProjectContext } from "@/lib/ai/context";
import { runAiTask } from "@/lib/ai/run";
import { hiringNeedTask } from "@/lib/ai/tasks/hiring-need";
import { intakeReasonTask } from "@/lib/ai/tasks/intake-reason";
import { searchPlanTask } from "@/lib/ai/tasks/search-plan";

export async function getIntelligence(db: Db, projectId: string) {
  const [row] = await db
    .select()
    .from(hiringIntelligence)
    .where(eq(hiringIntelligence.searchProjectId, projectId));
  return row;
}

async function persist(
  db: Db,
  projectId: string,
  payload: CanonicalIntelligence,
  meta?: GenerationMeta,
) {
  await db
    .insert(hiringIntelligence)
    .values({ searchProjectId: projectId, payload, meta })
    .onConflictDoUpdate({
      target: hiringIntelligence.searchProjectId,
      set: { payload, meta, updatedAt: new Date().toISOString() },
    });
}

async function requireIntent(db: Db, projectId: string) {
  const row = await getIntelligence(db, projectId);
  if (!row) {
    throw new Error(
      "No canonical intelligence yet — derive the hiring need first.",
    );
  }
  return row;
}

/**
 * JD → HiringNeedIR + initial HiringIntentIR. The first interpretation
 * step; downstream agents consume the IR instead of the raw JD. Re-running
 * re-reads the JD but always preserves the verbatim statement log.
 */
export async function deriveHiringNeed(
  db: Db,
  projectId: string,
  critique?: string[],
) {
  const ctx = await loadProjectContext(db, projectId, critique);
  const { output, meta, warnings } = await runAiTask(hiringNeedTask, ctx, {
    db,
    searchProjectId: projectId,
  });
  const existing = await getIntelligence(db, projectId);
  const intent: HiringIntentIR = {
    ...output,
    statements: existing?.payload.intent.statements ?? [],
    revision: existing ? existing.payload.intent.revision + 1 : 0,
  };
  const payload: CanonicalIntelligence = { ...existing?.payload, intent };
  await persist(db, projectId, payload, meta);
  return { intent, warnings };
}

/**
 * One read-only turn of the intake loop: propose the highest-information
 * next question without mutating the stored intent.
 */
export async function proposeNextQuestion(
  db: Db,
  projectId: string,
): Promise<{ nextQuestion: NextQuestion | null }> {
  const row = await requireIntent(db, projectId);
  const project = await loadProjectContext(db, projectId);
  const { output } = await runAiTask(
    intakeReasonTask,
    { project, intent: row.payload.intent },
    { db, searchProjectId: projectId },
  );
  return { nextQuestion: output.nextQuestion };
}

export const recordManagerStatementInput = z.object({
  searchProjectId: z.string(),
  text: z.string().min(1),
  speaker: z.string().default("hiring_manager"),
  /** What prompted it — usually the question that was asked. */
  context: z.string().optional(),
});

/**
 * The adaptive-intake loop (IntakeReasoner): append the statement verbatim,
 * run one reasoning turn, merge the updated requirement/uncertainty/
 * contradiction sets, bump the revision, and return the next question.
 */
export async function recordManagerStatement(
  db: Db,
  input: z.infer<typeof recordManagerStatementInput>,
) {
  const row = await requireIntent(db, input.searchProjectId);
  const current = row.payload.intent;
  const statement: ManagerStatement = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    speaker: input.speaker,
    text: input.text,
    context: input.context,
  };
  const project = await loadProjectContext(db, input.searchProjectId);
  const { output, meta, warnings } = await runAiTask(
    intakeReasonTask,
    { project, intent: current, statement },
    { db, searchProjectId: input.searchProjectId },
  );
  const intent: HiringIntentIR = {
    need: {
      ...current.need,
      claims: [...current.need.claims, ...output.extractedClaims],
    },
    requirements: output.requirements,
    uncertainties: output.uncertainties,
    contradictions: output.contradictions,
    statements: [...current.statements, statement],
    revision: current.revision + 1,
  };
  await persist(db, input.searchProjectId, { ...row.payload, intent }, meta);
  return { intent, nextQuestion: output.nextQuestion, warnings };
}

/**
 * HiringIntentIR → SuccessIR + EvidenceIR + TalentPopulationIR +
 * SearchPlanIR, persisted alongside the intent.
 */
export async function deriveSearchPlan(
  db: Db,
  projectId: string,
  critique?: string[],
) {
  const row = await requireIntent(db, projectId);
  const ctx = await loadProjectContext(db, projectId, critique);
  const { output, meta, warnings } = await runAiTask(searchPlanTask, ctx, {
    db,
    searchProjectId: projectId,
  });
  const payload: CanonicalIntelligence = {
    intent: row.payload.intent,
    success: output.success,
    evidence: output.evidence,
    population: output.population,
    searchPlan: output.searchPlan,
  };
  await persist(db, projectId, payload, meta);
  return { payload, warnings };
}

export interface PlannedQueries {
  segmentLabel: string;
  linkedRequirementIds: string[];
  rationale: string;
  queries: ComposedQuery[];
}

/**
 * Deterministic: SearchPlanIR query plans → the validated composer →
 * concrete, always-visible query strings. No model call.
 */
export async function composeDiscoveryQueries(
  db: Db,
  projectId: string,
): Promise<PlannedQueries[]> {
  const row = await requireIntent(db, projectId);
  const plan = row.payload.searchPlan;
  if (!plan) {
    throw new Error("No SearchPlanIR yet — derive the search plan first.");
  }
  return plan.queryPlans.map((queryPlan) => ({
    segmentLabel: queryPlan.segmentLabel,
    linkedRequirementIds: queryPlan.linkedRequirementIds,
    rationale: queryPlan.rationale,
    queries: composeQueries({
      titles: queryPlan.titles,
      alternateTitles: queryPlan.alternateTitles,
      adjacentTitles: queryPlan.adjacentTitles,
      mustHave: queryPlan.mustHaveTerms,
      anyOf: queryPlan.anyOfTerms,
      credentials: queryPlan.credentials,
      locations: queryPlan.locations,
      companies: [],
      exclusions: queryPlan.exclusions,
    }),
  }));
}
