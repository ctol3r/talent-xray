/**
 * Audience research (D-013): deterministic queries derived from the
 * canonical IR (or the project's facts when no plan exists), run through
 * the general ResearchProvider, persisted to research_sources with the
 * exact query that produced each finding. Audience-level only — the system
 * never researches an individual candidate. Result pages are never fetched.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import type { CanonicalIntelligence } from "@/lib/core/ir";
import type { Db } from "@/lib/db/client";
import { researchSources, searchProjects } from "@/lib/db/schema";
import { MOCK_RESEARCH_SOURCE } from "@/lib/research/mock-research";
import {
  getResearchProvider,
  type ResearchFinding,
  type ResearchProvider,
} from "@/lib/research/provider";
import { SESSION_RESEARCH_SOURCE } from "@/lib/research/session-research";
import type { AudienceSegment } from "@/lib/ai/tasks/personas";

export const RESEARCH_SOURCES = [
  SESSION_RESEARCH_SOURCE,
  MOCK_RESEARCH_SOURCE,
] as const;

/** Raised when the research gate cannot be satisfied. */
export class ResearchRequiredError extends Error {
  constructor(providerName: string) {
    super(
      providerName === "none"
        ? "Research is required before personas or outreach can be generated, and no general research provider is configured (TALENTOS_RESEARCH_PROVIDER=session|mock)."
        : `Research is required before personas or outreach can be generated, but the "${providerName}" research provider returned no findings.`,
    );
    this.name = "ResearchRequiredError";
  }
}

type Project = typeof searchProjects.$inferSelect;

/**
 * The audience segments personas are built for: the IR population when it
 * exists, otherwise one fallback audience from the project's own facts.
 */
export function audienceSegments(
  project: Project,
  payload: CanonicalIntelligence | undefined,
): AudienceSegment[] {
  const segments = payload?.population?.segments ?? [];
  if (segments.length > 0) return segments;
  return [
    {
      label: `${project.roleTitle} candidates`,
      description: [
        project.roleTitle,
        project.industry ? `in ${project.industry}` : "",
        project.seniority ? `(${project.seniority})` : "",
      ]
        .filter(Boolean)
        .join(" "),
      estimatedSupply: "unknown",
      whereTheyAre: [],
      provenance: "model_inference",
    },
  ];
}

/**
 * Deterministic research queries (always visible, stored with findings):
 * company context, one per audience segment, compensation, and what the
 * audience values. Segment queries prefer the plan's own vocabulary.
 */
export function audienceQueries(
  project: Project,
  payload: CanonicalIntelligence | undefined,
): string[] {
  const year = new Date().getFullYear();
  const company = project.companyName ?? "";
  const industry = project.industry ?? "";
  const queries: string[] = [];
  if (company) {
    queries.push(`${company} ${industry} research team mission`.trim());
  }
  for (const segment of audienceSegments(project, payload).slice(0, 3)) {
    const plan = payload?.searchPlan?.queryPlans.find((q) =>
      q.segmentLabel.startsWith(segment.label.split(" — ")[0]),
    );
    const terms = plan
      ? [...plan.mustHaveTerms, ...plan.anyOfTerms].slice(0, 3)
      : segment.label.split(/\s+/).slice(0, 4);
    queries.push(
      `${terms.join(" ")} ${industry} researchers community conferences ${year}`.trim(),
    );
  }
  queries.push(
    `${project.roleTitle} ${industry} compensation ${company ? "nonprofit" : ""} ${year}`
      .replace(/\s+/g, " ")
      .trim(),
  );
  queries.push(
    `what ${industry || project.roleTitle} researchers value in a job motivations survey`.trim(),
  );
  return Array.from(new Set(queries.map((q) => q.replace(/\s+/g, " ").trim())));
}

export async function listResearchFindings(db: Db, projectId: string) {
  return db
    .select()
    .from(researchSources)
    .where(
      and(
        eq(researchSources.searchProjectId, projectId),
        inArray(researchSources.source, [...RESEARCH_SOURCES]),
      ),
    )
    .orderBy(desc(researchSources.createdAt));
}

/**
 * Run every audience query not yet answered for this project, persisting
 * findings as they arrive. Resumable: a query is skipped once any finding
 * for it is stored; with the session provider a pending query throws
 * ResearchPendingError after earlier queries' findings were already saved.
 */
export async function researchAudience(
  db: Db,
  projectId: string,
  provider: ResearchProvider = getResearchProvider(),
) {
  const [project] = await db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.id, projectId));
  if (!project) throw new Error(`Search project ${projectId} not found`);
  if (!provider.configured) throw new ResearchRequiredError(provider.name);

  const { getIntelligence } = await import("./intelligence");
  const payload = (await getIntelligence(db, projectId))?.payload;
  const queries = audienceQueries(project, payload);
  const existing = await listResearchFindings(db, projectId);
  const answered = new Set(existing.map((row) => row.query));
  const knownUrls = new Set(existing.map((row) => row.url));

  for (const query of queries) {
    if (answered.has(query)) continue;
    const findings: ResearchFinding[] = await provider.search(query, {
      limit: 6,
    });
    const fresh = findings.filter((f) => !knownUrls.has(f.url));
    if (fresh.length > 0) {
      await db.insert(researchSources).values(
        fresh.map((f) => ({
          searchProjectId: projectId,
          url: f.url,
          title: f.title,
          snippet: f.snippet,
          source: f.source,
          query: f.query,
          retrievedAt: f.retrievedAt,
        })),
      );
      for (const f of fresh) knownUrls.add(f.url);
    }
  }
  return { queries, findings: await listResearchFindings(db, projectId) };
}
