/**
 * P0-C: every count the UI shows comes from the execution graph, so no
 * literal can drift. Plus the conservative identity resolution (spec §12),
 * which never merges two records by itself.
 */
import { describe, expect, it } from "vitest";
import {
  ProgressTracker,
  formatElapsed,
  planExecution,
} from "../../artifact-src/core/execution-plan";
import { findIdentityMatches } from "../../artifact-src/core/identity";
import { CREW_ORDER } from "../../artifact-src/ai/tasks";
import { MODULES } from "../../artifact-src/core/dependencies";

const modules = [
  { key: "hiring_need", label: "Canonical Need" },
  { key: "success_profile", label: "Success Profile" },
];

describe("execution plan", () => {
  it("derives the call range from the graph, with revision passes optional", () => {
    const plan = planExecution({ kind: "crew", modules, withCritic: true });
    expect(plan.modelCalls).toEqual({ min: 4, max: 6 });
    expect(plan.summary).toBe("2 modules · 4–6 model calls");
  });

  it("counts research operations separately from model calls", () => {
    const plan = planExecution({
      kind: "crew",
      modules,
      withCritic: false,
      researchOps: 1,
    });
    expect(plan.modelCalls).toEqual({ min: 2, max: 2 });
    expect(plan.researchOps).toBe(1);
    expect(plan.summary).toContain("1 research op");
  });

  it("a single module reads in the singular", () => {
    const plan = planExecution({
      kind: "module",
      modules: modules.slice(0, 1),
      withCritic: false,
    });
    expect(plan.summary).toBe("1 module · 1 model call");
  });

  it("the crew plan covers every crew module, including the canonical need", () => {
    const plan = planExecution({
      kind: "crew",
      modules: CREW_ORDER.map((k) => ({ key: k, label: MODULES[k].label })),
      withCritic: true,
    });
    expect(plan.modules).toEqual([...CREW_ORDER]);
    expect(plan.modules).toContain("hiring_need");
    expect(plan.modelCalls.min).toBe(CREW_ORDER.length * 2);
    expect(plan.modelCalls.max).toBe(CREW_ORDER.length * 3);
  });
});

describe("progress tracker", () => {
  it("reports completed, skipped, retries and failures against the plan", () => {
    const plan = planExecution({ kind: "crew", modules, withCritic: true });
    const t = new ProgressTracker(plan);
    t.start("hiring_need", "generate");
    t.done("hiring_need", "generate");
    t.start("hiring_need", "critic");
    t.done("hiring_need", "critic");
    t.skip("hiring_need", "revise", "critic accepted");
    t.start("success_profile", "generate");
    t.fail("success_profile", "generate", "rate_limited");
    t.start("success_profile", "generate");
    t.done("success_profile", "generate");
    t.finish();

    const snap = t.snapshot();
    expect(snap.total).toBe(6);
    expect(snap.completed).toBe(3);
    expect(snap.skipped).toBe(1);
    expect(snap.retries).toBe(1);
    expect(snap.finished).toBe(true);
    expect(
      snap.steps.find((s) => s.module === "hiring_need" && s.kind === "revise")
        ?.error,
    ).toBe("critic accepted");
  });

  it("a run with a failure and some progress is resumable", () => {
    const plan = planExecution({ kind: "crew", modules, withCritic: false });
    const t = new ProgressTracker(plan);
    t.start("hiring_need", "generate");
    t.done("hiring_need", "generate");
    t.start("success_profile", "generate");
    t.fail("success_profile", "generate", "network");
    const snap = t.snapshot();
    expect(snap.failures).toBe(1);
    expect(snap.resumable).toBe(true);
    expect(snap.finished).toBe(false);
  });

  it("snapshots are copies, not the tracker's own step objects", () => {
    const t = new ProgressTracker(
      planExecution({
        kind: "module",
        modules: modules.slice(0, 1),
        withCritic: false,
      }),
    );
    const snap = t.snapshot();
    snap.steps[0].status = "done";
    expect(t.snapshot().steps[0].status).toBe("pending");
  });

  it("formats elapsed time in seconds then minutes", () => {
    expect(formatElapsed(4_000)).toBe("4s");
    expect(formatElapsed(125_000)).toBe("2m 5s");
  });
});

describe("identity resolution never merges by itself", () => {
  const existing = [
    {
      id: "a",
      name: "Priya Patel",
      currentCompany: "Leeds Teaching Hospitals",
      profileUrls: ["https://www.linkedin.com/in/priya-patel/"],
    },
    { id: "b", name: "Sam O'Neill", currentCompany: "Example Health" },
  ];

  it("a shared profile URL is the strongest signal, and still only a flag", () => {
    const m = findIdentityMatches(
      {
        id: "new",
        name: "P. Patel",
        profileUrls: ["http://linkedin.com/in/priya-patel"],
      },
      existing,
    );
    expect(m).toHaveLength(1);
    expect(m[0].strength).toBe("same_urls");
    expect(m[0].otherId).toBe("a");
  });

  it("same name at a different employer is flagged as possibly two people", () => {
    const m = findIdentityMatches(
      {
        id: "new",
        name: "Priya Patel",
        currentCompany: "Manchester Royal Infirmary",
      },
      existing,
    );
    expect(m[0].strength).toBe("same_name_different_org");
    expect(m[0].reason).toContain("may be two people");
  });

  it("same name at the same employer is still only a review flag", () => {
    const m = findIdentityMatches(
      {
        id: "new",
        name: "Dr Priya Patel",
        currentCompany: "Leeds Teaching Hospitals Ltd",
      },
      existing,
    );
    expect(m[0].strength).toBe("same_name_same_org");
  });

  it("a similar name raises a look, and an unrelated person raises nothing", () => {
    expect(
      findIdentityMatches({ id: "new", name: "Pooja Patel" }, existing)[0]
        .strength,
    ).toBe("similar_name");
    expect(
      findIdentityMatches({ id: "new", name: "Alex Fernandez" }, existing),
    ).toEqual([]);
  });

  it("never matches a record against itself", () => {
    expect(
      findIdentityMatches(
        {
          id: "a",
          name: "Priya Patel",
          currentCompany: "Leeds Teaching Hospitals",
        },
        existing,
      ),
    ).toEqual([]);
  });
});
