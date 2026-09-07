"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { act, type ActionResult } from "./helpers";
import { getDb } from "@/lib/db/client";
import { pipelineSnapshots, successProfiles } from "@/lib/db/schema";
import { getAppAdapter } from "@/lib/hsal/adapter";
import { humanActorIdFor } from "@/lib/hsal/client";
import {
  buildSnapshot,
  mergeCriteriaIntoPayload,
  nextLearningId,
  parseProfileLists,
  sameProfile,
  snapshotId,
} from "@/lib/hsal/generic";
import {
  experimentInput,
  learningInput,
  postInterventionInput,
  profileChangeInput,
  snapshotInput,
} from "@/lib/hsal/action-schemas";
import { SP104_ID, sp104 } from "../../../fixtures/sp104";

const projectInput = z.object({ searchProjectId: z.string().min(1) });

/** WHAT'S HAPPENING? + WHAT ELSE COULD EXPLAIN IT? — bind, sync, ingest, generate. Never touches belief confidence. */
export async function runDiagnosisAction(
  input: unknown,
): Promise<
  ActionResult<{ decisionCaseId: string; recommendedTestId?: string }>
> {
  return act(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const db = getDb();
    const { adapter, domain } = getAppAdapter(db);
    const project = await domain.getSearchProject(searchProjectId);
    if (!project)
      throw new Error(`search project ${searchProjectId} not found`);
    await adapter.initializeSearchCase(project);
    for (const c of await domain.getCandidateEvidence(searchProjectId))
      await adapter.ingestCandidateEvidence(c);
    for (const f of await domain.getHMFeedback(searchProjectId))
      await adapter.ingestHMFeedback(f);
    const result = await adapter.diagnoseSearch(searchProjectId);
    revalidatePath(`/searches/${searchProjectId}`, "layout");
    return {
      decisionCaseId: result.decisionCaseId,
      ...(result.recommendedNextTest
        ? { recommendedTestId: result.recommendedNextTest.id }
        : {}),
    };
  });
}

const beliefInput = z.object({
  searchProjectId: z.string().min(1),
  statement: z.string().min(1),
  confidence: z.coerce.number().min(0).max(1),
  id: z.string().optional(),
});

/** WHAT DO YOU THINK? — the recruiter's own belief and confidence. */
export async function captureBeliefAction(
  input: unknown,
): Promise<ActionResult<{ beliefId: string; confidence: number }>> {
  return act(async () => {
    const parsed = beliefInput.parse(input);
    const db = getDb();
    const { adapter, domain } = getAppAdapter(db);
    const project = await domain.getSearchProject(parsed.searchProjectId);
    if (!project)
      throw new Error(`search project ${parsed.searchProjectId} not found`);
    await adapter.initializeSearchCase(project);
    const belief = await adapter.captureRecruiterBelief({
      ...(parsed.id ? { id: parsed.id } : {}),
      searchProjectId: parsed.searchProjectId,
      statement: parsed.statement,
      confidence: parsed.confidence,
      actorId: humanActorIdFor(parsed.searchProjectId),
    });
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return { beliefId: belief.id, confidence: belief.confidence };
  });
}

const selectInput = z.object({
  searchProjectId: z.string().min(1),
  interventionId: z.string().min(1),
});

/** SELECT TEST — explicit human selection; nothing is executed. */
export async function selectTestAction(
  input: unknown,
): Promise<ActionResult<{ status: string }>> {
  return act(async () => {
    const { searchProjectId, interventionId } = selectInput.parse(input);
    const { adapter } = getAppAdapter(getDb());
    const i = await adapter.selectIntervention(
      interventionId,
      humanActorIdFor(searchProjectId),
    );
    revalidatePath(`/searches/${searchProjectId}`, "layout");
    return { status: i.status };
  });
}

/** Record what the experiment showed. For SP104 the seeded result (7/10 advanced) is used when no payload is given. */
export async function recordExperimentResultAction(
  input: unknown,
): Promise<ActionResult<{ evidenceIds: string[] }>> {
  return act(async () => {
    const parsed = experimentInput.parse(input);
    const { adapter } = getAppAdapter(getDb());
    if (parsed.searchProjectId !== SP104_ID && !parsed.observations)
      throw new Error("Enter at least one observation.");
    const result =
      parsed.searchProjectId === SP104_ID && !parsed.observations
        ? { ...sp104.experimentResult, interventionId: parsed.interventionId }
        : {
            id: `EXP-${parsed.interventionId}-${Date.now()}`,
            searchProjectId: parsed.searchProjectId,
            interventionId: parsed.interventionId,
            observedAt: new Date().toISOString(),
            summary: parsed.summary ?? "Experiment result recorded.",
            observations: parsed.observations ?? [],
            metrics: {
              ...(parsed.metrics ?? {}),
              ...(parsed.advanced !== undefined && parsed.total
                ? {
                    advanced: parsed.advanced,
                    total: parsed.total,
                    advanceRate: parsed.advanced / parsed.total,
                  }
                : {}),
            },
          };
    const ev = await adapter.ingestExperimentResult(result);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return { evidenceIds: ev.map((e) => e.id) };
  });
}

