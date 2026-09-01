import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { emptyCandidateProfile } from "@/lib/core/payloads";
import type { Db } from "@/lib/db/client";
import {
  candidateEvidence,
  candidateSources,
  candidates,
  closePlans,
  offers,
  onboardingPlans,
  outreachMessages,
  outreachSequences,
  pipelineEvents,
  pipelineStages,
  scorecards,
  searchProjects,
} from "@/lib/db/schema";

export const createCandidateInput = z.object({
  searchProjectId: z.string(),
  name: z.string().min(1),
  currentTitle: z.string().optional(),
  currentCompany: z.string().optional(),
  geography: z.string().optional(),
  resumeText: z.string().optional(),
  recruiterNotes: z.string().optional(),
  profileUrls: z.array(z.string()).default([]),
  stage: z.string().default("identified"),
});

export async function createCandidate(
  db: Db,
  input: z.infer<typeof createCandidateInput>,
) {
  const { profileUrls, ...fields } = input;
  const [candidate] = await db
    .insert(candidates)
    .values({ ...fields, profile: emptyCandidateProfile() })
    .returning();
  if (profileUrls.length > 0) {
    await db.insert(candidateSources).values(
      profileUrls
        .filter((url) => url.trim() !== "")
        .map((url) => ({
          candidateId: candidate.id,
          url: url.trim(),
          addedVia: "manual",
        })),
    );
  }
  // Every candidate enters the pipeline with an event — the analytics substrate.
  await db.insert(pipelineEvents).values({
    searchProjectId: input.searchProjectId,
    candidateId: candidate.id,
    fromStage: null,
    toStage: input.stage,
  });
  return candidate;
}

export const updateCandidateInput = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  currentTitle: z.string().optional(),
  currentCompany: z.string().optional(),
  geography: z.string().optional(),
  resumeText: z.string().optional(),
  recruiterNotes: z.string().optional(),
  compensationNote: z.string().optional(),
  nextAction: z.string().optional(),
  nextActionDue: z.string().optional(),
  disposition: z
    .enum(["active", "on_hold", "withdrawn", "not_selected", "hired"])
    .optional(),
});

export async function updateCandidate(
  db: Db,
  input: z.infer<typeof updateCandidateInput>,
) {
  const { id, ...fields } = input;
  const [candidate] = await db
    .update(candidates)
    .set({ ...fields, updatedAt: new Date().toISOString() })
    .where(eq(candidates.id, id))
    .returning();
  return candidate;
}

export const moveCandidateStageInput = z.object({
  candidateId: z.string(),
  toStage: z.string().min(1),
  note: z.string().optional(),
});

export async function moveCandidateStage(
  db: Db,
  input: z.infer<typeof moveCandidateStageInput>,
) {
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, input.candidateId));
  if (!candidate) throw new Error("Candidate not found");
  if (candidate.stage === input.toStage) return candidate;
  const [updated] = await db
    .update(candidates)
    .set({ stage: input.toStage, updatedAt: new Date().toISOString() })
    .where(eq(candidates.id, input.candidateId))
    .returning();
  await db.insert(pipelineEvents).values({
    searchProjectId: candidate.searchProjectId,
    candidateId: candidate.id,
    fromStage: candidate.stage,
    toStage: input.toStage,
    note: input.note,
  });
  return updated;
}

export async function listCandidates(db: Db, projectId: string) {
  return db
    .select()
    .from(candidates)
    .where(eq(candidates.searchProjectId, projectId))
    .orderBy(desc(candidates.updatedAt));
}

export async function listAllCandidates(db: Db) {
  return db
    .select({ candidate: candidates, projectName: searchProjects.name })
    .from(candidates)
    .innerJoin(searchProjects, eq(candidates.searchProjectId, searchProjects.id))
    .orderBy(desc(candidates.updatedAt));
}

export async function getCandidate(db: Db, id: string) {
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, id));
  return candidate;
}

export async function getCandidateSources(db: Db, candidateId: string) {
  return db
    .select()
    .from(candidateSources)
    .where(eq(candidateSources.candidateId, candidateId));
}

export const addCandidateSourceInput = z.object({
  candidateId: z.string(),
  url: z.string().min(1),
  sourceType: z.string().optional(),
  label: z.string().optional(),
});

export async function addCandidateSource(
  db: Db,
  input: z.infer<typeof addCandidateSourceInput>,
) {
  const [source] = await db
    .insert(candidateSources)
    .values({ ...input, addedVia: "manual" })
    .returning();
  return source;
}

export async function getPipelineStages(db: Db, projectId: string) {
  return db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.searchProjectId, projectId))
    .orderBy(pipelineStages.position);
}

export async function getPipelineEvents(db: Db, projectId: string) {
  return db
    .select()
    .from(pipelineEvents)
    .where(eq(pipelineEvents.searchProjectId, projectId));
}

/** Privacy: full deletion of a candidate and every dependent record. */
export async function deleteCandidate(db: Db, candidateId: string) {
  await db.delete(scorecards).where(eq(scorecards.candidateId, candidateId));
  await db.delete(offers).where(eq(offers.candidateId, candidateId));
  await db.delete(closePlans).where(eq(closePlans.candidateId, candidateId));
  await db
    .delete(onboardingPlans)
    .where(eq(onboardingPlans.candidateId, candidateId));
  await db
    .delete(outreachMessages)
    .where(eq(outreachMessages.candidateId, candidateId));
  await db
    .delete(outreachSequences)
    .where(eq(outreachSequences.candidateId, candidateId));
  await db
    .delete(candidateEvidence)
    .where(eq(candidateEvidence.candidateId, candidateId));
  await db
    .delete(candidateSources)
    .where(eq(candidateSources.candidateId, candidateId));
  await db
    .delete(pipelineEvents)
    .where(eq(pipelineEvents.candidateId, candidateId));
  await db.delete(candidates).where(eq(candidates.id, candidateId));
}

/** Privacy: export everything held about a candidate as one JSON document. */
export async function exportCandidate(db: Db, candidateId: string) {
  const candidate = await getCandidate(db, candidateId);
  if (!candidate) throw new Error("Candidate not found");
  const [sources, evidence, sequences, messages, cards, candidateOffers, close, onboarding, events] =
    await Promise.all([
      getCandidateSources(db, candidateId),
      db.select().from(candidateEvidence).where(eq(candidateEvidence.candidateId, candidateId)),
      db.select().from(outreachSequences).where(eq(outreachSequences.candidateId, candidateId)),
      db.select().from(outreachMessages).where(eq(outreachMessages.candidateId, candidateId)),
      db.select().from(scorecards).where(eq(scorecards.candidateId, candidateId)),
      db.select().from(offers).where(eq(offers.candidateId, candidateId)),
      db.select().from(closePlans).where(eq(closePlans.candidateId, candidateId)),
      db.select().from(onboardingPlans).where(eq(onboardingPlans.candidateId, candidateId)),
      db.select().from(pipelineEvents).where(eq(pipelineEvents.candidateId, candidateId)),
    ]);
  return {
    exportedAt: new Date().toISOString(),
    candidate,
    sources,
    evidence,
    outreach: { sequences, messages },
    scorecards: cards,
    offers: candidateOffers,
    closePlans: close,
    onboardingPlans: onboarding,
    pipelineEvents: events,
  };
}
