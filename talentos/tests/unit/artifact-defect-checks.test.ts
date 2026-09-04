/**
 * The deliberate-defect suite (spec §18) runs identically in the page and
 * here. Every check must pass, and each must actually be a check — a run
 * that reports a pass for something it did not execute is the failure mode
 * this file exists to prevent.
 */
import { describe, expect, it } from "vitest";
import {
  DEFECT_CHECKS,
  runDefectChecks,
} from "../../artifact-src/core/defect-checks";

describe("deliberate-defect checks", () => {
  const results = runDefectChecks();

  it("runs every registered check and reports one result each", () => {
    expect(results).toHaveLength(DEFECT_CHECKS.length);
    expect(DEFECT_CHECKS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(results.map((r) => r.id)).size).toBe(results.length);
  });

  for (const check of DEFECT_CHECKS) {
    it(check.name, () => {
      const r = check.run({});
      expect(r.detail.length).toBeGreaterThan(0);
      expect(r.passed, `${check.id}: ${r.detail}`).toBe(true);
    });
  }

  it("every check is deterministic — no model call is needed to run them", () => {
    expect(results.every((r) => r.kind === "deterministic")).toBe(true);
  });
});
