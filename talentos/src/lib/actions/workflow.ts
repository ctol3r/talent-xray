"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  closePlanPayloadSchema,
  ensureIds,
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
  scanPayloadForProtectedTraits,
  type TraitScanHit,
} from "@/lib/domain/fair-hiring";
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
  setTaskStatus,
  reorderTasks,
  reorderTasksInput,
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
import { askAboutBlock, type AskAnswer } from "@/lib/ai/tasks/ask";
import { act, type ActionResult } from "./helpers";

type ArtifactHandler = (
  db: ReturnType<typeof getDb>,
  ownerId: string,
  raw: unknown,
) => Promise<{ exists: boolean; saved?: unknown }>;

/**
 * An edited payload, put through exactly what a generated one goes through.
 *
 * `runAiTask` validates against the schema, then runs `ensureIds` so every
 * item in a list stays addressable. This boundary did the first and not the
 * second, which meant a recruiter who added a competency to a success profile
 * added one with no id — and the next thing to reference it by id could not.
 * In an install with no model key this is not the rare path; it is the only
 * path a payload is ever written by hand, and it should be the same path.
 */
function checked<T>(schema: z.ZodType<T>, raw: unknown): T {
  return ensureIds(schema.parse(raw));
}

/**
 * One type-safe handler per artifact kind: the kind's own zod schema
 * validates the raw JSON, then the matching typed save runs. Project
 * artifacts key by searchProjectId; candidate artifacts by candidateId.
 */
const PROJECT_ARTIFACTS: Record<string, ArtifactHandler> = {
  role_intelligence: async (db, ownerId, raw) => {
    if (!(await getRoleIntelligence(db, ownerId))) return { exists: false };
    const payload = checked(roleIntelligencePayloadSchema, raw);
    await updateRoleIntelligencePayload(db, ownerId, payload);
    return { exists: true, saved: payload };
  },
  success_profile: async (db, ownerId, raw) => {
    if (!(await getSuccessProfile(db, ownerId))) return { exists: false };
    const payload = checked(successProfilePayloadSchema, raw);
    await updateSuccessProfilePayload(db, ownerId, payload);
    return { exists: true, saved: payload };
  },
  market_research: async (db, ownerId, raw) => {
    if (!(await getMarketResearch(db, ownerId))) return { exists: false };
    const payload = checked(marketResearchPayloadSchema, raw);
    await updateMarketResearchPayload(db, ownerId, payload);
    return { exists: true, saved: payload };
  },
  sourcing_strategy: async (db, ownerId, raw) => {
    if (!(await getSourcingStrategy(db, ownerId))) return { exists: false };
    const payload = checked(sourcingStrategyPayloadSchema, raw);
    await updateSourcingStrategyPayload(db, ownerId, payload);
    return { exists: true, saved: payload };
  },
  screen_guide: async (db, ownerId, raw) => {
    if (!(await getScreenGuide(db, ownerId))) return { exists: false };
    const payload = checked(screenGuidePayloadSchema, raw);
    await updateScreenGuidePayload(db, ownerId, payload);
    return { exists: true, saved: payload };
  },
  hm_brief: async (db, ownerId, raw) => {
    if (!(await getHmBrief(db, ownerId))) return { exists: false };
    const payload = checked(hmBriefPayloadSchema, raw);
    await updateHmBriefPayload(db, ownerId, payload);
    return { exists: true, saved: payload };
  },
  interview_plan: async (db, ownerId, raw) => {
    if (!(await getInterviewPlan(db, ownerId))) return { exists: false };
    const payload = checked(interviewPlanPayloadSchema, raw);
    await updateInterviewPlanPayload(db, ownerId, payload);
    return { exists: true, saved: payload };
  },
};

