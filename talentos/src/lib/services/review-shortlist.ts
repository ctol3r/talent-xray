import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { candidates, settings } from "@/lib/db/schema";
import { reviewWorkspace } from "./document-review";
import { validateAnchor } from "@/lib/documents/contracts";
const selection = z.object({ comparisonIds: z.array(z.string()).max(100) });
/** A draft output selection, not a pipeline stage or a submitted hiring decision. */
export function shortlistWorkspace(db: Db, searchProjectId: string) {
  const saved = selection.safeParse(
    db
      .select()
      .from(settings)
      .where(eq(settings.key, `review-shortlist:${searchProjectId}`))
      .get()?.value,
  );
  const people = db
    .select()
    .from(candidates)
    .where(eq(candidates.searchProjectId, searchProjectId))
    .all();
  const reviews = people.flatMap((person) => {
    const w = reviewWorkspace(db, searchProjectId, person.id);
    return w.comparisons.map((comparison) => {
      const cv = w.cvVersions.find((d) => d.id === comparison.cvVersionId)!,
        jd = w.jdVersions.find((d) => d.id === comparison.jdVersionId)!;
      const accepted = w.links.filter(
        (l) =>
          l.comparisonId === comparison.id &&
          w.reviews.find((r) => r.linkId === l.id)?.decision === "accepted",
      );
      for (const link of accepted) {
        validateAnchor(cv.text, link.payload.cvAnchor);
        if (link.payload.jdAnchor)
          validateAnchor(jd.text, link.payload.jdAnchor);
      }
      return {
        comparisonId: comparison.id,
        candidateId: person.id,
        candidateName: person.name,
        cvVersionId: cv.id,
        jdVersionId: jd.id,
        createdAt: comparison.createdAt,
        freshness:
          comparison.contextHash === w.contextHash ? "current" : "stale",
        conclusion: comparison.conclusion,
        accepted: accepted.map((l) => ({
          ...l,
          reviewHistory: w.reviews.filter((r) => r.linkId === l.id),
        })),
        unresolvedRequirements: comparison.requirements.filter(
          (r) =>
            !accepted.some(
              (l) =>
                l.payload.requirementId === r.id &&
                l.payload.assessment === "relevant",
            ),
        ),
        requirements: comparison.requirements,
      };
    });
  });
  return {
    reviews,
    comparisonIds: saved.success ? saved.data.comparisonIds : [],
  };
}
export function saveShortlistDraft(db: Db, raw: unknown) {
  const p = selection.extend({ searchProjectId: z.string().min(1) }).parse(raw);
  const w = shortlistWorkspace(db, p.searchProjectId);
  for (const id of p.comparisonIds) {
    const r = w.reviews.find((r) => r.comparisonId === id);
    if (!r || r.freshness !== "current")
      throw new Error(
        "Only current comparisons from this search can enter the draft shortlist.",
      );
    if (!r.accepted.length && !r.conclusion.trim())
      throw new Error(
        "Review evidence or save a recruiter conclusion before selecting this comparison.",
      );
  }
  db.insert(settings)
    .values({
      key: `review-shortlist:${p.searchProjectId}`,
      value: { comparisonIds: [...new Set(p.comparisonIds)] },
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: { comparisonIds: [...new Set(p.comparisonIds)] },
        updatedAt: new Date().toISOString(),
      },
    })
    .run();
  return p.comparisonIds;
}
export function exportShortlistDraft(db: Db, searchProjectId: string) {
  const w = shortlistWorkspace(db, searchProjectId);
  const reviews = w.comparisonIds.map((id) => {
    const review = w.reviews.find((r) => r.comparisonId === id);
    if (!review || review.freshness !== "current")
      throw new Error(
        "A selected review is stale or unavailable. Update the draft selection before export.",
      );
    return review;
  });
  if (!reviews.length)
    throw new Error("Select and save at least one reviewed candidate first.");
  return {
    kind: "draft-reviewed-shortlist",
    searchProjectId,
    exportedAt: new Date().toISOString(),
    notice:
      "Recruiter-selected draft only. No contact, submission or stage change is implied. Relationship acceptance is not independent verification.",
    reviews,
  };
}
