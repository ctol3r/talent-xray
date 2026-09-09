import { afterAll, expect, it } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/lib/db/schema";
import {
  defaultChart,
  renameScope,
  removeScope,
  snapshot,
} from "../../artifact-src/core/hill";
import { readHill, writeHill } from "@/lib/services/hill";
const sqlite = new Database(":memory:");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: "drizzle" });
afterAll(() => sqlite.close());
it("records a rename even when no position changed, without rewriting the old name or unknown", () => {
  let chart = snapshot(defaultChart(), "recruiter", "", "2026-09-08T09:00:00Z");
  const before = chart.scopes[0];
  chart = snapshot(
    renameScope(chart, before.id, "New scope name", "New unknown"),
    "recruiter",
    "",
    "2026-09-08T10:00:00Z",
  );
  expect(chart.history).toHaveLength(2);
  expect(chart.history[0].scopes?.[0]).toEqual(before);
  expect(chart.history[1].scopes?.[0].name).toBe("New scope name");
  chart = removeScope(chart, before.id);
  expect(chart.history[0].scopes?.[0].name).toBe(before.name);
});
it("round-trips historical definitions and retains legacy position-only history", () => {
  const job = db
    .insert(schema.searchProjects)
    .values({ name: "History test", roleTitle: "Recruiter" })
    .returning()
    .get();
  const chart = snapshot(
    defaultChart(),
    "recruiter",
    "Review complete",
    "2026-09-08T09:00:00Z",
  );
  writeHill(db, job.id, chart);
  expect(readHill(db, job.id).history[0].scopes).toEqual(chart.scopes);
  const legacy = {
    ...chart,
    history: chart.history.map((s) => ({
      at: s.at,
      by: s.by,
      positions: s.positions,
      note: s.note,
    })),
  };
  writeHill(db, job.id, legacy);
  expect(readHill(db, job.id).history[0].scopes).toBeUndefined();
});
it("does not disguise corrupt history as a new empty chart", () => {
  db.insert(schema.settings)
    .values({
      key: "hill:corrupt",
      value: { version: 1, scopes: "bad", history: [] },
    })
    .run();
  expect(() => readHill(db, "corrupt")).toThrow(/preserved/);
  expect(
    sqlite.prepare("select value from settings where key='hill:corrupt'").get(),
  ).toEqual({
    value: JSON.stringify({ version: 1, scopes: "bad", history: [] }),
  });
});
it("rejects writes for a nonexistent job", () => {
  expect(() => writeHill(db, "not-a-job", defaultChart())).toThrow(
    /no longer exists/,
  );
  expect(
    sqlite.prepare("select key from settings where key='hill:not-a-job'").get(),
  ).toBeUndefined();
});
