/**
 * What the page you are on is connected to.
 *
 * Two things the workspace had and then only half-had. The connected strip —
 * the records this page touches, by name, one click away — existed on a job's
 * modules and nowhere else, so it vanished the moment you looked at a person,
 * a tag, the notes or the dashboard. And the knowledge graph was a pane you
 * had to open, which means it was a picture you had to remember to want.
 *
 * Both are the same question — *what is near here* — so they are one answer
 * now, computed from the address and shown at the foot of every page.
 *
 * Three readings, because "near here" means three different things:
 *
 *  - **Inside a job**, near means that job's own records: its people, its
 *    requirements, its documents, its channels. That graph is a projection of
 *    rows in SQLite and is always available.
 *  - **On a tag**, near means everything carrying that word, across jobs —
 *    which is the connection a per-job graph cannot hold, and the whole point
 *    of writing the word in two places.
 *  - **Everywhere else** — the dashboard, the notes, the task list — near
 *    means the desk: the jobs, the people, and the words written on both.
 *
 * None of it needs Neo4j. The whole-graph page uses that when it is
 * configured; this must work on a laptop with nothing running, because a
 * panel that is empty most of the time teaches people to ignore it.
 */
import type { Db } from "@/lib/db/client";
import {
  graphAdjacency,
  graphNodeHref,
  graphNodeId,
  graphWithin,
  type GraphEdge,
  type GraphKind,
  type GraphNode,
} from "@/lib/core/knowledge-graph";
import { knowledgeGraph } from "@/lib/services/knowledge-graph";
import { scanTagMentions, tagPage } from "@/lib/services/tags";
import { readDailyNote, todayKey } from "@/lib/services/daily";
import { candidates } from "@/lib/db/schema";
import { listSearchProjects } from "@/lib/services/search-projects";
import { tagSlug, tagsIn } from "@/lib/core/tags";

/**
 * How much of the graph a panel can hold.
 *
 * Past about forty the picture is a hairball and the list is a directory, and
 * both stop being the thing you glance at. Nearest first, so what is cut is
 * always the least related.
 */
export const CONTEXT_LIMIT = 40;

export interface ContextLink {
  id: string;
  kind: GraphKind;
  label: string;
  href: string;
}

/**
 * Somebody else's sentence, with this page's subject in it.
 *
 * The difference from a link is the sentence. "This job is connected to Ada"
 * is a fact you can get from the graph; "*we should ask Ada about the ramp*,
 * written on the CAIS job on Tuesday" is why anybody wrote it down, and it is
 * the half a graph cannot hold.
 */
export interface Backlink {
  id: string;
  kind: GraphKind;
  /** The record the sentence is written on. */
  label: string;
  href: string;
  /** Which field it was written in, in words. */
  where: string;
  /** The sentence around the reference. */
  context: string;
}

export interface PageContext {
  /** The record this page is about, if it is about one. */
  focus: { id: string; kind: GraphKind; label: string } | null;
  /** One line saying what this panel is showing and why. */
  says: string;
  links: ContextLink[];
  /** Who wrote about this, and what they said. Empty where nobody has. */
  backlinks: Backlink[];
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
}

const EMPTY: PageContext = {
  focus: null,
  says: "Nothing is on file yet, so there is nothing near here.",
  links: [],
  backlinks: [],
  graph: { nodes: [], edges: [] },
};

/** Enough to read; past that it is a search rather than a footnote. */
const MAX_BACKLINKS = 12;

/**
 * Every place somebody wrote this page's subject down.
 *
 * Only words: a reference is `[[a word]]` somebody typed, and this product's
 * whole connective tissue is that the same word written in two places joins
 * them. A job's own name appearing on the page about that job is not somebody
 * writing about it.
 */
