import { saveDocument } from "./documents";
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { computeOutreachStats } from "@/lib/domain/analytics";
import { startDateAgreementSchema } from "@/lib/core/enums";
import {
  computeNextBestActions,
  type NextBestAction,
  type ProjectSnapshot,
} from "@/lib/domain/next-best-action";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/domain/pipeline";
import { duplicateJobTitleMessage, sameJobTitle } from "@/lib/domain/job-label";
import {
  CURRENCIES,
  FTE_OPTIONS,
  JOB_PRIORITIES,
  SALARY_PERIODS,
  SPONSORSHIP_OPTIONS,
  isValidChoice,
  type Choice,
} from "@/lib/domain/job-fields";
import type { Db } from "@/lib/db/client";
import {
  candidatePackets,
  candidates,
  closePlans,
  companies,
  hiringManagers,
  hmBriefs,
  intakeSessions,
  jobDescriptions,
  offers,
  outreachMessages,
  pipelineEvents,
  pipelineStages,
  roleIntelligence,
  searchProjects,
  searchQueries,
  sourceChannels,
  sourcingStrategies,
  successProfiles,
  tasks,
} from "@/lib/db/schema";

/**
 * A value from a fixed list, or empty. Empty is always allowed: a form that
 * forces a choice before the recruiter knows one collects guesses.
 */
const choice = (choices: Choice[]) =>
  z
    .string()
    .refine((value) => isValidChoice(choices, value), {
      message: "Not one of the available options.",
    })
    .optional();

export const createSearchProjectInput = z.object({
  name: z.string().min(1),
  companyName: z.string().optional(),
  roleTitle: z.string().min(1),
  geography: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  industry: z.string().optional(),
  seniority: z.string().optional(),
  employmentType: z.string().optional(),
  workArrangement: z.string().optional(),
  compensationNote: z.string().optional(),
  // The offer, in parts. Each is validated against its own list so a stored
  // value is always one the product knows how to render.
  fte: choice(FTE_OPTIONS),
  salaryMin: z.coerce.number().int().min(0).max(100_000_000).optional(),
  salaryMax: z.coerce.number().int().min(0).max(100_000_000).optional(),
  salaryCurrency: choice(CURRENCIES),
  salaryPeriod: choice(SALARY_PERIODS),
  openings: z.coerce.number().int().min(1).max(999).optional(),
  priority: choice(JOB_PRIORITIES),
  sponsorship: choice(SPONSORSHIP_OPTIONS),
  targetStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  /**
   * Whether a start date was agreed. Optional here so seeds, imports and
   * fixtures can still make a job in one line; required at intake, which is
   * where a person is actually in a position to answer it.
   */
  startDateAgreement: startDateAgreementSchema.optional(),
  businessObjective: z.string().optional(),
  recruiterNotes: z.string().optional(),
});
export type CreateSearchProjectInput = z.infer<typeof createSearchProjectInput>;

/**
 * What intake must answer, which is more than what the database will hold.
 *
 * The start date is the only expectation this product captures, and every
 * "recent", "stalled" and "quiet" reading in it is measured against that
 * window. When it is missing the reading falls back to a fortnight nobody
 * agreed to — so the question is asked at intake rather than left to a blank
 * field that could equally mean "not agreed" or "not typed".
 *
 * "Not agreed yet" is a legitimate answer and always will be: a manager who
 * has not committed to a date has not committed to one, and a form that makes
 * people invent one would be trading a visible assumption for an invisible
 * lie. What is refused is silence — and answering "agreed" without a date,
 * which is a claim with nothing behind it.
 */
export const intakeSearchProjectInput = createSearchProjectInput
  .extend({ startDateAgreement: startDateAgreementSchema })
  .superRefine((value, ctx) => {
    if (value.startDateAgreement === "agreed" && !value.targetStartDate)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetStartDate"],
        message: "A start date was agreed, so give the date.",
      });
    if (value.startDateAgreement === "not_agreed" && value.targetStartDate)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["targetStartDate"],
        message:
          "No start date was agreed, so remove the date or change the answer.",
      });
  });

