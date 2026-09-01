"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  closePlanPayloadSchema,
  evidenceAlignmentPayloadSchema,
  intakePayloadSchema,
  interviewPlanPayloadSchema,
  marketResearchPayloadSchema,
  onboardingPlanPayloadSchema,
  roleIntelligencePayloadSchema,
  screenGuidePayloadSchema,
  sourcingStrategyPayloadSchema,
  successProfilePayloadSchema,
} from "@/lib/core/payloads";
import { getDb } from "@/lib/db/client";
import {
  getCandidateEvidence,
  getClosePlan,
  getLatestIntakeSession,
  getMarketResearch,
  getOnboardingPlan,
  getRoleIntelligence,
  getScreenGuide,
  getSourcingStrategy,
  getSuccessProfile,
  getInterviewPlan,
  updateCandidateEvidencePayload,
  updateClosePlanPayload,
  updateIntakePayload,
  updateInterviewPlanPayload,
  updateMarketResearchPayload,
  updateOnboardingPlan,
  updateRoleIntelligencePayload,
  updateScreenGuidePayload,
  updateSourcingStrategyPayload,
  updateSuccessProfilePayload,
} from "@/lib/services/artifacts";
import { getCandidate } from "@/lib/services/candidates";
import {
  addLearning,
  addLearningInput,
  answerIntakeQuestion,
  answerIntakeQuestionInput,
  archiveQuery,
  completeIntake,
  completeTask,
  createTask,
  createTaskInput,
  saveScorecard,
  saveScorecardInput,
  updateChannel,
  updateChannelInput,
  updateOutreachStatus,
  updateOutreachStatusInput,
  upsertOffer,
  upsertOfferInput,
  upsertQuery,
  upsertQueryInput,
} from "@/lib/services/workflow";
import { act, type ActionResult } from "./helpers";

const PROJECT_ARTIFACTS = {
  role_intelligence: {
    schema: roleIntelligencePayloadSchema,
    get: getRoleIntelligence,
    save: updateRoleIntelligencePayload,
  },
  success_profile: {
    schema: successProfilePayloadSchema,
    get: getSuccessProfile,
    save: updateSuccessProfilePayload,
  },
  market_research: {
    schema: marketResearchPayloadSchema,
    get: getMarketResearch,
    save: updateMarketResearchPayload,
  },
  sourcing_strategy: {
    schema: sourcingStrategyPayloadSchema,
    get: getSourcingStrategy,
    save: updateSourcingStrategyPayload,
  },
  screen_guide: {
    schema: screenGuidePayloadSchema,
    get: getScreenGuide,
    save: updateScreenGuidePayload,
  },
  interview_plan: {
    schema: interviewPlanPayloadSchema,
    get: getInterviewPlan,
    save: updateInterviewPlanPayload,
  },
} as const;

const CANDIDATE_ARTIFACTS = {
  evidence: {
    schema: evidenceAlignmentPayloadSchema,
    get: getCandidateEvidence,
    save: updateCandidateEvidencePayload,
  },
  close_plan: {
    schema: closePlanPayloadSchema,
    get: getClosePlan,
    save: updateClosePlanPayload,
  },
  onboarding_plan: {
    schema: onboardingPlanPayloadSchema,
    get: getOnboardingPlan,
    save: (db: ReturnType<typeof getDb>, id: string, payload: z.infer<typeof onboardingPlanPayloadSchema>) =>
      updateOnboardingPlan(db, id, payload),
  },
} as const;

const saveArtifactInput = z.object({
  kind: z.enum([
    "role_intelligence",
    "success_profile",
    "market_research",
    "sourcing_strategy",
    "screen_guide",
    "interview_plan",
    "intake",
    "evidence",
    "close_plan",
    "onboarding_plan",
  ]),
  /** searchProjectId for project artifacts; candidateId for candidate ones. */
  ownerId: z.string(),
  json: z.string(),
});

/**
 * The universal "recruiter edits an AI draft" boundary: raw JSON comes in,
 * the artifact's own zod schema validates it, then it replaces the payload.
 */
