"use server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import {
  createGraphLink,
  removeGraphLink,
} from "@/lib/services/knowledge-graph";
import { act } from "./helpers";
export async function createGraphLinkAction(raw: unknown) {
  return act(async () => {
    const link = createGraphLink(getDb(), raw);
    revalidatePath("/searches", "layout");
    return link.id;
  });
}
export async function removeGraphLinkAction(raw: unknown) {
  return act(async () => {
    const id = removeGraphLink(getDb(), raw);
    revalidatePath("/searches", "layout");
    return id;
  });
}
