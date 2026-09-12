/**
 * The graph's filters.
 *
 * "Why has that node disappeared" is the hardest question a graph view
 * produces, so the filter logic is pure and tested here rather than
 * discovered by squinting at a canvas.
 *
 * Two properties carry most of the weight. Orphans are computed after the
 * other filters, because a record only becomes unconnected once the links to
 * it have gone. And search never hides anything — it marks matches so the
 * picture can dim the rest, since a graph with the context removed is a list.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIEW,
  applyGraphFilters,
  normalizeView,
} from "@/lib/core/graph-view-settings";
import { clampForces, DEFAULT_FORCES } from "@/lib/core/graph-layout";
import type {
  GraphEdge,
  GraphKind,
  GraphNode,
} from "@/lib/core/knowledge-graph";

const node = (id: string, kind: GraphKind, label = id): GraphNode => ({
  id,
  kind,
  label,
  detail: "",
  href: `/x/${id}`,
});
const edge = (
  from: string,
  to: string,
  origin: GraphEdge["origin"] = "stored_reference",
): GraphEdge => ({
  id: `${from}->${to}`,
  from,
  to,
  label: "mentions",
  note: "",
  origin,
});

const nodes = [
  node("job", "search", "CAIS"),
  node("person", "candidate", "Jordan Rivera"),
  node("tag", "tag", "ai-safety"),
  node("lonely", "channel", "Unused channel"),
];
const edges = [
  edge("job", "tag"),
  edge("person", "tag"),
  edge("job", "person", "recruiter"),
];

describe("turning a kind off", () => {
  it("removes its records and any link that needed them", () => {
    const result = applyGraphFilters(nodes, edges, {
      ...DEFAULT_VIEW.filters,
      kinds: { ...DEFAULT_VIEW.filters.kinds, tag: false },
    });
    expect(result.nodes.map((n) => n.id).sort()).toEqual([
      "job",
      "lonely",
      "person",
    ]);
    expect(result.edges.map((e) => e.id)).toEqual(["job->person"]);
    expect(result.hidden.nodes).toBe(1);
  });
});

describe("link origin", () => {
  it("can show only the links you drew", () => {
    const result = applyGraphFilters(nodes, edges, {
      ...DEFAULT_VIEW.filters,
      storedLinks: false,
    });
    expect(result.edges.map((e) => e.origin)).toEqual(["recruiter"]);
  });

  it("can show only the links read from records", () => {
    const result = applyGraphFilters(nodes, edges, {
      ...DEFAULT_VIEW.filters,
      recruiterLinks: false,
    });
    expect(result.edges.every((e) => e.origin === "stored_reference")).toBe(
      true,
    );
  });
});

describe("orphans are computed last", () => {
  it("hides a record with no links", () => {
    const result = applyGraphFilters(nodes, edges, {
      ...DEFAULT_VIEW.filters,
      orphans: false,
    });
    expect(result.nodes.map((n) => n.id)).not.toContain("lonely");
  });

  it("hides a record whose only link was just filtered out", () => {
    // Turning off recruiter links leaves nothing touching the person except
    // the tag; turning off tags too should strand them.
    const result = applyGraphFilters(nodes, edges, {
      ...DEFAULT_VIEW.filters,
      kinds: { ...DEFAULT_VIEW.filters.kinds, tag: false },
      recruiterLinks: false,
      orphans: false,
    });
    expect(result.nodes).toEqual([]);
  });
});

describe("search marks rather than hides", () => {
  it("keeps every record and marks the matches", () => {
    const result = applyGraphFilters(nodes, edges, {
      ...DEFAULT_VIEW.filters,
      search: "jordan",
    });
    expect(result.nodes).toHaveLength(4);
    expect([...result.matched]).toEqual(["person"]);
  });

  it("marks everything when the box is empty", () => {
    const result = applyGraphFilters(nodes, edges, DEFAULT_VIEW.filters);
    expect(result.matched.size).toBe(4);
  });
});

describe("settings that arrive from storage", () => {
  it("repairs anything missing or out of range", () => {
    const view = normalizeView({
      filters: { search: 42, kinds: { tag: false } },
      display: { nodeSize: 99, labelThreshold: -5 },
      forces: { repel: 10_000_000 },
    });
    expect(view.filters.search).toBe("");
    expect(view.filters.kinds.tag).toBe(false);
    // Every other kind defaults to shown, so a new kind is never invisible.
    expect(view.filters.kinds.candidate).toBe(true);
    expect(view.display.nodeSize).toBeLessThanOrEqual(2.5);
    expect(view.display.labelThreshold).toBe(0);
    expect(view.forces.repel).toBeLessThanOrEqual(40000);
  });

  it("survives complete nonsense", () => {
    expect(normalizeView(null)).toEqual(DEFAULT_VIEW);
    expect(normalizeView("not an object")).toEqual(DEFAULT_VIEW);
  });
});

describe("forces stay inside the bounds", () => {
  it("clamps rather than accepting a value that would blank the canvas", () => {
    expect(clampForces({ repel: 0 }).repel).toBeGreaterThan(0);
    expect(clampForces({ linkDistance: 99999 }).linkDistance).toBeLessThan(
      1000,
    );
    expect(clampForces({})).toEqual(DEFAULT_FORCES);
    expect(clampForces({ centre: Number.NaN }).centre).toBe(
      DEFAULT_FORCES.centre,
    );
  });
});
