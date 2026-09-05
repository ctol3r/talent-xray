"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { saveCompensation } from "@/lib/services/compensation";
import { act } from "./helpers";
export async function saveCompensationAction(raw: unknown) {
  return act(async () => {
    const result = saveCompensation(getDb(), raw);
    revalidatePath("/searches", "layout");
    return result;
  });
}
