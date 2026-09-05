import { hmBriefPayloadSchema, type HmBriefPayload } from "@/lib/core/payloads";
import { renderProjectContext, type ProjectContext } from "../context";
import { classifyOccupationForMock } from "../mock-knowledge";
import { EDITABILITY_REMINDER, systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

/**
 * W9 — the hiring-manager-facing search brief: what the search is hunting,
 * how the HM stays calibrated, and how to give feedback the pipeline can
 * actually use. Written TO the hiring manager; the recruiter shares it.
 */
export const hmBriefTask = defineAiTask<ProjectContext, HmBriefPayload>({
  task: "hm_brief",
  schemaName: "HmBrief",
  schema: hmBriefPayloadSchema,
  system:
    () => `${systemPrelude("an elite recruiter writing the hiring-manager brief for a live search")}

Write the brief addressed to the hiring manager (second person), grounded in the intake answers and success profile:
- headline: one paragraph — what we are hunting and why it is (or isn't) hard, in the HM's language.
- whatWeAreLookingFor: the real bar as agreed — each item with provenance so the HM sees which requirements came from them vs. inference.
- calibrationQuestions: the questions that keep the search calibrated as candidates flow (e.g. "when you passed on X, which requirement did that sharpen?"), each with whyItMatters.
- reviewInstructions: how to give evidence-anchored feedback — cite the specific evidence behind advance/hold/pass, never gut adjectives; and what feedback within what turnaround keeps the pipeline healthy.
- processExpectations: what the process asks of the HM (review SLAs, interview stages they own, debrief discipline).
- openQuestions: what only the HM can still settle.
Do not flatter, do not pad; a busy executive should finish this in three minutes.
${EDITABILITY_REMINDER}`,
  user: (ctx) => `${renderProjectContext(ctx)}
## Task
Write the hiring-manager brief for this search now.`,
  mock: (ctx) => {
    const occ = classifyOccupationForMock(
      `${ctx.project.roleTitle} ${ctx.project.industry ?? ""}`,
    );
    return {
      headline: `[Mock] Brief for the ${ctx.project.roleTitle} search at ${ctx.project.companyName ?? "the company"}.`,
      whatWeAreLookingFor: occ.evidenceSignals.slice(0, 3).map((text) => ({
        text,
        provenance: "model_inference" as const,
      })),
      calibrationQuestions: [
        {
          question:
            "When you pass on a candidate, which stated requirement did that decision sharpen?",
          whyItMatters: "Turns every pass into search calibration.",
        },
      ],
      reviewInstructions:
        "[Mock] Anchor every advance/hold/pass to specific evidence from the material.",
      processExpectations: [
        "[Mock] Review submitted candidates within 3 business days.",
      ],
      openQuestions: occ.domainQuestions.slice(0, 2),
    };
  },
});
