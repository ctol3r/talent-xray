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
 * The adaptive-intake loop (IntakeReasoner), in two durable phases so it
 * is resumable under the session provider:
 *   1. Append the statement verbatim and persist it immediately (no
 *      `reasonedAt`). A re-run with the same text reuses that stored
 *      statement instead of minting a new id — so the reasoner's prompt,
 *      and therefore the session request hash, is stable.
 *   2. Run one reasoning turn over the stored statement, merge the updated
 *      requirement/uncertainty/contradiction sets, stamp `reasonedAt`, bump
 *      the revision, and return the next question.
 */
export async function recordManagerStatement(
  db: Db,
  rawInput: z.input<typeof recordManagerStatementInput>,
) {
  const input = recordManagerStatementInput.parse(rawInput);
  const row = await requireIntent(db, input.searchProjectId);
  const current = row.payload.intent;
  const last = current.statements.at(-1);
  const pending =
    last && !last.reasonedAt && last.text === input.text ? last : undefined;
  const statement: ManagerStatement = pending ?? {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    speaker: input.speaker,
    text: input.text,
    context: input.context,
  };
  if (!pending) {
    if (last && !last.reasonedAt) {
      throw new Error(
        "The previous hiring-manager statement has not been reasoned over yet — re-run it before recording another.",
      );
    }
    await persist(db, input.searchProjectId, {
      ...row.payload,
      intent: { ...current, statements: [...current.statements, statement] },
    });
  }
  const stored: HiringIntentIR = pending
    ? current
    : { ...current, statements: [...current.statements, statement] };

  const project = await loadProjectContext(db, input.searchProjectId);
  const { output, meta, warnings } = await runAiTask(
    intakeReasonTask,
    { project, intent: stored, statement },
    { db, searchProjectId: input.searchProjectId },
  );
  const reasonedAt = new Date().toISOString();
  const intent: HiringIntentIR = {
    need: {
      ...stored.need,
      claims: [...stored.need.claims, ...output.extractedClaims],
    },
    requirements: output.requirements,
    uncertainties: output.uncertainties,
    contradictions: output.contradictions,
    statements: stored.statements.map((s) =>
      s.id === statement.id ? { ...s, reasonedAt } : s,
    ),
    revision: stored.revision + 1,
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

/** Case-insensitive de-duplication, also dropping anything in `against`. */
function dedupeTerms(terms: string[], against: string[] = []): string[] {
  const seen = new Set(against.map((t) => t.trim().toLowerCase()));
  const out: string[] = [];
  for (const term of terms) {
    const key = term.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(term.trim());
  }
  return out;
}

/**
 * Deterministic: SearchPlanIR query plans → the validated composer →
 * concrete, always-visible query strings. No model call. Lists are
 * de-duplicated here (alternates against primaries, adjacents against
 * both) so a model that repeats a title never yields a redundant OR group.
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
  return plan.queryPlans.map((queryPlan) => {
    const titles = dedupeTerms(queryPlan.titles);
    const alternateTitles = dedupeTerms(queryPlan.alternateTitles, titles);
    const adjacentTitles = dedupeTerms(queryPlan.adjacentTitles, [
      ...titles,
      ...alternateTitles,
    ]);
    const mustHave = dedupeTerms(queryPlan.mustHaveTerms);
    return {
      segmentLabel: queryPlan.segmentLabel,
      linkedRequirementIds: queryPlan.linkedRequirementIds,
      rationale: queryPlan.rationale,
      queries: composeQueries({
        titles,
        alternateTitles,
        adjacentTitles,
        mustHave,
        anyOf: dedupeTerms(queryPlan.anyOfTerms, mustHave),
        credentials: dedupeTerms(queryPlan.credentials),
        locations: dedupeTerms(queryPlan.locations),
        companies: [],
        exclusions: dedupeTerms(queryPlan.exclusions),
      }),
    };
  });
}
