"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import {
  graphBacklinks,
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

const colors: Record<GraphKind, string> = {
  search: "#a5b4fc",
  candidate: "#5eead4",
  requirement: "#fcd34d",
  document: "#93c5fd",
  comparison: "#c4b5fd",
  channel: "#fdba74",
  source: "#f9a8d4",
};
const inputClass =
  "w-full rounded border border-edge2 bg-panel2 p-2 text-sm text-ink";
const buttonClass =
  "rounded border border-edge2 px-3 py-1.5 text-sm hover:bg-panel2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50";
function GraphPicture({
  nodes,
  edges,
  selectedId,
  select,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string;
  select: (id: string) => void;
}) {
  const selected = nodes.find((node) => node.id === selectedId);
  const others = nodes.filter((node) => node.id !== selectedId);
  const positions = new Map<string, { x: number; y: number }>();
  if (selected) positions.set(selected.id, { x: 450, y: 290 });
  others.forEach((node, index) => {
    const ring = Math.floor(index / 20);
    const count = Math.min(20, others.length - ring * 20);
    const angle =
      ((index % 20) * 2 * Math.PI) / Math.max(count, 1) - Math.PI / 2;
    positions.set(node.id, {
      x: 450 + Math.cos(angle) * (270 + ring * 70),
      y: 290 + Math.sin(angle) * (175 + ring * 44),
    });
  });
  return (
    <svg
      viewBox="0 0 900 590"
      className="min-h-72 w-full rounded border border-edge bg-[#101827]"
      role="group"
      aria-label="Interactive knowledge graph. Tab to a record and press Enter to inspect its backlinks."
    >
      <title>Stored references and recruiter links</title>
      {edges.map((edge) => {
        const from = positions.get(edge.from),
          to = positions.get(edge.to);
        if (!from || !to) return null;
        const active = edge.from === selectedId || edge.to === selectedId;
        return (
          <line
            key={edge.id}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={active ? "#a5b4fc" : "#475569"}
            strokeWidth={active ? 2 : 1}
            strokeDasharray={edge.origin === "recruiter" ? "5 5" : undefined}
            opacity={active ? 0.9 : 0.4}
          >
            <title>{`${edge.label} · ${edge.origin === "recruiter" ? "Recruiter link" : "Stored reference"}`}</title>
          </line>
        );
      })}
      {nodes.map((node) => {
        const position = positions.get(node.id)!;
        return (
          <g
            key={node.id}
            role="button"
            tabIndex={0}
            aria-label={`Inspect ${node.kind}: ${node.label}`}
            aria-pressed={node.id === selectedId}
            className="cursor-pointer focus:outline-none [&:focus>circle]:stroke-white [&:focus>circle]:stroke-4"
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
              r={node.id === selectedId ? 22 : 13}
              fill={colors[node.kind]}
              stroke={node.id === selectedId ? "#fff" : "#101827"}
              strokeWidth={node.id === selectedId ? 3 : 2}
            />
            <text
              x={position.x}
              y={position.y + (node.id === selectedId ? 42 : 30)}
              textAnchor="middle"
              fill="#f1f5f9"
              fontSize={12}
            >
              {node.label.length > 28
                ? `${node.label.slice(0, 25)}…`
                : node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
export function KnowledgeGraphWorkspace({ graph }: { graph: KnowledgeGraph }) {
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
  const pictureNodes = [
    selected,
    ...availablePictureNodes
      .filter((node) => node.id !== selected.id)
      .slice(0, overview ? 59 : 20),
  ];
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
        title="Knowledge graph"
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
        <Card title="Records">
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
                  <span className="block text-[10px] text-ink-muted">
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
              <GraphPicture
                nodes={pictureNodes}
                edges={graph.edges}
                selectedId={selected.id}
                select={select}
              />
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
          <Card title="Add a bidirectional relationship">
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
            <Card title="Relationships to unavailable records">
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
