/** CLI entry: `pnpm db:migrate` — applies committed migrations in drizzle/. */
import { getDb } from "./client";

process.env.TALENTOS_ALLOW_MIGRATIONS = "1";
getDb();
console.log("Migrations applied.");