/**
 * Refuse a title another job already uses.
 *
 * Titles are how a job is named in a list, in the recall menu and inside
 * `[[a title]]` in a note, so two identical ones make all three ambiguous.
 * The check is case- and punctuation-insensitive, because "CAIS Founding
 * Recruiter" and "CAIS — founding recruiter" are the same title to a reader.
 */
async function assertJobTitleFree(
  db: Db,
  title: string,
  exceptId?: string,
): Promise<void> {
  const taken = (await db.select().from(searchProjects)).find(
    (row) => row.id !== exceptId && sameJobTitle(row.name, title),
  );
  if (taken) throw new Error(duplicateJobTitleMessage(taken.name));
}

export async function createSearchProject(
  db: Db,
  input: CreateSearchProjectInput,
) {
  await assertJobTitleFree(db, input.name);
  let companyId: string | undefined;
  if (input.companyName) {
    const existing = await db
      .select()
      .from(companies)
      .where(eq(companies.name, input.companyName));
    companyId =
      existing[0]?.id ??
      (
        await db
          .insert(companies)
          .values({ name: input.companyName })
          .returning()
      )[0].id;
  }
  const [project] = await db
    .insert(searchProjects)
    .values({ ...input, companyId })
    .returning();
  await db.insert(pipelineStages).values(
    DEFAULT_PIPELINE_STAGES.map((stage) => ({
      searchProjectId: project.id,
      ...stage,
    })),
  );
  return project;
}

export const updateSearchProjectInput = createSearchProjectInput
  .partial()
  .extend({
    id: z.string(),
    status: z.enum(["open", "on_hold", "closed"]).optional(),
  });

export async function updateSearchProject(
  db: Db,
  input: z.infer<typeof updateSearchProjectInput>,
) {
  const { id, ...fields } = input;
  if (fields.name) await assertJobTitleFree(db, fields.name, id);
  const [project] = await db
    .update(searchProjects)
    .set({ ...fields, updatedAt: new Date().toISOString() })
    .where(eq(searchProjects.id, id))
    .returning();
  return project;
}

export async function listSearchProjects(db: Db) {
  return db
    .select()
    .from(searchProjects)
    .orderBy(desc(searchProjects.updatedAt));
}

export async function getSearchProject(db: Db, id: string) {
  const [project] = await db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.id, id));
  return project;
}

export const saveJobDescriptionInput = z.object({
  searchProjectId: z.string(),
  rawText: z.string().min(1),
  source: z.enum(["pasted", "uploaded", "manual", "url"]).default("pasted"),
  url: z.string().optional(),
});

export async function saveJobDescription(
  db: Db,
  input: z.infer<typeof saveJobDescriptionInput>,
) {
  const parsed = saveJobDescriptionInput.parse(input);
  saveDocument(
    db,
    {
      searchProjectId: parsed.searchProjectId,
      kind: "jd",
      text: parsed.rawText,
      confirmed: true,
    },
    undefined,
    { source: parsed.source, url: parsed.url },
  );
  return db
    .select()
    .from(jobDescriptions)
    .where(eq(jobDescriptions.searchProjectId, input.searchProjectId))
    .orderBy(desc(jobDescriptions.createdAt))
    .get()!;
}

export const saveHiringManagerInput = z.object({
  searchProjectId: z.string(),
  name: z.string().min(1),
  title: z.string().optional(),
  email: z.string().optional(),
  styleNotes: z.string().optional(),
});

export async function saveHiringManager(
  db: Db,
  input: z.infer<typeof saveHiringManagerInput>,
) {
  const [hm] = await db.insert(hiringManagers).values(input).returning();
  return hm;
}

/** Stage keys treated as "awaiting recruiter review" for NBA counting. */
const REVIEW_STAGES = ["research", "identified", "review"];

