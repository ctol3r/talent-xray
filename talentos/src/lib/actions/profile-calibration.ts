"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { answerCalibration } from "@/lib/services/profile-calibration";
import { act, type ActionResult } from "./helpers";

const input = z.object({ jobId: z.string().min(1) }).passthrough();

/**
 * One action, because there is one thing to do: answer the question.
 *
 * There is deliberately no action here that edits the profile without an open
 * question, and none that dismisses the question without recording anything.
 * The profile has its own page for ordinary edits; this path exists so that a
 * change made because of four rejections is stored as a change made because
 * of four rejections.
 */
export async function answerCalibrationAction(
  raw: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const { jobId } = input.parse(raw);
    answerCalibration(getDb(), raw);
    revalidatePath(`/searches/${jobId}/hill`);
    revalidatePath(`/searches/${jobId}/profile`);
    revalidatePath(`/searches/${jobId}`);
    return undefined;
  });
}
