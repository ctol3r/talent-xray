/**
 * What a pane can be.
 *
 * A pane started as one thing — a page, meaning a tag or a record — which
 * made the stack a reading tool and nothing else. Every page in the workspace
 * is a pane now: the dashboard, the calendar, the task list, a job, the people
 * list, the tag index, the graph, a search, a sourcing brief, the settings. A
 * trail of thought is not only made of pages.
 *
 * `paneForRoute` is what makes that true without a per-page decision: any
 * address in the workspace maps to the pane that stands for it, so shift-click
 * anywhere opens beside your work instead of replacing it.
 *
 * A pane is identified by a single string so the whole stack fits in a URL
 * and stays shareable. The prefix decides what it is; everything after the
 * first colon is that kind's own id.
 *
 * Parsing lives here, apart from the rendering, because "what is in this
 * URL" is the question that breaks first and is the cheapest to test.
 */

export const PANE_KINDS = [
  "page",
  "home",
  "tasks",
  "calendar",
  "job",
  "people",
  "dashboard",
  "jobs",
  "tags",
  "graph",
  "settings",
  "outbox",
  "search",
  "sourcing",
  "notes",
] as const;
export type PaneKind = (typeof PANE_KINDS)[number];

export interface PaneRef {
  /** The original string, so a pane can be found in the stack by identity. */
  target: string;
  kind: PaneKind;
  /** The kind's own id: a slug, a job id, or a date. Empty where unused. */
  id: string;
}

const ICONS: Record<PaneKind, string> = {
  page: "🏷️",
  home: "🏠",
  tasks: "✅",
  calendar: "📅",
  job: "💼",
  people: "👥",
  dashboard: "🏠",
  jobs: "💼",
  tags: "🏷️",
  graph: "🕸️",
  settings: "⚙️",
  outbox: "📮",
  search: "🔍",
  sourcing: "🔭",
  notes: "📝",
};

/**
 * Kinds that are one thing, not one of many, so their target is just the kind.
 * `tasks` is the task list; there is no second one to distinguish it from.
 */
const SINGLETONS: readonly PaneKind[] = [
  "home",
  "notes",
  "tasks",
  "people",
  "dashboard",
  "jobs",
  "tags",
  "graph",
  "settings",
  "outbox",
];

export function paneIcon(kind: PaneKind): string {
  return ICONS[kind];
}

/**
 * Read a pane out of its string.
 *
 * A bare slug with no prefix is a page, because that is what every stack
 * written before typed panes existed contains, and an old link should still
 * open the thing it used to.
 */
export function parsePane(target: string): PaneRef {
  const trimmed = target.trim();
  const colon = trimmed.indexOf(":");
  const head = colon === -1 ? trimmed : trimmed.slice(0, colon);
  const rest = colon === -1 ? "" : trimmed.slice(colon + 1);

  if ((PANE_KINDS as readonly string[]).includes(head)) {
    const kind = head as PaneKind;
    return { target: trimmed, kind, id: rest };
  }
  return { target: trimmed, kind: "page", id: trimmed };
}

/** The canonical string for a pane, so the same thing is never opened twice. */
export function paneTarget(kind: PaneKind, id = ""): string {
  if (SINGLETONS.includes(kind)) return kind;
  if (kind === "calendar") return id ? `calendar:${id}` : "calendar";
  // A search or a sourcing brief with nothing in it is a blank box, so an
  // empty id keeps the kind alone and the pane says what it is waiting for.
  if ((kind === "search" || kind === "sourcing") && !id) return kind;
  return `${kind}:${id}`;
}

/** The title shown before the pane's own content has loaded. */
export function paneFallbackTitle(ref: PaneRef): string {
  switch (ref.kind) {
    case "home":
      return "Home";
    case "notes":
      return "Notes";
    case "tasks":
      return "Tasks";
    case "people":
      return "People";
    case "calendar":
      return ref.id || "Today";
    case "job":
      return "Job";
    case "dashboard":
      return "Dashboard";
    case "jobs":
      return "Jobs";
    case "tags":
      return "Tags";
    case "graph":
      return "Whole graph";
    case "settings":
      return "Settings";
    case "outbox":
      return "Outbox";
    case "search":
      return ref.id ? `Search: ${ref.id}` : "Search";
    case "sourcing":
      return ref.id ? `Sourcing: ${ref.id}` : "Sourcing";
    default:
      return ref.id || "Page";
  }
}

/**
 * The pane that stands for a route, so any page in the workspace can be opened
 * beside your work rather than instead of it.
 *
 * Returns null for a route with no pane of its own — a job's own modules are
 * reached through the job pane, and there is nothing to gain from a pane whose
 * only content is a link to the page you are already on.
 */
