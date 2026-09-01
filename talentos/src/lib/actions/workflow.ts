"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  closePlanPayloadSchema,
  evidenceAlignmentPayloadSchema,
  hmBriefPayloadSchema,
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
import { getHmBrief, updateHmBriefPayload } from "@/lib/services/guidance";
import { act, type ActionResult } from "./helpers";

type ArtifactHandler = (
  db: ReturnType<typeof getDb>,
  ownerId: string,
  raw: unknown,
) => Promise<{ exists: boolean }>;

/**
 * One type-safe handler per artifact kind: the kind's own zod schema
 * validates the raw JSON, then the matching typed save runs. Project
 * artifacts key by searchProjectId; candidate artifacts by candidateId.
 */
const PROJECT_ARTIFACTS: Record<string, ArtifactHandler> = {
  role_intelligence: async (db, ownerId, raw) => {
    if (!(await getRoleIntelligence(db, ownerId))) return { exists: false };
    await updateRoleIntelligencePayload(
      db,
      ownerId,
      roleIntelligencePayloadSchema.parse(raw),
    );
    return { exists: true };
  },
  success_profile: async (db, ownerId, raw) => {
    if (!(await getSuccessProfile(db, ownerId))) return { exists: false };
    await updateSuccessProfilePayload(
      db,
      ownerId,
      successProfilePayloadSchema.parse(raw),
    );
    return { exists: true };
  },
  market_research: async (db, ownerId, raw) => {
    if (!(await getMarketResearch(db, ownerId))) return { exists: false };
    await updateMarketResearchPayload(
      db,
      ownerId,
      marketResearchPayloadSchema.parse(raw),
    );
    return { exists: true };
  },
  sourcing_strategy: async (db, ownerId, raw) => {
    if (!(await getSourcingStrategy(db, ownerId))) return { exists: false };
    await updateSourcingStrategyPayload(
      db,
      ownerId,
      sourcingStrategyPayloadSchema.parse(raw),
    );
    return { exists: true };
  },
  screen_guide: async (db, ownerId, raw) => {
    if (!(await getScreenGuide(db, ownerId))) return { exists: false };
    await updateScreenGuidePayload(
      db,
      ownerId,
      screenGuidePayloadSchema.parse(raw),
    );
    return { exists: true };
  },
  hm_brief: async (db, ownerId, raw) => {
    if (!(await getHmBrief(db, ownerId))) return { exists: false };
    await updateHmBriefPayload(db, ownerId, hmBriefPayloadSchema.parse(raw));
    return { exists: true };
  },
  interview_plan: async (db, ownerId, raw) => {
    if (!(await getInterviewPlan(db, ownerId))) return { exists: false };
    await updateInterviewPlanPayload(
      db,
      ownerId,
      interviewPlanPayloadSchema.parse(raw),
    );
    return { exists: true };
  },
};

const CANDIDATE_ARTIFACTS: Record<string, ArtifactHandler> = {
  evidence: async (db, ownerId, raw) => {
    if (!(await getCandidateEvidence(db, ownerId))) return { exists: false };
    await updateCandidateEvidencePayload(
      db,
      ownerId,
      evidenceAlignmentPayloadSchema.parse(raw),
    );
    return { exists: true };
  },
  close_plan: async (db, ownerId, raw) => {
    if (!(await getClosePlan(db, ownerId))) return { exists: false };
    await updateClosePlanPayload(
      db,
      ownerId,
      closePlanPayloadSchema.parse(raw),
    );
    return { exists: true };
  },
  onboarding_plan: async (db, ownerId, raw) => {
    if (!(await getOnboardingPlan(db, ownerId))) return { exists: false };
    await updateOnboardingPlan(
      db,
      ownerId,
      onboardingPlanPayloadSchema.parse(raw),
    );
    return { exists: true };
  },
};

const saveArtifactInput = z.object({
  kind: z.enum([
    "role_intelligence",
    "success_profile",
    "market_research",
    "sourcing_strategy",
    "screen_guide",
    "interview_plan",
    "hm_brief",
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

    const projectHandler = PROJECT_ARTIFACTS[parsed.kind];
    if (projectHandler) {
      const { exists } = await projectHandler(db, parsed.ownerId, raw);
      if (!exists) throw new Error("Nothing generated yet to edit");
      revalidatePath(`/searches/${parsed.ownerId}`, "layout");
      return undefined;
    }

    const candidateHandler = CANDIDATE_ARTIFACTS[parsed.kind];
    if (!candidateHandler)
      throw new Error(`Unknown artifact kind ${parsed.kind}`);
    const { exists } = await candidateHandler(db, parsed.ownerId, raw);
    if (!exists) throw new Error("Nothing generated yet to edit");
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
