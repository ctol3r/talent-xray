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
import {
  hiringIntelligence,
  searchQueries,
  sourceChannels,
} from "@/lib/db/schema";
import {
  type AudiencePersonaIR,
  type CanonicalIntelligence,
  type HiringIntentIR,
  type ManagerStatement,
  type NextQuestion,
} from "@/lib/core/ir";
import {
  decisionsForQuery,
  deriveTermDecisions,
  signalsFingerprint,
  type CalibrationSignals,
  type LinkOutcome,
} from "@/lib/domain/calibration";
import {
  normalizeQueryKey,
  prepareQueries,
  type PreparedQuery,
  type PrepareResult,
} from "@/lib/domain/query-normalization";
import type { TermDecision } from "@/lib/core/payloads";
import { loadProjectContext } from "@/lib/ai/context";
import { runAiTask } from "@/lib/ai/run";
import { hiringNeedTask } from "@/lib/ai/tasks/hiring-need";
import { intakeReasonTask } from "@/lib/ai/tasks/intake-reason";
import { applyIntakeHygiene } from "@/lib/domain/intake-hygiene";
import { personasTask } from "@/lib/ai/tasks/personas";
import { searchPlanTask } from "@/lib/ai/tasks/search-plan";
import {
  getResearchProvider,
  type ResearchProvider,
} from "@/lib/research/provider";
import {
  audienceSegments,
  researchAudience,
  ResearchRequiredError,
} from "./research";

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
  // W12 S-2/S-3/S-4/S-10/S-11: deterministic backstops behind the
  // reasoner's own rules — see src/lib/domain/intake-hygiene.ts.
  const hygienic = applyIntakeHygiene(output, stored, project.jdText, [
    ...stored.statements,
  ]);
  const intent: HiringIntentIR = {
    need: {
      ...stored.need,
      claims: [...stored.need.claims, ...output.extractedClaims],
    },
    requirements: hygienic.requirements,
    uncertainties: hygienic.uncertainties,
    contradictions: hygienic.contradictions,
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
  // Personas are bound to the population segments, so a re-plan drops them;
  // derivePersonas rebuilds them from the stored research findings.
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
  queries: PreparedQuery[];
  qa: Pick<PrepareResult, "pruned" | "droppedDuplicates" | "inputNotes">;
  /** Wave B: calibration decisions applied to this segment's vocabulary. */
  decisions: TermDecision[];
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
  calibration?: { signals: CalibrationSignals; outcomes: LinkOutcome[] },
): Promise<PlannedQueries[]> {
  const row = await requireIntent(db, projectId);
  const plan = row.payload.searchPlan;
  if (!plan) {
    throw new Error("No SearchPlanIR yet — derive the search plan first.");
  }
  const channels = await db
    .select({
      name: sourceChannels.name,
      kind: sourceChannels.kind,
      url: sourceChannels.url,
      status: sourceChannels.status,
    })
    .from(sourceChannels)
    .where(eq(sourceChannels.searchProjectId, projectId));
  return plan.queryPlans.map((queryPlan) => {
    const raw = {
      titles: queryPlan.titles,
      alternateTitles: queryPlan.alternateTitles,
      adjacentTitles: queryPlan.adjacentTitles,
      mustHave: queryPlan.mustHaveTerms,
      anyOf: queryPlan.anyOfTerms,
      credentials: queryPlan.credentials,
      locations: queryPlan.locations,
      companies: [],
      exclusions: queryPlan.exclusions,
    };
    const { input, decisions } = calibration
      ? deriveTermDecisions(raw, calibration.signals, calibration.outcomes)
      : { input: raw, decisions: [] };
    const prepared = prepareQueries({ input, channels });
    return {
      segmentLabel: queryPlan.segmentLabel,
      linkedRequirementIds: queryPlan.linkedRequirementIds,
      rationale: queryPlan.rationale,
      queries: prepared.rows,
      qa: {
        pruned: prepared.pruned,
        droppedDuplicates: prepared.droppedDuplicates,
        inputNotes: prepared.inputNotes,
      },
      decisions,
    };
  });
}

