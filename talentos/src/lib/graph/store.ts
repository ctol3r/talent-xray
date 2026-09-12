/**
 * The graph in Neo4j: schema, sync, and the queries the app asks.
 *
 * The SQLite records stay the system of record. This is a projection of them
 * pushed into a graph database, rebuilt by `syncGraph`, so nothing here can
 * hold a recruiting fact that the database does not. What it adds is reach:
 * every search in one graph, so a tag written on a job in one search and a
 * person in another is a single edge you can walk, which is the thing the
 * per-search projection can never express.
 *
 * Labelling: every node carries `:Entity` with a unique `id`, plus its own
 * label (`:Candidate`, `:Tag`, …). MERGE runs against the static `:Entity`
 * label so the uniqueness index is used, and the specific label is attached
 * afterwards — Neo4j's own documentation warns that matching on a dynamic
 * label plans badly.
 *
 * Relationship types come from a fixed allow-list. A relationship type is
 * part of the query, not a parameter, so an unvalidated string would be a
 * schema-injection hole even with the `$()` dynamic form.
 */
import {
  graphKinds,
  type GraphEdge,
  type GraphNode,
} from "@/lib/core/knowledge-graph";
import { getDriver, neo4jSettings } from "./driver";

/** Label for a node kind. `candidate` → `Candidate`. */
export function labelFor(kind: string): string {
  const found = graphKinds.find((entry) => entry === kind);
  if (!found) throw new Error(`Unknown graph node kind: ${kind}`);
  return found.charAt(0).toUpperCase() + found.slice(1);
}

/**
 * Every relationship type this app writes. An edge whose label is not here
 * becomes `RELATED_TO`, so an unexpected value can never reach the query.
 */
export const RELATIONSHIP_TYPES = {
  "includes candidate": "INCLUDES_CANDIDATE",
  requires: "REQUIRES",
  mentions: "MENTIONS",
  "has saved source": "HAS_SAVED_SOURCE",
  "has document": "HAS_DOCUMENT",
  compares: "COMPARES",
  "uses channel": "USES_CHANNEL",
} as const;

export function relationshipType(label: string): string {
  return (
    (RELATIONSHIP_TYPES as Record<string, string>)[label.toLowerCase()] ??
    "RELATED_TO"
  );
}

/**
 * Schema. Every statement is idempotent and must be sent on its own — Neo4j
 * refuses several schema commands in one call. A uniqueness constraint
 * creates its own backing range index, so no index is declared for the same
 * property.
 */
export function schemaStatements(): string[] {
  return [
    "CREATE CONSTRAINT entity_id_unique IF NOT EXISTS FOR (n:Entity) REQUIRE n.id IS UNIQUE",
    ...graphKinds.map(
      (kind) =>
        `CREATE CONSTRAINT ${kind}_id_unique IF NOT EXISTS FOR (n:${labelFor(kind)}) REQUIRE n.id IS UNIQUE`,
    ),
    "CREATE INDEX entity_search_project IF NOT EXISTS FOR (n:Entity) ON (n.searchProjectId)",
  ];
}

export const UPSERT_NODES = `
UNWIND $nodes AS row
MERGE (n:Entity { id: row.id })
ON CREATE SET n.createdAt = datetime()
SET n:$(row.label),
    n.kind = row.kind,
    n.label = row.nodeLabel,
    n.detail = row.detail,
    n.href = row.href,
    n.externalUrl = row.externalUrl,
    n.status = row.status,
    n.searchProjectId = row.searchProjectId,
    n.updatedAt = datetime()
`;

export const UPSERT_EDGES = `
UNWIND $edges AS row
MATCH (a:Entity { id: row.from })
MATCH (b:Entity { id: row.to })
MERGE (a)-[r:$(row.type) { id: row.id }]->(b)
ON CREATE SET r.createdAt = datetime()
SET r.label = row.label, r.note = row.note, r.origin = row.origin
`;

/**
 * Neighbours in both directions.
 *
 * `-[r]-` without an arrow is what makes this bi-directional; `startNode(r)`
 * recovers which way the edge was written, so a reader still sees "includes
 * candidate" the right way round.
 */
