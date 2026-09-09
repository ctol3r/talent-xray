"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { GlobalGraphView } from "@/lib/services/global-graph";
import { syncGraphAction } from "@/lib/actions/graph-sync";
import { GraphPictureOnly } from "./knowledge-graph";
import { GraphControls, useGraphView } from "./graph-controls";
import { applyGraphFilters } from "@/lib/core/graph-view-settings";
import { Card, EmptyState, PageHeader, Tag } from "@/components/ui";

/**
 * Every job in one picture.
 *
 * The per-job graph is a projection rebuilt on the spot and needs nothing
 * installed. This one is the store: it holds every job at once, so a tag
 * written on a job in one search and on a person in another is a single edge
 * you can walk. That connection has nowhere to live in a per-job view, which
 * is the whole reason the store is here.
 *
 * When it is not paired the page says so plainly and prints the command,
 * rather than showing an empty canvas and letting you wonder.
 */
export function GlobalGraph({
  view: graphView,
  jobCount,
  focus = null,
}: {
  view: GlobalGraphView;
  jobCount: number;
  /**
   * The record to open on, when something else chose it — a pane following
   * the page you are standing on. Only the starting point: the moment you
   * pick a node yourself, yours wins.
   */
  focus?: string | null;
}) {
  const [view, setView] = useGraphView();
  const [selected, setSelected] = useState<string | null>(focus);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allNodes = graphView.graph?.nodes ?? [];
  const allEdges = graphView.graph?.edges ?? [];
  const filtered = applyGraphFilters(allNodes, allEdges, view.filters);
  const nodes = filtered.nodes;
  const edges = filtered.edges;
  const current =
    nodes.find((node) => node.id === selected) ?? nodes[0] ?? null;

  return (
    <div>
      <PageHeader
        title="🕸️ Whole graph"
        description="Every job, person, requirement, document, channel and tag in one picture. A tag written on a job in one search and on a person in another is one edge here — which is the connection a per-job graph cannot hold."
        actions={
          <div className="flex items-center gap-2">
            <Tag tone={graphView.reachable ? "ok" : "warn"}>
              {graphView.reachable
                ? "connected"
                : graphView.configured
                  ? "unreachable"
                  : "not paired"}
            </Tag>
            {graphView.configured && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setMessage(null);
                    const result = await syncGraphAction();
                    setMessage(
                      result.ok
                        ? `Rebuilt from ${result.data.jobs} jobs: ${result.data.nodes} records, ${result.data.edges} links.`
                        : result.error,
                    );
                  })
                }
                className="rounded bg-accent px-3 py-1.5 text-[14px] font-medium text-canvas hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Rebuilding…" : "Rebuild from records"}
              </button>
            )}
          </div>
        }
      />

      {message && (
        <p className="mb-3 rounded border border-edge2 bg-panel2 px-3 py-2 text-[13.5px] text-ink-muted">
          {message}
        </p>
      )}

      {!graphView.reachable ? (
        <Card>
          <EmptyState
            title={
              graphView.configured
                ? "The graph store is configured but not answering"
                : "The graph store is not paired"
            }
            detail={graphView.detail}
          />
          <pre className="mt-3 overflow-x-auto rounded border border-edge bg-panel2 p-3 text-[12.5px] text-ink-muted">
            {graphView.howToStart.join("\n")}
          </pre>
          <p className="mt-2 text-[13px] text-ink-faint">
            Nothing depends on it. Each of your {jobCount} jobs has its own
            graph on its Knowledge graph page either way.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          <Card>
            <p className="mb-2 text-[13px] text-ink-muted">
              {graphView.counts?.nodes} records · {graphView.counts?.edges}{" "}
              links · {graphView.counts?.tags} tags · from {jobCount} jobs ·{" "}
              {graphView.uri}
            </p>
            {allNodes.length === 0 ? (
              <EmptyState
                title="The store is empty"
                detail="Press rebuild and it will be filled from the records. Nothing is lost by doing that; the records are the source of truth and this is a projection of them."
              />
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <GraphControls
                  value={view}
                  onChange={setView}
                  counts={{
                    shown: nodes.length,
                    hidden: filtered.hidden.nodes,
                    edges: edges.length,
                  }}
                />
                <div className="min-w-0 flex-1">
                  {nodes.length === 0 ? (
                    <EmptyState
                      title="Every record is filtered out"
                      detail="The filters are hiding all of it. Turn a kind back on, or press reset."
                    />
                  ) : (
                    <GraphPictureOnly
                      nodes={nodes.slice(0, 200)}
                      edges={edges}
                      selectedId={current?.id ?? ""}
                      select={setSelected}
                      view={view}
                      matched={filtered.matched}
                    />
                  )}
                </div>
              </div>
            )}
          </Card>

          {current && (
            <Card title={`${current.label}`}>
              <p className="text-[13px] text-ink-muted">{current.detail}</p>
              {current.href && current.href !== "#" && (
                <Link
                  href={current.href}
                  className="mt-1 inline-block text-[13.5px] text-accent hover:underline"
                >
                  Open it →
                </Link>
              )}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
