/**
 * Delete a search and everything under it.
 *
 *   pnpm purge:search --list                 → what is in the database
 *   pnpm purge:search --prefix "Smoke — "    → delete every search so named
 *   pnpm purge:search <id> [<id>…]           → delete these searches
 *
 * Always writes a timestamped copy of the database first. Deletion is the one
 * thing in this app that cannot be undone, so it takes a backup it does not
 * ask permission for and prints where it went.
 *
 * This exists because the end-to-end check (`pnpm smoke`) used to write its
 * fixtures into whichever database it found, which meant a run left five
 * "Smoke — …" searches sitting in real work. The check now uses its own file;
 * this cleans up what the old behaviour left behind.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dbPath = path.resolve(
  process.env.TALENTOS_DATABASE_PATH ?? "./data/talentos.db",
);
if (!fs.existsSync(dbPath)) {
  console.error(`No database at ${dbPath}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

interface Row {
  id: string;
  name: string;
  people: number;
}

const searches = db
  .prepare(
    `SELECT s.id, s.name,
            (SELECT COUNT(*) FROM candidates c WHERE c.search_project_id = s.id) AS people
     FROM search_projects s ORDER BY s.created_at`,
  )
  .all() as Row[];

if (args.length === 0 || args[0] === "--list") {
  console.log(`${searches.length} searches in ${dbPath}\n`);
  for (const row of searches) {
    console.log(
      `  ${row.id}  ${String(row.people).padStart(3)} people  ${row.name}`,
    );
  }
  process.exit(0);
}

let targets: Row[];
if (args[0] === "--prefix") {
  const prefix = args[1];
  if (!prefix) {
    console.error('Usage: pnpm purge:search --prefix "Smoke — "');
    process.exit(1);
  }
  targets = searches.filter((row) => row.name.startsWith(prefix));
} else {
  const wanted = new Set(args);
  targets = searches.filter((row) => wanted.has(row.id));
}

if (targets.length === 0) {
  console.log("Nothing matched. Database untouched.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backup = dbPath.replace(/\.db$/, `.backup-${stamp}.db`);
fs.copyFileSync(dbPath, backup);
console.log(`backup: ${backup}\n`);

/** Every table carrying a search or candidate reference, children first. */
const tables = db
  .prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
  )
  .all() as { name: string }[];

const byProject: string[] = [];
const byCandidate: string[] = [];
for (const table of tables) {
  if (table.name === "search_projects" || table.name === "candidates") continue;
  const columns = (
    db.prepare(`PRAGMA table_info("${table.name}")`).all() as { name: string }[]
  ).map((column) => column.name);
  if (columns.includes("search_project_id")) byProject.push(table.name);
  else if (columns.includes("candidate_id")) byCandidate.push(table.name);
}

const ids = targets.map((row) => row.id);
const placeholders = ids.map(() => "?").join(",");
const candidateIds = (
  db
    .prepare(
      `SELECT id FROM candidates WHERE search_project_id IN (${placeholders})`,
    )
    .all(...ids) as { id: string }[]
).map((row) => row.id);

const purge = db.transaction(() => {
  let removed = 0;
  if (candidateIds.length > 0) {
    const candidatePlaceholders = candidateIds.map(() => "?").join(",");
    for (const table of byCandidate) {
      removed += db
        .prepare(
          `DELETE FROM "${table}" WHERE candidate_id IN (${candidatePlaceholders})`,
        )
        .run(...candidateIds).changes;
    }
  }
  for (const table of byProject) {
    removed += db
      .prepare(
        `DELETE FROM "${table}" WHERE search_project_id IN (${placeholders})`,
      )
      .run(...ids).changes;
  }
  removed += db
    .prepare(
      `DELETE FROM candidates WHERE search_project_id IN (${placeholders})`,
    )
    .run(...ids).changes;
  removed += db
    .prepare(`DELETE FROM search_projects WHERE id IN (${placeholders})`)
    .run(...ids).changes;
  return removed;
});

for (const row of targets) {
  console.log(`  removing  ${row.name}  (${row.people} people)`);
}
const removed = purge();
db.close();
console.log(
  `\nremoved ${targets.length} searches and ${removed} related rows.`,
);
