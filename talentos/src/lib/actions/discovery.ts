"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import type { DiscoveryResult } from "@/lib/research/discovery-provider";
import {
  recordLinkOutRun,
  recordLinkOutRunInput,
  runDiscovery,
  runDiscoveryInput,
  saveDiscoveryResult,
  saveDiscoveryResultInput,
  setEvidenceVerification,
  setEvidenceVerificationInput,
} from "@/lib/services/discovery";
import { recordQueryRun } from "@/lib/services/query-yield";
import { runOpenIndex, runOpenIndexInput } from "@/lib/services/open-index";
import {
  readPages,
  readPagesInput,
  type PageReadingRun,
} from "@/lib/services/page-reading";
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

/** Link-out run (D-034): the count the recruiter read and the URLs they kept. */
export async function recordLinkOutRunAction(
  input: unknown,
): Promise<
  ActionResult<{ runId: string; savedUrls: number; candidatesCreated: number }>
> {
  return act(async () => {
    const parsed = recordLinkOutRunInput.parse(input);
    const result = await recordLinkOutRun(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return result;
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

/**
 * Run the open index (public, licensed people APIs) for a search.
 *
 * Returns rows and stores nothing. Keeping one is the existing explicit act
 * — `saveDiscoveryResultAction` — so an open-index save lands in the same
 * ledger, labelled unverified, as any other.
 */
export async function runOpenIndexAction(input: unknown): Promise<
  ActionResult<{
    results: DiscoveryResult[];
    reports: { source: string; label: string; count: number; error?: string }[];
    requests: { source: string; url: string; purpose: string }[];
  }>
> {
  return act(async () => {
    const parsed = runOpenIndexInput.parse(input);
    const run = await runOpenIndex(parsed);
    return {
      results: run.results,
      reports: run.reports,
      requests: run.requests,
    };
  });
}

/**
 * Open the pages a run returned and read the people off them (D-082).
 *
 * Nothing is persisted: a reading is handed to the panel and dropped, and a
 * person becomes a record through the same explicit save a link-out result
 * already uses. Off unless the owner has turned reading on, in which case
 * every row comes back with the sentence saying so.
 */
export async function readDiscoveredPagesAction(
  input: unknown,
): Promise<ActionResult<PageReadingRun>> {
  return act(async () => readPages(readPagesInput.parse(input)));
}
