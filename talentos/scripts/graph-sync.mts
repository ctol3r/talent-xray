/**
 * Push every search's graph into Neo4j, then report what the graph can now
 * answer that a per-search projection cannot.
 *
 *   pnpm graph:sync          → sync all searches and print the summary
 *   pnpm graph:sync <tag>    → also list everything carrying that tag
 *
 * Reads SQLite, writes Neo4j. The records stay where they are.
 */
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/lib/db/client";

// Scripts do not get Next's env loading, so read .env the way the other
// scripts in this directory do.
const envFile = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
import { listSearchProjects } from "../src/lib/services/search-projects";
import { knowledgeGraph } from "../src/lib/services/knowledge-graph";
import {
  neo4jConfigured,
  neo4jReachable,
  closeDriver,
} from "../src/lib/graph/driver";
import {
  ensureSchema,
  syncGraph,
  tagCarriers,
  within,
} from "../src/lib/graph/store";

if (!neo4jConfigured()) {
  console.log(
    "Neo4j is not configured. Set NEO4J_URI and NEO4J_PASSWORD in .env.\n" +
      "The in-process graph works without it; Neo4j is what makes the graph global.",
  );
  process.exit(0);
}

const reachable = await neo4jReachable();
if (!reachable.ok) {
  console.error(`Neo4j is configured but unreachable: ${reachable.detail}`);
  process.exit(1);
}
console.log(`connected: ${reachable.detail}`);

await ensureSchema();
const db = getDb();
const projects = await listSearchProjects(db);
let nodes = 0;
let edges = 0;
for (const project of projects) {
  const graph = knowledgeGraph(db, project.id);
  const written = await syncGraph(project.id, graph);
  nodes += written.nodes;
  edges += written.edges;
  console.log(
    `  ${project.name.slice(0, 46).padEnd(48)} ${String(written.nodes).padStart(4)} nodes ${String(written.edges).padStart(4)} edges`,
  );
}
console.log(
  `\nsynced ${projects.length} searches · ${nodes} nodes · ${edges} edges`,
);

const slug = process.argv[2];
if (slug) {
  const carriers = await tagCarriers(slug);
  console.log(`\nEverything carrying #${slug}, across every search:`);
  for (const row of carriers) {
    console.log(`  ${row.kind.padEnd(10)} ${row.label}`);
  }
  const reach = await within(`tag:${slug}`, 2);
  console.log(`\nWithin two hops of #${slug}: ${reach.length} records`);
  for (const row of reach.slice(0, 8)) {
    console.log(
      `  ${String(row.hops)}  ${row.kind.padEnd(10)} ${row.label.slice(0, 44)}  via ${row.pathLabels.join(" → ")}`,
    );
  }
}

await closeDriver();
