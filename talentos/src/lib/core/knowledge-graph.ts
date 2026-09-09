import { z } from "zod";

export const graphKinds = [
  "search",
  "candidate",
  "requirement",
  "document",
  "comparison",
  "channel",
  "source",
  /**
   * A tag (D-039). Not a record: a word somebody wrote. It is a node because
   * a tag is the only thing in this graph that links across searches — the
   * same word on a job and on a person is the edge, and without a node for
   * it that edge has nowhere to land.
   */
  "tag",
] as const;
export type GraphKind = (typeof graphKinds)[number];
export type GraphNode = {
  id: string;
  kind: GraphKind;
  label: string;
  detail: string;
  href: string;
  externalUrl?: string;
  status?: string;
};
export type GraphEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  note: string;
  origin: "stored_reference" | "recruiter";
  createdAt?: string;
};
export const manualGraphLink = z.object({
  id: z.string().min(1).max(180),
  from: z.string().min(1).max(180),
  to: z.string().min(1).max(180),
  label: z.string().trim().min(1).max(100),
  note: z.string().trim().max(2000),
  actor: z.literal("local-owner"),
  createdAt: z.iso.datetime(),
});
export const graphLinkStore = z.object({
  version: z.literal(1),
  links: z.array(manualGraphLink).max(500),
});
export const graphLinkInput = manualGraphLink
  .omit({ id: true, actor: true, createdAt: true })
  .extend({
    searchProjectId: z.string().min(1).max(180),
  });
export type KnowledgeGraph = {
  searchProjectId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  unavailableLinks: z.infer<typeof manualGraphLink>[];
};
/**
 * Everything a node touches, in both directions.
 *
 * `incoming` and `outgoing` are kept apart because the direction is
 * meaningful when you read one edge — "includes candidate" is not the same
 * sentence backwards. `graphNeighbours` is the traversal view: it does not
 * care which way an edge was written, which is what makes the graph
 * bi-directional rather than a tree drawn sideways.
 */
export function graphBacklinks(
  graph: Pick<KnowledgeGraph, "nodes" | "edges">,
  nodeId: string,
) {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  return {
    incoming: graph.edges
      .filter((edge) => edge.to === nodeId)
      .flatMap((edge) => {
        const node = byId.get(edge.from);
        return node ? [{ edge, node }] : [];
      }),
    outgoing: graph.edges
      .filter((edge) => edge.from === nodeId)
      .flatMap((edge) => {
        const node = byId.get(edge.to);
        return node ? [{ edge, node }] : [];
      }),
  };
}

export interface GraphNeighbour {
  node: GraphNode;
  edge: GraphEdge;
  /** Which way the edge was written. Traversal ignores it; reading does not. */
  direction: "out" | "in";
}

export type GraphAdjacency = Map<string, GraphNeighbour[]>;

/**
 * Build the both-ways adjacency map in one pass.
 *
 * Every edge is filed under both of its ends, which is what makes the graph
 * bi-directional at the data level rather than only in how it is drawn.
 * Building it once matters: a traversal that called a per-node filter would
 * scan every edge at every step, so a three-hop walk over a few hundred
 * records would do tens of thousands of comparisons for an answer that is
 * one map lookup per node.
 */
export function graphAdjacency(
  graph: Pick<KnowledgeGraph, "nodes" | "edges">,
): GraphAdjacency {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const adjacency: GraphAdjacency = new Map();
  const file = (from: string, to: string, edge: GraphEdge) => {
    const node = byId.get(to);
    if (!node) return;
    const list = adjacency.get(from);
    const entry: GraphNeighbour = {
      node,
      edge,
      direction: edge.from === from ? "out" : "in",
    };
    if (list) list.push(entry);
    else adjacency.set(from, [entry]);
  };
  for (const edge of graph.edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) continue;
    file(edge.from, edge.to, edge);
    // A self-edge is filed once, not twice.
    if (edge.to !== edge.from) file(edge.to, edge.from, edge);
  }
  return adjacency;
}

/** Every node one edge away, whichever way that edge points. */
export function graphNeighbours(
  graph: Pick<KnowledgeGraph, "nodes" | "edges">,
  nodeId: string,
  adjacency?: GraphAdjacency,
): GraphNeighbour[] {
  return (adjacency ?? graphAdjacency(graph)).get(nodeId) ?? [];
}

/**
 * Everything within `depth` edges, with the shortest path to each.
 *
 * Breadth-first and undirected, so "what is near this person" answers with
 * the tag two of their notes share and the other person carrying it — which
 * is the question a single-direction graph cannot answer at all.
 */
export function graphWithin(
  graph: Pick<KnowledgeGraph, "nodes" | "edges">,
  nodeId: string,
  depth: number,
  adjacency?: GraphAdjacency,
): { node: GraphNode; hops: number; path: GraphEdge[] }[] {
  const index = adjacency ?? graphAdjacency(graph);
  const exists = graph.nodes.some((node) => node.id === nodeId);
  if (!exists || depth < 1) return [];
  const visited = new Set<string>([nodeId]);
  const out: { node: GraphNode; hops: number; path: GraphEdge[] }[] = [];
  let frontier: { id: string; path: GraphEdge[] }[] = [
    { id: nodeId, path: [] },
  ];

  for (let hop = 1; hop <= depth; hop += 1) {
    const next: { id: string; path: GraphEdge[] }[] = [];
    for (const entry of frontier) {
      for (const neighbour of index.get(entry.id) ?? []) {
        if (visited.has(neighbour.node.id)) continue;
        visited.add(neighbour.node.id);
        const path = [...entry.path, neighbour.edge];
        out.push({ node: neighbour.node, hops: hop, path });
        next.push({ id: neighbour.node.id, path });
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return out;
}

export function graphNodeId(kind: GraphKind, id: string) {
  return `${kind}:${id}`;
}
export function graphNodeHref(searchProjectId: string, nodeId: string) {
  return `/searches/${encodeURIComponent(searchProjectId)}/graph?node=${encodeURIComponent(nodeId)}`;
}
/** Stored URLs remain untrusted. Graph links never execute scripts or credentials. */
export function safeGraphUrl(
  raw: string | null | undefined,
): string | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
