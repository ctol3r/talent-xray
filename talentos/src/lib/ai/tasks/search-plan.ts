import { searchPlanOutputSchema, type SearchPlanOutput } from "@/lib/core/ir";
import { renderProjectContext, type ProjectContext } from "../context";
import { classifyOccupationForMock } from "../mock-knowledge";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

/**
 * HiringIntentIR → SuccessIR + EvidenceIR + TalentPopulationIR +
 * SearchPlanIR (D-011). Query plans feed the deterministic composer;
 * this task plans concepts, it does not write final query strings.
 */
export const searchPlanTask = defineAiTask<ProjectContext, SearchPlanOutput>({
  task: "derive_search_plan",
  schemaName: "SearchPlan",
  schema: searchPlanOutputSchema,
  maxTokens: 32000,
  system:
    () => `${systemPrelude("an elite sourcing strategist planning discovery from the canonical hiring intelligence")}

Consume the canonical HiringIntentIR from the context — its requirements are the source of truth; do not re-derive them from the JD.

- success: what success in the seat observably looks like; link outcomes to requirement ids.
- evidence: for each load-bearing requirement (by requirementId), the observable public evidence, where it lives (surfaces people actually use to describe themselves), and what strong vs weak looks like.
- population: who plausibly clears the bar — honest supply estimates ("unknown" is welcome), where each segment describes itself publicly, plus adjacent segments with their tradeoffs and explicit exclusions.
- searchPlan.queryPlans: per segment, the composer inputs (titles / alternates / adjacents, must-have terms, any-of terms, credentials, locations, exclusions) with linkedRequirementIds and a rationale. Terms must be phrases people literally write about themselves. The deterministic composer builds the strings; never emit final boolean here.
- Open, consequential uncertainties in the intent must show up as caution in your rationale — not be papered over.`,
  user: (ctx) => `${renderProjectContext(ctx)}
## Task
Derive SuccessIR, EvidenceIR, TalentPopulationIR, and SearchPlanIR from the canonical intent now.`,
  mock: (ctx) => {
    const occ = classifyOccupationForMock(
      `${ctx.project.roleTitle} ${ctx.project.industry ?? ""}`,
    );
    const requirements = ctx.intelligence?.intent.requirements ?? [];
    const requirementIds = requirements
      .map((r) => r.id)
      .filter((id): id is string => Boolean(id));
    const titles = ctx.project.roleTitle
      .split("/")
      .map((t) => t.trim())
      .filter(Boolean);
    return {
      success: {
        mission:
          ctx.intelligence?.intent.need.businessProblem ??
          `[Mock] Deliver in the ${ctx.project.roleTitle} seat.`,
        outcomes: [
          {
            text: `[Mock] Demonstrated progress on ${occ.vocabulary[0] ?? "core work"} within 90 days.`,
            horizon: "90 days",
            provenance: "model_inference" as const,
            linkedRequirementIds: requirementIds.slice(0, 1),
          },
        ],
        goodVsExceptional: `[Mock] Exceptional ${occ.profession} hires show compounding output, not just competence.`,
      },
      evidence: {
        items: requirements
          .filter((r) => r.id)
          .map((r) => ({
            requirementId: r.id as string,
            observable: r.evidenceSpec[0] ?? `[Mock] Evidence for ${r.label}`,
            whereToLook: occ.channels.slice(0, 2).map((c) => c.name),
            strongLooksLike: `[Mock] Sustained, first-hand ${r.label.toLowerCase()} track record.`,
            weakLooksLike: `[Mock] Adjacent or second-hand exposure to ${r.label.toLowerCase()}.`,
          })),
      },
      population: {
        segments: [
          {
            label: `[Mock] Core ${occ.profession} practitioners`,
            description: `[Mock] ${occ.titles.join(" / ")} matching the explicit requirements.`,
            estimatedSupply: "unknown" as const,
            whereTheyAre: occ.channels.slice(0, 3).map((c) => c.name),
            provenance: "model_inference" as const,
          },
        ],
        adjacentSegments: occ.adjacentTitles.slice(0, 2).map((label) => ({
          label,
          description: `[Mock] Adjacent population: ${label}.`,
          tradeoff: "[Mock] Broader supply, weaker direct evidence.",
        })),
        exclusions: ["[Mock] Profiles with no observable job-related evidence"],
      },
      searchPlan: {
        queryPlans: [
          {
            segmentLabel: `[Mock] Core ${occ.profession} practitioners`,
            titles: titles.length > 0 ? titles : occ.titles.slice(0, 1),
            alternateTitles: occ.titles,
            adjacentTitles: occ.adjacentTitles,
            mustHaveTerms: occ.vocabulary.slice(0, 1),
            anyOfTerms: occ.vocabulary.slice(1, 4),
            credentials: [],
            locations: ctx.project.geography
              ? [ctx.project.geography.split(",")[0].trim()]
              : [],
            exclusions: [],
            linkedRequirementIds: requirementIds,
            rationale:
              "[Mock] Primary segment plan derived from explicit requirements; open consequential uncertainties noted in intent.",
          },
        ],
        sequencing: [
          "[Mock] Run the core segment narrow variant first; widen only on low yield.",
        ],
      },
    };
  },
});