const reviseInput = z.object({
  searchProjectId: z.string().min(1),
  beliefId: z.string().min(1),
  previousConfidence: z.coerce.number().min(0).max(1),
  newConfidence: z.coerce.number().min(0).max(1),
  reason: z.string().min(1),
  evidenceIds: z.array(z.string()).default([]),
});

/** Explicit human belief revision with stale-write protection. */
export async function reviseBeliefAction(
  input: unknown,
): Promise<ActionResult<{ revisionId: string; newConfidence: number }>> {
  return act(async () => {
    const parsed = reviseInput.parse(input);
    const { adapter } = getAppAdapter(getDb());
    const rev = await adapter.reviseBelief({
      ...parsed,
      actorId: humanActorIdFor(parsed.searchProjectId),
    });
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return { revisionId: rev.id, newConfidence: rev.newConfidence };
  });
}

/**
 * The human applies a Success Profile change for ANY search. The workstation
 * writes the new criteria into its own Success Profile; HSAL only records that
 * a human did it (user-asserted evidence + an event). Never automatic.
 */
export async function applyProfileChangeAction(
  input: unknown,
): Promise<ActionResult<{ evidenceId: string }>> {
  return act(async () => {
    const parsed = profileChangeInput.parse(input);
    const { searchProjectId, interventionId } = parsed;
    const db = getDb();
    const { adapter, domain } = getAppAdapter(db);
    const project = await domain.getSearchProject(searchProjectId);
    if (!project)
      throw new Error(`search project ${searchProjectId} not found`);
    const before = project.successProfile;
    const known = [
      ...before.mustHave,
      ...before.preferred,
      ...before.transferable,
      ...parsed.knownCriteria,
    ];
    const after = parseProfileLists(parsed, known);
    if (sameProfile(before, after))
      throw new Error("No change to the Success Profile was made.");
    const [current] = await db
      .select()
      .from(successProfiles)
      .where(eq(successProfiles.searchProjectId, searchProjectId));
    const payload = mergeCriteriaIntoPayload(current?.payload, after);
    const now = new Date().toISOString();
    if (current) {
      await db
        .update(successProfiles)
        .set({ payload, updatedAt: now })
        .where(eq(successProfiles.searchProjectId, searchProjectId));
    } else {
      await db
        .insert(successProfiles)
        .values({ searchProjectId, payload, createdAt: now, updatedAt: now });
    }
    let ev;
    try {
      ev = await adapter.recordSuccessProfileChange(
        searchProjectId,
        before,
        after,
        humanActorIdFor(searchProjectId),
        interventionId,
      );
    } catch (err) {
      // Keep the workstation and HSAL consistent: undo the profile write so the
      // recruiter can retry instead of being told nothing changed.
      if (current) {
        await db
          .update(successProfiles)
          .set({ payload: current.payload, updatedAt: current.updatedAt })
          .where(eq(successProfiles.searchProjectId, searchProjectId));
      } else {
        await db
          .delete(successProfiles)
          .where(eq(successProfiles.searchProjectId, searchProjectId));
      }
      throw err;
    }
    revalidatePath(`/searches/${searchProjectId}`, "layout");
    return { evidenceId: ev.id };
  });
}

/**
 * Store a pipeline snapshot in the workstation. Re-recording the same period
 * with the same counts is a no-op; with different counts it becomes a new
 * revision (`…-r2`), because HSAL states are immutable and history is never
 * overwritten. Returns the snapshot and whether a row was written.
 */
