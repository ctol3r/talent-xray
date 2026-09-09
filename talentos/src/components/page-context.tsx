"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraphPictureOnly } from "./knowledge-graph";
import { PreviewLink } from "./page-preview";
import { markFor } from "../../artifact-src/core/marks";
import type { GraphKind } from "@/lib/core/knowledge-graph";
import type { PageContext as Context } from "@/lib/services/page-context";

/**
 * What this page connects to, at the foot of every page.
 *
 * Two things that had gone missing between them. The connected strip — the
 * records this page touches, by name — lived on a job's modules and nowhere
 * else, so it disappeared the moment you looked at a person, a tag, the notes
 * or the dashboard. And the knowledge graph was a pane you had to open, which
 * makes it a picture you have to remember to want.
 *
 * They are the same question, so they are one panel: the picture on the left,
 * the names on the right, both about wherever you happen to be standing. The
 * names matter as much as the shape — a graph tells you there are eleven
 * things near here and a list tells you which eleven, and the reason to write
 * a word on two records is to be able to read both of them back.
 *
 * Open or shut is remembered, because this is a preference about how you like
 * to work rather than about this page.
 */

const KIND_LABEL: Record<GraphKind, string> = {
  search: "Jobs",
  candidate: "People",
  requirement: "Requirements",
  document: "Documents",
  comparison: "Comparisons",
  channel: "Channels",
  source: "Sources",
  tag: "Tags",
};

const KIND_ORDER: GraphKind[] = [
  "tag",
  "candidate",
  "search",
  "requirement",
  "document",
  "comparison",
  "channel",
  "source",
];

const OPEN_KEY = "talentos.context-open";
const OPEN_EVENT = "talentos:context-open";

/**
 * Open or shut, remembered.
 *
 * A preference about how you like to work rather than about this page, so it
 * outlives the tab. Read through the store rather than in an effect so the
 * first client render already knows, and cached because
 * `useSyncExternalStore` compares snapshots by identity.
 */
let openCache: { raw: string | null; value: boolean } | null = null;

