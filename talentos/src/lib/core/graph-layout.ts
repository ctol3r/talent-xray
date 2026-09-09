/**
 * Graph layout: where each record sits in the picture.
 *
 * Lives here rather than in the component because it is arithmetic with a
 * property worth testing directly — the same graph must produce the same
 * picture every time. Initial positions come from a hash of the record id
 * and a fixed number of iterations run, so there is no randomness and no
 * animation frame loop; a test can assert exact coordinates.
 *
 * The old layout put the selected record in the middle and spaced everything
 * else evenly on rings, which drew every graph the same shape. This settles
 * the records under repulsion and edge springs, so a cluster looks like a
 * cluster and a chain looks like a chain.
 */
import type { GraphEdge, GraphNode } from "./knowledge-graph";

export interface GraphPoint {
  x: number;
  y: number;
}

export const GRAPH_VIEW_WIDTH = 900;
export const GRAPH_VIEW_HEIGHT = 590;

/** Keeps a node off the very edge, where a label would be clipped. */
const MARGIN_X = 60;
const MARGIN_Y = 44;
/** Far outside the frame: a backstop against a runaway force, nothing more. */
const RUNAWAY = 4000;

/**
 * A backstop, not a boundary.
 *
 * Set far outside the viewport, so a node that a force sends flying does not
 * reach infinity, but nothing in an ordinary layout ever touches it. The shape
 * a graph ends up with should come from its own links, not from a wall.
 */
function containRunaway(position: { x: number; y: number }): void {
  const cx = GRAPH_VIEW_WIDTH / 2;
  const cy = GRAPH_VIEW_HEIGHT / 2;
  position.x = Math.max(cx - RUNAWAY, Math.min(cx + RUNAWAY, position.x));
  position.y = Math.max(cy - RUNAWAY, Math.min(cy + RUNAWAY, position.y));
}

/**
 * Shrink the settled layout until it fits, scaling about the middle.
 *
 * Fitting once at the end is what makes the graph a shape rather than a box.
 * Nothing comes to rest against an edge, so a dense graph reads as the blob,
 * ring or chain its links actually make — and the selected record stays in the
 * middle, because the scale is taken about that point.
 *
 * A record the recruiter dragged is left exactly where they dropped it.
 */
function fitToView(
  positions: Map<string, { x: number; y: number }>,
  pinned: { has(id: string): boolean },
): void {
  const cx = GRAPH_VIEW_WIDTH / 2;
  const cy = GRAPH_VIEW_HEIGHT / 2;
  const rx = cx - MARGIN_X;
  const ry = cy - MARGIN_Y;

  let worst = 0;
  for (const [id, position] of positions) {
    if (pinned.has(id)) continue;
    worst = Math.max(
      worst,
      Math.hypot((position.x - cx) / rx, (position.y - cy) / ry),
    );
  }
  // Only ever shrink. Blowing a small graph up to fill the frame would make
  // two records look as far apart as two hundred.
  if (worst <= 1 || worst === 0) return;

  const scale = 1 / worst;
  for (const [id, position] of positions) {
    if (pinned.has(id)) continue;
    position.x = cx + (position.x - cx) * scale;
    position.y = cy + (position.y - cy) * scale;
  }
}

/**
 * The four numbers that decide the shape of the picture, exposed because a
 * graph that reads well at twenty records is a hairball at three hundred and
 * the reader is the only one who knows which they are looking at.
 *
 * Named the way Obsidian names them, because that is the vocabulary anyone
 * who has used a graph view already has.
 */
export interface GraphForces {
  /** How strongly everything is pulled to the middle. */
  centre: number;
  /** How hard records push each other apart. */
  repel: number;
  /** How hard a link pulls its two ends together. */
  linkForce: number;
  /** The length a link settles at when nothing else acts on it. */
  linkDistance: number;
}

export const DEFAULT_FORCES: GraphForces = {
  centre: 0.006,
  repel: 12000,
  linkForce: 0.08,
  linkDistance: 150,
};

/** Bounds a slider may move within, so no setting can produce a blank canvas. */
export const FORCE_RANGES: Record<
  keyof GraphForces,
  { min: number; max: number; step: number }
