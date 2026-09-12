"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { derivePersonas } from "@/lib/services/intelligence";
import { act, type ActionResult } from "./helpers";
import type { GenerateSummary } from "./generate";

const projectInput = z.object({ searchProjectId: z.string() });

/**
 * Research the audience on the web (through the configured research
 * provider) and derive one research-backed persona per talent segment
 * (D-013). Audience-level only; fails honestly when no research provider is
 * configured or a session research request is still pending.
 */
export async function derivePersonasAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const { personas, findings, droppedCitations, warnings } =
      await derivePersonas(getDb(), searchProjectId);
    revalidatePath(`/searches/${searchProjectId}`, "layout");
    return {
      warnings,
      note: `${personas.length} persona${personas.length === 1 ? "" : "s"} from ${findings.length} research finding${findings.length === 1 ? "" : "s"}${
        droppedCitations > 0
          ? ` (${droppedCitations} uncited claim${droppedCitations === 1 ? "" : "s"} dropped)`
          : ""
      }`,
    };
  });
}
