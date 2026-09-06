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
import { recordQueryRun } from "@/lib/services/query-yield";
import { act, type ActionResult } from "./helpers";

export async function runDiscoveryAction(
  input: unknown,
): Promise<ActionResult<{ results: DiscoveryResult[]; runId: string }>> {
  return act(async () => {
    const parsed = runDiscoveryInput.parse(input);
    const results = await runDiscovery(parsed);
    // Results stay transient until the recruiter saves one explicitly. The
    // yield ledger records the run itself — query text, engine and a result
    // COUNT — which is a query record, not a result record (product rule 2).
    const run = await recordQueryRun(getDb(), {
      searchProjectId: parsed.searchProjectId,
      queryId: parsed.queryId,
      queryText: parsed.query,
      edited: parsed.edited,
      engine: parsed.engine,
      resultCount: results.length,
    });
    return { results, runId: run.id };
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
