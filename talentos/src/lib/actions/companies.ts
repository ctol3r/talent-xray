"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { setCompanySite, setCompanySiteInput } from "@/lib/services/companies";
import { act, type ActionResult } from "./helpers";

export async function setCompanySiteAction(
  input: unknown,
): Promise<ActionResult<{ url: string | null }>> {
  return act(async () => {
    const parsed = setCompanySiteInput.parse(input);
    const saved = setCompanySite(getDb(), parsed);
    // Every surface: a company's mark appears on the jobs list, the people
    // list, a job's header and a person's page, and all of them are wrong the
    // moment one of them is right.
    revalidatePath("/", "layout");
    return saved;
  });
}
