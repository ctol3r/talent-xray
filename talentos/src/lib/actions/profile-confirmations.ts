"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import {
  recordCandidateAnswer,
  recordAnswerInput,
  recordRequestSent,
  recordRequestSentInput,
  resolveNotice,
  resolveNoticeInput,
  type AnswerResult,
} from "@/lib/services/profile-confirmations";
import { act, type ActionResult } from "./helpers";

const withPath = z.object({ searchProjectId: z.string().min(1) });

/** The recruiter states they sent the message. Nothing is sent from here. */
export async function recordRequestSentAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = recordRequestSentInput.merge(withPath).parse(input);
    recordRequestSent(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return undefined;
  });
}

export async function resolveNoticeAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = resolveNoticeInput.merge(withPath).parse(input);
    resolveNotice(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return undefined;
  });
}

export async function recordCandidateAnswerAction(
  input: unknown,
): Promise<ActionResult<AnswerResult>> {
  return act(async () => {
    const parsed = recordAnswerInput.merge(withPath).parse(input);
    const result = recordCandidateAnswer(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return result;
  });
}
