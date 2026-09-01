"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import {
  createSearchProject,
  createSearchProjectInput,
  saveHiringManager,
  saveHiringManagerInput,
  saveJobDescription,
  saveJobDescriptionInput,
  updateSearchProject,
  updateSearchProjectInput,
} from "@/lib/services/search-projects";
import { act, type ActionResult } from "./helpers";

export async function createSearchProjectAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return act(async () => {
    const parsed = createSearchProjectInput.parse(input);
    const project = await createSearchProject(getDb(), parsed);
    revalidatePath("/", "layout");
    return { id: project.id };
  });
}

export async function updateSearchProjectAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = updateSearchProjectInput.parse(input);
    await updateSearchProject(getDb(), parsed);
    revalidatePath("/", "layout");
    return undefined;
  });
}

export async function saveJobDescriptionAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = saveJobDescriptionInput.parse(input);
    await saveJobDescription(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return undefined;
  });
}

export async function saveHiringManagerAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = saveHiringManagerInput.parse(input);
    await saveHiringManager(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return undefined;
  });
}
