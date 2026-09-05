import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { expect, it } from "vitest";
import { getDb } from "@/lib/db/client";
it("leaves an existing database untouched until explicit migration opt-in", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "document-migration-")),
    folder = path.join(dir, "old");
  mkdirSync(path.join(folder, "meta"), { recursive: true });
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  ) as { entries: { idx: number; tag: string; when: number }[] };
  journal.entries = journal.entries.filter((e) => e.idx < 4);
  writeFileSync(
    path.join(folder, "meta/_journal.json"),
    JSON.stringify(journal),
  );
  for (const entry of journal.entries)
    copyFileSync(
      `drizzle/${entry.tag}.sql`,
      path.join(folder, `${entry.tag}.sql`),
    );
  const file = path.join(dir, "old.db");
  const original = new Database(file);
  migrate(drizzle(original), { migrationsFolder: folder });
  original.close();
  const prior = process.env.TALENTOS_DATABASE_PATH,
    permission = process.env.TALENTOS_ALLOW_MIGRATIONS;
  process.env.TALENTOS_DATABASE_PATH = file;
  delete process.env.TALENTOS_ALLOW_MIGRATIONS;
  globalThis.__talentosDb = undefined;
  try {
    expect(() => getDb()).toThrow(/No migration was applied/);
    const untouched = new Database(file, { readonly: true });
    expect(
      untouched
        .prepare(
          "SELECT name FROM sqlite_master WHERE name='document_versions'",
        )
        .get(),
    ).toBeUndefined();
    untouched.close();
    process.env.TALENTOS_ALLOW_MIGRATIONS = "1";
    expect(() => getDb()).not.toThrow();
    const updated = new Database(file, { readonly: true });
    expect(
      updated
        .prepare(
          "SELECT name FROM sqlite_master WHERE name='document_versions'",
        )
        .get(),
    ).toBeTruthy();
    expect(updated.pragma("integrity_check")).toEqual([
      { integrity_check: "ok" },
    ]);
    updated.close();
  } finally {
    globalThis.__talentosDb = undefined;
    if (prior === undefined) delete process.env.TALENTOS_DATABASE_PATH;
    else process.env.TALENTOS_DATABASE_PATH = prior;
    if (permission === undefined) delete process.env.TALENTOS_ALLOW_MIGRATIONS;
    else process.env.TALENTOS_ALLOW_MIGRATIONS = permission;
    rmSync(dir, { recursive: true, force: true });
  }
});