/**
 * Persist the plan-derived strings (Wave B): the deterministic IR path gets
 * a real caller, so `linkedRequirementIds` land on rows. Rows are
 * de-duplicated by normalized text against what is already stored; when a
 * planned row collides with an existing one, the requirement linkage is
 * merged onto the surviving row instead of being lost.
 */
export async function generatePlannedQueries(db: Db, projectId: string) {
  const { loadCalibrationSignals } = await import("./calibration");
  const calibration = await loadCalibrationSignals(db, projectId);
  const planned = await composeDiscoveryQueries(db, projectId, calibration);
  const generatedAt = new Date().toISOString();
  const existing = await db
    .select({
      id: searchQueries.id,
      query: searchQueries.query,
      archived: searchQueries.archived,
      linkedRequirementIds: searchQueries.linkedRequirementIds,
    })
    .from(searchQueries)
    .where(eq(searchQueries.searchProjectId, projectId));
  const byKey = new Map(
    existing
      .filter((q) => !q.archived)
      .map((q) => [normalizeQueryKey(q.query), q]),
  );
  const seenKeys = new Set<string>();
  const rows: (typeof searchQueries.$inferInsert)[] = [];
  let merged = 0;
  const decisions: TermDecision[] = [];
  for (const segment of planned) {
    decisions.push(...segment.decisions);
    for (const q of segment.queries) {
      const key = normalizeQueryKey(q.query);
      const rowDecisions = decisionsForQuery(q.query, segment.decisions);
      const linked = [
        ...new Set([
          ...segment.linkedRequirementIds,
          ...rowDecisions.flatMap((d) => d.requirementIds),
        ]),
      ];
      const collision = byKey.get(key);
      if (collision) {
        const union = [
          ...new Set([...(collision.linkedRequirementIds ?? []), ...linked]),
        ];
        if (union.length !== (collision.linkedRequirementIds ?? []).length) {
          await db
            .update(searchQueries)
            .set({ linkedRequirementIds: union })
            .where(eq(searchQueries.id, collision.id));
          merged += 1;
        }
        continue;
      }
      if (seenKeys.has(key) || q.query.trim() === "") continue;
      seenKeys.add(key);
      rows.push({
        searchProjectId: projectId,
        platform: q.platform,
        query: q.query,
        purpose: `${segment.segmentLabel} — ${q.purpose}`,
        breadth: q.breadth,
        expectedPrecision: q.expectedPrecision,
        targetPhenotype: segment.segmentLabel,
        provenance: "model_inference",
        qaMeta: { ...q.qa, notes: [...segment.qa.inputNotes, ...q.qa.notes] },
        calibration: {
          generatedAt,
          reviewedLinks: calibration.signals.reviewedLinks,
          signalsHash: signalsFingerprint(calibration.outcomes),
          decisions: rowDecisions,
        },
        linkedRequirementIds: linked,
      });
    }
  }
  if (rows.length > 0) await db.insert(searchQueries).values(rows);
  return {
    added: rows.length,
    merged,
    segments: planned.length,
    decisions,
    reviewedLinks: calibration.signals.reviewedLinks,
  };
}

/**
 * Derive the hiring need when no canonical document exists yet, so a
 * downstream step (personas, outreach) never runs against the raw JD.
 */
export async function ensureIntent(db: Db, projectId: string) {
  const existing = await getIntelligence(db, projectId);
  if (existing) return existing;
  await deriveHiringNeed(db, projectId);
  return requireIntent(db, projectId);
}

/**
 * Provenance enforcement for personas (D-013): a citation may point only at
 * a finding that was actually provided; anything else is fabricated and is
 * dropped. A persona left with no citation is refused — the gate exists so
 * that no persona rests on the model's "knowledge" of an audience.
 */
