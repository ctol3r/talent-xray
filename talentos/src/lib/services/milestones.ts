/**
 * Recording the four moments, and reading the three intervals back.
 *
 * Writing is deliberately dull: `recordMilestone` is called from the places in
 * the workflow where the transition already happens — the intake being
 * completed, a reply being marked qualified, a shortlist being agreed, an
 * offer being marked signed — and it is the only way a row gets written. There
 * is no backfill and no inference anywhere in this file. A job that predates
 * the events has no events, which the sample size on the dashboard reports
 * honestly rather than papering over.
 *
 * Reading takes an explicit list of job ids. That is not ceremony: the whole
 * failure mode of a desk-level number is that it silently answers about jobs
 * the reader has filtered away, and the only reliable defence is refusing to
 * have a default.
 */
import { inArray } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { searchMilestones } from "@/lib/db/schema";
import {
  elapsedReadings,
  type ElapsedReading,
  type MilestoneKind,
  type MilestoneRow,
} from "../../../artifact-src/core/milestones";

export interface RecordMilestoneInput {
  searchProjectId: string;
  kind: MilestoneKind;
  /** When it happened. Defaults to now, which is right when a person just did it. */
  occurredAt?: string;
  candidateId?: string | null;
  note?: string | null;
}

/**
 * Write the moment down, once.
 *
 * First write wins and later ones are dropped, which is what "first qualified
 * reply" means and what a brief being completed twice should do. The unique
 * index is the thing enforcing it; `onConflictDoNothing` just stops the second
 * attempt from being an error, because the caller marking a second reply as
 * qualified has done nothing wrong.
 */
export async function recordMilestone(
  db: Db,
  input: RecordMilestoneInput,
): Promise<void> {
  await db
    .insert(searchMilestones)
    .values({
      searchProjectId: input.searchProjectId,
      kind: input.kind,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      candidateId: input.candidateId ?? null,
      note: input.note ?? null,
    })
    .onConflictDoNothing();
}

export async function listMilestones(
  db: Db,
  jobIds: string[],
): Promise<MilestoneRow[]> {
  if (jobIds.length === 0) return [];
  const rows = await db
    .select()
    .from(searchMilestones)
    .where(inArray(searchMilestones.searchProjectId, jobIds));
  return rows.map((row) => ({
    jobId: row.searchProjectId,
    kind: row.kind,
    occurredAt: row.occurredAt,
  }));
}

export interface DeskElapsed {
  readings: ElapsedReading[];
  /** How many jobs the numbers were drawn from, for the caption. */
  jobsInScope: number;
}

/**
 * The three medians, over exactly the jobs given and no others.
 *
 * Callers pass the scope they are displaying. Passing every job in the
 * workspace is a legitimate scope — it is what an unfiltered dashboard is
 * showing — but it has to be said rather than assumed, so that a page which
 * later grows a filter cannot keep answering about the whole desk by accident.
 */
export async function deskElapsed(
  db: Db,
  jobIds: string[],
  now = new Date().toISOString(),
): Promise<DeskElapsed> {
  const rows = await listMilestones(db, jobIds);
  return { readings: elapsedReadings(rows, now), jobsInScope: jobIds.length };
}
