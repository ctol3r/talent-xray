/**
 * W8 — Discovery execution (docs/ROADMAP-AGENT-TEAMS.md).
 *
 * Runs composed search strings against the configured ResearchProvider
 * (google-cse = the two live Talent X-Ray people-only engines). Results
 * are transient: nothing is persisted unless the recruiter explicitly
 * saves one result (a deliberate, one-at-a-time act) — then it lands in
 * research_sources, optionally as a candidate. Result pages are never
 * fetched; links open externally.
 */
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { researchSources } from "@/lib/db/schema";
import {
  getResearchProvider,
  type ResearchResult,
} from "@/lib/research/provider";
import { createCandidate, createCandidateInput } from "./candidates";

export function discoveryStatus() {
  const provider = getResearchProvider();
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
): Promise<ResearchResult[]> {
  const provider = getResearchProvider();
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
  source: z.string(),
  query: z.string(),
  /** When set, also create a candidate from this saved result. */
  candidateName: z.string().min(1).optional(),
});

export async function saveDiscoveryResult(
  db: Db,
  input: z.infer<typeof saveDiscoveryResultInput>,
) {
  const [saved] = await db
    .insert(researchSources)
    .values({
      searchProjectId: input.searchProjectId,
      url: input.url,
      title: input.title,
      snippet: input.snippet,
      source: input.source,
      query: input.query,
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
        resumeText: input.snippet
          ? `Search-result snippet (saved by recruiter, verify on profile):\n${input.snippet}`
          : undefined,
      }),
    );
    candidateId = candidate.id;
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
