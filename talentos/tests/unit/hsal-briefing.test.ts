/**
 * HSAL in the daily briefing.
 *
 * The rule this file exists to hold: HSAL adds, and is never required. Every
 * way it can be absent — unconfigured, unreachable, nothing bound, a case
 * that errors — must produce an empty list and no thrown error, because the
 * briefing is the first thing a recruiter sees each morning and a paired
 * research tool being down is not their problem.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import {
  STALE_BELIEF_DAYS,
  beliefPrompt,
  staleBeliefs,
} from "@/lib/services/hsal-briefing";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

let db: Db;
let sqlite: Database.Database;
let dir: string;
const originalToken = process.env.HSAL_TOKEN;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-hsal-brief-"));
  sqlite = new Database(path.join(dir, "test.db"));
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema }) as unknown as Db;
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
});

afterEach(() => {
  if (originalToken === undefined) delete process.env.HSAL_TOKEN;
  else process.env.HSAL_TOKEN = originalToken;
});

afterAll(() => {
  sqlite.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("HSAL adds and is never required", () => {
  it("returns nothing, and does not throw, when it is not configured", async () => {
    delete process.env.HSAL_TOKEN;
    await expect(staleBeliefs(db, "2026-09-07T23:59:59.999Z")).resolves.toEqual(
      [],
    );
  });

  it("returns nothing when nothing is bound to a decision case", async () => {
    // Even with a token, an unbound workspace has no beliefs to nudge about.
    process.env.HSAL_TOKEN = "hsal_test_token";
    await expect(staleBeliefs(db, "2026-09-07T23:59:59.999Z")).resolves.toEqual(
      [],
    );
  });
});

describe("the nudge itself", () => {
  it("says how sure you were and how long ago, without moving the number", () => {
    const line = beliefPrompt({
      id: "b1",
      projectId: "p1",
      projectName: "CAIS — Founding Recruiter",
      statement: "The market is supply constrained",
      confidence: 0.76,
      status: "active",
      updatedAt: "2026-08-01T00:00:00.000Z",
      ageDays: 37,
      href: "/searches/p1/diagnosis",
    });
    expect(line).toContain("76%");
    expect(line).toContain("37 days ago");
    // A nudge, not a correction: it must not tell them what to believe.
    expect(line.toLowerCase()).not.toContain("should");
    expect(line.toLowerCase()).not.toContain("wrong");
  });

  it("says when a belief is contested", () => {
    const line = beliefPrompt({
      id: "b2",
      projectId: "p1",
      projectName: "x",
      statement: "y",
      confidence: 0.3,
      status: "contested",
      updatedAt: "2026-08-01T00:00:00.000Z",
      ageDays: 20,
      href: "/x",
    });
    expect(line).toContain("contested");
  });

  it("waits a fortnight before nudging", () => {
    // Short enough that a belief cannot quietly rot; long enough that it is
    // not nagging about something decided last week.
    expect(STALE_BELIEF_DAYS).toBeGreaterThanOrEqual(7);
    expect(STALE_BELIEF_DAYS).toBeLessThanOrEqual(30);
  });
});
