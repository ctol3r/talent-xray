import {
  onboardingPlanPayloadSchema,
  type OnboardingPlanPayload,
} from "@/lib/core/payloads";
import type { candidates } from "@/lib/db/schema";
import { renderProjectContext, type ProjectContext } from "../context";
import { systemPrelude } from "../prompts";
import { defineAiTask } from "../run";

export interface OnboardingContext {
  project: ProjectContext;
  candidate: typeof candidates.$inferSelect;
  startDate?: string;
}

export const onboardingPlanTask = defineAiTask<
  OnboardingContext,
  OnboardingPlanPayload
>({
  task: "onboarding_plan",
  schemaName: "OnboardingPlan",
  schema: onboardingPlanPayloadSchema,
  system:
    () => `${systemPrelude("a recruiting-operations partner planning onboarding")}

The offer is accepted. Build the plan that gets this person to a strong start:
- checklist: preboarding items with owner (recruiter / manager / candidate / HR-ops) and dueOffsetDays relative to start date (negative = before day 1). Adapt to this role's realities (licensing/credentialing for clinicians, ITAR/equipment for manufacturing, board logistics for executives, equipment/access for knowledge workers).
- recruiterHandoff / managerHandoff: what each must transfer, explicitly.
- communicationSchedule: candidate touchpoints between acceptance and start — the window where counteroffers and cold feet happen — plus early-tenure check-ins.
- day1Prep, day30FollowUp, hmFollowUp.
Keep every item concrete and assignable.`,
  user: (ctx) => `${renderProjectContext(ctx.project)}
## New hire
${JSON.stringify(
  {
    name: ctx.candidate.name,
    role: ctx.project.project.roleTitle,
    startDate: ctx.startDate ?? "not set",
  },
  null,
  1,
)}
## Task
Build the onboarding plan now.`,
  mock: (ctx) => ({
    checklist: [
      {
        label: `[Mock] Confirm written acceptance from ${ctx.candidate.name}`,
        owner: "recruiter",
        dueOffsetDays: -14,
        done: false,
      },
      {
        label: "[Mock] Background/reference checks complete",
        owner: "HR-ops",
        dueOffsetDays: -10,
        done: false,
      },
      {
        label: "[Mock] Equipment and access ordered",
        owner: "manager",
        dueOffsetDays: -7,
        done: false,
      },
    ],
    recruiterHandoff: [
      "[Mock] Share close-plan notes (motivations, concerns) with the manager",
    ],
    managerHandoff: ["[Mock] 30/60/90 expectations drafted before day 1"],
    communicationSchedule: [
      {
        day: "Acceptance + 2",
        touchpoint: "[Mock] Congratulations call; confirm resignation plan",
      },
      { day: "Start − 7", touchpoint: "[Mock] Logistics check-in" },
      { day: "Day 1", touchpoint: "[Mock] First-day check-in" },
    ],
    day1Prep: ["[Mock] Welcome plan and first-week schedule ready"],
    day30FollowUp: ["[Mock] 30-day check-in with new hire"],
    hmFollowUp: ["[Mock] 30-day check-in with hiring manager"],
  }),
});
