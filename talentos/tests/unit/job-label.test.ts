/**
 * A job is a unique title and a location.
 *
 * Unique because a title is how a job is named in a list, in the recall menu
 * and inside `[[a title]]` in a note — two identical ones make all three
 * ambiguous. Location because it is what separates two jobs faster than
 * anything else on the record.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import {
  jobLabel,
  jobLocation,
  jobTitleKey,
  sameJobTitle,
} from "@/lib/domain/job-label";
import {
  createSearchProject,
  updateSearchProject,
} from "@/lib/services/search-projects";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

let db: Db;
let sqlite: Database.Database;
let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-jobs-"));
  sqlite = new Database(path.join(dir, "test.db"));
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema }) as unknown as Db;
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
});

afterAll(() => {
  sqlite.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("two titles are the same title when a reader would say so", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(
      sameJobTitle("CAIS — Founding Recruiter", "cais founding recruiter"),
    ).toBe(true);
    expect(jobTitleKey("CAIS  —  Founding   Recruiter")).toBe(
      "cais founding recruiter",
    );
  });

  it("keeps genuinely different titles apart", () => {
    expect(sameJobTitle("Founding Recruiter", "Founding Recruiter II")).toBe(
      false,
    );
  });
});

describe("a job is shown with where it is", () => {
  it("pairs the title with the location", () => {
    expect(
      jobLabel({
        name: "CAIS — Founding Recruiter",
        geography: "San Francisco",
      }),
    ).toBe("CAIS — Founding Recruiter · San Francisco");
  });

  it("says the location is missing rather than showing a dash", () => {
    expect(jobLocation({ name: "x", geography: "  " })).toBe(
      "Location not set",
    );
    expect(jobLocation({ name: "x" })).toBe("Location not set");
  });
});

describe("the workspace refuses a duplicate title", () => {
  it("refuses on create, and names the job already using it", async () => {
    await createSearchProject(db, {
      name: "CAIS — Founding Recruiter",
      roleTitle: "Founding Recruiter",
      geography: "San Francisco",
    });
    await expect(
      createSearchProject(db, {
        name: "cais   founding recruiter",
        roleTitle: "Founding Recruiter",
      }),
    ).rejects.toThrow(/CAIS — Founding Recruiter.*already exists/s);
  });

  it("refuses on rename, but lets a job keep its own title", async () => {
    const other = await createSearchProject(db, {
      name: "GitLab — Talent Brand Manager",
      roleTitle: "Talent Brand Manager",
    });
    await expect(
      updateSearchProject(db, {
        id: other.id,
        name: "CAIS — Founding Recruiter",
      }),
    ).rejects.toThrow(/already exists/);
    // Saving a job without changing its title is not a collision with itself.
    await expect(
      updateSearchProject(db, {
        id: other.id,
        name: "GitLab — Talent Brand Manager",
        geography: "Remote",
      }),
    ).resolves.toBeTruthy();
  });
});
