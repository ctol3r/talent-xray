/**
 * Daily notes: a page per day, like Roam's.
 *
 * Two halves, and the split is the point. The top half is written by you —
 * one free-text note per date, stored under a `daily:<date>` settings key, so
 * there is no migration and no new table. The bottom half is not written by
 * anyone: it is what the records themselves say happened that day, read back
 * out of the database. A person added, a job opened, a stage moved, a note
 * changed, a source kept, a learning recorded.
 *
 * That means a day is never empty because you forgot to journal. The work
 * already left a trail; this reads it.
 *
 * References written in the note (`[[a page]]`, `@person`, `jj job`) are
 * ordinary page references (D-039), so today's note appears on the person's
 * tag page and on the tag pages of every word in it.
 */
import { and, eq, gte, lt } from "drizzle-orm";
import { z } from "zod";
import {
  dayBounds,
  dayOf,
  dayTitle,
  shiftDay,
  todayKey,
} from "../../../artifact-src/core/day";
import type { Db } from "@/lib/db/client";
import {
  candidates,
  candidateSources,
  pipelineEvents,
  searchLearnings,
  searchProjects,
  settings,
} from "@/lib/db/schema";

/** A calendar day, `YYYY-MM-DD`, in the reader's own timezone. */
export const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export { dayOf, dayTitle, shiftDay, todayKey };

const noteValue = z.object({
  version: z.literal(1),
  text: z.string().max(20000),
});

export function readDailyNote(db: Db, day: string): string {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, `daily:${day}`))
    .get();
  if (!row) return "";
  const parsed = noteValue.safeParse(row.value);
  return parsed.success ? parsed.data.text : "";
}

export function writeDailyNote(db: Db, day: string, text: string): void {
  const value = noteValue.parse({ version: 1, text });
  db.insert(settings)
    .values({ key: `daily:${dayKey.parse(day)}`, value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date().toISOString() },
    })
    .run();
}

export interface DayEvent {
  at: string;
  kind: "job" | "person" | "stage" | "source" | "learning";
  icon: string;
  label: string;
  detail: string;
  href: string;
}

const KIND_ICON: Record<DayEvent["kind"], string> = {
  job: "💼",
  person: "👤",
  stage: "🪜",
  source: "🔗",
  learning: "📚",
};

/**
 * What the records say happened on this day. Read, never written; ordered
 * newest last so the day reads forwards.
 */
