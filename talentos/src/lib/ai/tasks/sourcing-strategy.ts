import {
  sourcingStrategyPayloadSchema,
  type SourcingStrategyPayload,
} from "@/lib/core/payloads";
import { renderProjectContext, type ProjectContext } from "../context";
import { classifyOccupationForMock } from "../mock-knowledge";
import { EDITABILITY_REMINDER, systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export const sourcingStrategyTask = defineAiTask<
  ProjectContext,
  SourcingStrategyPayload
>({
  task: "sourcing_strategy",
  schemaName: "SourcingStrategy",
  schema: sourcingStrategyPayloadSchema,
  system: () => `${systemPrelude("an elite sourcer writing a search strategy brief")}

Produce the search strategy brief for THIS search:
- primaryTargetProfile: one tight paragraph describing the phenotype most likely to succeed and be closeable.
- secondaryTargetProfiles: distinct, viable variants (not weaker copies of the primary).
- adjacentPossibilities: non-obvious populations with a rationale for why they transfer.
- targetTitles / excludedTitles: the titles to chase and the noise to cut.
- targetCompanies / feederCompanies: name companies only when the context or well-known industry structure supports them; otherwise describe the company *type*.
- targetIndustries, targetGeographies: aligned to the success profile and market reality.
- rationale: why this strategy fits this market and this company's pull.
- risks: where this strategy fails and what would signal that early.
${EDITABILITY_REMINDER}`,
  user: (ctx) => `${renderProjectContext(ctx)}
## Task
Write the sourcing strategy brief for this search now.`,
  mock: (ctx) => {
    const occ = classifyOccupationForMock(
      `${ctx.project.roleTitle} ${ctx.project.industry ?? ""}`,
    );
    return {
      primaryTargetProfile: `[Mock] ${occ.profession} practitioner matching the ${ctx.project.roleTitle} bar in ${ctx.project.geography ?? "target geography"}.`,
      secondaryTargetProfiles: occ.titles.map((t) => `[Mock] ${t} variant`),
      adjacentPossibilities: occ.adjacentTitles.map((text) => ({
        text,
        rationale: `[Mock] Adjacent ${occ.profession} population with transferable evidence.`,
      })),
      targetTitles: occ.titles,
      excludedTitles: [`Junior ${ctx.project.roleTitle}`, "Intern"],
      targetCompanies: [],
      feederCompanies: [],
      targetIndustries: [ctx.project.industry ?? "Unspecified"],
      targetGeographies: [ctx.project.geography ?? "Unspecified"],
      rationale: `[Mock] Strategy rationale for ${occ.profession}.`,
      risks: ["[Mock] Strategy risk to monitor."],
    };
  },
});