export async function saveArtifactJsonAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = saveArtifactInput.parse(input);
    const db = getDb();
    const raw: unknown = JSON.parse(parsed.json);

    if (parsed.kind === "intake") {
      const session = await getLatestIntakeSession(db, parsed.ownerId);
      if (!session) throw new Error("No intake session to edit");
      await updateIntakePayload(db, session.id, intakePayloadSchema.parse(raw));
      revalidatePath(`/searches/${parsed.ownerId}`, "layout");
      return undefined;
    }

    if (parsed.kind in PROJECT_ARTIFACTS) {
      const artifact =
        PROJECT_ARTIFACTS[parsed.kind as keyof typeof PROJECT_ARTIFACTS];
      const existing = await artifact.get(db, parsed.ownerId);
      if (!existing) throw new Error("Nothing generated yet to edit");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- narrowed per-kind by the schema parse on the line above
      await artifact.save(db, parsed.ownerId, artifact.schema.parse(raw) as any);
      revalidatePath(`/searches/${parsed.ownerId}`, "layout");
      return undefined;
    }

    const artifact =
      CANDIDATE_ARTIFACTS[parsed.kind as keyof typeof CANDIDATE_ARTIFACTS];
    const existing = await artifact.get(db, parsed.ownerId);
    if (!existing) throw new Error("Nothing generated yet to edit");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- narrowed per-kind by the schema parse on the line above
    await artifact.save(db, parsed.ownerId, artifact.schema.parse(raw) as any);
    const candidate = await getCandidate(db, parsed.ownerId);
    if (candidate) {
      revalidatePath(`/searches/${candidate.searchProjectId}`, "layout");
    }
    return undefined;
  });
}

// ── Intake ──────────────────────────────────────────────────────────────────

export async function answerIntakeQuestionAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = answerIntakeQuestionInput.parse(input);
    await answerIntakeQuestion(getDb(), parsed);
    revalidatePath("/searches", "layout");
    return undefined;
  });
}

const completeIntakeInput = z.object({
  sessionId: z.string(),
  searchProjectId: z.string(),
});

export async function completeIntakeAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = completeIntakeInput.parse(input);
    await completeIntake(getDb(), parsed.sessionId);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return undefined;
  });
}

// ── Scorecards, offers, outreach, queries, channels, tasks, learnings ──────

export async function saveScorecardAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = saveScorecardInput.parse(input);
    await saveScorecard(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return undefined;
  });
}

export async function upsertOfferAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = upsertOfferInput.parse(input);
    await upsertOffer(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return undefined;
  });
}

export async function updateOutreachStatusAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = updateOutreachStatusInput.parse(input);
    await updateOutreachStatus(getDb(), parsed);
    revalidatePath("/searches", "layout");
    return undefined;
  });
}

export async function upsertQueryAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = upsertQueryInput.parse(input);
    await upsertQuery(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return undefined;
  });
}

const archiveQueryInput = z.object({
  queryId: z.string(),
  searchProjectId: z.string(),
});

export async function archiveQueryAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = archiveQueryInput.parse(input);
    await archiveQuery(getDb(), parsed.queryId);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return undefined;
  });
}

export async function updateChannelAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = updateChannelInput.parse(input);
    await updateChannel(getDb(), parsed);
    revalidatePath("/searches", "layout");
    return undefined;
  });
}

export async function createTaskAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = createTaskInput.parse(input);
    await createTask(getDb(), parsed);
    revalidatePath("/tasks");
    return undefined;
  });
}

const completeTaskInput = z.object({ taskId: z.string() });

export async function completeTaskAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = completeTaskInput.parse(input);
    await completeTask(getDb(), parsed.taskId);
    revalidatePath("/tasks");
    revalidatePath("/");
    return undefined;
  });
}

export async function addLearningAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = addLearningInput.parse(input);
    await addLearning(getDb(), parsed);
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return undefined;
  });
}

const setOnboardingStateInput = z.object({
  candidateId: z.string(),
  searchProjectId: z.string(),
  startDate: z.string().optional(),
  startConfirmed: z.boolean().optional(),
  checklistItemId: z.string().optional(),
  checklistDone: z.boolean().optional(),
});

export async function setOnboardingStateAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = setOnboardingStateInput.parse(input);
    const db = getDb();
    const plan = await getOnboardingPlan(db, parsed.candidateId);
    if (!plan) throw new Error("No onboarding plan yet");
    const payload = plan.payload;
    if (parsed.checklistItemId !== undefined) {
      for (const item of payload.checklist) {
        if (item.id === parsed.checklistItemId) {
          item.done = parsed.checklistDone ?? !item.done;
        }
      }
    }
    await updateOnboardingPlan(db, parsed.candidateId, payload, {
      startDate: parsed.startDate,
      startConfirmed: parsed.startConfirmed,
    });
    revalidatePath(`/searches/${parsed.searchProjectId}`, "layout");
    return undefined;
  });
}
