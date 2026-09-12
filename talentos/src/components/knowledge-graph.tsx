"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  GRAPH_VIEW_HEIGHT as VIEW_H,
  GRAPH_VIEW_WIDTH as VIEW_W,
  advanceSimulation,
  createSimulation,
  GRAPH_ITERATIONS,
  reheat,
  settleGraph as settle,
  simulationSettled,
  snapshotSimulation,
  type GraphSimulation,
  type GraphPoint as Point,
} from "@/lib/core/graph-layout";
import {
  DEFAULT_VIEW,
  type GraphViewSettings,
} from "@/lib/core/graph-view-settings";
import {
  graphBacklinks,
  graphWithin,
  graphKinds,
  graphNodeHref,
  type GraphEdge,
  type GraphKind,
  type GraphNode,
  type KnowledgeGraph,
} from "@/lib/core/knowledge-graph";
import {
  createGraphLinkAction,
  removeGraphLinkAction,
} from "@/lib/actions/knowledge-graph";
import { Card, PageHeader } from "@/components/ui";
import { GraphControls, useGraphView } from "./graph-controls";
import { applyGraphFilters } from "@/lib/core/graph-view-settings";
import { EMPTY_STATES } from "@/lib/domain/voice";

const colors: Record<GraphKind, string> = {
  search: "#a5b4fc",
  candidate: "#5eead4",
  requirement: "#fcd34d",
  document: "#93c5fd",
  comparison: "#c4b5fd",
  channel: "#fdba74",
  source: "#f9a8d4",
  tag: "#f0abfc",
};
const inputClass =
  "w-full rounded border border-edge2 bg-panel2 p-2 text-sm text-ink";
const buttonClass =
  "rounded border border-edge2 px-3 py-1.5 text-sm hover:bg-panel2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50";
/**
 * The graph picture.
 *
 * It was a fixed radial layout: selected node in the middle, everything else
 * on evenly spaced rings. That drew every graph the same shape, so structure
 * was invisible — a hub with twenty leaves and a chain of twenty looked
 * identical. This is a settled force layout instead, so clusters separate,
 * hubs sit centrally, and the picture differs when the data differs.
 *
 * The simulation is deterministic and finite: initial positions come from a
 * hash of the node id, then a fixed number of iterations run inside a memo.
 * No animation frame loop, no randomness, so the same graph draws the same
 * picture every time and a test can assert on it. Dragging a node pins it
 * and re-settles the rest around it.
 */

/**
 * The picture on its own, for the whole-workspace graph, which has no
 * backlink panels around it. Same layout, same interactions, one export.
 */
export function GraphPictureOnly(props: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string;
  select: (id: string) => void;
  view?: GraphViewSettings;
  matched?: Set<string>;
  /**
   * Shorter, for the panel at the foot of every page.
   *
   * The full size is right when the graph is what you came to look at. At the
   * bottom of a page it is a glance, and 28rem of it under every page in the
   * product is a scroll rather than a glance.
   */
  compact?: boolean;
}) {
  return <GraphPicture {...props} />;
}

