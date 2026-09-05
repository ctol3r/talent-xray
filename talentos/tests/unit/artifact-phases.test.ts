/**
 * The five-phase IA (spec §5). Phase status is DERIVED from the module
 * states the rail already shows — it invents no new truth — and a phase is
 * only complete when every required output is current or aging.
 */
import { describe, expect, it } from "vitest";
import {
  NAV,
  PHASES,
  PHASE_KEYS,
  activePhase,
  entriesFor,
  phaseOf,
  phaseStatuses,
  researchEntryStatus,
  type EntryStatus,
} from "../../artifact-src/core/phases";
import { MODULE_KEYS } from "../../artifact-src/core/dependencies";

const all = (state: EntryStatus["state"]): Record<string, EntryStatus> =>
  Object.fromEntries(
    NAV.map((e) => [e.key, { state, reason: `everything is ${state}` }]),
  );

describe("the nav", () => {
  it("places every module in exactly one phase, and adds only the screens that have no record", () => {
    const keys = NAV.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of MODULE_KEYS) {
      expect(keys, `${key} is missing from the nav`).toContain(key);
    }
    const extras = keys.filter((k) => !MODULE_KEYS.includes(k as never));
    expect(extras.sort()).toEqual([
      "actions",
      "overview",
      "pipeline",
      "research",
    ]);
    for (const entry of NAV) {
      expect(PHASE_KEYS).toContain(entry.phase);
      expect(phaseOf(entry.key)).toBe(entry.phase);
      expect(entry.hint.length).toBeGreaterThan(20);
    }
  });

  it("every phase asks a question and has at least one entry", () => {
    for (const key of PHASE_KEYS) {
      expect(PHASES[key].question).toMatch(/\?$/);
      expect(NAV.some((e) => e.phase === key)).toBe(true);
    }
  });

  it("Guided hides advanced entries; Expert shows them", () => {
    const guided = entriesFor("define", "guided").map((e) => e.key);
    const expert = entriesFor("define", "expert").map((e) => e.key);
    expect(guided).not.toContain("role_intelligence");
    expect(expert).toContain("role_intelligence");
    expect(expert.length).toBeGreaterThan(guided.length);
    expect(entriesFor("learn", "guided")).toEqual([]);
    expect(entriesFor("learn", "expert").map((e) => e.key)).toEqual([
      "golden_test",
    ]);
  });
});

describe("phase status", () => {
  it("is not_started when nothing has run", () => {
    const statuses = phaseStatuses({ statuses: all("not_started") });
    expect(statuses.map((p) => p.state)).toEqual([
      "not_started",
      "not_started",
      "not_started",
      "not_started",
      "complete", // Learn requires nothing
    ]);
    expect(activePhase(statuses)).toBe("define");
  });

  it("is complete only when every required output is current or aging", () => {
    const statuses = phaseStatuses({ statuses: all("current") });
    expect(statuses.every((p) => p.state === "complete")).toBe(true);
    expect(activePhase(statuses)).toBe("learn");

    const aging = phaseStatuses({ statuses: all("aging") });
    expect(aging.every((p) => p.state === "complete")).toBe(true);
  });

  it("blocked is a real result but never completion", () => {
    const statuses = phaseStatuses({ statuses: all("blocked") });
    expect(statuses[0].state).toBe("needs_attention");
    expect(statuses.find((p) => p.key === "research")?.state).toBe(
      "needs_attention",
    );
  });

  it("names what needs attention", () => {
    const statuses = phaseStatuses({
      statuses: {
        ...all("current"),
        search_strings: { state: "failed", reason: "rate limited" },
      },
    });
    const plan = statuses.find((p) => p.key === "plan")!;
    expect(plan.state).toBe("needs_attention");
    expect(plan.reason).toContain("Search Strings");
    expect(activePhase(statuses)).toBe("plan");
  });

  it("counts progress honestly", () => {
    const statuses = phaseStatuses({
      statuses: {
        ...all("not_started"),
        sourcing_strategy: { state: "current", reason: "ok" },
      },
    });
    const plan = statuses.find((p) => p.key === "plan")!;
    expect(plan.done).toBe(1);
    expect(plan.total).toBe(3);
    expect(plan.state).toBe("in_progress");
  });

  it("marks a later phase early, and says which output it is waiting on", () => {
    const statuses = phaseStatuses({ statuses: all("not_started") });
    expect(statuses[0].ready).toBe(true);
    const plan = statuses.find((p) => p.key === "plan")!;
    expect(plan.ready).toBe(false);
    expect(plan.earlyReason).toContain("Generate");
    expect(plan.earlyReason).toContain("reads its output");
  });

  it("stops calling later phases early once the earlier ones have produced", () => {
    const statuses = phaseStatuses({ statuses: all("current") });
    expect(statuses.every((p) => p.ready)).toBe(true);
  });
});

describe("the research entry reads live, not from a record", () => {
  it("says plainly why it is blocked in a runtime with no web access", () => {
    const st = researchEntryStatus("blocked", undefined);
    expect(st.state).toBe("blocked");
    expect(st.reason).toContain("no web access");
    expect(st.reason).toContain("no connector is wired");
  });

  it("carries the as-of date when there is one", () => {
    expect(researchEntryStatus("current", "2026-09-04").reason).toContain(
      "2026-09-04",
    );
    expect(researchEntryStatus("aging", "2026-08-01").reason).toContain(
      "refresh",
    );
    expect(researchEntryStatus("failed", undefined).state).toBe("failed");
  });
});
