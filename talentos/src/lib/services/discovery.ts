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
import { isHttpUrl } from "@/lib/domain/discovery";
import {
  getCandidateDiscoveryProvider,
  type DiscoveryResult,
} from "@/lib/research/discovery-provider";
import {
  hostedEngineIds,
  TALENT_XRAY_PROVIDER_NAME,
} from "@/lib/research/talent-xray";
import { createCandidate, createCandidateInput } from "./candidates";
import { recordQueryRun } from "./query-yield";

/**
 * Two ways to reach the engines. Link-out (D-034) is always available and
 * needs no key: the recruiter opens the engine's hosted results page. The
 * JSON API provider is optional (Google closed it to new customers, D-033)
 * and reports `configured` only when a key is present.
 */
export function discoveryStatus() {
  const provider = getCandidateDiscoveryProvider();
  return {
    provider: provider.name,
    configured: provider.configured,
    hosted: hostedEngineIds(),
  };
}

export const runDiscoveryInput = z.object({
  searchProjectId: z.string(),
  query: z.string().min(2),
  engine: z.enum(["core", "reach"]).default("core"),
  limit: z.number().int().min(1).max(10).default(10),
  /** The stored string this run came from (yield ledger, Wave A). */
  queryId: z.string().optional(),
  /** True when the text differs from the stored string. */
  edited: z.boolean().default(false),
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
  /**
   * The stored string that produced this result, only when it ran verbatim.
   * An edited run leaves this unset so the stored string is never credited
   * with a save it did not produce.
   */
  queryId: z.string().optional(),
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
      queryId: input.queryId,
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
      queryId: input.queryId,
    });
  }
  return { saved, candidateId };
}

const linkOutSaveSchema = z.object({
  url: z
    .string()
    .max(2048)
    .refine(isHttpUrl, "Each line must be a complete http(s) URL."),
  title: z.string().max(500).optional(),
  candidateName: z.string().min(1).max(200).optional(),
});

export const recordLinkOutRunInput = z.object({
  searchProjectId: z.string(),
  /** The stored string this run came from, when run verbatim. */
  queryId: z.string().optional(),
  queryText: z.string().min(2),
  edited: z.boolean().default(false),
  engine: z.enum(["core", "reach"]),
  /** The count the recruiter read off the hosted page — a number, not a result. */
  resultCount: z.number().int().min(0),
  /** URLs the recruiter chose to keep after opening them. */
  saves: z.array(linkOutSaveSchema).max(50).default([]),
});

/**
 * Link-out run (D-034). The recruiter opened the hosted engine page in a
 * new tab, read the result count, and pasted the profile URLs worth
 * keeping. Only that count and those explicit saves are stored — the same
 * ledger rows the JSON API path wrote, so yield rolls up identically. An
 * edited string is recorded but never credited (Wave A rule).
 */
export async function recordLinkOutRun(
  db: Db,
  raw: z.input<typeof recordLinkOutRunInput>,
) {
  const input = recordLinkOutRunInput.parse(raw);
  const run = await recordQueryRun(db, {
    searchProjectId: input.searchProjectId,
    queryId: input.queryId,
    queryText: input.queryText,
    edited: input.edited,
    engine: input.engine,
    resultCount: input.resultCount,
  });
  const creditedQueryId = input.edited ? undefined : input.queryId;
  let candidatesCreated = 0;
  for (const save of input.saves) {
    const { candidateId } = await saveDiscoveryResult(db, {
      searchProjectId: input.searchProjectId,
      url: save.url,
      title: save.title,
      provider: TALENT_XRAY_PROVIDER_NAME,
      engine: input.engine,
      query: input.queryText,
      retrievedAt: run.ranAt,
      candidateName: save.candidateName,
      queryId: creditedQueryId,
    });
    if (candidateId) candidatesCreated += 1;
  }
  return { runId: run.id, savedUrls: input.saves.length, candidatesCreated };
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