const CANDIDATE_ARTIFACTS: Record<string, ArtifactHandler> = {
  evidence: async (db, ownerId, raw) => {
    if (!(await getCandidateEvidence(db, ownerId))) return { exists: false };
    const payload = checked(evidenceAlignmentPayloadSchema, raw);
    await updateCandidateEvidencePayload(db, ownerId, payload);
    return { exists: true, saved: payload };
  },
  close_plan: async (db, ownerId, raw) => {
    if (!(await getClosePlan(db, ownerId))) return { exists: false };
    const payload = checked(closePlanPayloadSchema, raw);
    await updateClosePlanPayload(db, ownerId, payload);
    return { exists: true, saved: payload };
  },
  onboarding_plan: async (db, ownerId, raw) => {
    if (!(await getOnboardingPlan(db, ownerId))) return { exists: false };
    const payload = checked(onboardingPlanPayloadSchema, raw);
    await updateOnboardingPlan(db, ownerId, payload);
    return { exists: true, saved: payload };
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
 *
 * It also scans what it saved for protected-characteristic language and hands
 * the hits back. `runAiTask` has always done this to the model's output, and
 * this boundary — the one a person types into — did not, which had the guard
 * pointed at the writer least likely to need it. A hit is a flag and never a
 * block: legitimate mentions exist, the recruiter is the one who can tell,
 * and a fair-hiring rule that silently refuses to save somebody's work is a
 * rule people route around.
 */
export async function saveArtifactJsonAction(
  input: unknown,
): Promise<ActionResult<{ warnings: TraitScanHit[] }>> {
  return act(async () => {
    const parsed = saveArtifactInput.parse(input);
    const db = getDb();
    const raw: unknown = JSON.parse(parsed.json);

    if (parsed.kind === "intake") {
      const session = await getLatestIntakeSession(db, parsed.ownerId);
      if (!session) throw new Error("No intake session to edit");
      const payload = checked(intakePayloadSchema, raw);
      await updateIntakePayload(db, session.id, payload);
      revalidatePath(`/searches/${parsed.ownerId}`, "layout");
      return { warnings: scanPayloadForProtectedTraits(payload) };
    }

    const projectHandler = PROJECT_ARTIFACTS[parsed.kind];
    if (projectHandler) {
      const { exists, saved } = await projectHandler(db, parsed.ownerId, raw);
      if (!exists) throw new Error("Nothing generated yet to edit");
      revalidatePath(`/searches/${parsed.ownerId}`, "layout");
      return { warnings: scanPayloadForProtectedTraits(saved) };
    }

    const candidateHandler = CANDIDATE_ARTIFACTS[parsed.kind];
    if (!candidateHandler)
      throw new Error(`Unknown artifact kind ${parsed.kind}`);
    const { exists, saved } = await candidateHandler(db, parsed.ownerId, raw);
    if (!exists) throw new Error("Nothing generated yet to edit");
    const candidate = await getCandidate(db, parsed.ownerId);
    if (candidate) {
      revalidatePath(`/searches/${candidate.searchProjectId}`, "layout");
    }
    return { warnings: scanPayloadForProtectedTraits(saved) };
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

/**
 * The same as creating a task, except it hands the id back.
 *
 * A block in a note that becomes a to-do has to hold the id of the row it now
 * is, or the tick in the note and the tick on the task list are two different
 * facts that will disagree the first time either is used.
 */
export async function createTaskForBlockAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return act(async () => {
    const parsed = createTaskInput.parse(input);
    const task = await createTask(getDb(), parsed);
    revalidatePath("/tasks");
    revalidatePath("/");
    return { id: task.id };
  });
}

const askInput = z.object({ question: z.string().min(3).max(2000) });

/**
 * Ask the configured model a question typed into a note.
 *
 * Whatever comes back is labelled as a model's answer where it lands, and with
 * the session provider — the default here — nothing comes back at once: the
 * request goes to the outbox and the action returns `pending` with the two
 * file paths, which the note then says out loud. An answer that appeared with
 * no way to tell where it came from would be the one thing this product does
 * not do.
 */
export async function askAction(
  input: unknown,
): Promise<ActionResult<AskAnswer>> {
  return act(async () => {
    const parsed = askInput.parse(input);
    return askAboutBlock(parsed.question);
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

const setTaskStatusInput = completeTaskInput.extend({ done: z.boolean() });

/** Tick and untick, which is what makes it a checkbox rather than a button. */
export async function setTaskStatusAction(
  input: unknown,
): Promise<ActionResult<undefined>> {
  return act(async () => {
    const parsed = setTaskStatusInput.parse(input);
    await setTaskStatus(getDb(), parsed.taskId, parsed.done);
    revalidatePath("/tasks");
    revalidatePath("/");
    return undefined;
  });
}

/**
 * Save the order a recruiter dragged tasks into.
 *
 * The whole list is sent rather than "move item 3 to position 1", so the
 * saved order is exactly what is on screen — relative nudges drift the
 * moment two moves arrive at once.
 */
export async function reorderTasksAction(
  input: unknown,
): Promise<ActionResult<{ placed: number }>> {
  return act(async () => {
    const parsed = reorderTasksInput.parse(input);
    const result = await reorderTasks(getDb(), parsed);
    revalidatePath("/tasks");
    revalidatePath("/");
    return result;
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
