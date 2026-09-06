"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { act, type ActionResult } from "./helpers";
import { getDb } from "@/lib/db/client";
import { pipelineSnapshots, successProfiles } from "@/lib/db/schema";
import { getAppAdapter } from "@/lib/hsal/adapter";
import { humanActorIdFor } from "@/lib/hsal/client";
import { successProfileToPayload } from "@/lib/hsal/seed-sp104";
import { SP104_ID, sp104, sp104Learning } from "../../../fixtures/sp104";

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

const experimentInput = z.object({
  searchProjectId: z.string().min(1),
  interventionId: z.string().min(1),
  summary: z.string().min(1).optional(),
  observations: z.array(z.string().min(1)).optional(),
  metrics: z.record(z.string(), z.number()).optional(),
});

/** Record what the experiment showed. For SP104 the seeded result (7/10 advanced) is used when no payload is given. */
export async function recordExperimentResultAction(
  input: unknown,
): Promise<ActionResult<{ evidenceIds: string[] }>> {
  return act(async () => {
    const parsed = experimentInput.parse(input);
    const { adapter } = getAppAdapter(getDb());
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
            metrics: parsed.metrics ?? {},
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

const profileChangeInput = z.object({
  searchProjectId: z.string().min(1),
  interventionId: z.string().optional(),
});

/** The human applies the Success Profile change (SP104: the seeded post-review profile). The workstation applies it; HSAL only records it. */
export async function applyProfileChangeAction(
  input: unknown,
): Promise<ActionResult<{ evidenceId: string }>> {
  return act(async () => {
    const { searchProjectId, interventionId } = profileChangeInput.parse(input);
    if (searchProjectId !== SP104_ID)
      throw new Error(
        "Success Profile changes are applied in the Profile module; the HSAL demo path is wired for SP104 only.",
      );
    const db = getDb();
    const { adapter, domain } = getAppAdapter(db);
    const project = await domain.getSearchProject(searchProjectId);
    if (!project) throw new Error("SP104 not seeded");
    const [current] = await db
      .select()
      .from(successProfiles)
      .where(eq(successProfiles.searchProjectId, searchProjectId));
    await db
      .update(successProfiles)
      .set({
        payload: successProfileToPayload(
          sp104.successProfileAfter,
          current?.payload,
        ),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(successProfiles.searchProjectId, searchProjectId));
    const ev = await adapter.recordSuccessProfileChange(
      searchProjectId,
      project.successProfile,
      sp104.successProfileAfter,
      humanActorIdFor(searchProjectId),
      interventionId,
    );
    revalidatePath(`/searches/${searchProjectId}`, "layout");
    return { evidenceId: ev.id };
  });
}

const postInterventionInput = z.object({
  searchProjectId: z.string().min(1),
  interventionId: z.string().min(1),
});

/** Ingest the post-intervention pipeline (SP104: seeded W9) and create the Trajectory. */
export async function recordPostInterventionAction(
  input: unknown,
): Promise<ActionResult<{ trajectoryId: string }>> {
  return act(async () => {
    const { searchProjectId, interventionId } =
      postInterventionInput.parse(input);
    if (searchProjectId !== SP104_ID)
      throw new Error(
        "Post-intervention snapshots are imported from the ATS; the seeded path is wired for SP104 only.",
      );
    const db = getDb();
    const { adapter, domain } = getAppAdapter(db);
    await db
      .insert(pipelineSnapshots)
      .values({ ...sp104.pipelineW9, createdAt: sp104.pipelineW9.observedAt })
      .onConflictDoNothing();
    const project = await domain.getSearchProject(searchProjectId);
    if (!project) throw new Error("SP104 not seeded");
    const tr = await adapter.recordPostInterventionState(
      project,
      sp104.pipelineW9,
      interventionId,
    );
    revalidatePath(`/searches/${searchProjectId}`, "layout");
    return { trajectoryId: tr.id };
  });
}

const learningInput = z.object({
  searchProjectId: z.string().min(1),
  evidenceIds: z.array(z.string()).default([]),
  originatingBeliefIds: z.array(z.string()).default([]),
  originatingModelIds: z.array(z.string()).default([]),
});

/** WHAT DID WE LEARN? — persist the domain learning (SP104: seeded text) referencing HSAL ids. */
export async function saveLearningAction(
  input: unknown,
): Promise<ActionResult<{ learningId: string }>> {
  return act(async () => {
    const parsed = learningInput.parse(input);
    if (parsed.searchProjectId !== SP104_ID)
      throw new Error(
        "Learning capture form is wired for SP104 in this slice.",
      );
    const { adapter } = getAppAdapter(getDb());
    const learning = await adapter.createSearchLearning(
      sp104Learning({
        evidenceIds: parsed.evidenceIds,
        originatingBeliefIds: parsed.originatingBeliefIds,
        originatingModelIds: parsed.originatingModelIds,
      }),
    );
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return { learningId: learning.id };
  });
}
