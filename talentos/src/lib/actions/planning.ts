"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadProjectContext } from "@/lib/ai/context";
import { SessionFulfillmentPendingError } from "@/lib/ai/session";
import { getDb } from "@/lib/db/client";
import type { TraitScanHit } from "@/lib/domain/fair-hiring";
import {
  deriveHiringNeed,
  deriveSearchPlan,
  getIntelligence,
} from "@/lib/services/intelligence";
import { act, type ActionResult } from "./helpers";

const projectInput = z.object({ searchProjectId: z.string().trim().min(1) });

export type PlanningOutcome =
  | { state: "ready"; warnings: TraitScanHit[] }
  | { state: "pending"; requestPath: string; responsePath: string };

// A prepared session request is neither a failed generation nor a saved draft.
// Keep this distinction local to planning; other generation controls share act.
async function planAction(
  run: () => Promise<PlanningOutcome>,
): Promise<ActionResult<PlanningOutcome>> {
  return act(async () => {
    try {
      return await run();
    } catch (error) {
      if (error instanceof SessionFulfillmentPendingError) {
        return {
          state: "pending",
          requestPath: error.requestPath,
          responsePath: error.responsePath,
        };
      }
      throw error;
    }
  });
}

/** Initial interpretation only: repeated clicks must not replace reviewed intent. */
export async function initializeHiringNeedAction(
  input: unknown,
): Promise<ActionResult<PlanningOutcome>> {
  return planAction(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const db = getDb();
    if (await getIntelligence(db, searchProjectId)) {
      revalidatePath(`/searches/${searchProjectId}`, "layout");
      return { state: "ready", warnings: [] };
    }
    const context = await loadProjectContext(db, searchProjectId);
    if (!context.jdText?.trim()) {
      throw new Error(
        "Save a job description before deriving the hiring need.",
      );
    }
    const { warnings } = await deriveHiringNeed(db, searchProjectId);
    revalidatePath(`/searches/${searchProjectId}`, "layout");
    return { state: "ready", warnings };
  });
}

export async function deriveSearchPlanAction(
  input: unknown,
): Promise<ActionResult<PlanningOutcome>> {
  return planAction(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const db = getDb();
    const intelligence = await getIntelligence(db, searchProjectId);
    if (!intelligence) {
      throw new Error("Derive the hiring need before deriving a search plan.");
    }
    if (intelligence.payload.intent.requirements.length === 0) {
      throw new Error(
        "Add job-related requirements before deriving a search plan.",
      );
    }
    const { warnings } = await deriveSearchPlan(db, searchProjectId);
    revalidatePath(`/searches/${searchProjectId}`, "layout");
    return { state: "ready", warnings };
  });
}