export async function buildProjectSnapshot(
  db: Db,
  projectId: string,
): Promise<ProjectSnapshot> {
  const [jd] = await db
    .select({ id: jobDescriptions.id })
    .from(jobDescriptions)
    .where(eq(jobDescriptions.searchProjectId, projectId))
    .limit(1);
  const [intel] = await db
    .select()
    .from(roleIntelligence)
    .where(eq(roleIntelligence.searchProjectId, projectId));
  const [intake] = await db
    .select()
    .from(intakeSessions)
    .where(eq(intakeSessions.searchProjectId, projectId))
    .orderBy(desc(intakeSessions.createdAt))
    .limit(1);
  const [profile] = await db
    .select({ id: successProfiles.id })
    .from(successProfiles)
    .where(eq(successProfiles.searchProjectId, projectId));
  const [strategy] = await db
    .select({ id: sourcingStrategies.id })
    .from(sourcingStrategies)
    .where(eq(sourcingStrategies.searchProjectId, projectId));
  const channels = await db
    .select({ id: sourceChannels.id })
    .from(sourceChannels)
    .where(eq(sourceChannels.searchProjectId, projectId));
  const queries = await db
    .select({ id: searchQueries.id })
    .from(searchQueries)
    .where(
      and(
        eq(searchQueries.searchProjectId, projectId),
        eq(searchQueries.archived, false),
      ),
    );
  const projectCandidates = await db
    .select()
    .from(candidates)
    .where(eq(candidates.searchProjectId, projectId));
  const candidateIds = projectCandidates.map((c) => c.id);
  const messages =
    candidateIds.length > 0
      ? await db
          .select({ status: outreachMessages.status })
          .from(outreachMessages)
          .where(inArray(outreachMessages.candidateId, candidateIds))
      : [];
  const events = await db
    .select()
    .from(pipelineEvents)
    .where(eq(pipelineEvents.searchProjectId, projectId));
  const openTasks = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.searchProjectId, projectId), eq(tasks.status, "open")));
  const [hmBrief] = await db
    .select({ id: hmBriefs.id })
    .from(hmBriefs)
    .where(eq(hmBriefs.searchProjectId, projectId));
  const projectOffers = await db
    .select()
    .from(offers)
    .where(eq(offers.searchProjectId, projectId));
  const closePlanRows = await db
    .select({ candidateId: closePlans.candidateId })
    .from(closePlans)
    .where(eq(closePlans.searchProjectId, projectId));
  const prepPackets = await db
    .select({ candidateId: candidatePackets.candidateId })
    .from(candidatePackets)
    .where(
      and(
        eq(candidatePackets.searchProjectId, projectId),
        eq(candidatePackets.kind, "interview_prep"),
      ),
    );

  const now = new Date();
  const todayIso = now.toISOString();
  const stalledThresholdDays = 7;
  const stalledCutoff = new Date(
    now.getTime() - stalledThresholdDays * 24 * 3600 * 1000,
  ).toISOString();

  const lastEventByCandidate = new Map<string, string>();
  for (const event of events) {
    const existing = lastEventByCandidate.get(event.candidateId);
    if (!existing || event.occurredAt > existing) {
      lastEventByCandidate.set(event.candidateId, event.occurredAt);
    }
  }
  const terminalStages = new Set(
    DEFAULT_PIPELINE_STAGES.filter((s) => s.isTerminal).map((s) => s.key),
  );
  const stalledCandidateCount = projectCandidates.filter((c) => {
    if (terminalStages.has(c.stage) || c.disposition !== "active") return false;
    const last = lastEventByCandidate.get(c.id) ?? c.createdAt;
    return last < stalledCutoff;
  }).length;

  const unanswered = intake
    ? intake.payload.categories
        .flatMap((cat) => cat.questions)
        .filter((q) => !q.answer || q.answer.trim() === "").length
    : 0;

  const outreach = computeOutreachStats(messages);

  // W9 — guidance-thread metrics.
  const hmReviewPendingCount = projectCandidates.filter(
    (c) =>
      c.stage === "hm_review" &&
      c.disposition === "active" &&
      (c.hmFeedback ?? []).length === 0,
  ).length;
  const closePlanned = new Set(closePlanRows.map((r) => r.candidateId));
  const offersWithoutClosePlanCount = projectOffers.filter(
    (o) =>
      (o.status === "preparing" || o.status === "extended") &&
      !closePlanned.has(o.candidateId),
  ).length;
  const prepped = new Set(prepPackets.map((r) => r.candidateId));
  const interviewingWithoutPrepCount = projectCandidates.filter(
    (c) =>
      (c.stage === "interviewing" || c.stage === "final") &&
      c.disposition === "active" &&
      !prepped.has(c.id),
  ).length;

  return {
    projectId,
    hasJobDescription: Boolean(jd),
    hasRoleIntelligence: Boolean(intel),
    unresolvedQuestionCount: intel?.payload.unresolvedQuestions.length ?? 0,
    hasIntake: Boolean(intake),
    unansweredIntakeCount: unanswered,
    intakeComplete: intake?.status === "complete",
    hasSuccessProfile: Boolean(profile),
    hasStrategy: Boolean(strategy),
    channelCount: channels.length,
    queryCount: queries.length,
    candidateCount: projectCandidates.length,
    candidatesNeedingReview: projectCandidates.filter(
      (c) => REVIEW_STAGES.includes(c.stage) && c.disposition === "active",
    ).length,
    followUpsDueCount: projectCandidates.filter(
      (c) => c.nextActionDue !== null && c.nextActionDue <= todayIso,
    ).length,
    outreachSent: outreach.sent,
    outreachReplied: outreach.replied,
    stalledCandidateCount,
    stalledThresholdDays,
    openTaskCount: openTasks.length,
    hasHmBrief: Boolean(hmBrief),
    hmReviewPendingCount,
    offersWithoutClosePlanCount,
    interviewingWithoutPrepCount,
  };
}

