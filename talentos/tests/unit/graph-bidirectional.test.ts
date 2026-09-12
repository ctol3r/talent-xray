/**
 * Bi-directional linking, and tags as the thing that links.
 *
 * The property under test is the one a one-way graph cannot have: standing
 * on a person, you can reach the search that shares a word with them, by
 * walking one edge backwards and one forwards. Direction is still recorded,
 * because "includes candidate" is not the same sentence read backwards — it
 * is just not allowed to stop a traversal.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import {
  graphNeighbours,
  graphWithin,
  type GraphEdge,
  type GraphNode,
} from "@/lib/core/knowledge-graph";
import { knowledgeGraph } from "@/lib/services/knowledge-graph";
import { createCandidate, updateCandidate } from "@/lib/services/candidates";
import {
  createSearchProject,
  updateSearchProject,
} from "@/lib/services/search-projects";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

function node(id: string, kind: GraphNode["kind"] = "candidate"): GraphNode {
  return { id, kind, label: id, detail: "", href: `/x/${id}` };
}
function edge(from: string, to: string, label = "mentions"): GraphEdge {
  return {
    id: `${from}->${to}`,
    from,
    to,
    label,
    note: "",
    origin: "stored_reference",
  };
}

describe("an edge is walkable from either end", () => {
  const graph = {
    nodes: [node("a"), node("b"), node("t", "tag")],
    edges: [edge("a", "t"), edge("b", "t")],
  };

  it("returns neighbours whichever way the edge points", () => {
    expect(
      graphNeighbours(graph, "t").map((n) => `${n.node.id}:${n.direction}`),
    ).toEqual(["a:in", "b:in"]);
    expect(
      graphNeighbours(graph, "a").map((n) => `${n.node.id}:${n.direction}`),
    ).toEqual(["t:out"]);
  });

  it("reaches the far record through the shared word", () => {
    const within = graphWithin(graph, "a", 2);
    const far = within.find((entry) => entry.node.id === "b")!;
    expect(far.hops).toBe(2);
    expect(far.path.map((e) => e.label)).toEqual(["mentions", "mentions"]);
  });

  it("stops at the depth asked for", () => {
    expect(graphWithin(graph, "a", 1).map((e) => e.node.id)).toEqual(["t"]);
  });

  it("visits each record once, by its shortest path", () => {
    const dense = {
      nodes: [node("a"), node("b"), node("t", "tag"), node("u", "tag")],
      edges: [edge("a", "t"), edge("b", "t"), edge("a", "u"), edge("b", "u")],
    };
    const ids = graphWithin(dense, "a", 3).map((entry) => entry.node.id);
    expect(ids).toEqual([...new Set(ids)]);
    expect(
      graphWithin(dense, "a", 3).find((e) => e.node.id === "b")!.hops,
    ).toBe(2);
  });

  it("returns nothing for a record that is not in the graph", () => {
    expect(graphWithin(graph, "missing", 2)).toEqual([]);
  });
});

describe("a tag written twice is an edge in the real graph", () => {
  let db: Db;
  let sqlite: Database.Database;
  let dir: string;
  let projectId: string;
  let personId: string;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-graph-"));
    sqlite = new Database(path.join(dir, "test.db"));
    sqlite.pragma("foreign_keys = ON");
    db = drizzle(sqlite, { schema }) as unknown as Db;
    migrate(db, { migrationsFolder: path.resolve("drizzle") });

    const project = await createSearchProject(db, {
      name: "Graph tags",
      roleTitle: "Founding Recruiter",
    });
    projectId = project.id;
    await updateSearchProject(db, {
      id: projectId,
      recruiterNotes: "Turns on closing [[research engineers]].",
    });
    const person = await createCandidate(db, {
      searchProjectId: projectId,
      name: "Jordan Rivera",
    });
    personId = person.id;
    await updateCandidate(db, {
      id: personId,
      recruiterNotes: "Closed three [[research engineers]] at a lab.",
    });
  });

  afterAll(() => {
    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("makes the tag a node, not a label on a row", () => {
    const graph = knowledgeGraph(db, projectId);
    const tag = graph.nodes.find((entry) => entry.kind === "tag")!;
    expect(tag.label).toBe("research engineers");
    expect(tag.href).toBe("/tags/research-engineers");
  });

  it("connects the job and the person through it, both ways", () => {
    const graph = knowledgeGraph(db, projectId);
    const tag = graph.nodes.find((entry) => entry.kind === "tag")!;
    expect(
      graphNeighbours(graph, tag.id)
        .map((entry) => entry.node.kind)
        .sort(),
    ).toEqual(["candidate", "search"]);

    const person = graph.nodes.find(
      (entry) => entry.kind === "candidate" && entry.label === "Jordan Rivera",
    )!;
    const reached = graphWithin(graph, person.id, 2).find(
      (entry) => entry.node.id === tag.id,
    );
    expect(reached?.hops).toBe(1);
  });

  it("loses the node when the word is deleted, because there is no table", async () => {
    await updateCandidate(db, { id: personId, recruiterNotes: "No tags now." });
    await updateSearchProject(db, { id: projectId, recruiterNotes: "None." });
    expect(
      knowledgeGraph(db, projectId).nodes.filter((n) => n.kind === "tag"),
    ).toEqual([]);
  });
});
