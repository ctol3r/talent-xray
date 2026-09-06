"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import {
  clearRegistryMatch,
  confirmRegistryMatch,
  searchNppesForCandidate,
  type RegistrySearchHit,
} from "@/lib/services/registries";
import { act, type ActionResult } from "./helpers";

function refresh() {
  revalidatePath("/searches", "layout");
}

export async function searchNppesAction(
  input: unknown,
): Promise<ActionResult<{ hits: RegistrySearchHit[] }>> {
  return act(async () => {
    // In memory only — a search never writes.
    const hits = await searchNppesForCandidate(getDb(), input as never);
    return { hits };
  });
}

export async function confirmRegistryMatchAction(
  input: unknown,
): Promise<ActionResult<{ registryId: string }>> {
  return act(async () => {
    const row = await confirmRegistryMatch(getDb(), input as never);
    refresh();
    return { registryId: row.registryId };
  });
}

export async function clearRegistryMatchAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const { candidateId } = z
      .object({ candidateId: z.string().min(1) })
      .parse(input);
    await clearRegistryMatch(getDb(), candidateId);
    refresh();
    return undefined;
  });
}
