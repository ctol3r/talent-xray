/**
 * Movement for every open job, in one pass.
 *
 * Deliberately one query per table for the whole desk rather than per job:
 * the jobs page already calls `jobActivity` once per row, and adding a second
 * per-row read would make opening a list of twenty jobs forty round trips.
 *
 * Nothing is written to produce any of this. Every event counted is a row that
 * already existed — a task somebody ticked, a person somebody moved, a person
 * somebody added — which is what makes the number pointable-at rather than a
 * vanity metric.
 */
import type { Db } from "@/lib/db/client";
import { candidates, pipelineEvents, tasks } from "@/lib/db/schema";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/domain/pipeline";
import { jobClock, type JobClock } from "../../../artifact-src/core/clock";
import {
  median,
  movementReading,
  summariseMovement,
  type MovementEvent,
  type MovementReading,
} from "../../../artifact-src/core/movement";

const POSITION = new Map(
  DEFAULT_PIPELINE_STAGES.map((stage) => [stage.key, stage.position]),
);

/**
 * Forward or back.
 *
 * A move whose stages are not in the default set — a project with its own
 * stages — is counted as an advance rather than dropped: something happened to
 * a person, and refusing to count it because the stage list was customised
 * would make those jobs look quieter than they are.
 */
function directionOf(from: string | null, to: string): "advance" | "retreat" {
  const before = from === null ? -1 : (POSITION.get(from) ?? -1);
  const after = POSITION.get(to) ?? before + 1;
  return after < before ? "retreat" : "advance";
}

export interface JobMovement extends MovementReading {
  jobId: string;
  /** The window agreed at intake, and what it does to this job's thresholds. */
  clock: JobClock;
}

export interface DeskMovement {
  /** One per job, in the order the jobs were given. */
  readings: JobMovement[];
  values: number[];
  median: number;
  says: string;
  /**
   * Jobs with no agreed start date, measured on a default fortnight nobody
   * asked for. Counted so the page can say so: a measure resting on an
   * assumption should say which jobs it is assuming about.
   */
  unclocked: number;
}

export function deskMovement(
  db: Db,
  jobs: {
    id: string;
    createdAt?: string | null;
    targetStartDate?: string | null;
  }[],
  now = new Date().toISOString(),
): DeskMovement {
  const wanted = new Set(jobs.map((job) => job.id));
  const events = new Map<string, MovementEvent[]>();
  const add = (jobId: string | null, event: MovementEvent) => {
    if (!jobId || !wanted.has(jobId)) return;
    const list = events.get(jobId);
    if (list) list.push(event);
    else events.set(jobId, [event]);
  };

  for (const task of db.select().from(tasks).all()) {
    // Only finished ones: an open task is something owed, not something moved.
    if (task.status !== "done" || !task.completedAt) continue;
    add(task.searchProjectId, { at: task.completedAt, kind: "task" });
  }

  for (const move of db.select().from(pipelineEvents).all()) {
    add(move.searchProjectId, {
      at: move.occurredAt,
      kind: directionOf(move.fromStage, move.toStage),
    });
  }

  for (const person of db.select().from(candidates).all()) {
    add(person.searchProjectId, { at: person.createdAt, kind: "person" });
  }

  const readings = jobs.map((job) => {
    const opened = job.createdAt ?? now;
    const clock = jobClock(opened, job.targetStartDate, now);
    return {
      jobId: job.id,
      clock,
      ...movementReading(events.get(job.id) ?? [], opened, now, clock),
    };
  });
  const values = readings.map((reading) => reading.value);

  return {
    readings,
    values,
    median: median(values),
    says: summariseMovement(values),
    unclocked: readings.filter((r) => r.clock.agreedDays === null).length,
  };
}
