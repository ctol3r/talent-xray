"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { getCandidate, updateCandidate } from "@/lib/services/candidates";
import {
  getSearchProject,
  updateSearchProject,
} from "@/lib/services/search-projects";
import { appendTagToNotes, suggestCandidateTags } from "@/lib/services/tags";
import { act, type ActionResult } from "./helpers";

const suggestInput = z.object({ candidateId: z.string().uuid() });

const keepInput = z.object({
  candidateId: z.string().uuid(),
  slug: z.string().min(1).max(80),
  display: z.string().min(1).max(80),
});

export type TagSuggestion = {
  slug: string;
  tag: string;
  kind: string;
  evidence: string;
};

export async function suggestCandidateTagsAction(
  input: unknown,
): Promise<ActionResult<{ suggestions: TagSuggestion[]; notFound: string[] }>> {
  return act(async () => {
    const { candidateId } = suggestInput.parse(input);
    const result = await suggestCandidateTags(getDb(), candidateId);
    return {
      suggestions: result.suggestions.map((suggestion) => ({
        slug: suggestion.slug,
        tag: suggestion.tag,
        kind: suggestion.kind,
        evidence: suggestion.evidence,
      })),
      notFound: result.notFound,
    };
  });
}

/**
 * Keep one suggested tag. It becomes a word in the person's notes, which is
 * where a hand-written tag lives too, so it can be edited or deleted like
 * any other word.
 */
export async function keepCandidateTagAction(
  input: unknown,
): Promise<ActionResult<{ notes: string }>> {
  return act(async () => {
    const parsed = keepInput.parse(input);
    const db = getDb();
    const candidate = await getCandidate(db, parsed.candidateId);
    if (!candidate) throw new Error("Candidate not found.");
    const notes = appendTagToNotes(candidate.recruiterNotes, {
      slug: parsed.slug,
      display: parsed.display,
    });
    await updateCandidate(db, {
      id: parsed.candidateId,
      recruiterNotes: notes,
    });
    revalidatePath(`/searches/${candidate.searchProjectId}`, "layout");
    revalidatePath("/tags", "layout");
    return { notes };
  });
}

const keepJobInput = z.object({
  searchProjectId: z.string().min(1).max(180),
  slug: z.string().min(1).max(80),
  display: z.string().min(1).max(80),
});

/**
 * Keep one tag proposed from the job's requirements.
 *
 * It becomes a word in the job's notes — the same column a hand-typed tag
 * lives in and the one the tag index reads — so it can be edited or deleted
 * like any other word, and the graph picks it up on the next projection with
 * nothing to keep in step.
 */
export async function keepJobTagAction(
  input: unknown,
): Promise<ActionResult<{ notes: string }>> {
  return act(async () => {
    const parsed = keepJobInput.parse(input);
    const db = getDb();
    const project = await getSearchProject(db, parsed.searchProjectId);
    if (!project) throw new Error("Job not found.");
    const notes = appendTagToNotes(project.recruiterNotes, {
      slug: parsed.slug,
      display: parsed.display,
    });
    await updateSearchProject(db, {
      id: parsed.searchProjectId,
      recruiterNotes: notes,
    });
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    revalidatePath("/tags", "layout");
    return { notes };
  });
}
