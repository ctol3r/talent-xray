/**
 * What the graph shows, and how.
 *
 * The three groups are Obsidian's, because that is the vocabulary anyone who
 * has used a graph view already has: what is on screen (Filters), how it is
 * drawn (Display), and how it arranges itself (Forces).
 *
 * All of it is pure. The panel reads and writes this shape, the picture
 * consumes it, and `applyGraphFilters` is testable without a browser — which
 * matters because "why has that node disappeared" is otherwise the hardest
 * question in the feature.
 */
import {
  graphKinds,
  type GraphEdge,
  type GraphKind,
  type GraphNode,
} from "./knowledge-graph";
import { clampForces, DEFAULT_FORCES, type GraphForces } from "./graph-layout";

export interface GraphFilters {
  /** Free text over label and detail. Empty shows everything. */
  search: string;
  /** Which kinds of record are drawn at all. */
  kinds: Record<GraphKind, boolean>;
  /** Records with no links. Off, they disappear; on, they float free. */
  orphans: boolean;
  /** Links the recruiter drew by hand, as opposed to ones read from records. */
  recruiterLinks: boolean;
  /** Links derived from stored references. */
  storedLinks: boolean;
}

export interface GraphDisplay {
  /** Draw the direction an edge was written. */
  arrows: boolean;
  /** Below this many connections, a label is hidden unless hovered. */
  labelThreshold: number;
  nodeSize: number;
  linkThickness: number;
}

export interface GraphViewSettings {
  filters: GraphFilters;
  display: GraphDisplay;
  forces: GraphForces;
}

export const DEFAULT_VIEW: GraphViewSettings = {
  filters: {
    search: "",
    kinds: Object.fromEntries(graphKinds.map((kind) => [kind, true])) as Record<
      GraphKind,
      boolean
    >,
    orphans: true,
    recruiterLinks: true,
    storedLinks: true,
  },
  display: {
    arrows: false,
    labelThreshold: 0,
    nodeSize: 1,
    linkThickness: 1,
  },
  forces: DEFAULT_FORCES,
};

export const DISPLAY_RANGES = {
  labelThreshold: { min: 0, max: 8, step: 1 },
  nodeSize: { min: 0.5, max: 2.5, step: 0.1 },
  linkThickness: { min: 0.5, max: 3, step: 0.1 },
};

/** Repair anything that arrives from storage, so a bad value cannot blank the view. */
export function normalizeView(raw: unknown): GraphViewSettings {
  const value = (raw ?? {}) as Partial<GraphViewSettings>;
  const filters = (value.filters ?? {}) as Partial<GraphFilters>;
  const display = (value.display ?? {}) as Partial<GraphDisplay>;
  const clampDisplay = (key: keyof typeof DISPLAY_RANGES, given: unknown) => {
    const { min, max } = DISPLAY_RANGES[key];
    return typeof given === "number" && !Number.isNaN(given)
      ? Math.min(max, Math.max(min, given))
      : DEFAULT_VIEW.display[key];
  };
  return {
    filters: {
      search: typeof filters.search === "string" ? filters.search : "",
      kinds: Object.fromEntries(
        graphKinds.map((kind) => [kind, filters.kinds?.[kind] !== false]),
      ) as Record<GraphKind, boolean>,
      orphans: filters.orphans !== false,
      recruiterLinks: filters.recruiterLinks !== false,
      storedLinks: filters.storedLinks !== false,
    },
    display: {
      arrows: display.arrows === true,
      labelThreshold: clampDisplay("labelThreshold", display.labelThreshold),
      nodeSize: clampDisplay("nodeSize", display.nodeSize),
      linkThickness: clampDisplay("linkThickness", display.linkThickness),
    },
    forces: clampForces((value.forces ?? {}) as Partial<GraphForces>),
  };
}

export interface FilteredGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** How many of each were removed, so the panel can say so. */
  hidden: { nodes: number; edges: number };
  /** Records matching the search, for highlighting rather than hiding. */
  matched: Set<string>;
}

/**
 * Apply the filters, in the order that makes the counts honest.
 *
 * Kinds and link origins first, then orphans — because a record only becomes
 * an orphan after the links to it have been filtered out, and hiding orphans
 * before that would keep records whose only link has just gone.
 *
 * Search never hides anything. It marks matches so the picture can dim the
 * rest, because a graph with the context removed is a list.
 */
export function applyGraphFilters(
  nodes: GraphNode[],
  edges: GraphEdge[],
  filters: GraphFilters,
): FilteredGraph {
  const keptNodes = nodes.filter((node) => filters.kinds[node.kind] !== false);
  const present = new Set(keptNodes.map((node) => node.id));

  const keptEdges = edges.filter((edge) => {
    if (!present.has(edge.from) || !present.has(edge.to)) return false;
    return edge.origin === "recruiter"
      ? filters.recruiterLinks
      : filters.storedLinks;
  });

  const linked = new Set<string>();
  for (const edge of keptEdges) {
    linked.add(edge.from);
    linked.add(edge.to);
  }

  const finalNodes = filters.orphans
    ? keptNodes
    : keptNodes.filter((node) => linked.has(node.id));
  const finalIds = new Set(finalNodes.map((node) => node.id));
  const finalEdges = keptEdges.filter(
    (edge) => finalIds.has(edge.from) && finalIds.has(edge.to),
  );

  const needle = filters.search.trim().toLowerCase();
  const matched = new Set(
    needle
      ? finalNodes
          .filter((node) =>
            `${node.label} ${node.detail ?? ""} ${node.kind}`
              .toLowerCase()
              .includes(needle),
          )
          .map((node) => node.id)
      : finalNodes.map((node) => node.id),
  );

  return {
    nodes: finalNodes,
    edges: finalEdges,
    hidden: {
      nodes: nodes.length - finalNodes.length,
      edges: edges.length - finalEdges.length,
    },
    matched,
  };
}
