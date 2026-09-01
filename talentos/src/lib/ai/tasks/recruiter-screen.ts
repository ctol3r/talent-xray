import {
  screenGuidePayloadSchema,
  type ScreenGuidePayload,
} from "@/lib/core/payloads";
import { renderProjectContext, type ProjectContext } from "../context";
import { classifyOccupationForMock } from "../mock-knowledge";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export const recruiterScreenTask = defineAiTask<ProjectContext, ScreenGuidePayload>({
  task: "recruiter_screen",
  schemaName: "ScreenGuide",
  schema: screenGuidePayloadSchema,
  maxTokens: 24000,
  system: () => `${systemPrelude("an elite recruiter designing a phone-screen guide")}

Build the recruiter prescreen for THIS search from the success profile. Sections in interview order: opening, motivation, experience walk-through, functional/technical depth (the differentiating section — derive it from this profession's real evidence bar), outcomes, logistics (location/work arrangement/timing), compensation, candidate questions, close/next steps — adapted to this role.

Every question carries:
- why: what the answer changes about fit or close strategy.
- strongEvidence: 2–3 concrete examples of answers that indicate the bar is met.
- weakEvidence: answers that sound fine but aren't sufficient.
- redFlags: job-related warning signs ONLY (never protected characteristics, never proxies for them).
- followUps: probes to go one level deeper.

The functional/technical section must be specific enough that a recruiter who is not a domain expert can still hear the difference between strong and weak answers.`,
  user: (ctx) => `${renderProjectContext(ctx)}
## Task
Generate the recruiter screen guide for this search now.`,
  mock: (ctx) => {
    const occ = classifyOccupationForMock(
      `${ctx.project.roleTitle} ${ctx.project.industry ?? ""}`,
    );
    return {
      sections: [
        {
          title: "Opening & motivation",
          questions: [
            {
              question: `[Mock] What prompted you to take this call about the ${ctx.project.roleTitle} role?`,
              why: "Separates active interest from courtesy.",
              strongEvidence: ["[Mock] Specific pull toward the mission or work"],
              weakEvidence: ["[Mock] Vague openness to 'hearing about things'"],
              redFlags: [],
              followUps: ["[Mock] What would make you actually move?"],
            },
          ],
        },
        {
          title: `${occ.profession} depth (mock)`,
          questions: occ.domainQuestions.slice(0, 3).map((question) => ({
            question: `[Mock screen] ${question}`,
            why: `Tests the ${occ.profession} evidence bar.`,
            strongEvidence: occ.evidenceSignals.slice(0, 2).map((s) => `[Mock] ${s}`),
            weakEvidence: ["[Mock] Generic claims without specifics"],
            redFlags: ["[Mock] Cannot describe own work concretely"],
            followUps: ["[Mock] Walk me through a concrete example."],
          })),
        },
        {
          title: "Logistics & compensation",
          questions: [
            {
              question: `[Mock] The role is based in ${ctx.project.geography ?? "the listed location"} — how does that fit?`,
              why: "Location kills late-stage deals; surface it early.",
              strongEvidence: ["[Mock] Clear, unprompted confirmation"],
              weakEvidence: ["[Mock] 'Probably fine' without specifics"],
              redFlags: [],
              followUps: ["[Mock] Any timing constraints?"],
            },
          ],
        },
      ],
    };
  },
});
