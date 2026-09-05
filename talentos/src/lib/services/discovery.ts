/**
 * Discovery execution (W8, corrected per D-010).
 *
 * Runs composed search strings against the configured
 * CandidateDiscoveryProvider (default: talent-xray — the two live
 * people-only engines). Results are transient: nothing is persisted unless
 * the recruiter explicitly saves one result (a deliberate, one-at-a-time
 * act) — then the URL lands in research_sources and, when a candidate is
 * created, the snippet lands in candidate_source_evidence as UNVERIFIED
 * source evidence. A search-result snippet is never written into
 * candidates.resumeText. Result pages are never fetched; links open
 * externally.
 */
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { verificationStatusSchema } from "@/lib/core/enums";
import type { Db } from "@/lib/db/client";
import { candidateSourceEvidence, researchSources } from "@/lib/db/schema";
import {
  getCandidateDiscoveryProvider,
  type DiscoveryResult,
} from "@/lib/research/discovery-provider";
import { createCandidate, createCandidateInput } from "./candidates";

export function discoveryStatus() {
  const provider = getCandidateDiscoveryProvider();
  return { provider: provider.name, configured: provider.configured };
}

export const runDiscoveryInput = z.object({
  searchProjectId: z.string(),
  query: z.string().min(2),
  engine: z.enum(["core", "reach"]).default("core"),
  limit: z.number().int().min(1).max(10).default(10),
});

export async function runDiscovery(
  input: z.infer<typeof runDiscoveryInput>,
): Promise<DiscoveryResult[]> {
  const provider = getCandidateDiscoveryProvider();
  return provider.search(input.query, {
    limit: input.limit,
    engine: input.engine,
  });
}

export const saveDiscoveryResultInput = z.object({
  searchProjectId: z.string(),
  url: z.string().min(4),
  title: z.string().optional(),
  snippet: z.string().optional(),
  provider: z.string(),
  engine: z.string().optional(),
  query: z.string(),
  /** 1-based result position as the provider returned it. Not a score. */
  providerRank: z.number().int().min(1).optional(),
  retrievedAt: z.string().optional(),
  /** When set, also create a candidate from this saved result. */
  candidateName: z.string().min(1).optional(),
});

export async function saveDiscoveryResult(
  db: Db,
  input: z.infer<typeof saveDiscoveryResultInput>,
) {
  const sourceLabel = input.engine
    ? `${input.provider}:${input.engine}`
    : input.provider;
  const [saved] = await db
    .insert(researchSources)
    .values({
      searchProjectId: input.searchProjectId,
      url: input.url,
      title: input.title,
      snippet: input.snippet,
      source: sourceLabel,
      query: input.query,
      ...(input.retrievedAt ? { retrievedAt: input.retrievedAt } : {}),
    })
    .returning();

  let candidateId: string | undefined;
  if (input.candidateName) {
    const candidate = await createCandidate(
      db,
      createCandidateInput.parse({
        searchProjectId: input.searchProjectId,
        name: input.candidateName,
        profileUrls: [input.url],
        recruiterNotes: `Saved from discovery — query: ${input.query}`,
        // resumeText is candidate/recruiter material only; the snippet
        // becomes explicit, unverified source evidence below (D-010).
      }),
    );
    candidateId = candidate.id;
    await db.insert(candidateSourceEvidence).values({
      candidateId: candidate.id,
      searchProjectId: input.searchProjectId,
      sourceUrl: input.url,
      sourceType: "search_result",
      title: input.title,
      snippet: input.snippet,
      ...(input.retrievedAt ? { retrievedAt: input.retrievedAt } : {}),
      query: input.query,
      provider: input.provider,
      providerRank: input.providerRank,
      verificationStatus: "unverified",
      provenance: "search_result",
    });
  }
  return { saved, candidateId };
}

export async function listSavedSources(db: Db, projectId: string) {
  return db
    .select()
    .from(researchSources)
    .where(eq(researchSources.searchProjectId, projectId))
    .orderBy(desc(researchSources.createdAt));
}

export async function listCandidateSourceEvidence(db: Db, candidateId: string) {
  return db
    .select()
    .from(candidateSourceEvidence)
    .where(eq(candidateSourceEvidence.candidateId, candidateId))
    .orderBy(desc(candidateSourceEvidence.createdAt));
}

export const setEvidenceVerificationInput = z.object({
  evidenceId: z.string(),
  verificationStatus: verificationStatusSchema,
});

/**
 * A human act only: the recruiter checked (or un-checked) the source page.
 * No model or provider path calls this.
 */
export async function setEvidenceVerification(
  db: Db,
  input: z.infer<typeof setEvidenceVerificationInput>,
) {
  const [row] = await db
    .update(candidateSourceEvidence)
    .set({ verificationStatus: input.verificationStatus })
    .where(eq(candidateSourceEvidence.id, input.evidenceId))
    .returning();
  return row;
}
