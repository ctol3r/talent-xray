"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { syncWholeGraph } from "@/lib/services/global-graph";
import { act, type ActionResult } from "./helpers";

/**
 * Rebuild the whole-workspace graph from the records.
 *
 * Exposed as a button because the alternative was a command-line script,
 * which meant the store existed and nobody could see it.
 */
export async function syncGraphAction(): Promise<
  ActionResult<{ jobs: number; nodes: number; edges: number }>
> {
  return act(async () => {
    const result = await syncWholeGraph(getDb());
    revalidatePath("/graph");
    return result;
  });
}
