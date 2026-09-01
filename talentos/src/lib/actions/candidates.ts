"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import {
  addCandidateSource,
  addCandidateSourceInput,
  createCandidate,
  createCandidateInput,
  deleteCandidate,
  exportCandidate,
  getCandidate,
  moveCandidateStage,
  moveCandidateStageInput,
  updateCandidate,
  updateCandidateInput,
} from "@/lib/services/candidates";
import { act, type ActionResult } from "./helpers";

async function revalidateFor(candidateId: string) {
  const candidate = await getCandidate(getDb(), candidateId);
  if (candidate) {
    revalidatePath(`/searches/${candidate.searchProjectId}`, "layout");
  }
  revalidatePath("/candidates");
}

export async function createCandidateAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return act(async () => {
    const parsed = createCandidateInput.parse(input);
    const candidate = await createCandidate(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    revalidatePath("/candidates");
    return { id: candidate.id };
  });
}

export async function updateCandidateAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = updateCandidateInput.parse(input);
    await updateCandidate(getDb(), parsed);
    await revalidateFor(parsed.id);
    return undefined;
  });
}

export async function moveCandidateStageAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = moveCandidateStageInput.parse(input);
    await moveCandidateStage(getDb(), parsed);
    await revalidateFor(parsed.candidateId);
    return undefined;
  });
}

export async function addCandidateSourceAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = addCandidateSourceInput.parse(input);
    await addCandidateSource(getDb(), parsed);
    await revalidateFor(parsed.candidateId);
    return undefined;
  });
}

const idInput = z.object({ candidateId: z.string() });

export async function deleteCandidateAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const { candidateId } = idInput.parse(input);
    const candidate = await getCandidate(getDb(), candidateId);
    await deleteCandidate(getDb(), candidateId);
    if (candidate) {
      revalidatePath(`/searches/${candidate.searchProjectId}`, "layout");
    }
    revalidatePath("/candidates");
    return undefined;
  });
}

export async function exportCandidateAction(
  input: unknown,
): Promise<ActionResult<{ json: string }>> {
  return act(async () => {
    const { candidateId } = idInput.parse(input);
    const data = await exportCandidate(getDb(), candidateId);
    return { json: JSON.stringify(data, null, 2) };
  });
}