export function groundPersonas(
  personas: AudiencePersonaIR[],
  allowedUrls: Iterable<string>,
): { personas: AudiencePersonaIR[]; droppedCitations: number } {
  const allowed = new Set(allowedUrls);
  let droppedCitations = 0;
  const grounded = personas.map((persona) => {
    const researchCitations = persona.researchCitations.filter((citation) =>
      allowed.has(citation.url),
    );
    droppedCitations +=
      persona.researchCitations.length - researchCitations.length;
    if (researchCitations.length === 0) {
      throw new Error(
        `Persona "${persona.label}" cites no provided research finding — refusing to store an ungrounded persona.`,
      );
    }
    return {
      ...persona,
      id: persona.id ?? crypto.randomUUID(),
      researchCitations,
      provenance: "research" as const,
    };
  });
  return { personas: grounded, droppedCitations };
}

/**
 * Research gate (D-013): audience research first (idempotent per query),
 * then one AudiencePersonaIR per talent segment, each grounded in the
 * stored findings. Audience-level only — never an individual candidate.
 */
export async function derivePersonas(
  db: Db,
  projectId: string,
  options: { critique?: string[]; researchProvider?: ResearchProvider } = {},
) {
  await ensureIntent(db, projectId);
  const provider = options.researchProvider ?? getResearchProvider();
  const { findings } = await researchAudience(db, projectId, provider);
  if (findings.length === 0) throw new ResearchRequiredError(provider.name);

  const row = await requireIntent(db, projectId);
  const ctx = await loadProjectContext(db, projectId, options.critique);
  const segments = audienceSegments(ctx.project, row.payload);
  const { output, meta, warnings } = await runAiTask(
    personasTask,
    {
      project: ctx,
      segments,
      findings: findings.map((f) => ({
        url: f.url,
        title: f.title ?? undefined,
        snippet: f.snippet ?? undefined,
        query: f.query ?? "",
      })),
    },
    { db, searchProjectId: projectId },
  );
  const { personas, droppedCitations } = groundPersonas(
    output.personas,
    findings.map((f) => f.url),
  );
  const latest = await requireIntent(db, projectId);
  await persist(db, projectId, { ...latest.payload, personas }, meta);
  return { personas, findings, droppedCitations, warnings };
}

/** Manual intake stays available with no model credentials. This is the canonical writer. */
export async function addReviewRequirement(db: Db, raw: unknown) {
  const input = z
    .object({
      searchProjectId: z.string().min(1),
      statement: z.string().trim().min(1).max(4000),
      origin: z.enum(["jd", "manager_statement"]),
      jdVersionId: z.string().optional(),
      anchor: z
        .object({
          start: z.number().int().nonnegative(),
          end: z.number().int().positive(),
          quote: z.string(),
        })
        .optional(),
    })
    .parse(raw);
  const { listDocuments } = await import("./documents");
  const { validateAnchor } = await import("@/lib/documents/contracts");
  const jd = listDocuments(db, input.searchProjectId, undefined, "jd")[0];
  if (input.origin === "jd") {
    if (!jd || jd.id !== input.jdVersionId || !input.anchor)
      throw new Error("Select a passage in the current JD first.");
    validateAnchor(jd.text, input.anchor);
    if (input.statement !== input.anchor.quote.trim())
      throw new Error("The JD requirement must preserve the selected wording.");
  }
  const existing = await getIntelligence(db, input.searchProjectId);
  const intent: HiringIntentIR = existing?.payload.intent ?? {
    need: { businessProblem: "", roleSummary: "", claims: [], unknowns: [] },
    requirements: [],
    uncertainties: [],
    contradictions: [],
    statements: [],
    revision: 0,
  };
  intent.requirements = [
    ...intent.requirements,
    {
      id: crypto.randomUUID(),
      label: input.statement.slice(0, 80),
      statement: input.statement,
      definition: input.statement,
      kind: "must_have",
      origin: input.origin,
      evidenceSpec: [],
      falseSignals: [],
      status: "explicit",
      linkedUncertaintyIds: [],
    },
  ];
  intent.revision++;
  await persist(
    db,
    input.searchProjectId,
    { ...existing?.payload, intent },
    existing?.meta ?? undefined,
  );
  return intent.requirements.at(-1)!;
}
