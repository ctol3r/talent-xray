import {
  channelSuggestionsPayloadSchema,
  type ChannelSuggestionsPayload,
} from "@/lib/core/payloads";
import type { ChannelKind } from "@/lib/core/enums";
import { CHANNEL_KINDS } from "@/lib/core/enums";
import { renderProjectContext, type ProjectContext } from "../context";
import { classifyOccupationForMock } from "../mock-knowledge";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export const channelsTask = defineAiTask<
  ProjectContext,
  ChannelSuggestionsPayload
>({
  task: "channel_discovery",
  schemaName: "ChannelSuggestions",
  schema: channelSuggestionsPayloadSchema,
  system: () => `${systemPrelude("a sourcing-channel researcher")}

Determine WHERE candidates for this specific profession actually exist and rank the channels for THIS search: registries, communities, publications, conferences, associations, universities, portfolios, open-source, directories, job boards (general/specialized/association/regional), alumni networks, referral sources, events, social networks, search engines, databases.

Rules:
- Rank with priority: "high" (work it first), "medium", "experimental" — with whyRelevant explaining the ranking for THIS search, not generic virtue.
- NEVER invent venues. Name a specific channel only when you are confident it exists; you have no live web access, so mark named external venues certainty "inferred" at best — the recruiter verifies before use. Something you cannot name confidently becomes a channel *type* description with certainty "unknown".
- Only include a url when you are highly confident of the canonical domain; otherwise omit it.
- costModel: "free", "paid", or "unknown" — never guess "free".
- Cover profession-appropriate diversity (a physician search leans on registries and societies; an executive search leans on filings, boards, and referrals; a trades search leans on licensing databases, schools, and regional boards).
- reasoningSummary: 3–5 sentences on the overall channel logic for this search.`,
  user: (ctx) => `${renderProjectContext(ctx)}
## Task
Produce the ranked channel map for this search now.`,
  mock: (ctx) => {
    const occ = classifyOccupationForMock(
      `${ctx.project.roleTitle} ${ctx.project.industry ?? ""}`,
    );
    const toKind = (kind: string): ChannelKind =>
      (CHANNEL_KINDS as readonly string[]).includes(kind)
        ? (kind as ChannelKind)
        : "other";
    return {
      channels: occ.channels.map((channel, index) => ({
        name: channel.name,
        kind: toKind(channel.kind),
        whyRelevant: `[Mock] ${channel.why}`,
        costModel: "unknown" as const,
        priority: index < 2 ? ("high" as const) : ("medium" as const),
        certainty: "inferred" as const,
        note: "Mock suggestion — verify before use.",
      })),
      reasoningSummary: `[Mock] Channel logic for ${occ.profession}: start with the registries/communities where this population self-identifies.`,
    };
  },
});
