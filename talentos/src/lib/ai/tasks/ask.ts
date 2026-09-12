import { z } from "zod";
import {
  getProviderStatus,
  ProviderNotConfiguredError,
  type ModelProvider,
} from "@/lib/ai/provider";
import { createAnthropicProvider } from "@/lib/ai/anthropic";
import { createSessionProvider } from "@/lib/ai/session";
import { systemPrelude } from "@/lib/ai/prompts";

/**
 * A question asked from a note block.
 *
 * The one place in the product where somebody types a question in their own
 * words rather than pressing a button that generates a named artifact. It is
 * still structured, and deliberately so: the answer has to come back with the
 * things it is not sure about, because an answer that cannot say what it does
 * not know is one a recruiter has no way to check.
 *
 * What it is NOT allowed to be is a source of facts about people. The note it
 * is asked from may name candidates; the answer must not assert anything about
 * them that the recruiter did not write. It answers the question in front of
 * it — how to phrase something, what a term means, what to ask a manager — and
 * says so when the question is one it should not answer.
 */
export const askAnswerSchema = z.object({
  answer: z.string().min(1).max(2000),
  /** What the answer is not sure about. Empty only when there is genuinely nothing. */
  uncertain: z.array(z.string().max(300)).max(5),
  /**
   * True when the question asked for a claim about a named person. The answer
   * then says what it would need instead of guessing.
   */
  declined: z.boolean(),
});

export type AskAnswer = z.infer<typeof askAnswerSchema>;

export async function askAboutBlock(question: string): Promise<AskAnswer> {
  const status = getProviderStatus();
  if (!status.configured) {
    throw new ProviderNotConfiguredError(status.detail);
  }
  // The same two providers every other generation uses. A question typed in a
  // note is not a different kind of request and must not get a different kind
  // of answer.
  const provider: ModelProvider =
    status.kind === "session"
      ? createSessionProvider(status.model)
      : createAnthropicProvider(status.model);
  return provider.generateStructured({
    schema: askAnswerSchema,
    schemaName: "AskAnswer",
    system: `${systemPrelude("a recruiting colleague answering a question typed into a note")}

You are answering one question, typed in a note by a recruiter. Rules:
- Answer the question that was asked, briefly. Three or four sentences at most,
  and fewer where fewer will do.
- You have no live web access and no access to this workspace's records. Do not
  state a fact about a named person, a named company's current situation, or a
  live market number. If the question needs one, set declined true and say what
  the recruiter would have to look up.
- List in "uncertain" anything your answer rests on that you cannot check.
- Never flatter, never pad, and do not restate the question.`,
    user: question,
    maxTokens: 900,
  });
}
