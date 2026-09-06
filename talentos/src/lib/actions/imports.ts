"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { importSourceSchema, MAX_IMPORT_BYTES } from "@/lib/imports/contracts";
import type { ImportPreview } from "@/lib/imports/preview";
import {
  commitImport,
  previewImport,
  type CommitResult,
} from "@/lib/services/imports";
import { act, type ActionResult } from "./helpers";

function refresh(searchProjectId: string) {
  revalidatePath(`/searches/${searchProjectId}`, "layout");
  revalidatePath("/tasks");
}

export async function previewImportAction(
  form: FormData,
): Promise<ActionResult<ImportPreview & { text: string; filename: string }>> {
  return act(async () => {
    const searchProjectId = z
      .string()
      .min(1)
      .parse(form.get("searchProjectId"));
    const sourceRaw = form.get("source");
    const source =
      typeof sourceRaw === "string" && sourceRaw !== ""
        ? importSourceSchema.parse(sourceRaw)
        : undefined;
    const overridesRaw = form.get("overrides");
    const overrides =
      typeof overridesRaw === "string" && overridesRaw !== ""
        ? (JSON.parse(overridesRaw) as Record<string, string>)
        : undefined;
    const file = form.get("file");
    let text: string;
    let filename: string;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_IMPORT_BYTES) throw new Error("File exceeds 5 MiB.");
      const lower = file.name.toLowerCase();
      if (!lower.endsWith(".csv") && !lower.endsWith(".json")) {
        throw new Error("Choose a .csv or .json export.");
      }
      text = await file.text();
      filename = file.name;
    } else {
      // Re-preview with overrides: the client sends the text it already has.
      text = z.string().min(1).parse(form.get("text"));
      filename = z.string().min(1).parse(form.get("filename"));
    }
    const preview = await previewImport(getDb(), {
      searchProjectId,
      filename,
      text,
      source,
      overrides: overrides as never,
    });
    return { ...preview, text, filename };
  });
}

export async function commitImportAction(
  input: unknown,
): Promise<ActionResult<CommitResult>> {
  return act(async () => {
    const parsed = z
      .object({ searchProjectId: z.string().min(1) })
      .passthrough()
      .parse(input);
    const result = await commitImport(getDb(), input as never);
    refresh(parsed.searchProjectId);
    return result;
  });
}
