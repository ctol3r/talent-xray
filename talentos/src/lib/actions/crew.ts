"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import {
  advanceCrew,
  kickoffCandidateCrew,
  kickoffCandidateCrewInput,
  kickoffCrew,
  kickoffCrewInput,
  type CrewAdvanceResult,
} from "@/lib/services/crew";
import { getCandidate } from "@/lib/services/candidates";
import { act, type ActionResult } from "./helpers";
import type { GenerateSummary } from "./generate";

function revalidateProject(projectId: string) {
  revalidatePath(`/searches/${projectId}`, "layout");
}

export async function kickoffCrewAction(
  input: unknown,
): Promise<ActionResult<{ jobs: number }>> {
  return act(async () => {
    const { searchProjectId } = kickoffCrewInput.parse(input);
    const jobs = await kickoffCrew(getDb(), searchProjectId);
    revalidateProject(searchProjectId);
    return { jobs: jobs.length };
  });
}

export async function kickoffCandidateCrewAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { candidateId } = kickoffCandidateCrewInput.parse(input);
    const db = getDb();
    const jobs = await kickoffCandidateCrew(db, candidateId);
    const candidate = await getCandidate(db, candidateId);
    if (candidate) revalidateProject(candidate.searchProjectId);
    return {
      warnings: [],
      note: `Queued ${jobs.length} candidate agents (evidence → outreach). Advance them from the Crew tab.`,
    };
  });
}

export async function advanceCrewAction(
  input: unknown,
): Promise<ActionResult<CrewAdvanceResult>> {
  return act(async () => {
    const { searchProjectId } = kickoffCrewInput.parse(input);
    const result = await advanceCrew(getDb(), searchProjectId);
    revalidateProject(searchProjectId);
    return result;
  });
}
