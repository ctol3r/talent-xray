import { z } from "zod";

export const graphKinds = [
  "search",
  "candidate",
  "requirement",
  "document",
  "comparison",
  "channel",
  "source",
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
