/**
 * W7 — Crew orchestration (docs/ROADMAP-AGENT-TEAMS.md).
 *
 * A crew is a per-search team of role-scoped generation agents plus a
 * critic, run as a dependency-ordered job queue. Every job flows through
 * the same pipeline as manual generation (zod validation, fair-hiring
 * scan, audit log, editable persisted drafts). Agents draft and analyze;
 * they never decide, send, or reject.
 *
 * Job lifecycle: queued → (generate) → critiquing → (critic) →
 * done | revising → (one revision generation) → done. With the session
 * provider, any AI step can park at awaiting_model/critiquing/revising
 * with a request file recorded until a Claude session fulfills it.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { CritiquePayload } from "@/lib/core/payloads";
import { SessionFulfillmentPendingError } from "@/lib/ai/session";
import { runAiTask } from "@/lib/ai/run";
import { critiqueTask } from "@/lib/ai/tasks/critique";
import { loadProjectContext } from "@/lib/ai/context";
import type { Db } from "@/lib/db/client";
import { candidates, crewJobs } from "@/lib/db/schema";
import {
  generateChannels,
  generateEvidenceAlignment,
  generateIntake,
  generateInterviewPlan,
  generateMarketIntelligence,
  generateOutreach,
  generateRoleIntelligence,
  generateScreenGuide,
  generateSearchStrings,
  generateSourcingStrategy,
  generateSuccessProfile,
} from "./generation";
import {
  getCandidateEvidence,
  getInterviewPlan,
  getLatestIntakeSession,
  getMarketResearch,
  getRoleIntelligence,
  getScreenGuide,
  getSourcingStrategy,
  getSuccessProfile,
} from "./artifacts";
import { deriveHiringNeed, getIntelligence } from "./intelligence";
import { listChannels, listQueries } from "./workflow";

export interface CrewTaskSpec {
  task: string;
  label: string;
  dependsOn: string[];
  scope: "project" | "candidate";
}

/**
 * The project-level crew: dependency-ordered specialist agents. The crew
 * opens by deriving the canonical IR (D-011); every later specialist
 * receives it in context as the source of truth instead of privately
 * re-reading the JD.
 */
export const CREW_PROJECT_TASKS: CrewTaskSpec[] = [
  {
    task: "hiring_need",
    label: "Hiring Need (IR)",
    dependsOn: [],
    scope: "project",
  },
  {
    task: "role_intelligence",
    label: "Role Intelligence",
    dependsOn: ["hiring_need"],
    scope: "project",
  },
  {
    task: "intake",
    label: "HM Intake",
    dependsOn: ["role_intelligence"],
    scope: "project",
  },
  {
    task: "success_profile",
    label: "Success Profile",
    dependsOn: ["intake"],
    scope: "project",
  },
  {
    task: "market_intelligence",
    label: "Market Intelligence",
    dependsOn: ["success_profile"],
    scope: "project",
  },
  {
    task: "sourcing_strategy",
    label: "Sourcing Strategy",
    dependsOn: ["market_intelligence"],
    scope: "project",
  },
  {
    task: "channels",
    label: "Channel Map",
    dependsOn: ["sourcing_strategy"],
    scope: "project",
  },
  {
    task: "search_strings",
    label: "Search Strings",
    dependsOn: ["channels"],
    scope: "project",
  },
  {
    task: "screen",
    label: "Recruiter Screen",
    dependsOn: ["success_profile"],
    scope: "project",
  },
  {
    task: "interview_plan",
    label: "Interview Plan",
    dependsOn: ["success_profile"],
    scope: "project",
  },
];

export const CREW_CANDIDATE_TASKS: CrewTaskSpec[] = [
  {
    task: "evidence",
    label: "Evidence Alignment",
    dependsOn: [],
    scope: "candidate",
  },
  {
    task: "outreach",
    label: "Outreach Drafts",
    dependsOn: ["evidence"],
    scope: "candidate",
  },
];

const ALL_SPECS = [...CREW_PROJECT_TASKS, ...CREW_CANDIDATE_TASKS];
export function crewTaskLabel(task: string): string {
  return ALL_SPECS.find((s) => s.task === task)?.label ?? task;
}

type Generator = (
  db: Db,
  id: string,
  critique?: string[],
) => Promise<{ warnings: unknown[] }>;

const PROJECT_GENERATORS: Record<string, Generator> = {
  hiring_need: deriveHiringNeed,
  role_intelligence: generateRoleIntelligence,
  intake: generateIntake,
  success_profile: generateSuccessProfile,
  market_intelligence: generateMarketIntelligence,
  sourcing_strategy: generateSourcingStrategy,
  channels: generateChannels,
  search_strings: generateSearchStrings,
  screen: generateScreenGuide,
  interview_plan: generateInterviewPlan,
};
const CANDIDATE_GENERATORS: Record<string, Generator> = {
  evidence: generateEvidenceAlignment,
  outreach: generateOutreach,
};