function backlinksFor(db: Db, slugs: string[]): Backlink[] {
  if (slugs.length === 0) return [];
  const wanted = new Set(slugs);
  const out: Backlink[] = [];
  const seen = new Set<string>();
  for (const entry of scanTagMentions(db)) {
    if (!wanted.has(entry.slug)) continue;
    const mention = entry.mention;
    const key = `${mention.kind}:${mention.id}:${mention.field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: key,
      kind: mention.kind as GraphKind,
      label: mention.label,
      href: mention.href,
      where: mention.field,
      context: mention.context,
    });
    if (out.length >= MAX_BACKLINKS) break;
  }
  return out;
}

function trim(
  nodes: GraphNode[],
  edges: GraphEdge[],
): { graph: { nodes: GraphNode[]; edges: GraphEdge[] } } {
  const kept = nodes.slice(0, CONTEXT_LIMIT);
  const ids = new Set(kept.map((node) => node.id));
  return {
    graph: {
      nodes: kept,
      edges: edges.filter((edge) => ids.has(edge.from) && ids.has(edge.to)),
    },
  };
}

// ---------------------------------------------------------------------------
// inside a job

function jobContext(db: Db, jobId: string, candidateId: string | null) {
  let graph;
  try {
    graph = knowledgeGraph(db, jobId);
  } catch {
    // A job that has been deleted out from under an open tab. The panel says
    // nothing rather than taking the page down with it.
    return EMPTY;
  }
  const focusId = candidateId
    ? graphNodeId("candidate", candidateId)
    : graphNodeId("search", jobId);
  const focus = graph.nodes.find((node) => node.id === focusId) ?? null;

  const near = graphWithin(graph, focusId, 2, graphAdjacency(graph))
    .sort((a, b) => a.hops - b.hops)
    .map((entry) => entry.node);
  const nodes = focus ? [focus, ...near] : graph.nodes;

  // The words written on this job are what anything else could refer to it by.
  const words = graph.nodes
    .filter((node) => node.kind === "tag")
    .map((node) => node.id.slice("tag:".length));
  return {
    focus: focus
      ? { id: focus.id, kind: focus.kind, label: focus.label }
      : null,
    says: focus
      ? `Within two links of ${focus.label} in this job.`
      : "This job's own records.",
    backlinks: backlinksFor(db, words),
    links: near.map((node) => ({
      id: node.id,
      kind: node.kind,
      label: node.label,
      href: graphNodeHref(jobId, node.id),
    })),
    ...trim(nodes, graph.edges),
  };
}

// ---------------------------------------------------------------------------
// a tag

function tagContext(db: Db, slug: string): PageContext {
  const page = tagPage(db, slug);
  const rootId = graphNodeId("tag", slug);
  const root: GraphNode = {
    id: rootId,
    kind: "tag",
    label: page.display,
    detail: "the word this page is about",
    href: `/tags/${encodeURIComponent(slug)}`,
  };

  const nodes: GraphNode[] = [root];
  const edges: GraphEdge[] = [];
  const links: ContextLink[] = [];
  const seen = new Set<string>([rootId]);

  for (const mention of page.mentions) {
    const kind: GraphKind =
      mention.kind === "search" ? "search" : (mention.kind as GraphKind);
    const id = graphNodeId(kind, mention.id);
    if (seen.has(id)) continue;
    seen.add(id);
    nodes.push({
      id,
      kind,
      label: mention.label,
      detail: mention.field,
      href: mention.href,
    });
    edges.push({
      id: `${rootId}->${id}`,
      from: rootId,
      to: id,
      label: "written on",
      note: mention.context,
      origin: "stored_reference",
    });
    links.push({ id, kind, label: mention.label, href: mention.href });
  }

  // The words written alongside this one. A tag page's own best feature, and
  // the only edge in this product that crosses two jobs.
  for (const related of page.related) {
    const id = graphNodeId("tag", related.slug);
    if (seen.has(id)) continue;
    seen.add(id);
    const href = `/tags/${encodeURIComponent(related.slug)}`;
    nodes.push({
      id,
      kind: "tag",
      label: related.display,
      detail: `written beside this one ${related.shared} time${related.shared === 1 ? "" : "s"}`,
      href,
    });
    edges.push({
      id: `${rootId}~${id}`,
      from: rootId,
      to: id,
      label: `written beside · ${related.shared}`,
      note: "",
      origin: "stored_reference",
    });
    links.push({ id, kind: "tag", label: related.display, href });
  }

  return {
    focus: { id: rootId, kind: "tag", label: page.display },
    says: `${page.mentions.length} record${page.mentions.length === 1 ? "" : "s"} carry this word, and ${page.related.length} more are written beside it.`,
    links,
    backlinks: backlinksFor(db, [slug]),
    ...trim(nodes, edges),
  };
}

// ---------------------------------------------------------------------------
// the desk

/**
 * The desk: the jobs, the people on them, and the words written on both.
 *
 * Closed jobs are left out — this is a picture of what is being worked on,
 * not of everything that ever happened. The words are the part that connects
 * one job to another, which a per-job graph cannot hold and is the whole
 * reason to write the same word twice.
 */
async function deskContext(db: Db): Promise<PageContext> {
  const jobs = (await listSearchProjects(db)).filter(
    (job) => job.status === "open",
  );
  if (jobs.length === 0) return EMPTY;

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const links: ContextLink[] = [];
  const seen = new Set<string>();
  const open = new Set(jobs.map((job) => job.id));

  for (const job of jobs) {
    const id = graphNodeId("search", job.id);
    seen.add(id);
    const href = `/searches/${job.id}`;
    nodes.push({
      id,
      kind: "search",
      label: job.name,
      detail: job.roleTitle,
      href,
    });
    links.push({ id, kind: "search", label: job.name, href });
  }

  // One edge per (tag, job) pair, so a word on two jobs draws the line that
  // makes the two jobs neighbours.
  const drawn = new Set<string>();
  for (const entry of scanTagMentions(db)) {
    const mention = entry.mention;
    if (!open.has(mention.searchProjectId)) continue;
    const tagId = graphNodeId("tag", entry.slug);
    const href = `/tags/${encodeURIComponent(entry.slug)}`;
    if (!seen.has(tagId)) {
      seen.add(tagId);
      nodes.push({
        id: tagId,
        kind: "tag",
        label: entry.display,
        detail: "a word written on this desk",
        href,
      });
      links.push({ id: tagId, kind: "tag", label: entry.display, href });
    }
    const jobId = graphNodeId("search", mention.searchProjectId);
    const pair = `${tagId}|${jobId}`;
    if (drawn.has(pair)) continue;
    drawn.add(pair);
    edges.push({
      id: pair,
      from: tagId,
      to: jobId,
      label: "written on",
      note: "",
      origin: "stored_reference",
    });
  }

  // The people, edged to the job they belong to, so the picture has a shape
  // even on a desk where nobody has written a word yet.
  for (const person of db.select().from(candidates).all()) {
    if (!open.has(person.searchProjectId)) continue;
    const id = graphNodeId("candidate", person.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const href = `/searches/${person.searchProjectId}/candidates/${person.id}`;
    nodes.push({
      id,
      kind: "candidate",
      label: person.name,
      detail: person.stage,
      href,
    });
    links.push({ id, kind: "candidate", label: person.name, href });
    edges.push({
      id: `${graphNodeId("search", person.searchProjectId)}->${id}`,
      from: graphNodeId("search", person.searchProjectId),
      to: id,
      label: "in this job",
      note: "",
      origin: "stored_reference",
    });
  }

  const tags = nodes.filter((node) => node.kind === "tag").length;
  const people = nodes.filter((node) => node.kind === "candidate").length;
  const parts = [
    `${jobs.length} open job${jobs.length === 1 ? "" : "s"}`,
    people > 0 ? `${people} ${people === 1 ? "person" : "people"}` : null,
    tags > 0
      ? `${tags} word${tags === 1 ? "" : "s"} written across them`
      : "no words written across them yet",
  ].filter(Boolean);
  return {
    focus: null,
    says: `${parts.join(", ")}.`,
    links,
    backlinks: [],
    ...trim(nodes, edges),
  };
}

/**
 * A page whose subject is what you wrote today.
 *
 * Home, the notes and a day all show a note, and what is relevant on a page
 * showing a note is what the note is about: the words in it, and everything
 * else carrying those words. That is the point of writing `[[a word]]` — it
 * puts the note and the records in one place — and the panel is where that
 * becomes visible without opening anything.
 *
 * An empty note falls back to the desk, because a picture of nothing is not
 * a more relevant picture.
 */
function noteContext(db: Db, day: string): PageContext | null {
  const written = tagsIn(readDailyNote(db, day));
  if (written.length === 0) return null;

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const links: ContextLink[] = [];
  const seen = new Set<string>();
  const mentions = scanTagMentions(db);

  for (const tag of written) {
    const tagId = graphNodeId("tag", tag.slug);
    if (seen.has(tagId)) continue;
    seen.add(tagId);
    const href = `/tags/${encodeURIComponent(tag.slug)}`;
    nodes.push({
      id: tagId,
      kind: "tag",
      label: tag.display,
      detail: "written in today's note",
      href,
    });
    links.push({ id: tagId, kind: "tag", label: tag.display, href });

    for (const entry of mentions) {
      if (entry.slug !== tag.slug) continue;
      const kind = entry.mention.kind as GraphKind;
      const id = graphNodeId(kind, entry.mention.id);
      if (!seen.has(id)) {
        seen.add(id);
        nodes.push({
          id,
          kind,
          label: entry.mention.label,
          detail: entry.mention.field,
          href: entry.mention.href,
        });
        links.push({
          id,
          kind,
          label: entry.mention.label,
          href: entry.mention.href,
        });
      }
      edges.push({
        id: `${tagId}->${id}`,
        from: tagId,
        to: id,
        label: "written on",
        note: entry.mention.context,
        origin: "stored_reference",
      });
    }
  }

  const others = nodes.length - written.length;
  return {
    focus: null,
    says: `${written.length} word${written.length === 1 ? "" : "s"} in today's note, and the ${others} record${others === 1 ? "" : "s"} carrying them.`,
    links,
    backlinks: backlinksFor(
      db,
      written.map((tag) => tag.slug),
    ),
    ...trim(nodes, edges),
  };
}

