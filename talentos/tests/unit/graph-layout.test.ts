/**
 * The graph layout.
 *
 * The old picture placed the selected record in the centre and everything
 * else on evenly spaced rings, so every graph looked the same and structure
 * was invisible. These tests hold the two properties that replaced it: the
 * layout is deterministic, so the picture does not move between reloads and
 * a screenshot means something; and it is structural, so two graphs with
 * different shapes are drawn differently.
 */
import { describe, expect, it } from "vitest";
import {
  GRAPH_VIEW_HEIGHT,
  GRAPH_VIEW_WIDTH,
  settleGraph,
  unitHash,
} from "@/lib/core/graph-layout";
import type { GraphEdge, GraphNode } from "@/lib/core/knowledge-graph";

function node(id: string): GraphNode {
  return { id, kind: "candidate", label: id, detail: "", href: `/x/${id}` };
}

function edge(from: string, to: string): GraphEdge {
  return {
    id: `${from}->${to}`,
    from,
    to,
    label: "relates to",
    note: "",
    origin: "stored_reference",
  };
}

const chain = ["a", "b", "c", "d", "e", "f"];
const hubSpokes = ["hub", "s1", "s2", "s3", "s4", "s5"];

describe("the same graph draws the same picture", () => {
  it("returns identical coordinates on repeated runs", () => {
    const nodes = chain.map(node);
    const edges = chain.slice(1).map((id, i) => edge(chain[i], id));
    const first = settleGraph(nodes, edges, "a", new Map());
    const second = settleGraph(nodes, edges, "a", new Map());
    for (const id of chain) {
      expect(`${id} ${JSON.stringify(first.get(id))}`).toBe(
        `${id} ${JSON.stringify(second.get(id))}`,
      );
    }
  });

  it("does not depend on the order the records arrive in", () => {
    const edges = chain.slice(1).map((id, i) => edge(chain[i], id));
    const forward = settleGraph(chain.map(node), edges, "a", new Map());
    const reversed = settleGraph(
      [...chain].reverse().map(node),
      edges,
      "a",
      new Map(),
    );
    // Positions are within a pixel; the picture is the same picture.
    for (const id of chain) {
      const a = forward.get(id)!;
      const b = reversed.get(id)!;
      expect(`${id} ${Math.hypot(a.x - b.x, a.y - b.y) < 1}`).toBe(
        `${id} true`,
      );
    }
  });

  it("hashes a record id to a stable number", () => {
    expect(unitHash("candidate:abc", 1)).toBe(unitHash("candidate:abc", 1));
    expect(unitHash("candidate:abc", 1)).not.toBe(unitHash("candidate:abd", 1));
  });
});

describe("the picture reflects the structure", () => {
  it("puts a hub in the middle of its own spokes", () => {
    const hubEdges = hubSpokes.slice(1).map((id) => edge("hub", id));
    const positions = settleGraph(
      hubSpokes.map(node),
      hubEdges,
      "hub",
      new Map(),
    );
    const points = [...positions.values()];
    const cx = points.reduce((total, p) => total + p.x, 0) / points.length;
    const cy = points.reduce((total, p) => total + p.y, 0) / points.length;
    const distance = (id: string) => {
      const p = positions.get(id)!;
      return Math.hypot(p.x - cx, p.y - cy);
    };
    // The old ring layout could not express this: whatever was selected sat
    // in the centre regardless of how connected it was.
    for (const spoke of hubSpokes.slice(1)) {
      expect(`${spoke} ${distance("hub") < distance(spoke)}`).toBe(
        `${spoke} true`,
      );
    }
  });

  it("settles linked records to about the spring length apart", () => {
    const nodes = chain.map(node);
    const edges = chain.slice(1).map((id, i) => edge(chain[i], id));
    const positions = settleGraph(nodes, edges, "a", new Map());
    for (let i = 1; i < chain.length; i += 1) {
      const a = positions.get(chain[i - 1])!;
      const b = positions.get(chain[i])!;
      const gap = Math.hypot(a.x - b.x, a.y - b.y);
      expect(`${chain[i]} ${gap > 120 && gap < 200}`).toBe(`${chain[i]} true`);
    }
  });

  it("keeps every record inside the drawing area", () => {
    const nodes = chain.map(node);
    const edges = chain.slice(1).map((id, i) => edge(chain[i], id));
    for (const point of settleGraph(nodes, edges, "a", new Map()).values()) {
      expect(
        point.x >= 0 &&
          point.x <= GRAPH_VIEW_WIDTH &&
          point.y >= 0 &&
          point.y <= GRAPH_VIEW_HEIGHT,
      ).toBe(true);
    }
  });

  it("leaves a dragged record exactly where it was put", () => {
    const nodes = chain.map(node);
    const edges = chain.slice(1).map((id, i) => edge(chain[i], id));
    const pinned = new Map([["c", { x: 120, y: 480 }]]);
    const positions = settleGraph(nodes, edges, "a", pinned);
    expect(positions.get("c")).toEqual({ x: 120, y: 480 });
  });
});
