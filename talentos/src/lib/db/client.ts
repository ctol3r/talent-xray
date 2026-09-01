import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

/**
 * Local-first: one SQLite file, created on demand, migrated on first touch.
 * Backup = copy the file. Auto-migration is safe here — single user, local
 * disk, additive migrations (see docs/DECISIONS.md D-002).
 */
function resolveDatabasePath(): string {
  const configured = process.env.TALENTOS_DATABASE_PATH ?? "./data/talentos.db";
  return path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
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
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: migrationsFolder() });
  return db;
}

/** Singleton across Next.js hot reloads. */
export function getDb(): Db {
  if (!globalThis.__talentosDb) {
    globalThis.__talentosDb = createDb();
  }
  return globalThis.__talentosDb;
}
