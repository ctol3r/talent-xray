"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { act } from "./helpers";
import {
  prepareSourceRecommendations,
  previewSourceRecommendations,
  saveSourceRecommendations,
} from "@/lib/services/source-recommendations";
const project = z.string().min(1).max(100);
const response = z.string().max(400000);
function parseResponse(text: string): unknown {
  try {
    return JSON.parse(response.parse(text));
  } catch {
    throw new Error(
      "Paste the JSON response without Markdown fences; maximum 400,000 characters.",
    );
  }
}
export async function prepareSourceRecommendationsAction(raw: unknown) {
  return act(async () =>
    prepareSourceRecommendations(getDb(), project.parse(raw)),
  );
}
export async function previewSourceRecommendationsAction(raw: unknown) {
  return act(async () => {
    const input = z.object({ searchProjectId: project, response }).parse(raw);
    return previewSourceRecommendations(
      getDb(),
      input.searchProjectId,
      parseResponse(input.response),
    );
  });
}
export async function saveSourceRecommendationsAction(raw: unknown) {
  return act(async () => {
    const input = z
      .object({
        searchProjectId: project,
        response,
        selectedIds: z.array(z.string()).min(1).max(40),
      })
      .parse(raw);
    const result = await saveSourceRecommendations(
      getDb(),
      input.searchProjectId,
      parseResponse(input.response),
      input.selectedIds,
    );
    revalidatePath(`/searches/${input.searchProjectId}/sources`);
    return result;
  });
}
