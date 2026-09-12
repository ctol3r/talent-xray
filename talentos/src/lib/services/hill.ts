/**
 * Storing one hill chart per job.
 *
 * Under a `hill:<job id>` settings key, the same way daily notes are stored,
 * so every job has a chart the moment it exists and no migration runs to make
 * that true. A job with nothing recorded reads back as the default scopes at
 * the left foot, which is the honest state anyway: nobody has said where
 * anything is yet.
 *
 * The rules live in `artifact-src/core/hill.ts`, which imports nothing, so the
 * chart draws the same in the browser-only artifact as it does here. This file
 * only knows how to load it and save it.
 *
 * One thing that is deliberately not here: any function that computes a
 * position. Not from stage counts, not from candidate numbers, not from
 * elapsed time. A hill chart the software fills in is percent-complete wearing
 * a picture.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { searchProjects, settings } from "@/lib/db/schema";
import { jobClock, type JobClock } from "../../../artifact-src/core/clock";
import {
  defaultChart,
  readChart,
  summariseChart,
  type HillChart,
  type ScopeReading,
} from "../../../artifact-src/core/hill";

const scopeValue = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(120),
  position: z.number().min(0).max(1),
  unknown: z.string().max(400),
  doneAt: z.string().nullable(),
  colour: z.string().max(24),
});

const snapshotValue = z.object({
  at: z.string(),
  by: z.string().max(80),
  positions: z.record(z.string(), z.number().min(0).max(1)),
  scopes: z.array(scopeValue).max(40).optional(),
  note: z.string().max(600),
});

/**
 * Capped, because a chart is read on every job page and an unbounded history
 * would grow until it was the slowest thing on it. Two hundred moves is more
 * than a year of a weekly rhythm, and the oldest are the least useful: the
 * question the trail answers is what has happened lately.
 */
export const MAX_HISTORY = 200;

export const hillValue = z.object({
  version: z.literal(1),
  scopes: z.array(scopeValue).max(40),
  history: z.array(snapshotValue).max(MAX_HISTORY),
});

function key(jobId: string): string {
  return `hill:${jobId}`;
}

/**
 * The chart for a job, or the one every job starts with.
 *
 * A malformed saved chart is reported instead of reset. Returning defaults
 * would let the next edit silently replace the owner's history.
 */
export function readHill(db: Db, jobId: string): HillChart {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, key(jobId)))
    .get();
  if (!row) return defaultChart();
  const parsed = hillValue.safeParse(row.value);
  if (!parsed.success)
    throw new Error(
      "The saved hill chart could not be read. It has been preserved; repair or restore it before saving another update.",
    );
  return { scopes: parsed.data.scopes, history: parsed.data.history };
}

export function writeHill(db: Db, jobId: string, chart: HillChart): void {
  if (
    !db
      .select({ id: searchProjects.id })
      .from(searchProjects)
      .where(eq(searchProjects.id, jobId))
      .get()
  )
    throw new Error("This job no longer exists.");
  const value = hillValue.parse({
    version: 1,
    scopes: chart.scopes,
    history: chart.history.slice(-MAX_HISTORY),
  });
  db.insert(settings)
    .values({ key: key(jobId), value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date().toISOString() },
    })
    .run();
}

export interface HillReading {
  chart: HillChart;
  readings: ScopeReading[];
  /** The line at the top. Counts, never a percentage. */
  says: string;
  /** Scopes with a hand up, most recently raised first. */
  raised: ScopeReading[];
  /** The window agreed at intake, which sets how long "still" is here. */
  clock: JobClock;
}

export function readHillFor(
  db: Db,
  jobId: string,
  now = new Date().toISOString(),
): HillReading {
  const chart = readHill(db, jobId);
  // The job's own window, so "has not moved in a week" means a week of a
  // twelve-week search and a day of a two-week one. A raised hand on the wrong
  // clock is either a nag or a silence, and both get the feature switched off.
  const job = db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.id, jobId))
    .get();
  const clock = jobClock(job?.createdAt ?? now, job?.targetStartDate, now);
  const readings = readChart(chart, now, clock);
  return {
    chart,
    readings,
    says: summariseChart(readings),
    raised: readings.filter(
      (reading) => reading.signal === "stuck" || reading.signal === "backslid",
    ),
    clock,
  };
}
