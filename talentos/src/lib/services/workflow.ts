import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { RUBRIC_LEVELS, LEARNING_KINDS } from "@/lib/core/enums";
import type { Db } from "@/lib/db/client";
import {
  intakeSessions,
  offers,
  outreachMessages,
  scorecards,
  searchLearnings,
  searchQueries,
  sourceChannels,
  tasks,
  type ScorecardEntry,
} from "@/lib/db/schema";
import { getLatestIntakeSession } from "./artifacts";
import { moveCandidateStage } from "./candidates";

// ── Intake answer capture ───────────────────────────────────────────────────

export const answerIntakeQuestionInput = z.object({
  sessionId: z.string(),
  questionId: z.string(),
  answer: z.string(),
});

export async function answerIntakeQuestion(
  db: Db,
  input: z.infer<typeof answerIntakeQuestionInput>,
) {
  const [session] = await db
    .select()
    .from(intakeSessions)
    .where(eq(intakeSessions.id, input.sessionId));
  if (!session) throw new Error("Intake session not found");
  const payload = session.payload;
  let found = false;
  for (const category of payload.categories) {
    for (const question of category.questions) {
      if (question.id === input.questionId) {
        question.answer = input.answer;
        question.answeredAt = new Date().toISOString();
        found = true;
      }
    }
  }
  if (!found) throw new Error("Intake question not found");
  await db
    .update(intakeSessions)
    .set({
      payload,
      status: session.status === "draft" ? "in_progress" : session.status,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(intakeSessions.id, input.sessionId));
}

export async function completeIntake(db: Db, sessionId: string) {
  await db
    .update(intakeSessions)
    .set({ status: "complete", updatedAt: new Date().toISOString() })
    .where(eq(intakeSessions.id, sessionId));
}

export async function getIntakeProgress(db: Db, projectId: string) {
  const session = await getLatestIntakeSession(db, projectId);
  if (!session) return { total: 0, answered: 0 };
  const questions = session.payload.categories.flatMap((c) => c.questions);
  return {
    total: questions.length,
    answered: questions.filter((q) => q.answer && q.answer.trim() !== "")
      .length,
  };
}

// ── Scorecards ──────────────────────────────────────────────────────────────

export const scorecardEntryInput = z
  .object({
    id: z.string().optional(),
    competency: z.string().min(1),
    observation: z.string(),
    interpretation: z.string(),
    rating: z.enum(RUBRIC_LEVELS),
    evidenceText: z.string(),
  })
  .refine(
    (entry) =>
      entry.rating === "insufficient_evidence" ||
      entry.evidenceText.trim().length >= 10,
    {
      message:
        "A rating above 'insufficient evidence' requires written behavioral/outcome evidence.",
    },
  );

export const saveScorecardInput = z.object({
  id: z.string().optional(),
  searchProjectId: z.string(),
  candidateId: z.string(),
  stageName: z.string().min(1),
  interviewer: z.string().optional(),
  status: z.enum(["draft", "submitted"]).default("draft"),
  entries: z.array(scorecardEntryInput).min(1),
  overallNote: z.string().optional(),
});

export async function saveScorecard(
  db: Db,
  input: z.infer<typeof saveScorecardInput>,
) {
  const entries: ScorecardEntry[] = input.entries.map((entry) => ({
    ...entry,
    id: entry.id ?? crypto.randomUUID(),
  }));
  if (input.id) {
    const [updated] = await db
      .update(scorecards)
      .set({
        entries,
        status: input.status,
        interviewer: input.interviewer,
        overallNote: input.overallNote,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(scorecards.id, input.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(scorecards)
    .values({
      searchProjectId: input.searchProjectId,
      candidateId: input.candidateId,
      stageName: input.stageName,
      interviewer: input.interviewer,
      status: input.status,
      entries,
      overallNote: input.overallNote,
    })
    .returning();
  return created;
}

export async function listScorecards(db: Db, projectId: string) {
  return db
    .select()
    .from(scorecards)
    .where(eq(scorecards.searchProjectId, projectId))
    .orderBy(desc(scorecards.updatedAt));
}

export async function listCandidateScorecards(db: Db, candidateId: string) {
  return db
    .select()
    .from(scorecards)
    .where(eq(scorecards.candidateId, candidateId))
    .orderBy(desc(scorecards.updatedAt));
}

// ── Offers ──────────────────────────────────────────────────────────────────

export const upsertOfferInput = z.object({
  searchProjectId: z.string(),
  candidateId: z.string(),
  status: z.enum([
    "preparing",
    "extended",
    "accepted",
    "declined",
    "withdrawn",
  ]),
  compensationNote: z.string().optional(),
});

/** Offer status changes drive the pipeline stage so analytics stay honest. */
const OFFER_STAGE: Record<string, string | undefined> = {
  preparing: "offer_prep",
  extended: "offer_extended",
  accepted: "offer_accepted",
};

export async function upsertOffer(
  db: Db,
  input: z.infer<typeof upsertOfferInput>,
) {
  const now = new Date().toISOString();
  const [existing] = await db
    .select()
    .from(offers)
    .where(eq(offers.candidateId, input.candidateId));
  const timestamps = {
    extendedAt:
      input.status === "extended" ? now : (existing?.extendedAt ?? undefined),
    resolvedAt: ["accepted", "declined", "withdrawn"].includes(input.status)
      ? now
      : undefined,
  };
  let offer;
  if (existing) {
    [offer] = await db
      .update(offers)
      .set({
        status: input.status,
        compensationNote: input.compensationNote ?? existing.compensationNote,
        ...timestamps,
        updatedAt: now,
      })
      .where(eq(offers.id, existing.id))
      .returning();
  } else {
    [offer] = await db
      .insert(offers)
      .values({ ...input, ...timestamps })
      .returning();
  }
  const stage = OFFER_STAGE[input.status];
  if (stage) {
    await moveCandidateStage(db, {
      candidateId: input.candidateId,
      toStage: stage,
      note: `Offer ${input.status}`,
    });
  }
  return offer;
}

export async function getOffer(db: Db, candidateId: string) {
  const [offer] = await db
    .select()
    .from(offers)
    .where(eq(offers.candidateId, candidateId));
  return offer;
}

// ── Outreach tracking ───────────────────────────────────────────────────────

export const updateOutreachStatusInput = z.object({
  messageId: z.string(),
  status: z.enum(["drafted", "sent", "replied", "no_reply"]),
});

export async function updateOutreachStatus(
  db: Db,
  input: z.infer<typeof updateOutreachStatusInput>,
) {
  const now = new Date().toISOString();
  await db
    .update(outreachMessages)
    .set({
      status: input.status,
      sentAt: input.status === "sent" ? now : undefined,
      repliedAt: input.status === "replied" ? now : undefined,
      updatedAt: now,
    })
    .where(eq(outreachMessages.id, input.messageId));
}

export async function listCandidateMessages(db: Db, candidateId: string) {
  return db
    .select()
    .from(outreachMessages)
    .where(eq(outreachMessages.candidateId, candidateId))
    .orderBy(outreachMessages.createdAt);
}

// ── Queries & channels (recruiter edits) ────────────────────────────────────

export const upsertQueryInput = z.object({
  id: z.string().optional(),
  searchProjectId: z.string(),
  platform: z.string().min(1),
  query: z.string().min(1),
  purpose: z.string().optional(),
  breadth: z
    .enum(["narrow", "balanced", "broad", "adjacent", "experimental"])
    .default("balanced"),
});

export async function upsertQuery(
  db: Db,
  input: z.infer<typeof upsertQueryInput>,
) {
  if (input.id) {
    const [updated] = await db
      .update(searchQueries)
      .set({
        platform: input.platform,
        query: input.query,
        purpose: input.purpose,
        breadth: input.breadth,
        provenance: "recruiter",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(searchQueries.id, input.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(searchQueries)
    .values({ ...input, provenance: "recruiter" })
    .returning();
  return created;
}

export async function archiveQuery(db: Db, queryId: string) {
  await db
    .update(searchQueries)
    .set({ archived: true, updatedAt: new Date().toISOString() })
    .where(eq(searchQueries.id, queryId));
}

export async function listQueries(db: Db, projectId: string) {
  return db
    .select()
    .from(searchQueries)
    .where(
      and(
        eq(searchQueries.searchProjectId, projectId),
        eq(searchQueries.archived, false),
      ),
    )
    .orderBy(searchQueries.platform, searchQueries.breadth);
}

export const updateChannelInput = z.object({
  id: z.string(),
  priority: z.enum(["high", "medium", "experimental"]).optional(),
  status: z.enum(["suggested", "verified", "rejected"]).optional(),
  url: z.string().optional(),
  note: z.string().optional(),
});

export async function updateChannel(
  db: Db,
  input: z.infer<typeof updateChannelInput>,
) {
  const { id, ...fields } = input;
  const now = new Date().toISOString();
  await db
    .update(sourceChannels)
    .set({
      ...fields,
      // A human verifying a channel upgrades its certainty honestly.
      ...(input.status === "verified"
        ? {
            certainty: "verified" as const,
            verifiedAt: now,
            provenance: "recruiter" as const,
          }
        : {}),
      updatedAt: now,
    })
    .where(eq(sourceChannels.id, id));
}

export async function listChannels(db: Db, projectId: string) {
  return db
    .select()
    .from(sourceChannels)
    .where(eq(sourceChannels.searchProjectId, projectId))
    .orderBy(sourceChannels.priority, sourceChannels.name);
}

// ── Tasks ───────────────────────────────────────────────────────────────────

export const createTaskInput = z.object({
  title: z.string().min(1),
  searchProjectId: z.string().optional(),
  candidateId: z.string().optional(),
  kind: z.string().optional(),
  dueAt: z.string().optional(),
});

export async function createTask(
  db: Db,
  input: z.infer<typeof createTaskInput>,
) {
  const [task] = await db.insert(tasks).values(input).returning();
  return task;
}

export async function completeTask(db: Db, taskId: string) {
  await db
    .update(tasks)
    .set({ status: "done", completedAt: new Date().toISOString() })
    .where(eq(tasks.id, taskId));
}

export async function listOpenTasks(db: Db) {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.status, "open"))
    .orderBy(tasks.dueAt, tasks.createdAt);
}

// ── Learnings ───────────────────────────────────────────────────────────────

export const addLearningInput = z.object({
  searchProjectId: z.string(),
  candidateId: z.string().optional(),
  kind: z.enum(LEARNING_KINDS),
  text: z.string().min(1),
  sampleSize: z.number().int().positive().optional(),
});

export async function addLearning(
  db: Db,
  input: z.infer<typeof addLearningInput>,
) {
  const [learning] = await db
    .insert(searchLearnings)
    .values({ ...input, provenance: "recruiter" })
    .returning();
  return learning;
}

export async function listLearnings(db: Db, projectId: string) {
  return db
    .select()
    .from(searchLearnings)
    .where(eq(searchLearnings.searchProjectId, projectId))
    .orderBy(desc(searchLearnings.createdAt));
}
