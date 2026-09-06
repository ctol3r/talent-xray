import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { createSearchProject } from "@/lib/services/search-projects";
import { createCandidate, deleteCandidate } from "@/lib/services/candidates";
import {
  createGraphLink,
  knowledgeGraph,
  removeGraphLink,
} from "@/lib/services/knowledge-graph";
import {
  graphBacklinks,
  graphNodeHref,
  safeGraphUrl,
} from "@/lib/core/knowledge-graph";
import { saveDocument } from "@/lib/services/documents";
import { addReviewRequirement } from "@/lib/services/intelligence";
import {
  addConnection,
  recordReview,
  startComparison,
} from "@/lib/services/document-review";
let db: Db,
  sqlite: Database.Database,
  dir: string,
  searchId: string,
  personId: string;
function connect() {
  sqlite = new Database(path.join(dir, "graph.db"));
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });
}
beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "talentos-graph-"));
  connect();
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
  searchId = (
    await createSearchProject(db, {
      name: "Graph fixture",
      roleTitle: "Engineer",
    })
  ).id;
  personId = (
    await createCandidate(db, {
      searchProjectId: searchId,
      name: "Graph Person",
      profileUrls: [],
      stage: "identified",
    })
  ).id;
});
afterEach(() => {
  sqlite.close();
  rmSync(dir, { force: true, recursive: true });
});
const from = () => `search:${searchId}`;
const to = () => `candidate:${personId}`;
const input = () => ({
  searchProjectId: searchId,
  from: from(),
  to: to(),
  label: "discuss next",
  note: "Recruiter interpretation only.",
});
describe("reference-derived knowledge graph", () => {
  it("derives both directions from one stored reference without writing new records", () => {
    const before = db.select().from(schema.settings).all();
    const graph = knowledgeGraph(db, searchId);
    expect(
      graphBacklinks(graph, from()).outgoing.some(
        ({ node, edge }) =>
          node.id === to() && edge.label === "includes candidate",
      ),
    ).toBe(true);
    expect(
      graphBacklinks(graph, to()).incoming.some(
        ({ node }) => node.id === from(),
      ),
    ).toBe(true);
    expect(db.select().from(schema.settings).all()).toEqual(before);
    expect(graphNodeHref(searchId, to())).toContain(encodeURIComponent(to()));
  });
  it("saves one manual relationship, exposes both endpoints, survives restart and does not advance a stage", () => {
    const stages = db.select().from(schema.pipelineEvents).all();
    const link = createGraphLink(db, input());
    const duplicate = createGraphLink(db, {
      ...input(),
      label: "DISCUSS NEXT",
    });
    expect(duplicate.id).toBe(link.id);
    sqlite.close();
    connect();
    const graph = knowledgeGraph(db, searchId);
    expect(
      graphBacklinks(graph, from()).outgoing.some(
        ({ edge }) => edge.id === link.id && edge.origin === "recruiter",
      ),
    ).toBe(true);
    expect(
      graphBacklinks(graph, to()).incoming.some(
        ({ edge }) => edge.id === link.id,
      ),
    ).toBe(true);
    expect(
      db
        .select()
        .from(schema.candidates)
        .where(eq(schema.candidates.id, personId))
        .get()?.stage,
    ).toBe("identified");
    expect(db.select().from(schema.pipelineEvents).all()).toEqual(stages);
    removeGraphLink(db, { searchProjectId: searchId, linkId: link.id });
    const remaining = knowledgeGraph(db, searchId);
    expect(remaining.edges.some((edge) => edge.id === link.id)).toBe(false);
    expect(
      remaining.edges.some((edge) => edge.label === "includes candidate"),
    ).toBe(true);
  });
  it("rejects missing, self and cross-search endpoints and cross-search removal without writes", async () => {
    const other = (
      await createSearchProject(db, { name: "Other", roleTitle: "Analyst" })
    ).id;
    const otherPerson = (
      await createCandidate(db, {
        searchProjectId: other,
        name: "Other Person",
        profileUrls: [],
        stage: "identified",
      })
    ).id;
    const before = db.select().from(schema.settings).all();
    expect(() =>
      createGraphLink(db, { ...input(), to: `candidate:${otherPerson}` }),
    ).toThrow(/this search/);
    expect(() =>
      createGraphLink(db, { ...input(), to: "candidate:missing" }),
    ).toThrow(/this search/);
    expect(() => createGraphLink(db, { ...input(), to: from() })).toThrow(
      /different records/,
    );
    expect(db.select().from(schema.settings).all()).toEqual(before);
    const link = createGraphLink(db, input());
    expect(() =>
      removeGraphLink(db, { searchProjectId: other, linkId: link.id }),
    ).toThrow(/not found/);
    expect(
      knowledgeGraph(db, searchId).edges.some((edge) => edge.id === link.id),
    ).toBe(true);
    expect(
      knowledgeGraph(db, searchId).nodes.some(
        (node) => node.id === `candidate:${otherPerson}`,
      ),
    ).toBe(false);
  });
  it("retains dangling manual links for explicit cleanup without presenting a valid endpoint", async () => {
    const link = createGraphLink(db, input());
    await deleteCandidate(db, personId);
    const graph = knowledgeGraph(db, searchId);
    expect(graph.unavailableLinks.map((item) => item.id)).toEqual([link.id]);
    expect(graph.edges.some((edge) => edge.id === link.id)).toBe(false);
    expect(
      graphBacklinks(graph, from()).outgoing.some(
        ({ node }) => node.id === to(),
      ),
    ).toBe(false);
    removeGraphLink(db, { searchProjectId: searchId, linkId: link.id });
    expect(knowledgeGraph(db, searchId).unavailableLinks).toHaveLength(0);
  });
  it("includes explicitly saved browser URLs without snippets or executable source links", () => {
    const source = db
      .insert(schema.candidateSources)
      .values({
        candidateId: personId,
        url: "https://example.org/profile",
        label: "Saved profile",
        addedVia: "browser_capture",
      })
      .returning()
      .get();
    db.insert(schema.researchSources)
      .values({
        searchProjectId: searchId,
        url: "javascript:alert(1)",
        title: "Untrusted URL",
        source: "browser_capture",
        snippet: "Private snippet sentinel",
      })
      .run();
    const graph = knowledgeGraph(db, searchId);
    expect(
      graphBacklinks(graph, to()).outgoing.some(
        ({ node }) =>
          node.id === `source:candidate:${source.id}` &&
          node.externalUrl === "https://example.org/profile",
      ),
    ).toBe(true);
    expect(
      graph.nodes.find((node) => node.label === "Untrusted URL")?.externalUrl,
    ).toBeUndefined();
    expect(JSON.stringify(graph)).not.toContain("Private snippet sentinel");
    expect(safeGraphUrl("https://user:secret@example.org")).toBeUndefined();
    expect(safeGraphUrl("data:text/html,<script>")).toBeUndefined();
  });
  it("does not erase an unreadable manual-link store", () => {
    db.insert(schema.settings)
      .values({
        key: `knowledge-graph:${searchId}`,
        value: { version: 999, links: ["prior"] },
      })
      .run();
    expect(() => createGraphLink(db, input())).toThrow(/preserved/);
    expect(
      db
        .select()
        .from(schema.settings)
        .where(eq(schema.settings.key, `knowledge-graph:${searchId}`))
        .get()?.value,
    ).toEqual({ version: 999, links: ["prior"] });
  });
  it("keeps evidence assessment, review state and stale document versions distinct", async () => {
    const text = "Build Python services.";
    const jd = saveDocument(db, {
      searchProjectId: searchId,
      kind: "jd",
      text,
      confirmed: true,
    });
    const cv = saveDocument(db, {
      searchProjectId: searchId,
      candidateId: personId,
      kind: "cv",
      text: "Built Python services. Private document sentinel.",
      confirmed: true,
    });
    const requirement = await addReviewRequirement(db, {
      searchProjectId: searchId,
      statement: text,
      origin: "jd",
      jdVersionId: jd.id,
      anchor: { start: 0, end: text.length, quote: text },
    });
    const comparison = startComparison(db, searchId, personId);
    const link = addConnection(db, comparison.id, {
      requirementId: requirement.id!,
      cvAnchor: { start: 0, end: 22, quote: "Built Python services." },
      jdAnchor: { start: 0, end: text.length, quote: text },
      assessment: "partial",
      explanation: "States Python experience.",
      limitation: "Scope unverified.",
    });
    expect(
      knowledgeGraph(db, searchId).edges.find(
        (edge) => edge.id === `evidence:${link.id}`,
      )?.label,
    ).toBe("partial · suggested · current");
    recordReview(db, {
      linkId: link.id,
      decision: "accepted",
      note: "Relationship reviewed.",
    });
    let graph = knowledgeGraph(db, searchId);
    expect(
      graph.edges.find((edge) => edge.id === `evidence:${link.id}`)?.label,
    ).toBe("partial · accepted · current");
    expect(JSON.stringify(graph)).not.toContain("Private document sentinel");
    saveDocument(db, {
      searchProjectId: searchId,
      candidateId: personId,
      kind: "cv",
      text: "Revised CV.",
      confirmed: true,
      previousId: cv.id,
    });
    graph = knowledgeGraph(db, searchId);
    expect(
      graph.nodes.find((node) => node.id === `comparison:${comparison.id}`)
        ?.status,
    ).toBe("stale");
    expect(
      graph.edges.find((edge) => edge.id === `evidence:${link.id}`)?.label,
    ).toBe("partial · accepted · stale");
    expect(
      graphBacklinks(graph, `document:${cv.id}`).outgoing.some(
        ({ edge }) => edge.label === "revised as",
      ),
    ).toBe(true);
    // A corrupt stored anchor must not become a convincing graph relationship.
    db.update(schema.documentLinks)
      .set({
        payload: {
          ...link.payload,
          cvAnchor: { start: 0, end: 9, quote: "invented!" },
        },
      })
      .where(eq(schema.documentLinks.id, link.id))
      .run();
    expect(
      knowledgeGraph(db, searchId).edges.some(
        (edge) => edge.id === `evidence:${link.id}`,
      ),
    ).toBe(false);
  });
});