> = {
  centre: { min: 0.001, max: 0.03, step: 0.001 },
  repel: { min: 2000, max: 40000, step: 500 },
  linkForce: { min: 0.01, max: 0.3, step: 0.01 },
  linkDistance: { min: 60, max: 320, step: 10 },
};

export function clampForces(raw: Partial<GraphForces>): GraphForces {
  const out = { ...DEFAULT_FORCES };
  for (const key of Object.keys(FORCE_RANGES) as (keyof GraphForces)[]) {
    const value = raw[key];
    if (typeof value !== "number" || Number.isNaN(value)) continue;
    const { min, max } = FORCE_RANGES[key];
    out[key] = Math.min(max, Math.max(min, value));
  }
  return out;
}

/** Deterministic 0..1 from a string, so the layout never moves on reload. */
export function unitHash(value: string, salt: number): number {
  let hash = 2166136261 ^ salt;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 100000) / 100000;
}

/**
 * Settle the nodes: repulsion between every pair, springs along edges, a weak
 * pull to the centre, and the selected node held at the middle so the view
 * stays anchored on what the recruiter is looking at.
 */
export const GRAPH_ITERATIONS = 600;

/**
 * A settling graph, one tick at a time.
 *
 * The layout used to run all six hundred iterations in one go and hand back
 * the answer, which is correct and tells you nothing: a graph that appears
 * fully formed hides which records pulled which into place. Obsidian and Roam
 * both let you watch it settle, and the watching is the point — the motion is
 * how you read the structure.
 *
 * So the physics is a state you advance. `settleGraph` still runs it to
 * completion in one call, so the deterministic tests and the server render are
 * unchanged; the component drives the same steps from an animation frame.
 */
export interface GraphSimulation {
  nodes: GraphNode[];
  /** Edges whose ends are both present, resolved once. */
  live: GraphEdge[];
  positions: Map<string, GraphPoint>;
  selectedId: string;
  pinned: Map<string, GraphPoint>;
  forces: GraphForces;
  /** Ticks run so far, out of `GRAPH_ITERATIONS`. */
  step: number;
}

export function createSimulation(
  nodes: GraphNode[],
  edges: GraphEdge[],
  selectedId: string,
  pinned: Map<string, GraphPoint>,
  forces: GraphForces = DEFAULT_FORCES,
): GraphSimulation {
  const positions = new Map<string, GraphPoint>();
  const present = new Set(nodes.map((node) => node.id));
  nodes.forEach((node) => {
    const pin = pinned.get(node.id);
    if (pin) {
      positions.set(node.id, { ...pin });
      return;
    }
    positions.set(node.id, {
      x: GRAPH_VIEW_WIDTH / 2 + (unitHash(node.id, 1) - 0.5) * 520,
      y: GRAPH_VIEW_HEIGHT / 2 + (unitHash(node.id, 2) - 0.5) * 380,
    });
  });
  return {
    nodes,
    live: edges.filter((e) => present.has(e.from) && present.has(e.to)),
    positions,
    selectedId,
    pinned,
    forces,
    step: 0,
  };
}

/** True once the simulation has cooled all the way. */
export function simulationSettled(sim: GraphSimulation): boolean {
  return sim.step >= GRAPH_ITERATIONS;
}

/**
 * Warm it back up.
 *
 * A dragged record, a changed filter or a new selection all make the old
 * arrangement wrong, and letting the graph re-settle from where it is — rather
 * than snapping — is what makes the picture legible while it changes.
 */
export function reheat(
  sim: GraphSimulation,
  to = GRAPH_ITERATIONS * 0.45,
): void {
  sim.step = Math.min(sim.step, Math.max(0, Math.round(GRAPH_ITERATIONS - to)));
}

