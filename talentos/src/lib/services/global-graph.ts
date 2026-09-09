/**
 * The whole-workspace graph.
 *
 * Every job in one picture, which is the thing Neo4j is here for: a tag
 * written on a job in one search and on a person in another is a single edge
 * here and nowhere else. The per-job page keeps its own in-process
 * projection, which is faster and needs nothing installed; this is the view
 * that only exists when the store is paired.
 *
 * Reads only. The graph is rebuilt from SQLite by `syncGraph`, so Neo4j is
 * never a system of record and nothing is lost if the container is thrown
 * away.
 */
import type { Db } from "@/lib/db/client";
import { neo4jReachable, neo4jSettings } from "@/lib/graph/driver";
import {
  ensureSchema,
  graphCounts,
  syncGraph,
  wholeGraph,
} from "@/lib/graph/store";
import type { GraphEdge, GraphNode } from "@/lib/core/knowledge-graph";
import { listSearchProjects } from "./search-projects";
import { knowledgeGraph } from "./knowledge-graph";

export interface GlobalGraphView {
  configured: boolean;
  reachable: boolean;
  detail: string;
  uri?: string;
  counts?: { nodes: number; edges: number; tags: number };
  graph?: { nodes: GraphNode[]; edges: GraphEdge[] };
  /** The command to run if it is off, so the page can say it. */
  howToStart: string[];
}

export const HOW_TO_START = [
  "docker run -d --name talentos-neo4j -p 7474:7474 -p 7687:7687 \\",
  "  -e NEO4J_AUTH=neo4j/talentos-local-dev \\",
  "  -v neo4j-data:/data -v neo4j-logs:/logs neo4j:2026.07.1",
  "",
  "Then set NEO4J_URI and NEO4J_PASSWORD in .env and press Sync.",
];

export async function globalGraphView(): Promise<GlobalGraphView> {
  const settings = neo4jSettings();
  if (!settings) {
    return {
      configured: false,
      reachable: false,
      detail:
        "Not configured. Every job still has its own graph; this is the view that puts them in one picture.",
      howToStart: HOW_TO_START,
    };
  }
  const status = await neo4jReachable();
  if (!status.ok) {
    return {
      configured: true,
      reachable: false,
      detail: status.detail,
      uri: settings.uri,
      howToStart: HOW_TO_START,
    };
  }
  return {
    configured: true,
    reachable: true,
    detail: status.detail,
    uri: settings.uri,
    counts: await graphCounts(),
    graph: await wholeGraph(),
    howToStart: HOW_TO_START,
  };
}

/**
 * Push every job's projection into the store. Idempotent — a node already
 * there is updated, not duplicated — so pressing it twice is harmless.
 */
export async function syncWholeGraph(
  db: Db,
): Promise<{ jobs: number; nodes: number; edges: number }> {
  await ensureSchema();
  const projects = await listSearchProjects(db);
  let nodes = 0;
  let edges = 0;
  for (const project of projects) {
    const written = await syncGraph(project.id, knowledgeGraph(db, project.id));
    nodes += written.nodes;
    edges += written.edges;
  }
  return { jobs: projects.length, nodes, edges };
}