export const NEIGHBOURS = `
MATCH (n:Entity { id: $id })-[r]-(m:Entity)
RETURN m.id AS id, m.kind AS kind, m.label AS label, m.detail AS detail,
       m.href AS href, m.status AS status, m.searchProjectId AS searchProjectId,
       type(r) AS relType, r.id AS edgeId, r.label AS edgeLabel,
       r.note AS note, r.origin AS origin,
       CASE WHEN startNode(r).id = $id THEN 'out' ELSE 'in' END AS direction
ORDER BY relType, m.label
`;

/**
 * Everything within N hops, shortest path to each.
 *
 * The hop bound cannot be a parameter — `-[*1..$depth]-` is a syntax error —
 * so the statement is generated per depth from a validated integer. `depth`
 * is clamped and coerced before it reaches the string; nothing user-typed is
 * ever concatenated in.
 */
export function withinQuery(depth: number): string {
  const bounded = Math.max(1, Math.min(5, Math.trunc(depth)));
  // `m <> start` is not optional: Neo4j refuses a shortestPath whose ends can
  // be the same node ("cyclic shortest path search disabled"), and an
  // unfiltered pattern lets the start node match itself.
  return `
MATCH path = shortestPath((start:Entity { id: $id })-[*1..${bounded}]-(m:Entity))
WHERE m <> start
RETURN m.id AS id, m.kind AS kind, m.label AS label, m.href AS href,
       m.searchProjectId AS searchProjectId,
       length(path) AS hops,
       [rel IN relationships(path) | rel.label] AS pathLabels,
       [rel IN relationships(path) | rel.id] AS edgeIds
ORDER BY hops, m.label
`;
}

/**
 * Everything carrying a tag, across every search.
 *
 * This is the query that justifies the whole store: it deliberately does not
 * filter on `searchProjectId`, because a tag is the one node whose meaning
 * lives outside any single search.
 */
export const TAG_CARRIERS = `
MATCH (t:Tag { id: $tagId })-[r]-(m:Entity)
WHERE m:Search OR m:Candidate
RETURN m.id AS id, m.kind AS kind, m.label AS label, m.href AS href,
       m.searchProjectId AS searchProjectId, r.note AS note,
       CASE WHEN startNode(r).id = $tagId THEN 'out' ELSE 'in' END AS direction
ORDER BY kind, label
`;

export interface GraphRow {
  id: string;
  kind: string;
  label: string;
  href: string;
  searchProjectId?: string | null;
}

export interface NeighbourRow extends GraphRow {
  detail?: string | null;
  status?: string | null;
  relType: string;
  edgeId: string;
  edgeLabel: string;
  note?: string | null;
  origin?: string | null;
  direction: "out" | "in";
}

export interface WithinRow extends GraphRow {
  hops: number;
  pathLabels: string[];
  edgeIds: string[];
}

function database(): string {
  return neo4jSettings()?.database ?? "neo4j";
}

/** Create the constraints and indexes. Safe to run on every start. */
export async function ensureSchema(): Promise<void> {
  const driver = getDriver();
  for (const statement of schemaStatements()) {
    await driver.executeQuery(statement, {}, { database: database() });
  }
}

/**
 * Push one search's projection into the graph, in a single transaction.
 *
 * Idempotent: a node or edge already there is updated, not duplicated, which
 * is what lets this run on every visit without the graph growing. Edges that
 * have disappeared from the projection are removed for this search only, so
 * syncing one search never touches another's.
 */
export async function syncGraph(
  searchProjectId: string,
  graph: { nodes: GraphNode[]; edges: GraphEdge[] },
): Promise<{ nodes: number; edges: number }> {
  const driver = getDriver();
  const session = driver.session({ database: database() });
  try {
    await session.executeWrite(async (tx) => {
      await tx.run(UPSERT_NODES, {
        nodes: graph.nodes.map((node) => ({
          id: node.id,
          label: labelFor(node.kind),
          kind: node.kind,
          nodeLabel: node.label,
          detail: node.detail ?? "",
          href: node.href,
          externalUrl: node.externalUrl ?? null,
          status: node.status ?? null,
          // A tag belongs to no single search; that is the point of it.
          searchProjectId: node.kind === "tag" ? null : searchProjectId,
        })),
      });
      await tx.run(UPSERT_EDGES, {
        edges: graph.edges.map((edge) => ({
          id: edge.id,
          from: edge.from,
          to: edge.to,
          type: relationshipType(edge.label),
          label: edge.label,
          note: edge.note ?? "",
          origin: edge.origin,
        })),
      });
      // Anything this search used to assert and no longer does.
      await tx.run(
        `MATCH (a:Entity { searchProjectId: $searchProjectId })-[r]-()
         WHERE NOT r.id IN $keep
         DELETE r`,
        { searchProjectId, keep: graph.edges.map((edge) => edge.id) },
      );
    });
    return { nodes: graph.nodes.length, edges: graph.edges.length };
  } finally {
    await session.close();
  }
}