async function storeSnapshot(
  db: ReturnType<typeof getDb>,
  parsed: z.infer<typeof snapshotInput>,
): Promise<{
  snapshot: ReturnType<typeof buildSnapshot>;
  written: boolean;
}> {
  const base =
    parsed.id ??
    snapshotId(parsed.searchProjectId, parsed.periodStart, parsed.periodEnd);
  const existing = await db
    .select()
    .from(pipelineSnapshots)
    .where(eq(pipelineSnapshots.searchProjectId, parsed.searchProjectId));
  const same = (a: Record<string, number>, b: Record<string, number>) =>
    JSON.stringify(a) === JSON.stringify(b);
  const revisions = existing.filter(
    (r) => r.id === base || r.id.startsWith(`${base}-r`),
  );
  const match = revisions.find((r) => same(r.counts, parsed.counts));
  if (match)
    return {
      snapshot: buildSnapshot({
        ...parsed,
        id: match.id,
        observedAt: match.observedAt,
      }),
      written: false,
    };
  const id = revisions.length === 0 ? base : `${base}-r${revisions.length + 1}`;
  const snapshot = buildSnapshot({
    searchProjectId: parsed.searchProjectId,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    counts: parsed.counts,
    source: parsed.source,
    observedAt: parsed.observedAt ?? new Date().toISOString(),
    id,
  });
  await db
    .insert(pipelineSnapshots)
    .values({ ...snapshot, createdAt: snapshot.observedAt });
  return { snapshot, written: true };
}

/**
 * WHAT'S HAPPENING? — record the baseline pipeline for ANY search. If the
 * search is already bound to HSAL the snapshot is also synced as an observed
 * State; otherwise "Run diagnosis" will do that.
 */
export async function recordPipelineSnapshotAction(
  input: unknown,
): Promise<ActionResult<{ snapshotId: string; stateId?: string }>> {
  return act(async () => {
    const parsed = snapshotInput.parse(input);
    const db = getDb();
    const { snapshot } = await storeSnapshot(db, parsed);
    const { adapter, domain, bindings } = getAppAdapter(db);
    let stateId: string | undefined;
    if (await bindings.get(parsed.searchProjectId)) {
      const project = await domain.getSearchProject(parsed.searchProjectId);
      if (project)
        stateId = (await adapter.syncPipelineState(project, snapshot)).id;
    }
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return { snapshotId: snapshot.id, ...(stateId ? { stateId } : {}) };
  });
}

/**
 * Record the post-intervention pipeline for ANY search and create the
 * Trajectory. Counts arrive from the form (pre-filled from the workstation's
 * pipeline events when it has them) and are stored as a workstation snapshot
 * before HSAL sees them as an observed State.
 */
export async function recordPostInterventionAction(
  input: unknown,
): Promise<ActionResult<{ trajectoryId: string; snapshotId: string }>> {
  return act(async () => {
    const parsed = postInterventionInput.parse(input);
    const db = getDb();
    const { adapter, domain } = getAppAdapter(db);
    const project = await domain.getSearchProject(parsed.searchProjectId);
    if (!project)
      throw new Error(`search project ${parsed.searchProjectId} not found`);
    const { snapshot, written } = await storeSnapshot(db, parsed);
    let tr;
    try {
      tr = await adapter.recordPostInterventionState(
        project,
        snapshot,
        parsed.interventionId,
      );
    } catch (err) {
      // Do not leave a post-intervention snapshot as the project's "current"
      // pipeline when HSAL never saw it.
      if (written)
        await db
          .delete(pipelineSnapshots)
          .where(eq(pipelineSnapshots.id, snapshot.id));
      throw err;
    }
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return { trajectoryId: tr.id, snapshotId: snapshot.id };
  });
}

/** WHAT DID WE LEARN? — persist a recruiter-written learning for ANY search, referencing HSAL ids. */
export async function saveLearningAction(
  input: unknown,
): Promise<ActionResult<{ learningId: string }>> {
  return act(async () => {
    const parsed = learningInput.parse(input);
    const { adapter, learnings } = getAppAdapter(getDb());
    const all = await learnings.list();
    const existing = all
      .filter((l) => l.sourceSearchProjectId === parsed.searchProjectId)
      .map((l) => l.id);
    if (parsed.id) {
      const clash = all.find((l) => l.id === parsed.id);
      if (clash && clash.sourceSearchProjectId !== parsed.searchProjectId)
        throw new Error(`learning ${parsed.id} belongs to another search`);
    }
    const applicability = Object.fromEntries(
      Object.entries(parsed.applicability).filter(
        ([, v]) => Array.isArray(v) && v.length > 0,
      ),
    );
    const learning = await adapter.createSearchLearning({
      id: parsed.id ?? nextLearningId(parsed.searchProjectId, existing),
      sourceSearchProjectId: parsed.searchProjectId,
      title: parsed.title,
      statement: parsed.statement,
      category: parsed.category,
      confidence: parsed.confidence,
      applicability,
      evidenceIds: parsed.evidenceIds,
      originatingBeliefIds: parsed.originatingBeliefIds,
      originatingModelIds: parsed.originatingModelIds,
      createdAt: new Date().toISOString(),
    });
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return { learningId: learning.id };
  });
}
