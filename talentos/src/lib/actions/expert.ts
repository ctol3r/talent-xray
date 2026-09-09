"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import {
  askThread,
  clearChat,
  collectAnswers,
  retryThread,
  type AskThread,
} from "@/lib/services/expert";
import { act, type ActionResult } from "./helpers";

const askInput = z.object({
  question: z.string().min(1).max(4000),
  /** Name a specialist to override the routing. */
  expert: z.string().max(40).optional(),
});

export async function askExpertAction(
  input: unknown,
): Promise<ActionResult<{ threads: AskThread[] }>> {
  return act(async () => {
    const parsed = askInput.parse(input);
    const threads = await askThread(getDb(), parsed.question, parsed.expert);
    revalidatePath("/", "layout");
    return { threads };
  });
}

const retryInput = z.object({ threadId: z.string().min(1).max(64) });

export async function retryThreadAction(
  input: unknown,
): Promise<ActionResult<{ threads: AskThread[] }>> {
  return act(async () => {
    const parsed = retryInput.parse(input);
    const threads = await retryThread(getDb(), parsed.threadId);
    revalidatePath("/", "layout");
    return { threads };
  });
}

/**
 * Pick up anything that has been answered since the page was drawn.
 *
 * The conversation polls this while it has an open thread. It reads the
 * outbox and writes to the conversation; it never asks the model anything, so
 * polling it costs a directory check per open thread and nothing else. The
 * page is only revalidated when something actually moved — a poll that
 * revalidated on every tick would re-render the whole layout every few
 * seconds for no reason.
 */
export async function collectAnswersAction(): Promise<
  ActionResult<{ changed: boolean; threads: AskThread[] }>
> {
  return act(async () => {
    const { changed, threads } = collectAnswers(getDb());
    if (changed) revalidatePath("/", "layout");
    return { changed, threads };
  });
}

export async function clearChatAction(): Promise<ActionResult<undefined>> {
  return act(async () => {
    clearChat(getDb());
    revalidatePath("/", "layout");
    return undefined;
  });
}
