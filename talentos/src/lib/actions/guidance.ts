"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import {
  generateCandidatePacket,
  generateHmBrief,
  generatePacketInput,
  recordHmFeedback,
  recordHmFeedbackInput,
} from "@/lib/services/guidance";
import { getCandidate } from "@/lib/services/candidates";
import { act, type ActionResult } from "./helpers";
import type { GenerateSummary } from "./generate";

const projectInput = z.object({ searchProjectId: z.string() });

export async function generateHmBriefAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const { warnings } = await generateHmBrief(getDb(), searchProjectId);
    revalidatePath(`/searches/${searchProjectId}`, "layout");
    return { warnings };
  });
}

export async function generateCandidatePacketAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const parsed = generatePacketInput.parse(input);
    const db = getDb();
    const { warnings } = await generateCandidatePacket(db, parsed);
    const candidate = await getCandidate(db, parsed.candidateId);
    if (candidate)
      revalidatePath(`/searches/${candidate.searchProjectId}`, "layout");
    return {
      warnings,
      note: "Draft ready below — you share it; nothing sends.",
    };
  });
}

export async function recordHmFeedbackAction(
  input: unknown,
): Promise<ActionResult<{ recordedAt: string }>> {
  return act(async () => {
    const parsed = recordHmFeedbackInput.parse(input);
    const db = getDb();
    const entry = await recordHmFeedback(db, parsed);
    const candidate = await getCandidate(db, parsed.candidateId);
    if (candidate)
      revalidatePath(`/searches/${candidate.searchProjectId}`, "layout");
    return { recordedAt: entry.at };
  });
}
