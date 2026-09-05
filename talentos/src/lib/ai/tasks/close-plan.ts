import {
  closePlanPayloadSchema,
  type ClosePlanPayload,
} from "@/lib/core/payloads";
import type { candidates } from "@/lib/db/schema";
import { renderProjectContext, type ProjectContext } from "../context";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export interface CloseContext {
  project: ProjectContext;
  candidate: typeof candidates.$inferSelect;
  knownMotivations?: string;
}

export const closePlanTask = defineAiTask<CloseContext, ClosePlanPayload>({
  task: "close_plan",
  schemaName: "ClosePlan",
  schema: closePlanPayloadSchema,
  system: () => `${systemPrelude("a closing strategist")}

Build the ClosePlan for this candidate: what we know about their motivations, competing opportunities, compensation expectations, decision criteria, concerns, relocation and timing; the stakeholders in their decision; likely objections with honest suggested responses; what information is still missing (be explicit — a close plan built on guesses fails); recommended conversation topics; where the hiring manager should be involved; riskOfDecline with a grounded rationale; and offer-call preparation steps.

Hard rules:
- Base "known" fields ONLY on provided material; everything else goes to missingInformation.
- No manipulation, deceptive pressure, invented deadlines, or exploding-offer tactics. Suggested responses to objections must be honest and information-based.
- Where the candidate's interests genuinely diverge from the employer's, say so — a recruiter closes by resolving real concerns, not by papering over them.`,
  user: (ctx) => `${renderProjectContext(ctx.project)}
## Candidate
${JSON.stringify(
  {
    name: ctx.candidate.name,
    currentTitle: ctx.candidate.currentTitle,
    currentCompany: ctx.candidate.currentCompany,
    geography: ctx.candidate.geography,
    compensationNote: ctx.candidate.compensationNote,
    recruiterNotes: ctx.candidate.recruiterNotes,
    motivations: ctx.candidate.profile.motivations,
    concerns: ctx.candidate.profile.concerns,
  },
  null,
  1,
)}
${ctx.knownMotivations ? `## Additional close intel\n${ctx.knownMotivations}` : ""}
## Task
Build the close plan for this candidate now.`,
  mock: (ctx) => ({
    motivations:
      ctx.candidate.profile.motivations.length > 0
        ? ctx.candidate.profile.motivations
        : ["[Mock] Motivations not yet captured"],
    competingOpportunities: ["[Mock] Unknown — ask directly"],
    compensationExpectations: ctx.candidate.compensationNote ?? undefined,
    decisionCriteria: ["[Mock] To be confirmed with candidate"],
    concerns:
      ctx.candidate.profile.concerns.length > 0
        ? ctx.candidate.profile.concerns
        : ["[Mock] None recorded yet"],
    stakeholders: ["[Mock] Ask who else weighs in on the decision"],
    likelyObjections: [
      {
        objection: "[Mock] Compensation vs current package",
        suggestedResponse:
          "[Mock] Compare total package honestly; no pressure tactics.",
      },
    ],
    missingInformation: [
      "[Mock] Competing-process status",
      "[Mock] True decision timeline",
    ],
    recommendedTopics: ["[Mock] Walk through their decision criteria together"],
    hmInvolvement: ["[Mock] Pre-offer conversation with hiring manager"],
    riskOfDecline: {
      level: "unknown" as const,
      rationale: "[Mock] Too little close intel captured to rate risk.",
    },
    offerCallPrep: ["[Mock] Confirm verbal alignment before the written offer"],
  }),
});
