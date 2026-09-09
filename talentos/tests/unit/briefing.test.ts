/**
 * The daily briefing.
 *
 * The product's stated purpose is that someone who has never run a search can
 * run a good one by following it, so the thing worth testing is not that a
 * list renders — it is that the list is honest when there is nothing to
 * report, that the most overdue thing sorts first, that the legal deadline
 * cannot be crowded out, and that a suggestion carries its reasoning.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { candidates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  dailyBriefing,
  dailyReminders,
  dailySuggestions,
  progressSummary,
} from "@/lib/services/briefing";
import { COACHING, craftNoteFor } from "@/lib/domain/coaching";
import { createCandidate } from "@/lib/services/candidates";
import { createSearchProject } from "@/lib/services/search-projects";
import type { DayEvent } from "@/lib/services/daily";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

let db: Db;
let sqlite: Database.Database;
let dir: string;
let projectId: string;

const event = (kind: DayEvent["kind"]): DayEvent => ({
  at: "2026-09-07T09:00:00.000Z",
  kind,
  icon: "•",
  label: "x",
  detail: "y",
  href: "/",
});

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-brief-"));
  sqlite = new Database(path.join(dir, "test.db"));
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema }) as unknown as Db;
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
  const project = await createSearchProject(db, {
    name: "Briefing test",
    roleTitle: "Founding Recruiter",
  });
  projectId = project.id;
});

afterAll(() => {
  sqlite.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("progress is honest about a quiet day", () => {
  it("says nothing happened rather than showing a zero", () => {
    expect(progressSummary([], [])).toContain("Nothing recorded today");
    expect(progressSummary([], [event("person")])).toContain("Yesterday had 1");
  });

  it("compares with yesterday, in both directions", () => {
    expect(progressSummary([event("person"), event("stage")], [])).toContain(
      "2 more than yesterday",
    );
    expect(progressSummary([event("person")], [event("person")])).toContain(
      "the same as yesterday",
    );
    expect(
      progressSummary([event("person")], [event("person"), event("stage")]),
    ).toContain("1 fewer than yesterday");
  });
});

describe("reminders put the latest thing first", () => {
  it("sorts by how overdue, not by kind", async () => {
    const late = await createCandidate(db, {
      searchProjectId: projectId,
      name: "Very Late",
    });
    const soon = await createCandidate(db, {
      searchProjectId: projectId,
      name: "Due Today",
    });
    await db
      .update(candidates)
      .set({ nextAction: "Chase", nextActionDue: "2026-09-01T09:00:00.000Z" })
      .where(eq(candidates.id, late.id));
    await db
      .update(candidates)
      .set({ nextAction: "Call", nextActionDue: "2026-09-07T09:00:00.000Z" })
      .where(eq(candidates.id, soon.id));

    const reminders = await dailyReminders(db, "2026-09-07");
    const followUps = reminders.filter((r) => r.id.startsWith("follow-up:"));
    expect(followUps[0].detail).toContain("Very Late");
    expect(followUps[0].overdueDays).toBeGreaterThan(followUps[1].overdueDays);
    // Days late is stated, not implied by colour alone.
    expect(followUps[0].detail).toMatch(/\d+ days late/);
    expect(followUps[0].tone).toBe("bad");
  });

  it("raises the duty to tell someone you hold their details", async () => {
    const person = await createCandidate(db, {
      searchProjectId: projectId,
      name: "Unnotified Person",
    });
    // Added two months ago and never told.
    await db
      .update(candidates)
      .set({ createdAt: "2026-07-01T09:00:00.000Z" })
      .where(eq(candidates.id, person.id));

    const reminders = await dailyReminders(db, "2026-09-07");
    const notice = reminders.find((r) => r.id === `notice:${person.id}`);
    expect(notice?.title).toContain("Unnotified Person");
    expect(notice?.tone).toBe("bad");
  });

  it("says nothing rather than inventing something", async () => {
    expect(await dailyReminders(db, "2026-01-01")).toEqual([]);
  });
});

describe("a suggestion carries its reasoning", () => {
  it("attaches why it matters and what good looks like", async () => {
    const suggestions = await dailySuggestions(db);
    expect(suggestions.length).toBeGreaterThan(0);
    const first = suggestions[0];
    expect(first.projectName).toBe("Briefing test");
    // A fresh search's first move is always the job description.
    expect(first.id).toBe("add_jd");
    expect(first.why).toContain("derived from this text");
    expect(first.good).toBeTruthy();
  });

  it("never surfaces more than two moves from one search", async () => {
    const suggestions = await dailySuggestions(db);
    const perProject = new Map<string, number>();
    for (const suggestion of suggestions) {
      perProject.set(
        suggestion.projectId,
        (perProject.get(suggestion.projectId) ?? 0) + 1,
      );
    }
    for (const [id, count] of perProject) {
      expect(`${id} → ${count <= 2}`).toBe(`${id} → true`);
    }
  });

  it("never repeats the same move more than twice, whatever the workspace", async () => {
    // Six barely-started searches would otherwise offer the identical first
    // step six times and bury the search that has people in it.
    for (const name of ["Empty A", "Empty B", "Empty C", "Empty D"]) {
      await createSearchProject(db, { name, roleTitle: "Engineer" });
    }
    const suggestions = await dailySuggestions(db);
    const perKind = new Map<string, number>();
    for (const suggestion of suggestions) {
      perKind.set(suggestion.id, (perKind.get(suggestion.id) ?? 0) + 1);
    }
    for (const [id, count] of perKind) {
      expect(`${id} → ${count <= 2}`).toBe(`${id} → true`);
    }
    expect(suggestions.length).toBeLessThanOrEqual(8);
  });

  it("explains itself in craft terms, not software terms", () => {
    // Every reason should describe the recruiting consequence. A reason that
    // only names a screen teaches nothing.
    for (const [id, entry] of Object.entries(COACHING)) {
      expect(`${id} → ${entry.why.length > 60}`).toBe(`${id} → true`);
      expect(`${id} → ${entry.good.length > 20}`).toBe(`${id} → true`);
    }
  });
});

describe("the craft note", () => {
  it("is the same all day and changes between days", () => {
    expect(craftNoteFor("2026-09-07")).toBe(craftNoteFor("2026-09-07"));
    const week = new Set(
      ["01", "02", "03", "04", "05", "06", "07"].map((d) =>
        craftNoteFor(`2026-09-${d}`),
      ),
    );
    expect(week.size).toBeGreaterThan(1);
  });
});

describe("the whole briefing", () => {
  it("assembles without a model, a key or a network call", async () => {
    const briefing = await dailyBriefing(db, "2026-09-07");
    expect(briefing.day).toBe("2026-09-07");
    expect(briefing.summary).toBeTruthy();
    expect(briefing.craftNote).toBeTruthy();
    expect(Array.isArray(briefing.reminders)).toBe(true);
    expect(Array.isArray(briefing.suggestions)).toBe(true);
  });
});
