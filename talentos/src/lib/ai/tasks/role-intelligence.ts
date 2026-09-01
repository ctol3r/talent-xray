import {
  roleIntelligencePayloadSchema,
  type RoleIntelligencePayload,
} from "@/lib/core/payloads";
import { renderProjectContext, type ProjectContext } from "../context";
import { classifyOccupationForMock } from "../mock-knowledge";
import { EDITABILITY_REMINDER, systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export const roleIntelligenceTask = defineAiTask<
  ProjectContext,
  RoleIntelligencePayload
>({
  task: "role_intelligence",
  schemaName: "RoleIntelligence",
  schema: roleIntelligencePayloadSchema,
  system: () => `${systemPrelude("an elite talent-intelligence analyst")}

Extraction discipline (mandatory):
- Read the job description and search facts, then extract and infer the role's real shape.
- Separate strictly: hardRequirements (explicitly stated as required, non-negotiable), preferences (explicitly nice-to-have or softly worded), signals (positive indicators that predict success but are not stated requirements), assumptions (things YOU infer that the JD does not say), unresolvedQuestions (things only the hiring manager can settle).
- NEVER promote vague JD language ("strong communicator", "fast-paced environment") into hardRequirements — route it to preferences or unresolvedQuestions.
- Set provenance per item: "jd" when directly stated in the JD text, "model_inference" when you inferred it.
- likelyTalentCompetitors: employer types or named categories competing for this talent; name specific companies only when the context supports it.
- Finish with roleHypothesis: one paragraph stating what this role appears to really need, phrased so the recruiter can falsify it with the hiring manager.
${EDITABILITY_REMINDER}`,
  user: (ctx) => `${renderProjectContext(ctx)}
## Task
Extract complete role intelligence for this search now.`,
  mock: (ctx) => {
    const occ = classifyOccupationForMock(
      `${ctx.project.roleTitle} ${ctx.project.industry ?? ""}`,
    );
    const jdFirstLine = (ctx.jdText ?? "").split("\n")[0]?.slice(0, 120);
    return {
      canonicalTitle: ctx.project.roleTitle,
      alternateTitles: occ.titles.filter((t) => t !== ctx.project.roleTitle),
      seniority: ctx.project.seniority ?? "Unspecified",
      profession: occ.profession,
      occupationFamily: occ.profession,
      industry: ctx.project.industry ?? "Unspecified",
      jobFunction: occ.profession,
      responsibilities: occ.vocabulary
        .slice(0, 3)
        .map((v) => `Work involving ${v}`),
      businessOutcomes: [ctx.project.businessObjective ?? "Fill the role"],
      technologies: occ.vocabulary,
      domainKnowledge: occ.vocabulary.slice(0, 2),
      certifications: [],
      licenses: [],
      education: undefined,
      experienceSummary: `Per JD: ${jdFirstLine ?? "not provided"}`,
      likelyTalentCompetitors: occ.channels.slice(0, 2).map((c) => c.name),
      hardRequirements: occ.evidenceSignals.slice(0, 2).map((text) => ({
        text,
        provenance: "jd" as const,
      })),
      preferences: occ.evidenceSignals.slice(2).map((text) => ({
        text,
        provenance: "jd" as const,
      })),
      signals: occ.vocabulary.slice(0, 2).map((text) => ({
        text: `Familiarity with ${text}`,
        provenance: "model_inference" as const,
      })),
      assumptions: [
        {
          text: `Mock assumption for ${occ.profession} role (mock provider output)`,
          provenance: "model_inference" as const,
        },
      ],
      unresolvedQuestions: occ.domainQuestions.slice(0, 2).map((text) => ({
        text,
        provenance: "model_inference" as const,
      })),
      roleHypothesis: `[Mock] This ${ctx.project.roleTitle} search in ${ctx.project.geography ?? "the target geography"} appears to target the ${occ.profession} population; validate with the hiring manager.`,
    };
  },
});
