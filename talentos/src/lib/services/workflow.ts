import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { RUBRIC_LEVELS, LEARNING_KINDS } from "@/lib/core/enums";
import type { Db } from "@/lib/db/client";
import {
  candidates,
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
import { recordMilestone } from "./milestones";

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

/**
 * The intake is finished, which is the moment the brief exists.
 *
 * This is the one milestone nobody has to remember to record: completing the
 * intake is already an explicit act with a button behind it, and it is the
 * only thing in the product that means "the manager and I have agreed what we
 * are looking for". Every elapsed-day measure is counted from here, so a job
 * whose intake was never completed contributes to none of them — correctly,
 * because there is no brief to count from.
 */
export async function completeIntake(db: Db, sessionId: string) {
  const now = new Date().toISOString();
  const [session] = await db
    .select()
    .from(intakeSessions)
    .where(eq(intakeSessions.id, sessionId));
  if (!session) throw new Error("Intake session not found");
  await db
    .update(intakeSessions)
    .set({ status: "complete", updatedAt: now })
    .where(eq(intakeSessions.id, sessionId));
  await recordMilestone(db, {
    searchProjectId: session.searchProjectId,
    kind: "brief",
    occurredAt: now,
  });
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
    "signed",
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
  // Signing does not get a stage of its own. The pipeline's job is to say
  // where a person is, and a signed offer leaves them exactly where an
  // accepted one did; the signature is a date, and it is kept as one.
  signed: "offer_accepted",
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
    resolvedAt: ["accepted", "signed", "declined", "withdrawn"].includes(
      input.status,
    )
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
  // The end of the third interval, and the only one of the four that closes a
  // job. Recorded from `signed` and never from `accepted`: a verbal yes is not
  // a signature, and a measure that treated it as one would report a date that
  // had not happened.
  if (input.status === "signed") {
    await recordMilestone(db, {
      searchProjectId: input.searchProjectId,
      kind: "signature",
      occurredAt: now,
      candidateId: input.candidateId,
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
  /**
   * Whether the reply was worth having, said by the person reading it.
   *
   * The product records that a reply arrived; nothing in a reply tells software
   * whether it was a real candidate or a polite no, and the difference is the
   * entire content of the brief-to-first-qualified-reply measure. So it is
   * asked, once, at the moment the reply is being marked — the only moment
   * somebody has actually read it.
   */
  qualified: z.boolean().optional(),
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

  if (input.status !== "replied" || !input.qualified) return;
  // The message knows its candidate and the candidate knows its job; the
  // milestone is about the job, because "how long until this search heard
  // from somebody real" is a question about the search.
  const [message] = await db
    .select({ candidateId: outreachMessages.candidateId })
    .from(outreachMessages)
    .where(eq(outreachMessages.id, input.messageId));
  if (!message) return;
  const [person] = await db
    .select({ searchProjectId: candidates.searchProjectId })
    .from(candidates)
    .where(eq(candidates.id, message.candidateId));
  if (!person) return;
  await recordMilestone(db, {
    searchProjectId: person.searchProjectId,
    kind: "first_qualified_reply",
    occurredAt: now,
    candidateId: message.candidateId,
  });
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

/**
 * Tick a task, or untick it.
 *
 * Both directions, because a checkbox that only goes one way is not a
 * checkbox — it is a delete button wearing a tick, and the commonest thing
 * anybody does with a to-do list after ticking the wrong line is to untick it.
 * Reopening clears the completion time rather than keeping it, so a task that
 * is open has never been finished as far as any later reading is concerned.
 */
export async function setTaskStatus(db: Db, taskId: string, done: boolean) {
  await db
    .update(tasks)
    .set({
      status: done ? "done" : "open",
      completedAt: done ? new Date().toISOString() : null,
    })
    .where(eq(tasks.id, taskId));
}

/** Kept for the callers that only ever finish one. */
export async function completeTask(db: Db, taskId: string) {
  await setTaskStatus(db, taskId, true);
}

export async function listOpenTasks(db: Db) {
  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.status, "open"))
    .orderBy(tasks.dueAt, tasks.createdAt);
  return sortTasks(rows);
}

/**
 * How long a ticked task stays on the list.
 *
 * A fortnight, because the reason to keep a done task visible is to see what
 * you got through this week and to be able to untick the one you ticked by
 * mistake — and both of those go stale quickly. Older ones are counted rather
 * than listed: a to-do list that only grows is one nobody opens.
 */
export const DONE_VISIBLE_DAYS = 14;

export async function listTasks(db: Db, now = new Date()) {
  const rows = await db
    .select()
    .from(tasks)
    .orderBy(tasks.dueAt, tasks.createdAt);
  const cutoff = new Date(now.getTime() - DONE_VISIBLE_DAYS * 86_400_000);
  const visible = rows.filter((row) => {
    if (row.status === "open") return true;
    const at = row.completedAt ? Date.parse(row.completedAt) : Number.NaN;
    // A done task with no completion time is old data, not a recent tick.
    return Number.isFinite(at) && at >= cutoff.getTime();
  });
  return {
    rows: sortTasks(visible),
    open: rows.filter((row) => row.status === "open").length,
    done: visible.filter((row) => row.status === "done").length,
    olderDone: rows.length - visible.length,
  };
}

/**
 * Hand-placed first, in the order they were placed; everything else after,
 * in the order the database gave them, which is by date.
 *
 * Keeping the two groups apart is what lets dragging one task not silently
 * freeze the order of every other one. A task you have never touched keeps
 * behaving the way it did.
 */
export function sortTasks<T extends { sortOrder: number | null }>(
  rows: T[],
): T[] {
  const placed = rows
    .filter((row) => row.sortOrder !== null)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const unplaced = rows.filter((row) => row.sortOrder === null);
  return [...placed, ...unplaced];
}

export const reorderTasksInput = z.object({
  /** Every open task, in the order they should now appear. */
  orderedIds: z.array(z.string()).min(1).max(500),
});

/**
 * Write the order the recruiter dragged into.
 *
 * Every id in the list is given a position, so the result is exactly the
 * order shown rather than a set of relative nudges that drift. Ids that are
 * not open tasks are ignored rather than failing the whole move.
 */
export async function reorderTasks(
  db: Db,
  input: z.infer<typeof reorderTasksInput>,
) {
  const open = await db.select().from(tasks).where(eq(tasks.status, "open"));
  const known = new Set(open.map((row) => row.id));
  const ordered = input.orderedIds.filter((id) => known.has(id));
  for (const [index, id] of ordered.entries()) {
    await db.update(tasks).set({ sortOrder: index }).where(eq(tasks.id, id));
  }
  return { placed: ordered.length };
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
