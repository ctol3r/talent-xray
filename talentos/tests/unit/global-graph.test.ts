/**
 * The whole-workspace graph.
 *
 * Built because the store existed and nobody could see it: 277 records sat
 * in Neo4j reachable only from a command-line script, so from the product's
 * seat the pairing may as well not have happened.
 *
 * What is held here is the same rule as everywhere else HSAL or Neo4j
 * appears — it adds, it is never required. Unpaired or unreachable, the page
 * says so and prints the command, and every job still has its own graph.
 */
import { afterEach, describe, expect, it } from "vitest";
import { globalGraphView, HOW_TO_START } from "@/lib/services/global-graph";
import { neo4jConfigured } from "@/lib/graph/driver";

const saved = {
  uri: process.env.NEO4J_URI,
  password: process.env.NEO4J_PASSWORD,
};

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    const name = key === "uri" ? "NEO4J_URI" : "NEO4J_PASSWORD";
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

describe("unpaired is a state, not a failure", () => {
  it("reports not configured without throwing", async () => {
    delete process.env.NEO4J_URI;
    delete process.env.NEO4J_PASSWORD;
    expect(neo4jConfigured()).toBe(false);
    const view = await globalGraphView();
    expect(view.configured).toBe(false);
    expect(view.reachable).toBe(false);
    expect(view.graph).toBeUndefined();
    // It says what to do rather than showing an empty canvas.
    expect(view.detail).toContain("Every job still has its own graph");
  });

  it("reports configured-but-down without throwing", async () => {
    process.env.NEO4J_URI = "bolt://127.0.0.1:59999";
    process.env.NEO4J_PASSWORD = "not-a-real-password";
    const view = await globalGraphView();
    expect(view.configured).toBe(true);
    expect(view.reachable).toBe(false);
    expect(view.graph).toBeUndefined();
    expect(view.detail.length).toBeGreaterThan(0);
  }, 30_000);
});

describe("the instructions it prints", () => {
  it("names the pinned image rather than latest", () => {
    const text = HOW_TO_START.join("\n");
    expect(text).toContain("neo4j:2026.07.1");
    expect(text).not.toContain("neo4j:latest");
  });

  it("mounts a volume, so a restart does not lose the graph", () => {
    expect(HOW_TO_START.join("\n")).toContain("-v neo4j-data:/data");
  });

  it("says what to do after the container is up", () => {
    expect(HOW_TO_START.join("\n")).toContain("NEO4J_URI");
  });
});