/** Advance the physics by `ticks` steps, in place. */
export function advanceSimulation(sim: GraphSimulation, ticks = 1): void {
  const { nodes, live, positions, pinned, forces } = sim;
  const centre = { x: GRAPH_VIEW_WIDTH / 2, y: GRAPH_VIEW_HEIGHT / 2 };

  for (let t = 0; t < ticks && sim.step < GRAPH_ITERATIONS; t += 1) {
    const cooling = 1 - sim.step / GRAPH_ITERATIONS;
    // Net force on each record this step, before it is applied.
    const net = new Map<string, GraphPoint>();
    for (const node of nodes) net.set(node.id, { x: 0, y: 0 });

    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = positions.get(nodes[i].id)!;
        const b = positions.get(nodes[j].id)!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 0.01) {
          dx = unitHash(nodes[i].id, j) - 0.5;
          dy = unitHash(nodes[j].id, i) - 0.5;
          distance = 0.01;
        }
        const push = forces.repel / (distance * distance);
        const fa = net.get(nodes[i].id)!;
        const fb = net.get(nodes[j].id)!;
        fa.x += (dx / distance) * push;
        fa.y += (dy / distance) * push;
        fb.x -= (dx / distance) * push;
        fb.y -= (dy / distance) * push;
      }
    }

    for (const edge of live) {
      const a = positions.get(edge.from)!;
      const b = positions.get(edge.to)!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.max(Math.sqrt(dx * dx + dy * dy), 0.01);
      const spring = (distance - forces.linkDistance) * forces.linkForce;
      const fa = net.get(edge.from)!;
      const fb = net.get(edge.to)!;
      fa.x += (dx / distance) * spring;
      fa.y += (dy / distance) * spring;
      fb.x -= (dx / distance) * spring;
      fb.y -= (dy / distance) * spring;
    }

    for (const node of nodes) {
      if (pinned.has(node.id)) continue;
      const force = net.get(node.id)!;
      const position = positions.get(node.id)!;
      force.x += (centre.x - position.x) * forces.centre;
      force.y += (centre.y - position.y) * forces.centre;
      const move = 12 * cooling;
      position.x += Math.max(-move, Math.min(move, force.x * 0.35));
      position.y += Math.max(-move, Math.min(move, force.y * 0.35));
      // Only a runaway is caught here. Clamping to the viewport every step is
      // what made the graph look like a box: every node that drifted out came
      // to rest exactly on the boundary, so a dense graph grew a hard edge that
      // nothing in the data put there. The shape is fitted on the way out.
      containRunaway(position);
    }
    sim.step += 1;
  }
}

/**
 * The positions to draw, this instant.
 *
 * The anchor and the fit are a VIEW transform, applied to a copy on the way
 * out rather than written back into the physics. Feeding them back would make
 * the simulation chase its own camera, and the graph would drift for as long
 * as you watched it.
 */
export function snapshotSimulation(
  sim: GraphSimulation,
): Map<string, GraphPoint> {
  const centre = { x: GRAPH_VIEW_WIDTH / 2, y: GRAPH_VIEW_HEIGHT / 2 };
  const out = new Map<string, GraphPoint>();
  for (const [id, position] of sim.positions) out.set(id, { ...position });

  // Anchor the view on the selected record without distorting the shape:
  // translate everything so the selection lands in the middle.
  const anchor = out.get(sim.selectedId);
  if (anchor && !sim.pinned.has(sim.selectedId)) {
    const dx = centre.x - anchor.x;
    const dy = centre.y - anchor.y;
    for (const [id, position] of out) {
      // A record the recruiter dragged stays exactly where they dropped it.
      // Shifting it with the rest would make dragging feel broken.
      if (sim.pinned.has(id)) continue;
      position.x += dx * 0.65;
      position.y += dy * 0.65;
    }
  }
  fitToView(out, sim.pinned);
  return out;
}

/**
 * Settle the nodes: repulsion between every pair, springs along edges, a weak
 * pull to the centre, and the selected node held at the middle so the view
 * stays anchored on what the recruiter is looking at.
 *
 * Runs the whole simulation in one call. The component animates the same steps
 * instead; this is what the server renders and what the tests assert against.
 */
export function settleGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  selectedId: string,
  pinned: Map<string, GraphPoint>,
  forces: GraphForces = DEFAULT_FORCES,
): Map<string, GraphPoint> {
  const sim = createSimulation(nodes, edges, selectedId, pinned, forces);
  advanceSimulation(sim, GRAPH_ITERATIONS);
  return snapshotSimulation(sim);
}