export function dayEvents(db: Db, day: string): DayEvent[] {
  const { from, to } = dayBounds(day);
  const projects = db.select().from(searchProjects).all();
  const projectName = new Map(projects.map((row) => [row.id, row.name]));
  const out: DayEvent[] = [];

  for (const project of projects) {
    if (project.createdAt >= from && project.createdAt < to) {
      out.push({
        at: project.createdAt,
        kind: "job",
        icon: KIND_ICON.job,
        label: project.name,
        detail: `Job opened · ${project.roleTitle}`,
        href: `/searches/${project.id}`,
      });
    }
  }

  const people = db
    .select()
    .from(candidates)
    .where(and(gte(candidates.createdAt, from), lt(candidates.createdAt, to)))
    .all();
  for (const person of people) {
    out.push({
      at: person.createdAt,
      kind: "person",
      icon: KIND_ICON.person,
      label: person.name,
      detail: `Added to ${projectName.get(person.searchProjectId) ?? "a job"}`,
      href: `/searches/${person.searchProjectId}/candidates/${person.id}`,
    });
  }

  const moves = db
    .select()
    .from(pipelineEvents)
    .where(
      and(
        gte(pipelineEvents.occurredAt, from),
        lt(pipelineEvents.occurredAt, to),
      ),
    )
    .all();
  const peopleById = new Map(
    db
      .select()
      .from(candidates)
      .all()
      .map((person) => [person.id, person]),
  );
  for (const move of moves) {
    const person = move.candidateId ? peopleById.get(move.candidateId) : null;
    out.push({
      at: move.occurredAt,
      kind: "stage",
      icon: KIND_ICON.stage,
      label: person?.name ?? "Someone",
      detail: `${move.fromStage ?? "new"} → ${move.toStage}`,
      href: person
        ? `/searches/${person.searchProjectId}/candidates/${person.id}`
        : `/searches/${move.searchProjectId}/pipeline`,
    });
  }

  const kept = db
    .select()
    .from(candidateSources)
    .where(
      and(
        gte(candidateSources.createdAt, from),
        lt(candidateSources.createdAt, to),
      ),
    )
    .all();
  for (const source of kept) {
    const person = peopleById.get(source.candidateId);
    if (!person) continue;
    out.push({
      at: source.createdAt,
      kind: "source",
      icon: KIND_ICON.source,
      label: person.name,
      detail: `Address kept · ${source.url.slice(0, 60)}`,
      href: `/searches/${person.searchProjectId}/candidates/${person.id}`,
    });
  }

  const learnings = db
    .select()
    .from(searchLearnings)
    .where(
      and(
        gte(searchLearnings.createdAt, from),
        lt(searchLearnings.createdAt, to),
      ),
    )
    .all();
  for (const learning of learnings) {
    out.push({
      at: learning.createdAt,
      kind: "learning",
      icon: KIND_ICON.learning,
      label: projectName.get(learning.searchProjectId) ?? "A search",
      detail: learning.text.slice(0, 140),
      href: `/searches/${learning.searchProjectId}/learnings`,
    });
  }

  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/** Which days in a month have anything on them, for the calendar. */
export function daysWithActivity(db: Db, month: string): Set<string> {
  const days = new Set<string>();
  // By the day the reader lived through, not the day in Greenwich — the
  // calendar's dots have to agree with the page each dot opens.
  const stamp = (value: string | null | undefined) => {
    if (!value) return;
    const day = dayOf(value);
    if (day.startsWith(month)) days.add(day);
  };
  for (const row of db.select().from(searchProjects).all())
    stamp(row.createdAt);
  for (const row of db.select().from(candidates).all()) stamp(row.createdAt);
  for (const row of db.select().from(pipelineEvents).all())
    stamp(row.occurredAt);
  for (const row of db.select().from(candidateSources).all())
    stamp(row.createdAt);
  for (const row of db.select().from(searchLearnings).all())
    stamp(row.createdAt);
  for (const row of db.select().from(settings).all()) {
    if (row.key.startsWith(`daily:${month}`)) days.add(row.key.slice(6));
  }
  return days;
}

export interface DailyWorkspace {
  day: string;
  title: string;
  note: string;
  events: DayEvent[];
  previous: string;
  next: string;
  month: string;
  activeDays: string[];
}

export function dailyWorkspace(db: Db, day: string): DailyWorkspace {
  const key = dayKey.parse(day);
  const month = key.slice(0, 7);
  return {
    day: key,
    title: dayTitle(key),
    note: readDailyNote(db, key),
    events: dayEvents(db, key),
    previous: shiftDay(key, -1),
    next: shiftDay(key, 1),
    month,
    activeDays: [...daysWithActivity(db, month)].sort(),
  };
}

/**
 * The days, as one scroll.
 *
 * A journal is not a page per day with arrows between them — it is a roll you
 * unwind, and the day you want is usually two days up rather than four clicks
 * away. So the calendar reads as a continuous run of days, newest first, and
 * every one of them is writable where it sits.
 *
 * Empty days are included on purpose. They cost one line each and they are
 * what makes it a scroll rather than a list of the days somebody happened to
 * write on: the gap between last Tuesday and this one is information, and a
 * list that closes the gap hides it.
 */
export interface StreamDay {
  day: string;
  title: string;
  note: string;
  /** Cheap enough to compute per day, and the reason a quiet day is legible. */
  events: DayEvent[];
}

export const STREAM_BATCH = 10;

export function dayStream(
  db: Db,
  from: string,
  count = STREAM_BATCH,
): StreamDay[] {
  const first = dayKey.parse(from);
  const days: StreamDay[] = [];
  for (let step = 0; step < Math.min(count, 60); step += 1) {
    const day = step === 0 ? first : shiftDay(first, -step);
    days.push({
      day,
      title: dayTitle(day),
      note: readDailyNote(db, day),
      events: dayEvents(db, day),
    });
  }
  return days;
}
