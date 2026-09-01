import {
  modelMarketResearchPayloadSchema,
  type ModelMarketResearchPayload,
} from "@/lib/core/payloads";
import { renderProjectContext, type ProjectContext } from "../context";
import { classifyOccupationForMock } from "../mock-knowledge";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export const marketIntelligenceTask = defineAiTask<
  ProjectContext,
  ModelMarketResearchPayload
>({
  task: "market_intelligence",
  schemaName: "MarketResearch",
  schema: modelMarketResearchPayloadSchema,
  system: () => `${systemPrelude("a talent-market intelligence analyst")}

Answer the question: how difficult is this search, and why? Build sections such as: talent population & density, geographic hubs, common current employers & feeder organizations, education/training pipelines, communities & associations, compensation landscape, demand-side competition, talent movement patterns, adjacent pools, remote/relocation dynamics — choosing sections that matter for THIS role.

Certainty labeling is the core requirement (NO FAKE DATA):
- You can never emit "verified" (the schema forbids it) — that label is reserved for claims a human has confirmed against a source. Facts stated in the provided context are "inferred" at most; name the context as the basis in the note.
- Use "estimated" for order-of-magnitude professional judgment (say the basis), "inferred" for reasoning from structure, "unknown" where honesty demands it.
- NEVER state a precise labor-market number as fact. "Reliable exact population data unavailable" is a valid claim text.
- difficulty.rating: 1 (easy) – 5 (extremely hard), with a rationale naming the binding constraint.
- List assumptions and missingInformation explicitly; they drive the recruiter's follow-up research.`,
  user: (ctx) => `${renderProjectContext(ctx)}
## Task
Produce the market-intelligence assessment for this search now.`,
  mock: (ctx) => {
    const occ = classifyOccupationForMock(
      `${ctx.project.roleTitle} ${ctx.project.industry ?? ""}`,
    );
    return {
      difficulty: {
        rating: 3,
        rationale: `[Mock] Difficulty placeholder for ${occ.profession} in ${ctx.project.geography ?? "target geography"}.`,
      },
      sections: [
        {
          title: "Talent population",
          claims: [
            {
              text: "Reliable exact population data unavailable.",
              certainty: "unknown" as const,
            },
            {
              text: `[Mock] ${occ.profession} talent concentrates around ${occ.channels[0]?.name ?? "known hubs"}.`,
              certainty: "inferred" as const,
            },
          ],
        },
        {
          title: "Demand-side competition",
          claims: [
            {
              text: `[Mock] Competing employers likely recruit from the same ${occ.profession} pool.`,
              certainty: "inferred" as const,
            },
          ],
        },
      ],
      assumptions: [
        `[Mock] Assumes the ${ctx.project.roleTitle} JD reflects the real bar.`,
      ],
      missingInformation: [
        "Live labor-market data (research provider not configured).",
      ],
    };
  },
});
