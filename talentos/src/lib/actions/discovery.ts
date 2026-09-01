"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import type { ResearchResult } from "@/lib/research/provider";
import {
  runDiscovery,
  runDiscoveryInput,
  saveDiscoveryResult,
  saveDiscoveryResultInput,
} from "@/lib/services/discovery";
import { act, type ActionResult } from "./helpers";

export async function runDiscoveryAction(
  input: unknown,
): Promise<ActionResult<{ results: ResearchResult[] }>> {
  return act(async () => {
    const parsed = runDiscoveryInput.parse(input);
    const results = await runDiscovery(parsed);
    // Deliberately no persistence here: results are transient until the
    // recruiter saves one explicitly.
    return { results };
  });
}

export async function saveDiscoveryResultAction(
  input: unknown,
): Promise<ActionResult<{ candidateId?: string }>> {
  return act(async () => {
    const parsed = saveDiscoveryResultInput.parse(input);
    const { candidateId } = await saveDiscoveryResult(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return { candidateId };
  });
}