function subscribeOpen(listener: () => void): () => void {
  window.addEventListener(OPEN_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(OPEN_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function readOpen(): boolean {
  try {
    const raw = window.localStorage.getItem(OPEN_KEY);
    if (!openCache || openCache.raw !== raw) {
      openCache = { raw, value: raw !== "shut" };
    }
    return openCache.value;
  } catch {
    return true;
  }
}

/**
 * What a row is, in the workspace's own vocabulary.
 *
 * Three kinds have a preview card and an identity everything else in the
 * product agrees on: a job is `job:<id>`, a person `candidate:<id>`, a tag
 * `tag:<slug>`. Anything else — a requirement, a document, a channel — has
 * neither, and it used to be handed `tag:<whatever>`, which asked the preview
 * API for a tag that does not exist and, worse, gave the same record two
 * different names depending on which surface it was drawn on. The bands
 * between parallel pages join on this, so a record with two names is a record
 * that never joins to itself.
 */
function previewTarget(kind: GraphKind, id: string): string | null {
  if (kind === "tag") return `tag:${id.slice("tag:".length)}`;
  if (kind === "candidate") return `candidate:${id.slice("candidate:".length)}`;
  if (kind === "search") return `job:${id.slice("search:".length)}`;
  return null;
}

/** One row: previewable where the product has a card for it, a plain link where it does not. */
function ContextLinkRow({
  link,
  here,
}: {
  link: Context["links"][number];
  here: boolean;
}) {
  const target = previewTarget(link.kind, link.id);
  const className = `block truncate text-[13px] hover:underline ${
    here ? "text-ink" : "text-ink-muted"
  }`;
  if (!target) {
    return (
      <Link href={link.href} className={className}>
        {link.label}
      </Link>
    );
  }
  return (
    <PreviewLink target={target} href={link.href} className={className}>
      {link.label}
    </PreviewLink>
  );
}

export function PageContextPanel() {
  const pathname = usePathname();
  // The answer, with the question it answers. Navigation changes the question
  // before the new answer arrives, and holding both means a stale reply
  // simply does not match rather than sitting under the wrong heading.
  const [answer, setAnswer] = useState<{ path: string; data: Context } | null>(
    null,
  );
  const context = answer?.path === pathname ? answer.data : null;

  const open = useSyncExternalStore(subscribeOpen, readOpen, () => true);
  const setOpen = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(OPEN_KEY, next ? "open" : "shut");
    } catch {
      // A browser that refuses storage still gets a panel, just one that
      // forgets which way you left it.
    }
    window.dispatchEvent(new Event(OPEN_EVENT));
  }, []);

  useEffect(() => {
    let live = true;
    fetch(`/api/context?path=${encodeURIComponent(pathname)}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((payload: Context) => {
        if (live) setAnswer({ path: pathname, data: payload });
      })
      .catch(() => {
        // Nothing to say. The panel stays on its loading line rather than
        // putting an error at the foot of every page in the product.
      });
    return () => {
      live = false;
    };
  }, [pathname]);

  const grouped = KIND_ORDER.map((kind) => ({
    kind,
    items: (context?.links ?? []).filter((link) => link.kind === kind),
  })).filter((group) => group.items.length > 0);

  const total = context?.links.length ?? 0;

  return (
    <section
      data-testid="page-context"
      className="mt-8 rounded-lg border border-edge bg-panel/40"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-full items-baseline justify-between gap-3 px-3 py-2 text-left"
      >
        <span className="min-w-0 text-[13px] text-ink-muted">
          <span aria-hidden className="mr-1.5">
            🕸️
          </span>
          Connected here
          {context && (
            <span className="ml-2 text-ink-faint">
              {total} record{total === 1 ? "" : "s"} · {context.says}
            </span>
          )}
        </span>
        <span aria-hidden className="shrink-0 text-[12px] text-ink-faint">
          {open ? "⌃" : "⌄"}
        </span>
      </button>

      {open && (
        <div className="grid gap-4 border-t border-edge px-3 py-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          {context && context.graph.nodes.length > 0 ? (
            <div className="min-w-0 overflow-hidden rounded border border-edge">
              <GraphPictureOnly
                compact
                nodes={context.graph.nodes}
                edges={context.graph.edges}
                selectedId={context.focus?.id ?? context.graph.nodes[0].id}
                select={() => {}}
              />
            </div>
          ) : (
            <p className="text-[13px] text-ink-faint">
              {context
                ? "No picture yet — a word written on two records is what draws the first line."
                : "Reading what is near here…"}
            </p>
          )}

          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {grouped.map((group) => (
              <div key={group.kind} className="min-w-0">
                <p className="mb-1 text-[11px] tracking-wider text-ink-faint uppercase">
                  <span aria-hidden className="mr-1">
                    {markFor(group.kind)}
                  </span>
                  {KIND_LABEL[group.kind]}
                </p>
                <ul className="space-y-0.5">
                  {group.items.slice(0, 8).map((link) => (
                    <li key={link.id} className="flex min-w-0 gap-1.5">
                      <span aria-hidden className="shrink-0 text-[12px]">
                        {markFor(link.kind)}
                      </span>
                      <ContextLinkRow
                        link={link}
                        here={pathname === link.href}
                      />
                    </li>
                  ))}
                  {group.items.length > 8 && (
                    <li className="text-[12px] text-ink-faint">
                      +{group.items.length - 8} more
                    </li>
                  )}
                </ul>
              </div>
            ))}
            {context && context.backlinks.length > 0 && (
              /*
                Backlinks, with the sentence. The difference between this and
                the list above is the sentence: "connected to Ada" is a fact
                the graph already has, and "we should ask Ada about the ramp,
                written on the CAIS job on Tuesday" is why anybody wrote it
                down — which is the half a graph cannot hold.
              */
              <div className="min-w-0 sm:col-span-2">
                <p className="mb-1 text-[11px] tracking-wider text-ink-faint uppercase">
                  <span aria-hidden className="mr-1">
                    ↩︎
                  </span>
                  Referenced by
                </p>
                <ul className="space-y-1.5">
                  {context.backlinks.map((back) => (
                    <li
                      key={back.id}
                      className="border-l-2 border-edge2 pl-2.5"
                    >
                      <Link
                        href={back.href}
                        className="text-[13px] text-ink hover:underline"
                      >
                        <span aria-hidden className="mr-1">
                          {markFor(back.kind)}
                        </span>
                        {back.label}
                      </Link>
                      <span className="ml-1.5 text-[11px] text-ink-faint">
                        {back.where}
                      </span>
                      <p className="text-[12.5px] text-ink-muted">
                        {back.context}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {context && grouped.length === 0 && (
              <p className="text-[13px] text-ink-faint">
                Nothing is written near here yet. Type [[a word]] in a note on
                two records and both of them appear in this panel.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
