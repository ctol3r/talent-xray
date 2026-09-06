import { and, desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  candidateSources,
  candidates,
  researchSources,
  searchProjects,
} from "@/lib/db/schema";
import { captureInputSchema } from "@/lib/core/browser-companion";

export function captureWorkspace(db: Db) {
  return {
    projects: db
      .select({ id: searchProjects.id, name: searchProjects.name })
      .from(searchProjects)
      .orderBy(desc(searchProjects.updatedAt))
      .all(),
    candidates: db
      .select({
        id: candidates.id,
        name: candidates.name,
        searchProjectId: candidates.searchProjectId,
      })
      .from(candidates)
      .orderBy(desc(candidates.updatedAt))
      .all(),
    saved: [
      ...db
        .select({
          id: candidateSources.id,
          url: candidateSources.url,
          title: candidateSources.label,
          searchProjectId: candidates.searchProjectId,
          candidateId: candidates.id,
          createdAt: candidateSources.createdAt,
        })
        .from(candidateSources)
        .innerJoin(candidates, eq(candidateSources.candidateId, candidates.id))
        .where(eq(candidateSources.addedVia, "browser_capture"))
        .all(),
      ...db
        .select({
          id: researchSources.id,
          url: researchSources.url,
          title: researchSources.title,
          searchProjectId: researchSources.searchProjectId,
          createdAt: researchSources.createdAt,
        })
        .from(researchSources)
        .where(eq(researchSources.source, "browser_capture"))
        .all()
        .map((row) => ({ ...row, candidateId: null })),
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  };
}

/** Only the explicit Save action creates a record. No fetching or candidate workflow writes. */
export function saveCapturedSource(db: Db, input: unknown) {
  const parsed = captureInputSchema.parse(input);
  return db.transaction((tx) => {
    const project = tx
      .select({ id: searchProjects.id })
      .from(searchProjects)
      .where(eq(searchProjects.id, parsed.searchProjectId))
      .get();
    if (!project)
      throw new Error(
        "Search not found. Reopen the capture page and choose an existing search.",
      );
    if (parsed.destination === "candidate") {
      const candidate = tx
        .select()
        .from(candidates)
        .where(
          and(
            eq(candidates.id, parsed.candidateId!),
            eq(candidates.searchProjectId, project.id),
          ),
        )
        .get();
      if (!candidate)
        throw new Error(
          "The candidate does not belong to the selected search.",
        );
      const existing = tx
        .select()
        .from(candidateSources)
        .where(
          and(
            eq(candidateSources.candidateId, candidate.id),
            eq(candidateSources.url, parsed.url),
          ),
        )
        .get();
      const row =
        existing ??
        tx
          .insert(candidateSources)
          .values({
            candidateId: candidate.id,
            url: parsed.url,
            label: parsed.title || null,
            addedVia: "browser_capture",
          })
          .returning()
          .get();
      return {
        id: row.id,
        duplicate: !!existing,
        destination: parsed.destination,
        href: `/searches/${project.id}/candidates/${candidate.id}`,
      };
    }
    const existing = tx
      .select()
      .from(researchSources)
      .where(
        and(
          eq(researchSources.searchProjectId, project.id),
          eq(researchSources.url, parsed.url),
        ),
      )
      .get();
    const row =
      existing ??
      tx
        .insert(researchSources)
        .values({
          searchProjectId: project.id,
          url: parsed.url,
          title: parsed.title || null,
          source: "browser_capture",
        })
        .returning()
        .get();
    return {
      id: row.id,
      duplicate: !!existing,
      destination: parsed.destination,
      href: `/searches/${project.id}/market`,
    };
  });
}

export type CaptureWorkspace = ReturnType<typeof captureWorkspace>;