export async function neighbours(id: string): Promise<NeighbourRow[]> {
  const { records } = await getDriver().executeQuery(
    NEIGHBOURS,
    { id },
    { database: database(), routing: "READ" },
  );
  return records.map((record) => record.toObject() as NeighbourRow);
}

export async function within(id: string, depth: number): Promise<WithinRow[]> {
  const { records } = await getDriver().executeQuery(
    withinQuery(depth),
    { id },
    { database: database(), routing: "READ" },
  );
  return records.map((record) => record.toObject() as WithinRow);
}

/** Every search and person carrying a tag, across the whole workspace. */
export async function tagCarriers(slug: string): Promise<GraphRow[]> {
  const { records } = await getDriver().executeQuery(
    TAG_CARRIERS,
    { tagId: `tag:${slug}` },
    { database: database(), routing: "READ" },
  );
  return records.map((record) => record.toObject() as GraphRow);
}

export const WHOLE_GRAPH = `
MATCH (n:Entity)
OPTIONAL MATCH (n)-[r]->(m:Entity)
RETURN n.id AS id, n.kind AS kind, n.label AS label, n.detail AS detail,
       n.href AS href, n.status AS status, n.searchProjectId AS searchProjectId,
       r.id AS edgeId, r.label AS edgeLabel, r.note AS note, r.origin AS origin,
       m.id AS toId
`;

/**
 * The whole graph, across every job.
 *
 * This is the query the per-job projection cannot answer and the reason the
 * store exists: one tag written on a job in one search and a person in
 * another is a single edge here, and nowhere else. Returned in the same
 * shape the picture already draws, so the same component renders it.
 */
export async function wholeGraph(): Promise<{
  nodes: GraphNode[];
  edges: GraphEdge[];
}> {
  const { records } = await getDriver().executeQuery(
    WHOLE_GRAPH,
    {},
    { database: database(), routing: "READ" },
  );
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  for (const record of records) {
    const row = record.toObject() as {
      id: string;
      kind: string;
      label: string;
      detail: string | null;
      href: string | null;
      status: string | null;
      searchProjectId: string | null;
      edgeId: string | null;
      edgeLabel: string | null;
      note: string | null;
      origin: string | null;
      toId: string | null;
    };
    if (!nodes.has(row.id)) {
      nodes.set(row.id, {
        id: row.id,
        kind: (row.kind ?? "search") as GraphNode["kind"],
        label: row.label ?? row.id,
        detail: row.detail ?? "",
        href: row.href ?? "#",
        ...(row.status ? { status: row.status } : {}),
      });
    }
    if (row.edgeId && row.toId && !edges.has(row.edgeId)) {
      edges.set(row.edgeId, {
        id: row.edgeId,
        from: row.id,
        to: row.toId,
        label: row.edgeLabel ?? "relates to",
        note: row.note ?? "",
        origin: row.origin === "recruiter" ? "recruiter" : "stored_reference",
      });
    }
  }

  // An edge whose other end was never written is not drawable.
  const present = new Set(nodes.keys());
  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()].filter(
      (edge) => present.has(edge.from) && present.has(edge.to),
    ),
  };
}

/** How much is in there, for the status card. */
export async function graphCounts(): Promise<{
  nodes: number;
  edges: number;
  tags: number;
}> {
  const driver = getDriver();
  const one = async (cypher: string, key: string) => {
    const { records } = await driver.executeQuery(
      cypher,
      {},
      { database: database(), routing: "READ" },
    );
    return (records[0]?.get(key) as number) ?? 0;
  };
  return {
    nodes: await one("MATCH (n:Entity) RETURN count(n) AS n", "n"),
    edges: await one("MATCH ()-[r]->() RETURN count(r) AS n", "n"),
    tags: await one("MATCH (n:Tag) RETURN count(n) AS n", "n"),
  };
}
