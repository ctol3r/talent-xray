"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { dayKey, writeDailyNote } from "@/lib/services/daily";
import { act, type ActionResult } from "./helpers";

const input = z.object({ day: dayKey, text: z.string().max(20000) });

export async function saveDailyNoteAction(
  raw: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = input.parse(raw);
    writeDailyNote(getDb(), parsed.day, parsed.text);
    revalidatePath(`/daily/${parsed.day}`);
    revalidatePath("/tags", "layout");
    return undefined;
  });
}
