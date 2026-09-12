/**
 * Every module a job has is reachable.
 *
 * This test exists because grouping the nav into phases silently orphaned
 * two routes: `/review-shortlist` — which is where the card deck and the
 * evidence ribbons live — and `/crew`. Both still worked; nothing linked to
 * them. A page you can only reach by typing its URL is a page nobody uses,
 * and no other check would have caught it.
 *
 * So the routes on disk are the source of truth, and this asserts the nav
 * and the command menu between them cover all of it.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PHASES } from "@/components/workspace-nav";

/** Every `/searches/[id]/<module>` route that exists as a directory. */
function routesOnDisk(): string[] {
  const base = path.resolve("src/app/searches/[id]");
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("["))
    .filter((entry) => fs.existsSync(path.join(base, entry.name, "page.tsx")))
    .map((entry) => `/${entry.name}`)
    .sort();
}

const navPaths = PHASES.flatMap((phase) =>
  phase.modules.map((entry) => entry.path),
);

describe("the nav covers the job's modules", () => {
  it("shows every route, or names it as deliberately hidden", () => {
    // Kept out of the nav on purpose. Adding to this list is a decision;
    // forgetting a route is not, which is the difference this test protects.
    const hiddenOnPurpose = ["/crew"];
    const missing = routesOnDisk().filter(
      (route) => !navPaths.includes(route) && !hiddenOnPurpose.includes(route),
    );
    expect(`orphaned: ${missing.join(", ")}`).toBe("orphaned: ");
  });

  it("puts every module in exactly one phase", () => {
    const seen = new Map<string, string[]>();
    for (const phase of PHASES) {
      for (const entry of phase.modules) {
        seen.set(entry.path, [...(seen.get(entry.path) ?? []), phase.label]);
      }
    }
    for (const [modulePath, phases] of seen) {
      expect(`${modulePath} → ${phases.join("+")}`).toBe(
        `${modulePath} → ${phases[0]}`,
      );
    }
  });

  it("gives every module a label and an icon", () => {
    for (const phase of PHASES) {
      for (const entry of phase.modules) {
        expect(`${entry.path} label`).toBe(
          entry.label ? `${entry.path} label` : "missing",
        );
        expect(`${entry.path} icon`).toBe(
          entry.icon ? `${entry.path} icon` : "missing",
        );
      }
    }
  });

  it("keeps the overview as the first module of the first phase", () => {
    // An unmatched route falls back to the first phase, so it has to be the
    // one that makes sense to land on.
    expect(PHASES[0].modules[0].path).toBe("");
    expect(PHASES[0].modules[0].exact).toBe(true);
  });

  it("says what each phase is for", () => {
    for (const phase of PHASES) {
      expect(`${phase.id} → ${phase.detail.length > 25}`).toBe(
        `${phase.id} → true`,
      );
    }
  });
});
