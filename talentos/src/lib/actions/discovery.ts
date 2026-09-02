"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import type { DiscoveryResult } from "@/lib/research/discovery-provider";
import {
  runDiscovery,
  runDiscoveryInput,
  saveDiscoveryResult,
  saveDiscoveryResultInput,
  setEvidenceVerification,
  setEvidenceVerificationInput,
} from "@/lib/services/discovery";
import { act, type ActionResult } from "./helpers";

export async function runDiscoveryAction(
  input: unknown,
): Promise<ActionResult<{ results: DiscoveryResult[] }>> {
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

export async function setEvidenceVerificationAction(
  input: unknown,
): Promise<ActionResult<{ verificationStatus: string }>> {
  return act(async () => {
    const parsed = setEvidenceVerificationInput.parse(input);
    const row = await setEvidenceVerification(getDb(), parsed);
    if (!row) throw new Error("Evidence row not found");
    revalidatePath(`/searches/${row.searchProjectId}`, "layout");
    return { verificationStatus: row.verificationStatus };
  });
}
