import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { backfillLegacyDocuments } from "@/lib/documents/backfill";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

/**
 * Local SQLite. New databases initialize automatically; existing databases
 * require an explicit migration command before adopting a pending schema.
 */
function resolveDatabasePath(): string {
  const configured = process.env.TALENTOS_DATABASE_PATH ?? "./data/talentos.db";
  return path.isAbsolute(configured)
    ? configured
    : path.join(/* turbopackIgnore: true */ process.cwd(), configured);
}

function migrationsFolder(): string {
  return path.join(process.cwd(), "drizzle");
}

declare global {
  var __talentosDb: Db | undefined;
}

function createDb(): Db {
  const file = resolveDatabasePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existed = fs.existsSync(file);
  const sqlite = new Database(file);
  const journal = JSON.parse(
    fs.readFileSync(
      path.join(migrationsFolder(), "meta/_journal.json"),
      "utf8",
    ),
  ) as { entries: { when: number }[] };
  const hasJournal = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE name = ?")
    .get("__drizzle_migrations");
  const last = hasJournal
    ? (sqlite
        .prepare("SELECT MAX(created_at) AS applied FROM __drizzle_migrations")
        .get() as { applied: number | null })
    : undefined;
  if (
    existed &&
    (last?.applied ?? 0) < Math.max(...journal.entries.map((e) => e.when)) &&
    process.env.TALENTOS_ALLOW_MIGRATIONS !== "1"
  ) {
    sqlite.close();
    throw new Error(
      "Pending database migration. Back up the database and obtain owner authorization, then run pnpm db:migrate. No migration was applied.",
    );
  }
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: migrationsFolder() });
  backfillLegacyDocuments(db);
  return db;
}

/** Singleton across Next.js hot reloads. */
export function getDb(): Db {
  if (!globalThis.__talentosDb) {
    globalThis.__talentosDb = createDb();
  }
  return globalThis.__talentosDb;
}