/** Serialized artifact for the critic — whatever the task persisted. */
async function loadArtifactJson(
  db: Db,
  projectId: string,
  candidateId: string | null,
  task: string,
): Promise<string | null> {
  switch (task) {
    case "hiring_need": {
      const row = await getIntelligence(db, projectId);
      if (!row) return null;
      // The verbatim statement log is service-owned and not under review.
      const intent = row.payload.intent;
      return JSON.stringify({
        need: intent.need,
        requirements: intent.requirements,
        uncertainties: intent.uncertainties,
        contradictions: intent.contradictions,
        revision: intent.revision,
      });
    }
    case "role_intelligence":
      return JSON.stringify(
        (await getRoleIntelligence(db, projectId))?.payload ?? null,
      );
    case "intake":
      return JSON.stringify(
        (await getLatestIntakeSession(db, projectId))?.payload ?? null,
      );
    case "success_profile":
      return JSON.stringify(
        (await getSuccessProfile(db, projectId))?.payload ?? null,
      );
    case "market_intelligence":
      return JSON.stringify(
        (await getMarketResearch(db, projectId))?.payload ?? null,
      );
    case "sourcing_strategy":
      return JSON.stringify(
        (await getSourcingStrategy(db, projectId))?.payload ?? null,
      );
    case "screen":
      return JSON.stringify(
        (await getScreenGuide(db, projectId))?.payload ?? null,
      );
    case "interview_plan":
      return JSON.stringify(
        (await getInterviewPlan(db, projectId))?.payload ?? null,
      );
    case "channels": {
      const rows = await listChannels(db, projectId);
      return rows.length
        ? JSON.stringify(
            rows.map((c) => ({
              name: c.name,
              kind: c.kind,
              priority: c.priority,
              certainty: c.certainty,
              whyRelevant: c.whyRelevant,
            })),
          )
        : null;
    }
    case "search_strings": {
      const rows = await listQueries(db, projectId);
      return rows.length
        ? JSON.stringify(
            rows.map((q) => ({
              platform: q.platform,
              breadth: q.breadth,
              query: q.query,
            })),
          )
        : null;
    }
    case "evidence":
      return candidateId
        ? JSON.stringify(
            (await getCandidateEvidence(db, candidateId))?.payload ?? null,
          )
        : null;
    case "outreach":
      return null; // outreach persists as sequence rows; critic pass not wired in W7
    default:
      return null;
  }
}

const ACTIVE_STATUSES = [
  "queued",
  "awaiting_model",
  "critiquing",
  "revising",
] as const;

export const kickoffCrewInput = z.object({ searchProjectId: z.string() });

/** Enqueue a full project crew, cancelling any previous unfinished run. */
export async function kickoffCrew(db: Db, projectId: string) {
  await db
    .update(crewJobs)
    .set({ status: "cancelled", updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(crewJobs.searchProjectId, projectId),
        inArray(crewJobs.status, [...ACTIVE_STATUSES]),
      ),
    );
  const rows = await db
    .insert(crewJobs)
    .values(
      CREW_PROJECT_TASKS.map((spec) => ({
        searchProjectId: projectId,
        task: spec.task,
        dependsOn: spec.dependsOn,
      })),
    )
    .returning();
  return rows;
}

export const kickoffCandidateCrewInput = z.object({ candidateId: z.string() });

/** Enqueue the per-candidate agents (evidence → outreach). */
export async function kickoffCandidateCrew(db: Db, candidateId: string) {
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId));
  if (!candidate) throw new Error(`Candidate ${candidateId} not found`);
  await db
    .update(crewJobs)
    .set({ status: "cancelled", updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(crewJobs.candidateId, candidateId),
        inArray(crewJobs.status, [...ACTIVE_STATUSES]),
      ),
    );
  const rows = await db
    .insert(crewJobs)
    .values(
      CREW_CANDIDATE_TASKS.map((spec) => ({
        searchProjectId: candidate.searchProjectId,
        candidateId,
        task: spec.task,
        dependsOn: spec.dependsOn,
      })),
    )
    .returning();
  return rows;
}

export async function listCrewJobs(db: Db, projectId: string) {
  return db
    .select()
    .from(crewJobs)
    .where(eq(crewJobs.searchProjectId, projectId))
    .orderBy(asc(crewJobs.createdAt));
}

type CrewJob = typeof crewJobs.$inferSelect;

function depsSatisfied(job: CrewJob, all: CrewJob[]): boolean {
  return job.dependsOn.every((dep) =>
    all.some(
      (other) =>
        other.task === dep &&
        other.status === "done" &&
        other.searchProjectId === job.searchProjectId &&
        (other.candidateId ?? null) === (job.candidateId ?? null),
    ),
  );
}

/** Jobs that can make progress right now. */
export async function runnableJobs(db: Db, projectId: string) {
  const all = await listCrewJobs(db, projectId);
  return all.filter(
    (job) =>
      (job.status === "queued" && depsSatisfied(job, all)) ||
      job.status === "awaiting_model" ||
      job.status === "critiquing" ||
      job.status === "revising",
  );
}

