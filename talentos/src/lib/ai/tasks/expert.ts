import { z } from "zod";
import {
  getProviderStatus,
  ProviderNotConfiguredError,
  type ModelProvider,
} from "@/lib/ai/provider";
import { createAnthropicProvider } from "@/lib/ai/anthropic";
import { createSessionProvider } from "@/lib/ai/session";
import { systemPrelude } from "@/lib/ai/prompts";
import { type Expert } from "../../../../artifact-src/core/experts";

/**
 * One turn of a conversation with the talent expert.
 *
 * The difference from `ask.ts` — which answers one question typed into a note
 * — is that this one has a specialist and a history. The specialist is chosen
 * by `routeQuestion`, which is arithmetic; what arrives here is a persona and
 * the last few turns, so a follow-up like "and if they say no?" means
 * something.
 *
 * The hard rule is the same and it is the reason this is not simply a chat
 * window onto a model: **it may not tell you anything about a named person.**
 * The recruiter's own records are not in the prompt and the model has no
 * access to them, so anything it said about a candidate would be invented.
 * It answers the craft question — how to phrase it, what to ask, what a
 * number usually looks like, what the law will not let you weigh — and says
 * plainly when the question needs a record it cannot see.
 */
export const expertReplySchema = z.object({
  answer: z.string().min(1).max(4000),
  /** What the answer rests on that it cannot check. Named honestly, or empty. */
  uncertain: z.array(z.string().max(300)).max(5),
  /**
   * True when the question needed a fact about a named person, a named
   * company's current situation, or a live number. The answer then says what
   * the recruiter would have to look up rather than guessing.
   */
  declined: z.boolean(),
  /** Two or three things worth asking next. Empty when there is nothing. */
  next: z.array(z.string().max(160)).max(3),
});

export type ExpertReply = z.infer<typeof expertReplySchema>;

export interface ExpertTurnInput {
  expert: Expert;
  question: string;
  /** Oldest first: "you said / they said", trimmed to what fits. */
  history: { who: "you" | "expert"; text: string }[];
}

/** Enough for a follow-up to make sense, not so much that it drifts. */
const HISTORY_TURNS = 8;
const HISTORY_CHARS = 600;

export async function askTheExpert(
  input: ExpertTurnInput,
): Promise<ExpertReply> {
  const status = getProviderStatus();
  if (!status.configured) {
    throw new ProviderNotConfiguredError(status.detail);
  }
  const provider: ModelProvider =
    status.kind === "session"
      ? createSessionProvider(status.model)
      : createAnthropicProvider(status.model);

  const history = input.history
    .slice(-HISTORY_TURNS)
    .map(
      (turn) =>
        `${turn.who === "you" ? "Recruiter" : "You"}: ${turn.text.slice(0, HISTORY_CHARS)}`,
    )
    .join("\n\n");

  return provider.generateStructured({
    schema: expertReplySchema,
    schemaName: "ExpertReply",
    system: `${systemPrelude(`the ${input.expert.name.toLowerCase()} specialist on a small talent team — ${input.expert.does}`)}

You are one specialist on a team the recruiter talks to through a single
conversation. Rules:
- Answer as the specialist you are. If the question is really somebody else's,
  say so in one clause and answer the part that is yours.
- Be short. A recruiter reading this is mid-task; four or five sentences, and
  fewer where fewer will do. No preamble, no restating the question, no
  flattery, no summary at the end.
- You cannot see this workspace's records and you have no live web access. Do
  not state a fact about a named person, a named company's current situation,
  or a live market number. If the question needs one, set declined true and say
  exactly what the recruiter would have to look up.
- "uncertain" lists what your answer rests on that you cannot check. Leave it
  empty only when there is genuinely nothing.
- "next" is at most three things worth asking next, in the recruiter's words,
  not yours. Empty is fine.`,
    user: history
      ? `Earlier in this conversation:\n\n${history}\n\nThe recruiter now asks:\n${input.question}`
      : input.question,
    maxTokens: 1200,
  });
}
