import {
  interviewPlanPayloadSchema,
  type InterviewPlanPayload,
} from "@/lib/core/payloads";
import { renderProjectContext, type ProjectContext } from "../context";
import { classifyOccupationForMock } from "../mock-knowledge";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export const interviewPlanTask = defineAiTask<
  ProjectContext,
  InterviewPlanPayload
>({
  task: "interview_plan",
  schemaName: "InterviewPlan",
  schema: interviewPlanPayloadSchema,
  system: () => `${systemPrelude("an interview-system designer")}

Design the full interview architecture for THIS role — the stage sequence a strong process would actually run for this profession (a machinist gets a practical assessment and shop visit; an executive gets board sessions and references; a researcher gets a research talk; a physician gets credentialing and a clinic visit — derive the right equivalents).

For every stage:
- purpose: the ONE thing this stage exists to establish.
- competencies: what is assessed here and nowhere else.
- questions: representative structured questions or exercise descriptions.
- evidenceSought: what a passing performance looks like, observably.
- rubricNotes: how to anchor ratings to evidence (observation vs interpretation vs rating).
- doNotDuplicate: what earlier stages already covered — duplicated interviews burn candidates.
- interviewer: the right seat (by role, not by name, unless context names people).

Keep the process as short as rigor allows. Structured evidence over vibes throughout.`,
  user: (ctx) => `${renderProjectContext(ctx)}
## Task
Design the interview plan for this search now.`,
  mock: (ctx) => {
    const occ = classifyOccupationForMock(
      `${ctx.project.roleTitle} ${ctx.project.industry ?? ""}`,
    );
    return {
      stages: occ.interviewStages.map((name, index) => ({
        name,
        purpose: `[Mock] Purpose of ${name} for a ${occ.profession} hire.`,
        competencies: occ.evidenceSignals.slice(index % 2, (index % 2) + 2),
        questions: [`[Mock] Representative question for ${name}.`],
        evidenceSought: [`[Mock] Observable pass signal for ${name}.`],
        rubricNotes: "[Mock] Anchor ratings to written evidence.",
        doNotDuplicate:
          index > 0
            ? `[Mock] Covered in ${occ.interviewStages[index - 1]}.`
            : undefined,
      })),
    };
  },
});