export async function getNextBestActions(
  db: Db,
  projectId: string,
): Promise<NextBestAction[]> {
  return computeNextBestActions(await buildProjectSnapshot(db, projectId));
}

export interface DashboardData {
  activeSearches: (typeof searchProjects.$inferSelect)[];
  today: {
    followUpsDue: {
      candidate: typeof candidates.$inferSelect;
      projectName: string;
    }[];
    candidatesNeedingReview: number;
    openTasks: (typeof tasks.$inferSelect)[];
  };
  actionsByProject: {
    projectId: string;
    projectName: string;
    actions: NextBestAction[];
  }[];
  /**
   * Jobs that exist but are on hold or closed.
   *
   * Only a count, and only so the dashboard can tell an empty desk from a
   * finished one. They are two different situations and one of them should
   * not be greeted with "create your first search".
   */
  closedSearches: number;
  /**
   * Every job in the workspace, as ids.
   *
   * The scope the elapsed-day medians are computed over, passed explicitly so
   * the number and the caption beside it cannot drift apart. The dashboard has
   * no filter today, so the scope is everything; when it grows one, this is the
   * single place the narrowed set arrives from.
   */
  allJobIds: string[];
}

export async function getDashboardData(db: Db): Promise<DashboardData> {
  const active = await db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.status, "open"))
    .orderBy(desc(searchProjects.updatedAt));
  const todayIso = new Date().toISOString();
  const followUpsDue: DashboardData["today"]["followUpsDue"] = [];
  let candidatesNeedingReview = 0;
  const actionsByProject: DashboardData["actionsByProject"] = [];
  for (const project of active) {
    const snapshot = await buildProjectSnapshot(db, project.id);
    candidatesNeedingReview += snapshot.candidatesNeedingReview;
    const actions = computeNextBestActions(snapshot);
    if (actions.length > 0) {
      actionsByProject.push({
        projectId: project.id,
        projectName: project.name,
        actions: actions.slice(0, 3),
      });
    }
    const due = await db
      .select()
      .from(candidates)
      .where(
        and(
          eq(candidates.searchProjectId, project.id),
          lte(candidates.nextActionDue, todayIso),
        ),
      );
    for (const candidate of due) {
      followUpsDue.push({ candidate, projectName: project.name });
    }
  }
  const openTasks = await db
    .select()
    .from(tasks)
    .where(eq(tasks.status, "open"))
    .orderBy(tasks.dueAt);
  const all = await db.select({ id: searchProjects.id }).from(searchProjects);
  return {
    activeSearches: active,
    today: { followUpsDue, candidatesNeedingReview, openTasks },
    actionsByProject,
    closedSearches: all.length - active.length,
    allJobIds: all.map((job) => job.id),
  };
}
