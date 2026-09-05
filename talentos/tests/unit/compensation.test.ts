import { expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  compensationWorkspace,
  saveCompensation,
} from "@/lib/services/compensation";
import {
  compensationInputSchema,
  parseCompensationFindings,
  recommendCompensation,
  type CompensationInput,
} from "@/lib/core/compensation";
const source = {
  title: "Synthetic source",
  url: "https://one.example/pay",
  quote: "Example range 100000 to 140000",
  dataDate: "2026-06-01",
  role: "Engineer",
  geography: "Boston",
  employmentType: "Employee",
  currency: "USD",
  basis: "annual" as const,
  component: "base" as const,
  low: 100000,
  high: 140000,
  comparability: "Same role and level",
  reviewed: true,
};
const input: CompensationInput = {
  geography: "Boston",
  employmentType: "Employee",
  currency: "USD",
  basis: "annual",
  sources: [
    source,
    { ...source, url: "https://two.example/pay", low: 120000, high: 160000 },
  ],
};
it("calculates a transparent provisional band and never imports approval", () => {
  expect(recommendCompensation(input, "2026-09-05").range).toEqual({
    low: 110000,
    high: 150000,
  });
  const sources = parseCompensationFindings({ sources: input.sources });
  expect(sources.every((s) => !s.reviewed)).toBe(true);
  expect(
    recommendCompensation({ ...input, sources }, "2026-09-05").range,
  ).toBeNull();
});
it.each([
  { currency: "EUR" },
  { basis: "hourly" },
  { component: "total" },
  { geography: "London" },
  { employmentType: "Contractor" },
  { dataDate: "2020-01-01" },
  { dataDate: "2027-01-01" },
  { reviewed: false },
  { url: "https://one.example/pay?tracking=2" },
])(
  "withholds ranges with mismatched, stale, future, duplicate or unreviewed evidence: %j",
  (patch) => {
    const result = recommendCompensation(
      { ...input, sources: [source, { ...input.sources[1], ...patch }] },
      "2026-09-05",
    );
    expect(result.range).toBeNull();
  },
);
it("rejects invalid ranges, unsafe URLs and invalid dates", () => {
  for (const patch of [
    { low: 170000 },
    { low: 0 },
    { url: "javascript:alert(1)" },
    { dataDate: "2026-02-30" },
  ])
    expect(
      compensationInputSchema.safeParse({
        ...input,
        sources: [{ ...source, ...patch }],
      }).success,
    ).toBe(false);
});
it("persists after restart, suppresses stale role recommendations and rejects a stale writer", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "talentos-compensation-"));
  const file = path.join(dir, "test.db");
  let sqlite = new Database(file);
  try {
    let db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: "drizzle" });
    db.insert(schema.searchProjects)
      .values({
        id: "salary-search",
        name: "Fixture",
        roleTitle: "Engineer",
        geography: "Boston",
        compensationNote: "Owner budget unchanged",
      })
      .run();
    const w = compensationWorkspace(db, "salary-search");
    saveCompensation(db, {
      projectId: "salary-search",
      contextHash: w.contextHash,
      input,
    });
    sqlite.close();
    sqlite = new Database(file);
    db = drizzle(sqlite, { schema });
    expect(compensationWorkspace(db, "salary-search").saved?.input).toEqual(
      input,
    );
    expect(
      db.select().from(schema.searchProjects).get()?.compensationNote,
    ).toBe("Owner budget unchanged");
    db.update(schema.searchProjects)
      .set({ roleTitle: "Executive" })
      .where(eq(schema.searchProjects.id, "salary-search"))
      .run();
    expect(compensationWorkspace(db, "salary-search")).toMatchObject({
      stale: true,
      recommendation: null,
    });
    expect(() =>
      saveCompensation(db, {
        projectId: "salary-search",
        contextHash: w.contextHash,
        input,
      }),
    ).toThrow(/context changed/);
    expect(() => compensationWorkspace(db, "missing")).toThrow(/not found/);
  } finally {
    sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