function GraphPicture({
  nodes,
  edges,
  selectedId,
  select,
  view = DEFAULT_VIEW,
  matched,
  compact = false,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string;
  select: (id: string) => void;
  view?: GraphViewSettings;
  /** Records matching the search. Non-matches dim rather than disappear. */
  matched?: Set<string>;
  compact?: boolean;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [pins, setPins] = useState<Map<string, Point>>(new Map());
  const [dragging, setDragging] = useState<string | null>(null);
  /**
   * Dragging the canvas.
   *
   * The label has claimed you could do this for as long as it has existed, and
   * you could not: `pan` was state that only the reset button ever wrote. So a
   * graph bigger than its frame could be zoomed into and then not moved, which
   * is the one thing zoom makes necessary.
   *
   * Held as the grab point and the pan at the moment of the grab, rather than
   * as a running delta, so a pointer that leaves the element and comes back
   * does not jump.
   */
  const [grab, setGrab] = useState<{
    x: number;
    y: number;
    pan: Point;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const ids = new Set(nodes.map((node) => node.id));
  const live = edges.filter((e) => ids.has(e.from) && ids.has(e.to));

  // Identity of the drawn set, as plain strings, so the layout is recomputed
  // when the records or links change but not when their order does.
  const nodeKey = nodes.map((node) => node.id).join(",");
  const edgeKey = live.map((edge) => edge.id).join(",");

  const forceKey = JSON.stringify(view.forces);

  /**
   * The graph settles where you can watch it, the way Obsidian's and Roam's do.
   *
   * A layout that appears fully formed is correct and tells you nothing: the
   * motion is how you read which records pulled which into place, and where a
   * cluster came from. So the physics is stepped from an animation frame
   * rather than run to completion in one go.
   *
   * It stops when it cools, so nothing drifts forever and nothing is animating
   * while you are trying to read it. Dragging a record, changing a filter or
   * selecting something else warms it back up, because the old arrangement is
   * wrong the moment any of those change.
   *
   * Somebody who has asked for less motion gets the settled layout at once.
   */
  const [positions, setPositions] = useState<Map<string, Point>>(() =>
    settle(nodes, live, selectedId, pins, view.forces),
  );
  const simRef = useRef<GraphSimulation | null>(null);

  useEffect(() => {
    // Somebody who has asked for less motion gets the whole simulation in one
    // frame, which is the settled layout with no animation rather than a
    // different layout — the picture is the same either way.
    const still =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const perFrame = still ? GRAPH_ITERATIONS : 2;

    // Carry the current arrangement over rather than scattering from the hash
    // again: a filter change should rearrange the graph you are looking at,
    // not replace it with a different one.
    const previous = simRef.current?.positions;
    const sim = createSimulation(nodes, live, selectedId, pins, view.forces);
    if (previous) {
      for (const [id, point] of sim.positions) {
        const carried = previous.get(id);
        if (carried) sim.positions.set(id, { ...carried });
        else sim.positions.set(id, point);
      }
      reheat(sim);
    }
    simRef.current = sim;

    let frame = 0;
    const tick = () => {
      // Two steps a frame: fast enough to settle in a couple of seconds, slow
      // enough that you can see what moved.
      advanceSimulation(sim, perFrame);
      setPositions(snapshotSimulation(sim));
      if (!simulationSettled(sim)) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // nodes and live are derived from nodeKey and edgeKey; the forces from
    // forceKey. Listing the objects themselves would restart every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeKey, edgeKey, selectedId, pins, forceKey]);

  /** How many live edges touch each record; drives node size. */
  const degree = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of live) {
      counts.set(edge.from, (counts.get(edge.from) ?? 0) + 1);
      counts.set(edge.to, (counts.get(edge.to) ?? 0) + 1);
    }
    return counts;
  }, [live]);

  /** The record under the pointer, or the selection when nothing is hovered. */
  const focusId = hovered ?? selectedId;
  const neighbourhood = useMemo(() => {
    const set = new Set<string>([focusId]);
    for (const edge of live) {
      if (edge.from === focusId) set.add(edge.to);
      if (edge.to === focusId) set.add(edge.from);
    }
    return set;
  }, [live, focusId]);

  /** Pointer position in the SVG's own coordinates, so drag tracks the cursor. */
  function toGraph(event: { clientX: number; clientY: number }): Point | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const box = svg.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * VIEW_W;
    const y = ((event.clientY - box.top) / box.height) * VIEW_H;
    return { x: (x - pan.x) / zoom, y: (y - pan.y) / zoom };
  }

  function radius(node: GraphNode): number {
    const base =
      node.id === selectedId
        ? 20
        : 8 + Math.min(9, (degree.get(node.id) ?? 0) * 1.6);
    return base * view.display.nodeSize;
  }

  return (
    // Clipped, because the picture can be panned and dragged past its own
    // frame: a record pulled out to the right was making the whole page
    // scroll sideways, which on a phone is the page coming apart.
    <div className="relative overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        // No frame and no ground of its own: the graph is a shape, not a box,
        // and a border is what made a force-directed layout look rectangular
        // however round the layout itself was.
        className={`w-full touch-none overflow-hidden bg-transparent ${
          compact
            ? "min-h-[13rem] sm:min-h-[15rem]"
            : "min-h-[20rem] sm:min-h-[28rem]"
        } ${grab ? "cursor-grabbing" : "cursor-grab"}`}
        role="group"
        tabIndex={0}
        aria-label="Interactive knowledge graph. Tab to a record and press Enter to inspect its backlinks. Drag a record to move it, drag the background to pan, scroll to zoom, arrow keys to pan."
        onPointerDown={(event) => {
          // Only the canvas. A node stops this event, because dragging a record
          // moves the record and dragging what is behind it moves the view.
          const box = svgRef.current?.getBoundingClientRect();
          if (!box) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setGrab({ x: event.clientX, y: event.clientY, pan });
        }}
        onPointerMove={(event) => {
          if (dragging) {
            const point = toGraph(event);
            if (point)
              setPins((current) => new Map(current).set(dragging, point));
            return;
          }
          if (!grab) return;
          const box = svgRef.current?.getBoundingClientRect();
          if (!box) return;
          // Client pixels are not view units: at any zoom the picture must
          // travel exactly as far as the pointer did, or the canvas slides out
          // from under the cursor.
          setPan({
            x: grab.pan.x + ((event.clientX - grab.x) / box.width) * VIEW_W,
            y: grab.pan.y + ((event.clientY - grab.y) / box.height) * VIEW_H,
          });
        }}
        onPointerUp={() => {
          setDragging(null);
          setGrab(null);
        }}
        onPointerCancel={() => setGrab(null)}
        onPointerLeave={() => {
          setDragging(null);
          setHovered(null);
        }}
        onKeyDown={(event) => {
          // The same movement without a pointer. A view you can only reach by
          // dragging is a view somebody navigating by keyboard cannot reach.
          const step = event.shiftKey ? 160 : 48;
          const by: Record<string, Point> = {
            ArrowLeft: { x: step, y: 0 },
            ArrowRight: { x: -step, y: 0 },
            ArrowUp: { x: 0, y: step },
            ArrowDown: { x: 0, y: -step },
          };
          const move = by[event.key];
          if (!move) return;
          event.preventDefault();
          setPan((current) => ({
            x: current.x + move.x,
            y: current.y + move.y,
          }));
        }}
        onWheel={(event) => {
          // Zoom about the pointer, not about the origin: zooming into the
          // middle of the frame when you are looking at a cluster in the corner
          // moves the thing you were reading off the screen.
          const box = svgRef.current?.getBoundingClientRect();
          const next = Math.max(
            0.4,
            Math.min(3, event.deltaY < 0 ? zoom * 1.12 : zoom / 1.12),
          );
          if (box) {
            const px = ((event.clientX - box.left) / box.width) * VIEW_W;
            const py = ((event.clientY - box.top) / box.height) * VIEW_H;
            const ratio = next / zoom;
            setPan((current) => ({
              x: px - (px - current.x) * ratio,
              y: py - (py - current.y) * ratio,
            }));
          }
          setZoom(next);
        }}
      >
        <title>Stored references and recruiter links</title>
        <defs>
          <marker
            id="graph-arrow"
            viewBox="0 0 10 10"
            refX="18"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#a5b4fc" opacity="0.7" />
          </marker>
        </defs>
        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {live.map((edge) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;
            const active =
              neighbourhood.has(edge.from) && neighbourhood.has(edge.to);
            return (
              <line
                key={edge.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={active ? "#a5b4fc" : "#475569"}
                strokeWidth={(active ? 1.8 : 1) * view.display.linkThickness}
                markerEnd={
                  view.display.arrows ? "url(#graph-arrow)" : undefined
                }
                strokeDasharray={
                  edge.origin === "recruiter" ? "5 5" : undefined
                }
                opacity={active ? 0.85 : 0.18}
              >
                <title>{`${edge.label} · ${edge.origin === "recruiter" ? "Recruiter link" : "Stored reference"}`}</title>
              </line>
            );
          })}
          {nodes.map((node) => {
            const position = positions.get(node.id)!;
            const inFocus = neighbourhood.has(node.id);
            const r = radius(node);
            const connections = degree.get(node.id) ?? 0;
            const isMatch = !matched || matched.has(node.id);
            const showLabel =
              connections >= view.display.labelThreshold &&
              (inFocus || node.id === selectedId || nodes.length <= 24);
            return (
              <g
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`Inspect ${node.kind}: ${node.label}`}
                aria-pressed={node.id === selectedId}
                // A white ring is invisible on the pale green and amber nodes. Two tones,
                // the way Chrome's own ring is: the canvas colour inside and the
                // accent outside, so the pair reads on any node colour.
                className="cursor-pointer focus:outline-none [&:focus>circle]:stroke-accent [&:focus>circle]:stroke-4 [&:focus>circle]:[paint-order:stroke]"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setDragging(node.id);
                  const point = toGraph(event);
                  if (point) {
                    setPins((current) => new Map(current).set(node.id, point));
                  }
                }}
                onPointerEnter={() => setHovered(node.id)}
                onClick={() => select(node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    select(node.id);
                  }
                }}
              >
                <title>{`${node.kind}: ${node.label}${node.status ? ` · ${node.status}` : ""}`}</title>
                <circle
                  cx={position.x}
                  cy={position.y}
                  r={r}
                  fill={colors[node.kind]}
                  stroke={node.id === selectedId ? "#fff" : "#101827"}
                  strokeWidth={node.id === selectedId ? 3 : 2}
                  opacity={isMatch ? (inFocus ? 1 : 0.32) : 0.08}
                />
                {showLabel && (
                  <text
                    x={position.x}
                    y={position.y + r + 14}
                    textAnchor="middle"
                    fill="#f1f5f9"
                    fontSize={12}
                    opacity={isMatch ? (inFocus ? 1 : 0.45) : 0.12}
                    pointerEvents="none"
                  >
                    {node.label.length > 28
                      ? `${node.label.slice(0, 25)}…`
                      : node.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      <div className="absolute right-2 top-2 flex gap-1">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(3, z * 1.2))}
          className="rounded border border-edge2 bg-panel/80 px-2 py-0.5 text-[14px]"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(0.4, z / 1.2))}
          className="rounded border border-edge2 bg-panel/80 px-2 py-0.5 text-[14px]"
        >
          −
        </button>
        <button
          type="button"
          aria-label="Reset the view"
          onClick={() => {
            setZoom(1);
            setPan({ x: 0, y: 0 });
            setPins(new Map());
          }}
          className="rounded border border-edge2 bg-panel/80 px-2 py-0.5 text-[12px]"
        >
          Reset
        </button>
      </div>
      <p className="mt-1 text-[12px] text-ink-faint">
        Bigger record, more connections. Hover to light up what a record
        touches; drag to rearrange; scroll to zoom. A dashed line is a link you
        drew, a solid line is a reference already in the data.
      </p>
    </div>
  );
}
export function KnowledgeGraphWorkspace({ graph }: { graph: KnowledgeGraph }) {
  // `view` is already this component's graph/list switch, so the panel's
  // settings get their own name rather than shadowing it.
  const [graphView, setGraphView] = useGraphView();
  const router = useRouter(),
    params = useSearchParams();
  const [filter, setFilter] = useState("");
  const [kind, setKind] = useState<GraphKind | "all">("all");
  const [view, setView] = useState<"graph" | "list">("graph");
  const [overview, setOverview] = useState(false);
  const [target, setTarget] = useState("");
  const [label, setLabel] = useState("relates to");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const requested = params.get("node");
  const selected =
    graph.nodes.find((node) => node.id === requested) ?? graph.nodes[0];
  const backlinks = graphBacklinks(graph, selected.id);
  // Two hops, undirected. This is the view a one-way graph cannot produce:
  // a person, the tag one of their notes carries, and the other person or
  // search carrying the same word.
  const nearby = graphWithin(graph, selected.id, 2).filter(
    (entry) => entry.hops > 1,
  );
  const filtered = graph.nodes.filter(
    (node) =>
      (kind === "all" || node.kind === kind) &&
      `${node.label} ${node.kind}`.toLowerCase().includes(filter.toLowerCase()),
  );
  const neighbors = new Set([
    selected.id,
    ...backlinks.incoming.map(({ node }) => node.id),
    ...backlinks.outgoing.map(({ node }) => node.id),
  ]);
  const availablePictureNodes = overview
    ? filtered
    : graph.nodes.filter((node) => neighbors.has(node.id));
  const shortlist = [
    selected,
    ...availablePictureNodes
      .filter((node) => node.id !== selected.id)
      .slice(0, overview ? 119 : 40),
  ];
  // The panel's filters run over whatever the overview switch left, so the
  // two controls compose rather than fight.
  const shown = applyGraphFilters(shortlist, graph.edges, graphView.filters);
  const pictureNodes = shown.nodes.some((node) => node.id === selected.id)
    ? shown.nodes
    : [selected, ...shown.nodes];
  function select(id: string) {
    router.replace(graphNodeHref(graph.searchProjectId, id), { scroll: false });
  }
  function remove(id: string) {
    startTransition(async () => {
      const result = await removeGraphLinkAction({
        searchProjectId: graph.searchProjectId,
        linkId: id,
      });
      setMessage(
        result.ok
          ? "Manual link removed. Recruiting records were preserved."
          : result.error,
      );
      if (result.ok) router.refresh();
    });
  }
  function nearbySection() {
    return (
      <section aria-label="Nearby records">
        <h3 className="mb-2 text-sm font-semibold">
          Two links away ({nearby.length})
        </h3>
        {nearby.length === 0 ? (
          <p className="text-sm text-ink-muted">
            {EMPTY_STATES.noGraphNearby.detail}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {nearby.slice(0, 24).map((entry) => (
              <li
                key={entry.node.id}
                className="rounded border border-edge p-2 text-sm"
              >
                <button
                  className="text-left text-accent underline-offset-2 hover:underline"
                  onClick={() => select(entry.node.id)}
                >
                  {entry.node.label}
                </button>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {entry.node.kind} · via{" "}
                  {entry.path.map((edge) => edge.label).join(" → ")}
                </p>
              </li>
            ))}
            {nearby.length > 24 && (
              <li className="text-xs text-ink-faint">
                +{nearby.length - 24} more
              </li>
            )}
          </ul>
        )}
      </section>
    );
  }
  function connections(direction: "incoming" | "outgoing") {
    const items = backlinks[direction];
    return (
      <section
        aria-label={
          direction === "incoming" ? "Incoming backlinks" : "Outgoing links"
        }
      >
        <h3 className="mb-2 text-sm font-semibold">
          {direction === "incoming" ? "Incoming backlinks" : "Outgoing links"} (
          {items.length})
        </h3>
        {items.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No {direction} links for this record.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map(({ edge, node }) => (
              <li
                key={edge.id}
                className="rounded border border-edge p-2 text-sm"
              >
                <button
                  className="text-left text-accent underline-offset-2 hover:underline"
                  onClick={() => select(node.id)}
                >
                  {node.label}
                </button>
                <p className="mt-1 text-ink-muted">
                  {direction === "incoming"
                    ? `${node.kind} → selected record`
                    : `selected record → ${node.kind}`}{" "}
                  · {edge.label}
                </p>
                <p className="text-xs text-ink-faint">
                  {edge.origin === "recruiter"
                    ? "Recruiter-authored relationship"
                    : "Derived from stored reference"}
                  {node.status ? ` · ${node.status}` : ""}
                </p>
                {edge.note && (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-ink-muted">
                    {edge.note}
                  </p>
                )}
                {edge.origin === "recruiter" && (
                  <button
                    disabled={pending}
                    onClick={() => remove(edge.id)}
                    className="mt-2 text-xs text-accent underline"
                  >
                    Remove manual link
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }
  return (
    <div>
      <PageHeader
        title="🕸️ Knowledge graph"
        description="Explore both ends of every stored reference. Add your own relationships and follow backlinks between candidates, requirements, document versions and sources. Links describe context; they do not verify qualifications or change candidate stages."
      />
      <div className="mb-4 flex flex-wrap gap-2" aria-label="Graph display">
        <button
          className={buttonClass}
          aria-pressed={view === "graph"}
          onClick={() => setView("graph")}
        >
          Graph view
        </button>
        <button
          className={buttonClass}
          aria-pressed={view === "list"}
          onClick={() => setView("list")}
        >
          List view
        </button>
        {view === "graph" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={overview}
              onChange={(event) => setOverview(event.target.checked)}
            />{" "}
            All records overview
          </label>
        )}
        <p className="self-center text-xs text-ink-muted">
          {graph.nodes.length} records · {graph.edges.length} references ·
          selection is saved in the URL
        </p>
      </div>
      {requested && requested !== selected.id && (
        <p role="status" className="mb-3 text-sm text-warn">
          The selected record is unavailable in this search. Showing the search
          record.
        </p>
      )}
      <div className="grid items-start gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
        <Card title="🗃️ Records">
          <label className="block text-xs text-ink-muted">
            Find a record
            <input
              className={`${inputClass} mt-1`}
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          </label>
          <label className="mt-2 block text-xs text-ink-muted">
            Record type
            <select
              className={`${inputClass} mt-1`}
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as GraphKind | "all")
              }
            >
              <option value="all">All types</option>
              {graphKinds.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <ul
            className="mt-3 max-h-[550px] space-y-1 overflow-auto"
            aria-label="Graph records"
          >
            {filtered.map((node) => (
              <li key={node.id}>
                <button
                  className={`w-full rounded px-2 py-2 text-left text-xs hover:bg-panel2 ${node.id === selected.id ? "bg-accent-soft text-accent" : "text-ink"}`}
                  aria-current={node.id === selected.id ? "true" : undefined}
                  onClick={() => select(node.id)}
                >
                  <span className="block text-[11px] text-ink-muted">
                    {node.kind}
                  </span>
                  {node.label}
                </button>
              </li>
            ))}
          </ul>
          {!filtered.length && (
            <p className="mt-3 text-xs text-ink-muted">No records match.</p>
          )}
        </Card>
        <div className="min-w-0 space-y-4">
          {view === "graph" && (
            <div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <GraphControls
                  value={graphView}
                  onChange={setGraphView}
                  counts={{
                    shown: pictureNodes.length,
                    hidden: shown.hidden.nodes,
                    edges: shown.edges.length,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <GraphPicture
                    nodes={pictureNodes}
                    edges={shown.edges}
                    selectedId={selected.id}
                    select={select}
                    view={graphView}
                    matched={shown.matched}
                  />
                </div>
              </div>
              <p className="mt-2 text-xs text-ink-muted">
                {overview ? "Overview" : "Selected record and its neighbors"} ·
                showing {pictureNodes.length} of{" "}
                {Math.max(availablePictureNodes.length, 1)} records. The record
                list and backlinks include every stored reference. Dashed lines
                are manual relationships.
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-xs">
                {graphKinds.map((item) => (
                  <span key={item} className="flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: colors[item] }}
                    />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
          <Card
            title={
              <span>
                {selected.label}{" "}
                <span className="font-normal text-ink-muted">
                  · {selected.kind}
                </span>
              </span>
            }
          >
            {selected.status && (
              <p className="mb-2 text-sm text-ink-muted">
                Status: {selected.status}
              </p>
            )}
            <p className="whitespace-pre-wrap break-words text-sm text-ink-muted">
              {selected.detail}
            </p>
            <p className="mt-2 break-all text-xs text-ink-faint">
              Stable record reference: {selected.id}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              <Link className="text-accent underline" href={selected.href}>
                Open record
              </Link>
              {selected.externalUrl && (
                <a
                  className="text-accent underline"
                  href={selected.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open source in new tab
                </a>
              )}
              <Link
                className="text-accent underline"
                href={graphNodeHref(graph.searchProjectId, selected.id)}
              >
                Permanent graph link
              </Link>
            </div>
          </Card>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>{connections("incoming")}</Card>
            <Card>{connections("outgoing")}</Card>
          </div>
          <Card>{nearbySection()}</Card>
          <Card title="🔗 Add a bidirectional relationship">
            <p className="mb-3 text-sm text-ink-muted">
              This creates an outgoing link from {selected.label} and an
              incoming backlink on the other record. It records your
              interpretation without changing either record.
            </p>
            <form
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  const result = await createGraphLinkAction({
                    searchProjectId: graph.searchProjectId,
                    from: selected.id,
                    to: target,
                    label,
                    note,
                  });
                  setMessage(
                    result.ok
                      ? "Relationship saved. Both endpoints now show the link."
                      : result.error,
                  );
                  if (result.ok) {
                    setNote("");
                    router.refresh();
                  }
                });
              }}
            >
              <label className="block text-sm">
                Link to
                <select
                  required
                  className={`${inputClass} mt-1`}
                  value={target === selected.id ? "" : target}
                  onChange={(event) => setTarget(event.target.value)}
                >
                  <option value="">Choose a record in this search</option>
                  {graph.nodes
                    .filter((node) => node.id !== selected.id)
                    .map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.kind} · {node.label}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block text-sm">
                Relationship label
                <input
                  required
                  maxLength={100}
                  className={`${inputClass} mt-1`}
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="For example: suggested by"
                />
              </label>
              <label className="block text-sm">
                Context or limitation
                <textarea
                  maxLength={2000}
                  className={`${inputClass} mt-1`}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                />
              </label>
              <button
                className={buttonClass}
                disabled={
                  pending || !target || target === selected.id || !label.trim()
                }
                type="submit"
              >
                Save relationship
              </button>
            </form>
            <p
              className="mt-2 text-sm text-ink-muted"
              role="status"
              aria-live="polite"
            >
              {message}
            </p>
          </Card>
          {graph.unavailableLinks.length > 0 && (
            <Card title="🚫 Relationships to unavailable records">
              <p className="mb-2 text-sm text-ink-muted">
                These saved manual links are retained for review and excluded
                from the graph because an endpoint is no longer present.
              </p>
              <ul className="space-y-2">
                {graph.unavailableLinks.map((link) => (
                  <li className="break-all text-xs" key={link.id}>
                    {link.from} → {link.to} · {link.label}{" "}
                    <button
                      className="text-accent underline"
                      disabled={pending}
                      onClick={() => remove(link.id)}
                    >
                      Remove unavailable relationship
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
