/**
 * A job's activity, read out of the records.
 *
 * Nothing is written to produce this. Every cell in the strip and every
 * slice of the bar is a row that already existed — a person added, a stage
 * moved, an address kept, a learning recorded, a note changed. That matters
 * because an activity graph nobody can trace is a vanity metric, and this
 * one can be pointed at.
 */
import { and, eq, gte } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  candidates,
  candidateSources,
  pipelineEvents,
  searchLearnings,
  searchProjects,
} from "@/lib/db/schema";
import {
  ACTIVITY_DAYS,
  activityStrip,
  activitySummary,
  pipelineBar,
  shiftDay,
  type ActivityCell,
  type ActivityEvent,
  type StageSlice,
} from "@/lib/domain/activity-bar";
import { dayBounds } from "../../../artifact-src/core/day";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/domain/pipeline";

export interface JobActivity {
  cells: ActivityCell[];
  summary: string;
  slices: StageSlice[];
  people: number;
}

export function jobActivity(
  db: Db,
  searchProjectId: string,
  today: string,
): JobActivity {
  // The instant the first cell's day began where the reader is, not where
  // Greenwich is — otherwise the query's window and the strip's buckets are
  // offset from each other and the oldest column is always short.
  const from = dayBounds(shiftDay(today, -(ACTIVITY_DAYS - 1))).from;
  const events: ActivityEvent[] = [];

  const people = db
    .select()
    .from(candidates)
    .where(eq(candidates.searchProjectId, searchProjectId))
    .all();
  for (const person of people) {
    if (person.createdAt >= from) {
      events.push({ at: person.createdAt, kind: "person" });
    }
    // A note that was edited after the person was added is a day's work too.
    if (person.updatedAt >= from && person.updatedAt !== person.createdAt) {
      events.push({ at: person.updatedAt, kind: "note" });
    }
  }

  for (const move of db
    .select()
    .from(pipelineEvents)
    .where(
      and(
        eq(pipelineEvents.searchProjectId, searchProjectId),
        gte(pipelineEvents.occurredAt, from),
      ),
    )
    .all()) {
    events.push({ at: move.occurredAt, kind: "stage" });
  }

  const ids = new Set(people.map((person) => person.id));
  for (const source of db.select().from(candidateSources).all()) {
    if (!ids.has(source.candidateId) || source.createdAt < from) continue;
    events.push({ at: source.createdAt, kind: "source" });
  }

  for (const learning of db
    .select()
    .from(searchLearnings)
    .where(
      and(
        eq(searchLearnings.searchProjectId, searchProjectId),
        gte(searchLearnings.createdAt, from),
      ),
    )
    .all()) {
    events.push({ at: learning.createdAt, kind: "learning" });
  }

  const project = db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.id, searchProjectId))
    .get();
  if (project && project.createdAt >= from) {
    events.push({ at: project.createdAt, kind: "note" });
  }

  const counts = new Map<string, number>();
  for (const person of people) {
    counts.set(person.stage, (counts.get(person.stage) ?? 0) + 1);
  }

  const cells = activityStrip(events, today);
  const bar = pipelineBar(
    DEFAULT_PIPELINE_STAGES.map((stage) => ({
      key: stage.key,
      label: stage.label,
    })),
    counts,
  );
  return {
    cells,
    summary: activitySummary(cells),
    slices: bar.slices,
    people: people.length,
  };
}