// ---------------------------------------------------------------------------

const JOB = /^\/searches\/([^/]+)/;
const PERSON = /^\/searches\/[^/]+\/candidates\/([^/]+)/;
const TAG = /^\/tags\/([^/]+)$/;

/** What is near the page at this address. */
export async function pageContext(
  db: Db,
  pathname: string,
): Promise<PageContext> {
  const path = pathname.replace(/\/+$/, "") || "/";

  const tag = TAG.exec(path);
  if (tag) {
    // An address that is not a legal tag is not a tag page; the desk reading
    // is a better answer than an empty panel with a heading on it.
    const slug = tagSlug(decodeURIComponent(tag[1]));
    if (slug) return tagContext(db, slug);
  }

  const job = JOB.exec(path);
  if (job && job[1] !== "new") {
    const person = PERSON.exec(path);
    const candidateId =
      person && person[1] !== "import" ? decodeURIComponent(person[1]) : null;
    return jobContext(db, decodeURIComponent(job[1]), candidateId);
  }

  // A page that shows a note is about what the note is about.
  const day = /^\/daily\/(\d{4}-\d{2}-\d{2})$/.exec(path);
  if (path === "/" || path === "/notes" || path === "/daily" || day) {
    const note = noteContext(db, day ? day[1] : todayKey());
    if (note) return note;
  }

  return deskContext(db);
}
