/**
 * Running a compiled query on the Talent X-Ray engines (W20.1). The page
 * has no network: it links out to the engine's own results page, exactly
 * as the reference console does. Only Google-dialect, in-budget queries
 * are offered.
 */
import { describe, expect, it } from "vitest";
import {
  TALENT_XRAY_ENGINES,
  checkEngineQuery,
  defaultEngineRow,
  engineRunnable,
  engineSearchUrl,
} from "../../artifact-src/core/talent-xray";
import { compileQueries } from "../../artifact-src/core/query-compiler";

const INPUT = {
  titles: ["ICU Nurse"],
  alternateTitles: ["Critical Care Nurse"],
  adjacentTitles: ["ER Nurse"],
  mustHave: ["CCRN"],
  anyOf: [],
  credentials: ["RN"],
  locations: ["Houston"],
  companies: [],
  exclusions: ["recruiter"],
};

describe("engineSearchUrl", () => {
  it("is the reference console's fallback link, on the live Core engine", () => {
    const url = engineSearchUrl("core", '("ICU Nurse") CCRN Houston');
    expect(url).toBe(
      "https://cse.google.com/cse?cx=a157d37906e1141cc#gsc.q=" +
        encodeURIComponent('("ICU Nurse") CCRN Houston'),
    );
  });
  it("uses the Verified & Reach engine when asked", () => {
    expect(engineSearchUrl("reach", "x y z")).toContain("cx=918bc00e18d0c46e5");
  });
  it("names both live engines and nothing else", () => {
    expect(TALENT_XRAY_ENGINES.map((e) => e.cx)).toEqual([
      "a157d37906e1141cc",
      "918bc00e18d0c46e5",
    ]);
  });
  it("never puts a raw query into the URL", () => {
    expect(engineSearchUrl("core", 'a "b c" & d')).not.toContain(" ");
    expect(engineSearchUrl("core", 'a "b c" & d')).not.toContain('"');
  });
});

describe("engineRunnable", () => {
  it("offers Google rows that are runnable and never LinkedIn's native boolean", () => {
    const rows = compileQueries(INPUT);
    const native = rows.find((r) => r.platformId === "linkedin_native");
    const web = rows.find((r) => r.platformId === "google_web");
    expect(native?.runnable).toBe(true);
    expect(engineRunnable(native!)).toBe(false);
    expect(engineRunnable(web!)).toBe(true);
    expect(engineRunnable({ platformId: "google_web", runnable: false })).toBe(
      false,
    );
  });
});

describe("checkEngineQuery", () => {
  it("re-checks an edited query against Google's 32-word limit", () => {
    const ok = checkEngineQuery('("ICU Nurse" OR "Critical Care Nurse") CCRN');
    expect(ok.runnable).toBe(true);
    expect(ok.termCount).toBe(6);
    const long = checkEngineQuery(
      Array.from({ length: 40 }, (_, i) => `term${i}`).join(" "),
    );
    expect(long.runnable).toBe(false);
    expect(long.termCount).toBe(40);
    expect(long.violations.join(" ")).toMatch(/exceeds/);
  });
  it("refuses an empty query", () => {
    expect(checkEngineQuery("   ").runnable).toBe(false);
  });
});

describe("defaultEngineRow", () => {
  it("pre-loads the balanced open-web row when there is one", () => {
    const row = defaultEngineRow(compileQueries(INPUT));
    expect(row?.platformId).toBe("google_web");
    expect(row?.breadth).toBe("balanced");
  });
  it("returns nothing when nothing can run", () => {
    expect(defaultEngineRow([])).toBeUndefined();
  });
});
