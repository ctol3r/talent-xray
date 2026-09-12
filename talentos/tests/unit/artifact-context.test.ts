/**
 * Search-context versioning, dependency diff, and the ONE derived module
 * state (P0-B / spec §6).
 */
import { describe, expect, it } from "vitest";
import {
  contextFromFacts,
  contextVersionOf,
  describeDependencyDiff,
  diffContexts,
} from "../../artifact-src/core/search-context";
import {
  affectedByChanges,
  allModuleStates,
  moduleState,
  MODULES,
} from "../../artifact-src/core/dependencies";

const NOW = "2026-09-04T00:00:00Z";
const facts = {
  id: "s1",
  createdAt: NOW,
  name: "ICU",
  companyName: "Example Health",
  roleTitle: "Staff Nurse, ICU",
  geography: "Leeds",
  country: "United Kingdom",
  workplaceModel: "on-site required",
  jd: "NMC registration required.",
};

describe("SearchContext versions", () => {
  it("is content-addressed and stable for the same consequential inputs", () => {
    const a = contextFromFacts(facts, [], NOW);
    const b = contextFromFacts(
      { ...facts, name: "renamed" },
      [],
      "2026-09-05T00:00:00Z",
    );
    expect(a.searchVersion).toBe(b.searchVersion); // name and timestamps are not consequential
    expect(contextVersionOf(a)).toBe(a.searchVersion);
  });

  it("changes when a consequential field or a manager statement changes", () => {
    const a = contextFromFacts(facts, [], NOW);
    const b = contextFromFacts(
      { ...facts, workplaceModel: "hybrid preferred" },
      [],
      NOW,
    );
    const c = contextFromFacts(
      facts,
      [{ id: "st1", at: NOW, speaker: "hiring_manager", text: "Nights only." }],
      NOW,
    );
    expect(b.searchVersion).not.toBe(a.searchVersion);
    expect(c.searchVersion).not.toBe(a.searchVersion);
  });

  it("maps legacy facts (companyName, jd, compensationNote) onto the spec's field names", () => {
    const ctx = contextFromFacts(
      { ...facts, compensationNote: "£41k" },
      [],
      NOW,
    );
    expect(ctx.company).toBe("Example Health");
    expect(ctx.jobDescription).toBe("NMC registration required.");
    expect(ctx.compensationContext).toBe("£41k");
    expect(ctx.selectedIndustryPack).toBe("universal");
  });
});

describe("dependency diff", () => {
  it("names the field, the before/after values and every affected output", () => {
    const a = contextFromFacts(facts, [], NOW);
    const b = contextFromFacts(
      { ...facts, workplaceModel: "hybrid preferred" },
      [],
      NOW,
    );
    const changes = diffContexts(a, b);
    expect(changes).toHaveLength(1);
    expect(changes[0].label).toBe("Workplace model");
    const affected = affectedByChanges(changes);
    expect(affected).toEqual(
      expect.arrayContaining([
        "market_intelligence",
        "sourcing_strategy",
        "channels",
        "search_strings",
      ]),
    );
    expect(affected).not.toContain("hiring_need");
    const msg = describeDependencyDiff(changes, {
      moduleLabels: ["Market Intel", "Strategy", "Search Strings"],
      candidateAssessments: 7,
    });
    expect(msg).toBe(
      "Workplace model changed from on-site required to hybrid preferred. Market Intel, Strategy, Search Strings, and 7 candidate assessments are now stale.",
    );
  });

  it("a JD change invalidates the IR and everything downstream of it", () => {
    const a = contextFromFacts(facts, [], NOW);
    const b = contextFromFacts(
      { ...facts, jd: "NMC registration required. Band 6." },
      [],
      NOW,
    );
    const affected = affectedByChanges(diffContexts(a, b));
    expect(affected[0]).toBe("hiring_need");
    expect(affected).toContain("success_profile");
    expect(affected).toContain("candidates");
  });
});

