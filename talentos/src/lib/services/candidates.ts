import { MAX_DOCUMENT_CHARS } from "@/lib/documents/contracts";
import { reviewWorkspace } from "./document-review";
import { saveDocument, removeOriginal } from "./documents";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  candidateProfilePayloadSchema,
  emptyCandidateProfile,
} from "@/lib/core/payloads";
import type { Db } from "@/lib/db/client";
import {
  documentVersions,
  documentComparisons,
  candidatePackets,
  candidateSourceEvidence,
  candidateRegistryMatches,
  searchLearnings,
  tasks,
  aiGenerations,
  crewJobs,
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
  resumeText: z.string().max(MAX_DOCUMENT_CHARS).optional(),
  recruiterNotes: z.string().optional(),
  profileUrls: z.array(z.string()).default([]),
  stage: z.string().default("identified"),
  /** How the profile URLs arrived: "manual" (default), "browser_capture", "import:<source>" (Wave D). */
  addedVia: z.string().min(1).default("manual"),
  /** Human label for the source of those URLs, e.g. "hireEZ export". */
  sourceLabel: z.string().max(200).optional(),
  /** Partial profile merged over the empty profile (imports supply lists only). */
  profile: candidateProfilePayloadSchema.partial().optional(),
});

export async function createCandidate(
  db: Db,
  input: z.input<typeof createCandidateInput>,
) {
  const { profileUrls, resumeText, addedVia, sourceLabel, profile, ...fields } =
    createCandidateInput.parse(input);
  return db.transaction((tx) => {
    const candidate = tx
      .insert(candidates)
      .values({
        ...fields,
        profile: { ...emptyCandidateProfile(), ...(profile ?? {}) },
      })
      .returning()
      .get();
    if (resumeText?.trim())
      saveDocument(tx, {
        searchProjectId: fields.searchProjectId,
        candidateId: candidate.id,
        kind: "cv",
        text: resumeText,
        confirmed: true,
      });
    const urls = profileUrls.map((url) => url.trim()).filter(Boolean);
    if (urls.length)
      tx.insert(candidateSources)
        .values(
          urls.map((url) => ({
            candidateId: candidate.id,
            url,
            addedVia,
            label: sourceLabel,
          })),
        )
        .run();
    tx.insert(pipelineEvents)
      .values({
        searchProjectId: fields.searchProjectId,
        candidateId: candidate.id,
        fromStage: null,
        toStage: fields.stage,
      })
      .run();
    return tx
      .select()
      .from(candidates)
      .where(eq(candidates.id, candidate.id))
      .get()!;
  });
}

export const updateCandidateInput = z.object({
  id: z.string(),
  name: z.string().min(1).optional(),
  currentTitle: z.string().optional(),
  currentCompany: z.string().optional(),
  geography: z.string().optional(),
  resumeText: z.string().max(MAX_DOCUMENT_CHARS).optional(),
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
  const { id, resumeText, ...fields } = updateCandidateInput.parse(input);
  return db.transaction((tx) => {
    const owner = tx
      .select()
      .from(candidates)
      .where(eq(candidates.id, id))
      .get();
    if (!owner) throw new Error("Candidate not found.");
    if (resumeText !== undefined && resumeText !== owner.resumeText)
      saveDocument(tx, {
        searchProjectId: owner.searchProjectId,
        candidateId: id,
        kind: "cv",
        text: resumeText,
        confirmed: true,
      });
    return tx
      .update(candidates)
      .set({ ...fields, updatedAt: new Date().toISOString() })
      .where(eq(candidates.id, id))
      .returning()
      .get();
  });
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
    .innerJoin(
      searchProjects,
      eq(candidates.searchProjectId, searchProjects.id),
    )
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
  const originals = db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.candidateId, candidateId))
    .all()
    .flatMap((d) => (d.originalFileId ? [d.originalFileId] : []));
  db.transaction((tx) => {
    tx.delete(documentComparisons)
      .where(eq(documentComparisons.candidateId, candidateId))
      .run();
    tx.delete(documentVersions)
      .where(eq(documentVersions.candidateId, candidateId))
      .run();
    for (const table of [
      scorecards,
      offers,
      closePlans,
      onboardingPlans,
      outreachMessages,
      outreachSequences,
      candidateEvidence,
      candidateSources,
      pipelineEvents,
      candidatePackets,
      candidateSourceEvidence,
      candidateRegistryMatches,
      searchLearnings,
      tasks,
      aiGenerations,
      crewJobs,
    ]) {
      tx.delete(table).where(eq(table.candidateId, candidateId)).run();
    }
    tx.delete(candidates).where(eq(candidates.id, candidateId)).run();
  });
  for (const id of new Set(originals)) {
    if (
      !db
        .select()
        .from(documentVersions)
        .where(eq(documentVersions.originalFileId, id))
        .get()
    )
      removeOriginal(id);
  }
}

/** Privacy: export everything held about a candidate as one JSON document. */
export async function exportCandidate(db: Db, candidateId: string) {
  const candidate = await getCandidate(db, candidateId);
  if (!candidate) throw new Error("Candidate not found");
  const [
    sources,
    evidence,
    sequences,
    messages,
    cards,
    candidateOffers,
    close,
    onboarding,
    events,
  ] = await Promise.all([
    getCandidateSources(db, candidateId),
    db
      .select()
      .from(candidateEvidence)
      .where(eq(candidateEvidence.candidateId, candidateId)),
    db
      .select()
      .from(outreachSequences)
      .where(eq(outreachSequences.candidateId, candidateId)),
    db
      .select()
      .from(outreachMessages)
      .where(eq(outreachMessages.candidateId, candidateId)),
    db.select().from(scorecards).where(eq(scorecards.candidateId, candidateId)),
    db.select().from(offers).where(eq(offers.candidateId, candidateId)),
    db.select().from(closePlans).where(eq(closePlans.candidateId, candidateId)),
    db
      .select()
      .from(onboardingPlans)
      .where(eq(onboardingPlans.candidateId, candidateId)),
    db
      .select()
      .from(pipelineEvents)
      .where(eq(pipelineEvents.candidateId, candidateId)),
  ]);
  const registryMatches = await db
    .select()
    .from(candidateRegistryMatches)
    .where(eq(candidateRegistryMatches.candidateId, candidateId));
  return {
    registryMatches,
    documentReview: reviewWorkspace(db, candidate.searchProjectId, candidateId),
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
