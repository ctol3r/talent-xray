/** CLI entry: `pnpm db:migrate` — applies committed migrations in drizzle/. */
import { getDb } from "./client";

getDb();
console.log("Migrations applied.");
