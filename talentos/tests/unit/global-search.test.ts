/**
 * One search across everything. The point is that the query language behaves
 * the same wherever it is typed: a filter narrows a job list the way it narrows
 * a shortlist, and an exclusion excludes.
 */
import { afterAll, describe, expect, it } from "vitest";
import { globalSearch } from "@/lib/services/global-search";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/lib/db/schema";
const sqlite = new Database(":memory:");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: "drizzle" });
db.insert(schema.searchProjects)
  .values({ name: "Synthetic recruiter", roleTitle: "Recruiter" })
  .run();
afterAll(() => sqlite.close());

describe("globalSearch", () => {
  it("returns nothing, rather than everything, for a query nothing answers", () => {
    const result = globalSearch(db, "zzzzznotathinganywhere");
    expect(result.hits).toEqual([]);
  });

  it("hands back how it read the query", () => {
    const result = globalSearch(db, "loc:london recruiter -closed");
    expect(result.reading.join(" ")).toMatch(/locations: london/);
    expect(result.reading.join(" ")).toMatch(/excluding terms: closed/);
  });

  it("scores every hit and names what matched", () => {
    const result = globalSearch(db, "recruiter");
    for (const hit of result.hits) {
      expect(hit.score).toBeGreaterThan(0);
      expect(hit.score).toBeLessThanOrEqual(1);
      expect(hit.href.startsWith("/")).toBe(true);
      expect(hit.matched.length).toBeGreaterThan(0);
    }
  });

  it("excludes a row containing a negated term", () => {
    const all = globalSearch(db, "recruiter");
    const filtered = globalSearch(db, "recruiter -recruiter");
    expect(filtered.hits.length).toBeLessThan(all.hits.length);
  });

  it("counts hits by kind", () => {
    const result = globalSearch(db, "recruiter");
    const summed = Object.values(result.counts).reduce((a, b) => a + b, 0);
    expect(summed).toBe(result.hits.length);
  });

  it("reports an unreadable filter rather than silently dropping it", () => {
    expect(globalSearch(db, "wibble:thing").warnings.join(" ")).toMatch(
      /unknown filter/,
    );
  });
});