describe("module state", () => {
  const rec = (over: Record<string, unknown> = {}) => ({
    payload: { ok: true },
    meta: { generatedAt: NOW, inputVersion: "v1", ...over },
    traitWarnings: [] as string[],
  });

  it("not_started with a recovery when nothing is stored", () => {
    const st = moduleState({
      key: "market_intelligence",
      currentVersion: "v1",
      researchStatus: "blocked",
      upstream: {},
    });
    expect(st.state).toBe("not_started");
    expect(st.recovery?.actionType).toBe("generate_module");
  });

  it("failed when the last attempt errored and nothing usable exists", () => {
    const st = moduleState({
      key: "channels",
      record: {
        lastError: { at: NOW, message: "rate_limited" },
        meta: { generatedAt: "" },
      },
      currentVersion: "v1",
      researchStatus: "blocked",
      upstream: {},
    });
    expect(st.state).toBe("failed");
    expect(st.reason).toContain("rate_limited");
  });

  it("stale when the input version moved, naming what changed", () => {
    const st = moduleState({
      key: "success_profile",
      record: rec(),
      currentVersion: "v2",
      changedSince: ["Job description"],
      researchStatus: "blocked",
      upstream: {},
    });
    expect(st.state).toBe("stale");
    expect(st.reason).toContain("Job description");
  });

  it("stale when an upstream module is stale", () => {
    const up = moduleState({
      key: "hiring_need",
      record: rec(),
      currentVersion: "v2",
      researchStatus: "blocked",
      upstream: {},
    });
    const st = moduleState({
      key: "success_profile",
      record: rec({ inputVersion: "v2" }),
      currentVersion: "v2",
      researchStatus: "blocked",
      upstream: { hiring_need: up },
    });
    expect(up.state).toBe("stale");
    expect(st.state).toBe("stale");
    expect(st.reason).toContain(MODULES.hiring_need.label);
  });

  it("blocked when a substantive module was generated without research", () => {
    const st = moduleState({
      key: "market_intelligence",
      record: rec({ researchStatus: "blocked" }),
      currentVersion: "v1",
      researchStatus: "blocked",
      upstream: {},
    });
    expect(st.state).toBe("blocked");
    expect(st.recovery?.actionType).toBe("add_source");
  });

  it("aging / stale follow the LIVE research status, not the stamp at generation", () => {
    const aging = moduleState({
      key: "channels",
      record: rec({ researchStatus: "current", researchSnapshotId: "rs" }),
      currentVersion: "v1",
      researchStatus: "aging",
      upstream: {},
    });
    const stale = moduleState({
      key: "channels",
      record: rec({ researchStatus: "current", researchSnapshotId: "rs" }),
      currentVersion: "v1",
      researchStatus: "stale",
      upstream: {},
    });
    expect(aging.state).toBe("aging");
    expect(stale.state).toBe("stale");
  });

  it("needs_review beats current when the output mentions a protected trait", () => {
    const st = moduleState({
      key: "role_intelligence",
      record: { ...rec(), traitWarnings: ["age"] },
      currentVersion: "v1",
      researchStatus: "blocked",
      upstream: {},
    });
    expect(st.state).toBe("needs_review");
  });

  it("current when everything lines up, with an as-of", () => {
    const st = moduleState({
      key: "hiring_need",
      record: rec(),
      currentVersion: "v1",
      researchStatus: "blocked",
      upstream: {},
    });
    expect(st.state).toBe("current");
    expect(st.reason).toContain(NOW);
  });

  it("allModuleStates resolves upstream first", () => {
    const states = allModuleStates((key) => ({
      record:
        key === "hiring_need"
          ? rec()
          : key === "success_profile"
            ? rec({ inputVersion: "v2" })
            : undefined,
      currentVersion: "v2",
      researchStatus: "blocked",
      hasContent: false,
    }));
    expect(states.hiring_need.state).toBe("stale");
    expect(states.success_profile.state).toBe("stale");
    expect(states.candidates.state).toBe("not_started");
  });
});
