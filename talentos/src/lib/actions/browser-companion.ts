"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import {
  assertLocalCompanionRequest,
  captureInputSchema,
} from "@/lib/core/browser-companion";
import { saveCapturedSource } from "@/lib/services/browser-companion";
import { act } from "./helpers";

export async function saveCapturedSourceAction(input: unknown) {
  return act(async () => {
    const request = await headers();
    assertLocalCompanionRequest(request.get("host"), request.get("origin"));
    const parsed = captureInputSchema.parse(input);
    const result = saveCapturedSource(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    revalidatePath("/capture");
    return result;
  });
}
