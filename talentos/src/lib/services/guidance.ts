/**
 * W9 — two-sided guidance services: the HM brief, candidate-facing
 * packets, and evidence-anchored HM feedback capture. All AI output lands
 * as editable drafts; feedback entries are human input, appended verbatim.
 */
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { hmDecisionSchema, packetKindSchema } from "@/lib/core/enums";
import type { HmFeedbackEntry } from "@/lib/core/payloads";
import { loadProjectContext } from "@/lib/ai/context";
import { runAiTask } from "@/lib/ai/run";
import { candidatePacketTask } from "@/lib/ai/tasks/candidate-packet";
import { hmBriefTask } from "@/lib/ai/tasks/hm-brief";
import type { Db } from "@/lib/db/client";
import { candidatePackets, candidates, hmBriefs } from "@/lib/db/schema";

export async function generateHmBrief(
  db: Db,
  projectId: string,
  critique?: string[],
) {
  const ctx = await loadProjectContext(db, projectId, critique);
  const { output, meta, warnings } = await runAiTask(hmBriefTask, ctx, {
    db,
    searchProjectId: projectId,
  });
  await db
    .insert(hmBriefs)
    .values({ searchProjectId: projectId, payload: output, meta })
    .onConflictDoUpdate({
      target: hmBriefs.searchProjectId,
      set: { payload: output, meta, updatedAt: new Date().toISOString() },
    });
  return { output, meta, warnings };
}

export async function updateHmBriefPayload(
  db: Db,
  projectId: string,
  payload: import("@/lib/core/payloads").HmBriefPayload,
) {
  await db
    .update(hmBriefs)
    .set({ payload, updatedAt: new Date().toISOString() })
    .where(eq(hmBriefs.searchProjectId, projectId));
}

export async function getHmBrief(db: Db, projectId: string) {
  const [brief] = await db
    .select()
    .from(hmBriefs)
    .where(eq(hmBriefs.searchProjectId, projectId));
  return brief ?? null;
}

export const generatePacketInput = z.object({
  candidateId: z.string(),
  kind: packetKindSchema,
});

export async function generateCandidatePacket(
  db: Db,
  input: z.infer<typeof generatePacketInput>,
) {
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, input.candidateId));
  if (!candidate) throw new Error(`Candidate ${input.candidateId} not found`);
  const project = await loadProjectContext(db, candidate.searchProjectId);
  const { output, meta, warnings } = await runAiTask(
    candidatePacketTask,
    { project, candidate, kind: input.kind },
    {
      db,
      searchProjectId: candidate.searchProjectId,
      candidateId: candidate.id,
    },
  );
  const [packet] = await db
    .insert(candidatePackets)
    .values({
      candidateId: candidate.id,
      searchProjectId: candidate.searchProjectId,
      kind: input.kind,
      payload: output,
      meta,
    })
    .returning();
  return { packet, warnings };
}

/** Latest packet per kind for a candidate. */
export async function listCandidatePackets(db: Db, candidateId: string) {
  const rows = await db
    .select()
    .from(candidatePackets)
    .where(eq(candidatePackets.candidateId, candidateId))
    .orderBy(desc(candidatePackets.createdAt));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latest.has(row.kind)) latest.set(row.kind, row);
  }
  return [...latest.values()];
}

export const recordHmFeedbackInput = z.object({
  candidateId: z.string(),
  decision: hmDecisionSchema,
  evidenceNote: z.string().min(5, "Anchor the decision to specific evidence"),
});

/**
 * Append one evidence-anchored HM feedback entry. Human input, recorded
 * verbatim; it never moves the candidate's stage by itself.
 */
export async function recordHmFeedback(
  db: Db,
  input: z.infer<typeof recordHmFeedbackInput>,
) {
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, input.candidateId));
  if (!candidate) throw new Error(`Candidate ${input.candidateId} not found`);
  const entry: HmFeedbackEntry = {
    at: new Date().toISOString(),
    decision: input.decision,
    evidenceNote: input.evidenceNote,
  };
  const hmFeedback = [...(candidate.hmFeedback ?? []), entry];
  await db
    .update(candidates)
    .set({ hmFeedback, updatedAt: new Date().toISOString() })
    .where(eq(candidates.id, input.candidateId));
  return entry;
}
