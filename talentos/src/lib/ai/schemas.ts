/**
 * Every schema the outbox can be answered against, by name.
 *
 * The session handoff writes `<schemaName>-<hash>.request.json` and the
 * provider that reads the answer back does not validate it — `session.ts`
 * parses the JSON and casts. That was survivable while the only way to
 * answer was a Claude session writing the file itself; it is not survivable
 * once a person can paste into a text box, because a response missing a
 * field becomes a crash somewhere downstream with nothing pointing back here.
 *
 * So the paste is checked against the same zod schema the rest of the
 * pipeline uses. That is the point of this map: not a second contract, the
 * first one, indexed. `tests/unit/outbox.test.ts` asserts it covers every
 * `schemaName` in the codebase, so a task added tomorrow either appears here
 * or fails the build.
 */
import type { z } from "zod";
import { askAnswerSchema } from "./tasks/ask";
import { expertReplySchema } from "./tasks/expert";
import { researchResponseSchema } from "@/lib/research/session-research";
import { candidatePacketTask } from "./tasks/candidate-packet";
import { candidateTagsTask } from "./tasks/candidate-tags";
import { channelsTask } from "./tasks/channels";
import { closePlanTask } from "./tasks/close-plan";
import { critiqueTask } from "./tasks/critique";
import { documentComparisonTask } from "./tasks/document-comparison";
import { evidenceAlignmentTask } from "./tasks/evidence-alignment";
import { hiringNeedTask } from "./tasks/hiring-need";
import { hmBriefTask } from "./tasks/hm-brief";
import { intakeReasonTask } from "./tasks/intake-reason";
import { intakeTask } from "./tasks/intake";
import { interviewPlanTask } from "./tasks/interview-plan";
import { learningsSynthesisTask } from "./tasks/learnings-synthesis";
import { marketIntelligenceTask } from "./tasks/market-intelligence";
import { onboardingPlanTask } from "./tasks/onboarding-plan";
import { outreachTask } from "./tasks/outreach";
import { personasTask } from "./tasks/personas";
import { recruiterScreenTask } from "./tasks/recruiter-screen";
import { roleIntelligenceTask } from "./tasks/role-intelligence";
import { searchPlanTask } from "./tasks/search-plan";
import { sourcingStrategyTask } from "./tasks/sourcing-strategy";
import { stringExpansionTask } from "./tasks/string-expansion";
import { successProfileTask } from "./tasks/success-profile";

/**
 * The tasks that go through `runAiTask`. Each already carries its own name
 * and schema, so they are listed once and indexed by the name they declare —
 * there is no second place for the two to disagree.
 */
const TASKS = [
  candidatePacketTask,
  candidateTagsTask,
  channelsTask,
  closePlanTask,
  critiqueTask,
  documentComparisonTask,
  evidenceAlignmentTask,
  hiringNeedTask,
  hmBriefTask,
  intakeReasonTask,
  intakeTask,
  interviewPlanTask,
  learningsSynthesisTask,
  marketIntelligenceTask,
  onboardingPlanTask,
  outreachTask,
  personasTask,
  recruiterScreenTask,
  roleIntelligenceTask,
  searchPlanTask,
  sourcingStrategyTask,
  stringExpansionTask,
  successProfileTask,
] as const;

/**
 * The three that do not. `ask` and `expert` call a provider directly rather
 * than through `runAiTask`, and research is not a generation at all — it has
 * its own provider and its own fixed response shape.
 */
const STANDALONE: Record<string, z.ZodType<unknown>> = {
  AskAnswer: askAnswerSchema,
  ExpertReply: expertReplySchema,
  Research: researchResponseSchema,
};

export const RESPONSE_SCHEMAS: Record<string, z.ZodType<unknown>> = {
  ...Object.fromEntries(
    TASKS.map((task) => [task.schemaName, task.schema as z.ZodType<unknown>]),
  ),
  ...STANDALONE,
};

export function schemaFor(schemaName: string): z.ZodType<unknown> | undefined {
  return RESPONSE_SCHEMAS[schemaName];
}