export function paneForRoute(pathname: string, search = ""): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const query = new URLSearchParams(search).get("q") ?? "";

  if (path === "/") return paneTarget("home");
  if (path === "/dashboard") return paneTarget("dashboard");
  if (path === "/candidates") return paneTarget("people");
  if (path === "/tasks") return paneTarget("tasks");
  if (path === "/tags") return paneTarget("tags");
  if (path === "/graph") return paneTarget("graph");
  if (path === "/settings") return paneTarget("settings");
  if (path === "/outbox") return paneTarget("outbox");
  if (path === "/searches") return paneTarget("jobs");
  if (path === "/search") return paneTarget("search", query);
  if (path === "/sourcing") return paneTarget("sourcing", query);
  if (path === "/daily") return paneTarget("calendar");
  if (path === "/notes") return paneTarget("notes");

  const day = /^\/daily\/(\d{4}-\d{2}-\d{2})$/.exec(path);
  if (day) return paneTarget("calendar", day[1]);

  const tag = /^\/tags\/([^/]+)$/.exec(path);
  if (tag) return paneTarget("page", decodeURIComponent(tag[1]));

  const job = /^\/searches\/([^/]+)/.exec(path);
  if (job) return paneTarget("job", job[1]);

  return null;
}

/**
 * The address a pane shows.
 *
 * The exact inverse of `paneForRoute`, and it exists because a pane no longer
 * renders a summary of a page — it renders the page. Every kind here already
 * had a route; what it did not have was one implementation. There were two:
 * the page, and a hand-written projection of the page in `/api/pane` that had
 * to be extended by hand every time the page grew, and never was.
 *
 * `focus` is only meaningful for the graph, the one pane that changes with
 * where you are standing rather than with what you opened.
 */
export function routeForPane(ref: PaneRef, focus?: string | null): string {
  const q = (base: string, key: string, value: string) =>
    value ? `${base}?${key}=${encodeURIComponent(value)}` : base;

  switch (ref.kind) {
    case "home":
      return "/";
    case "dashboard":
      return "/dashboard";
    case "notes":
      return "/notes";
    case "tasks":
      return "/tasks";
    case "people":
      return "/candidates";
    case "jobs":
      return "/searches";
    case "tags":
      return "/tags";
    case "graph":
      return q("/graph", "focus", focus ?? "");
    case "settings":
      return "/settings";
    case "outbox":
      return "/outbox";
    case "search":
      return q("/search", "q", ref.id);
    case "sourcing":
      return q("/sourcing", "q", ref.id);
    case "calendar":
      return ref.id ? `/daily/${ref.id}` : "/daily";
    case "job":
      return `/searches/${ref.id}`;
    default:
      return `/tags/${encodeURIComponent(ref.id)}`;
  }
}

/**
 * The record the page you are on is about, as a graph node.
 *
 * This is what lets one graph pane follow you around: it stays open, in
 * whichever slot you put it, and re-centres on whatever the current page is
 * about rather than showing the same picture everywhere. A graph that does not
 * change as you move is a picture; one that does is a place you are standing.
 *
 * Null where a page is not about one record — the task list, settings, the
 * whole-graph page itself — and the pane falls back to the busiest part of the
 * graph, which is the honest answer to "what is near here" when the answer is
 * "nothing in particular".
 */
export function graphNodeForRoute(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";

  const person = /^\/searches\/[^/]+\/candidates\/([^/]+)/.exec(path);
  if (person && person[1] !== "import") return `candidate:${person[1]}`;

  const job = /^\/searches\/([^/]+)/.exec(path);
  if (job && job[1] !== "new") return `search:${job[1]}`;

  const tag = /^\/tags\/([^/]+)$/.exec(path);
  if (tag) return `tag:${decodeURIComponent(tag[1])}`;

  return null;
}

/**
 * Move a pane from one position to another.
 *
 * Dragging a pane past its own position has to account for the gap it leaves
 * behind, which is the off-by-one that makes every hand-rolled reorder feel
 * wrong. Removing first and inserting into the shortened list handles it:
 * the index the user dropped on already refers to the list without the
 * dragged pane in it.
 */
export function movePane(
  panes: string[],
  target: string,
  toIndex: number,
): string[] {
  const from = panes.indexOf(target);
  if (from === -1) return panes;
  const without = panes.filter((entry) => entry !== target);
  const at = Math.max(0, Math.min(without.length, toIndex));
  return [...without.slice(0, at), target, ...without.slice(at)];
}