export type JobStepOutcome = "advanced" | "pending" | "done" | "failed";

async function setJob(
  db: Db,
  id: string,
  patch: Partial<typeof crewJobs.$inferInsert>,
) {
  await db
    .update(crewJobs)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(crewJobs.id, id));
}

/**
 * Advance one job as far as it can go. Returns "pending" when the session
 * provider parked an AI step behind a request file.
 */
export async function runJob(db: Db, jobId: string): Promise<JobStepOutcome> {
  const [job] = await db.select().from(crewJobs).where(eq(crewJobs.id, jobId));
  if (!job) throw new Error(`Crew job ${jobId} not found`);
  const scopeId = job.candidateId ?? job.searchProjectId;
  const generator = job.candidateId
    ? CANDIDATE_GENERATORS[job.task]
    : PROJECT_GENERATORS[job.task];
  if (!generator) {
    await setJob(db, job.id, {
      status: "failed",
      error: `No generator for task ${job.task}`,
    });
    return "failed";
  }

  try {
    // Stage 1: generation.
    if (job.status === "queued" || job.status === "awaiting_model") {
      if (!job.startedAt)
        await setJob(db, job.id, { startedAt: new Date().toISOString() });
      await generator(db, scopeId);
      await setJob(db, job.id, {
        status: "critiquing",
        requestPath: null,
        attempt: job.attempt + 1,
      });
      return runJob(db, jobId);
    }
    // Stage 2: critic.
    if (job.status === "critiquing") {
      const artifactJson = await loadArtifactJson(
        db,
        job.searchProjectId,
        job.candidateId,
        job.task,
      );
      if (artifactJson === null) {
        // Nothing reviewable persisted for this task shape — accept as-is.
        await setJob(db, job.id, {
          status: "done",
          finishedAt: new Date().toISOString(),
        });
        return "done";
      }
      const { output } = await runAiTask(
        critiqueTask,
        {
          project: await loadProjectContext(db, job.searchProjectId),
          taskLabel: crewTaskLabel(job.task),
          artifactJson,
        },
        {
          db,
          searchProjectId: job.searchProjectId,
          candidateId: job.candidateId ?? undefined,
        },
      );
      const critique: CritiquePayload = output;
      if (critique.verdict === "accept" || critique.issues.length === 0) {
        await setJob(db, job.id, {
          critique,
          status: "done",
          finishedAt: new Date().toISOString(),
        });
        return "done";
      }
      await setJob(db, job.id, {
        critique,
        status: "revising",
        requestPath: null,
      });
      return runJob(db, jobId);
    }
    // Stage 3: one revision pass with the critique in context.
    if (job.status === "revising") {
      await generator(db, scopeId, job.critique?.issues ?? []);
      await setJob(db, job.id, {
        status: "done",
        requestPath: null,
        finishedAt: new Date().toISOString(),
        attempt: job.attempt + 1,
      });
      return "done";
    }
    return job.status === "done" ? "done" : "failed";
  } catch (error) {
    if (error instanceof SessionFulfillmentPendingError) {
      await setJob(db, job.id, { requestPath: error.requestPath });
      return "pending";
    }
    const message = error instanceof Error ? error.message : String(error);
    await setJob(db, job.id, { status: "failed", error: message });
    return "failed";
  }
}

export interface CrewAdvanceResult {
  ran: number;
  done: number;
  pending: {
    task: string;
    candidateId: string | null;
    requestPath: string | null;
  }[];
  failed: { task: string; error: string | null }[];
  remaining: number;
}

/**
 * Run every currently-runnable job once (dependency waves unlock as their
 * parents finish; call repeatedly until `remaining` is 0).
 */
export async function advanceCrew(
  db: Db,
  projectId: string,
): Promise<CrewAdvanceResult> {
  let ran = 0;
  // Keep sweeping while progress is made, so one call clears a whole
  // dependency chain when the provider is synchronous (anthropic/mock).
  for (;;) {
    const runnable = await runnableJobs(db, projectId);
    if (runnable.length === 0) break;
    let progressed = false;
    for (const job of runnable) {
      const outcome = await runJob(db, job.id);
      ran += 1;
      if (outcome === "done" || outcome === "advanced") progressed = true;
    }
    if (!progressed) break; // everything runnable is parked on request files
  }
  const all = await listCrewJobs(db, projectId);
  const active = all.filter((j) =>
    ACTIVE_STATUSES.includes(j.status as (typeof ACTIVE_STATUSES)[number]),
  );
  return {
    ran,
    done: all.filter((j) => j.status === "done").length,
    pending: active
      .filter((j) => j.requestPath)
      .map((j) => ({
        task: j.task,
        candidateId: j.candidateId,
        requestPath: j.requestPath,
      })),
    failed: all
      .filter((j) => j.status === "failed")
      .map((j) => ({ task: j.task, error: j.error })),
    remaining: active.length,
  };
}
