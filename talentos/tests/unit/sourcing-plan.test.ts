/**
 * The sourcing plan. The point of the dormant list is that a recruiter can see
 * what a connector is worth before paying for it, so these tests assert that a
 * dormant angle still carries its full query and its reason — and that nothing
 * dormant is ever presented as having run.
 */
import { describe, expect, it } from "vitest";
import { buildPlan, summarisePlan } from "@/lib/sourcing/plan";
import { availableConnectors, routeAngle } from "@/lib/sourcing/connectors";
import { structuredSources } from "@/lib/sourcing/structured-sources";
import { parseQuery } from "@/lib/sourcing/query-language";

describe("availableConnectors", () => {
  it("always has the workspace", () => {
    expect(availableConnectors({}).has("workspace")).toBe(true);
  });

  it("reads the open index from the environment string", () => {
    const on = availableConnectors({ openIndex: "wikidata,openalex" });
    expect(on.has("wikidata")).toBe(true);
    expect(on.has("openalex")).toBe(true);
    expect(on.has("crossref")).toBe(false);
  });

  it("treats 'off' and 'mock' as no live sources", () => {
    expect(availableConnectors({ openIndex: "off" }).has("wikidata")).toBe(
      false,
    );
    expect(availableConnectors({ openIndex: "mock" }).has("wikidata")).toBe(
      false,
    );
  });
});

describe("routeAngle", () => {
  it("never hands operator syntax to a structured API", () => {
    // Found by looking at the rendered page: a team-page angle was reported as
    // running on Wikidata, which cannot parse `inurl:/team`. The row would
    // have claimed a result from a query the source could not read.
    for (const kind of ["paper", "list", "page", "repository"] as const) {
      const routing = routeAngle(
        kind,
        availableConnectors({ openIndex: "wikidata,openalex,github" }),
      );
      expect(["hosted_engine", "web"]).toContain(routing.connector.id);
      expect(routing.connector.speaksOperators).toBe(true);
    }
  });

  it("hands a web-shaped angle to the recruiter rather than fetching it", () => {
    const routing = routeAngle("page", availableConnectors({}));
    expect(routing.state).toBe("handoff");
    expect(routing.reason).toMatch(/does not read an engine/u);
  });

  it("reports dormant, with the sentence that turns it on", () => {
    const routing = routeAngle(
      "page",
      availableConnectors({ hostedEngine: false }),
    );
    expect(routing.state).toBe("dormant");
    expect(routing.reason.length).toBeGreaterThan(10);
  });
});

describe("buildPlan", () => {
  const env = { openIndex: "openalex,crossref,github", hostedEngine: false };

  it("keeps a dormant angle's full query so its value is visible", () => {
    const plan = buildPlan("skill:robotics", env);
    expect(plan.dormant.length).toBeGreaterThan(0);
    for (const row of plan.dormant) {
      expect(row.query.length).toBeGreaterThan(20);
      expect(row.angle.rationale.length).toBeGreaterThan(40);
      expect(row.routing.reason.length).toBeGreaterThan(10);
    }
  });

  it("never lists the same angle as both running and dormant", () => {
    const plan = buildPlan("skill:robotics has:email", env);
    const running = new Set(plan.running.map((r) => r.angle.name));
    for (const row of plan.dormant)
      expect(running.has(row.angle.name)).toBe(false);
    for (const row of plan.handoff)
      expect(running.has(row.angle.name)).toBe(false);
  });

  it("shows how it read the brief, and what each expansion was for", () => {
    const plan = buildPlan("robotics engineers in London", env);
    expect(plan.reading.join(" ")).toMatch(/skills: robotics/);
    expect(plan.reading.join(" ")).toMatch(/locations: london/);
    const adjacent = plan.expansions.filter((e) => !e.direct);
    expect(adjacent.length).toBeGreaterThan(0);
    for (const e of adjacent) expect(e.reason.length).toBeGreaterThan(10);
  });

  it("turns dormant angles into running ones when the connector arrives", () => {
    const before = buildPlan("skill:robotics", {
      ...env,
      webSearchKey: undefined,
    });
    const after = buildPlan("skill:robotics", {
      ...env,
      webSearchKey: "present",
    });
    expect(after.running.length).toBeGreaterThan(before.running.length);
    expect(after.dormant.length).toBe(0);
  });

  it("plans nothing from the structured sources unless the caller supplies them", () => {
    // `plan.ts` deliberately knows nothing about the adapters, so the whole
    // planner can be bundled into the browser-only build. A caller that has
    // them passes them in; one that does not gets an empty list, not a crash.
    expect(buildPlan("skill:robotics", env).structured).toEqual([]);
  });

  it("routes the structured sources through their own request shapes", () => {
    const environment = { openIndex: "wikidata,openalex" };
    const brief = parseQuery("skill:robotics");
    const plan = buildPlan(brief, environment, {
      structured: structuredSources(brief, availableConnectors(environment)),
    });
    const live = plan.structured.filter((r) => r.state === "runs");
    const off = plan.structured.filter((r) => r.state === "dormant");
    expect(live.length).toBeGreaterThan(0);
    expect(off.length).toBeGreaterThan(0);
    for (const row of plan.structured) {
      expect(row.url).toMatch(/^https:\/\//);
      expect(row.purpose.length).toBeGreaterThan(5);
      expect(row.connector.speaksOperators).toBe(false);
    }
    for (const row of off) expect(row.reason.length).toBeGreaterThan(10);
  });

  it("summarises itself honestly", () => {
    const brief = parseQuery("skill:robotics");
    const plan = buildPlan(brief, env, {
      structured: structuredSources(brief, availableConnectors(env)),
    });
    expect(summarisePlan(plan)).toMatch(/angles run/);
    expect(summarisePlan(plan)).toMatch(/waiting on a connector/);
  });

  it("plans nothing from an empty brief rather than matching the whole web", () => {
    const plan = buildPlan("", env);
    expect(plan.running).toEqual([]);
    expect(plan.dormant).toEqual([]);
    expect(plan.handoff).toEqual([]);
  });
});
