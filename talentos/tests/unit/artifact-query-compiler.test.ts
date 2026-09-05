/**
 * P0-D: a query is only ever labelled runnable when it satisfies the
 * selected platform's real constraints. Over-budget queries are split into
 * runnable parts, or shown as not runnable with the reason — never given a
 * working Copy button and a warning chip.
 */
import { describe, expect, it } from "vitest";
import {
  PLATFORM_CONSTRAINTS,
  VARIANT_EXPLANATIONS,
  checkExtraQuery,
  compileQueries,
  countTerms,
  type StringLabInput,
} from "../../artifact-src/core/query-compiler";

const base: StringLabInput = {
  titles: ["ICU Nurse"],
  alternateTitles: ["Critical Care Nurse"],
  adjacentTitles: ["Theatre Nurse"],
  mustHave: ["NMC"],
  anyOf: ["ventilator", "ECMO"],
  credentials: ["NMC registered"],
  locations: ["Leeds"],
  companies: [],
  exclusions: ["recruiter"],
};

const wide: StringLabInput = {
  ...base,
  anyOf: Array.from({ length: 40 }, (_, i) => `skill${i}`),
};

describe("term counting", () => {
  it("counts the way Google does — boolean keywords and brackets are free", () => {
    expect(countTerms('"critical care" OR "intensive care"')).toBe(4);
    expect(countTerms("(a OR b) AND NOT c")).toBe(3);
    expect(countTerms("   ")).toBe(0);
  });
});

describe("platform constraints", () => {
  it("every platform records its limits and why they are what they are", () => {
    for (const p of PLATFORM_CONSTRAINTS) {
      expect(p.maxTerms !== null || p.maxChars !== null).toBe(true);
      expect(p.rationale.length).toBeGreaterThan(10);
    }
    const linkedin = PLATFORM_CONSTRAINTS.find(
      (p) => p.id === "linkedin_native",
    )!;
    expect(linkedin.maxTerms).toBeNull();
    expect(linkedin.maxChars).toBe(1000);
    expect(linkedin.operators.not).toBe("NOT");
    expect(linkedin.operators.site).toBe(false);
  });
});

describe("compilation", () => {
  it("never marks an over-budget Google query runnable", () => {
    const compiled = compileQueries(wide, { platformIds: ["google_linkedin"] });
    expect(compiled.length).toBeGreaterThan(0);
    for (const q of compiled) {
      if (q.runnable) expect(countTerms(q.query)).toBeLessThanOrEqual(32);
      else expect(q.violations.length).toBeGreaterThan(0);
    }
  });

  it("splits an over-budget OR group into numbered runnable parts", () => {
    const compiled = compileQueries(wide, { platformIds: ["google_linkedin"] });
    const parts = compiled.filter((q) => q.part);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) {
      expect(p.part!.of).toBeGreaterThan(1);
      expect(p.part!.index).toBeLessThanOrEqual(p.part!.of);
    }
  });

  it("translates to LinkedIn's dialect: NOT instead of a minus, and no site:", () => {
    const compiled = compileQueries(base, { platformIds: ["linkedin_native"] });
    expect(compiled.length).toBeGreaterThan(0);
    for (const q of compiled) {
      expect(q.query).not.toMatch(/\ssite:/);
      expect(q.query).not.toMatch(/\s-"/);
      if (q.query.includes("recruiter")) expect(q.query).toContain("NOT");
      expect(q.charCount).toBeLessThanOrEqual(1000);
      expect(q.runnable).toBe(true);
    }
  });

  it("explains what each breadth variant tests", () => {
    const compiled = compileQueries(base, { platformIds: ["google_linkedin"] });
    for (const q of compiled) {
      expect(q.explanation).toBe(VARIANT_EXPLANATIONS[q.breadth]);
      expect(q.explanation.length).toBeGreaterThan(40);
    }
  });

  it("de-duplicates identical queries within a platform", () => {
    const compiled = compileQueries(base, {
      platformIds: ["google_linkedin", "google_web"],
    });
    const keys = compiled.map(
      (q) => `${q.platformId}::${q.query.toLowerCase()}`,
    );
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only offers platforms whose tag is relevant, plus the general ones", () => {
    const general = compileQueries(base, {});
    expect(new Set(general.map((q) => q.platformId))).not.toContain(
      "google_scholar",
    );
    const research = compileQueries(base, { relevantTags: ["research"] });
    expect(research.some((q) => q.platformId === "google_scholar")).toBe(true);
  });
});

describe("model-suggested extra queries are checked, never trusted", () => {
  it("flags an unknown platform rather than assuming it is fine", () => {
    const res = checkExtraQuery("Some Sourcing Tool", "a OR b");
    expect(res.runnable).toBe(false);
    expect(res.violations[0]).toContain("not a platform this build knows");
  });

  it("flags an over-length query on a known platform", () => {
    const long = Array.from({ length: 40 }, (_, i) => `term${i}`).join(" ");
    const res = checkExtraQuery("Google (LinkedIn x-ray)", long);
    expect(res.runnable).toBe(false);
    expect(res.violations.join(" ")).toContain("32-term budget");
  });

  it("accepts a query that fits", () => {
    const res = checkExtraQuery(
      "Google (LinkedIn x-ray)",
      'site:linkedin.com/in "ICU nurse" Leeds',
    );
    expect(res.runnable).toBe(true);
    expect(res.platformId).toBe("google_linkedin");
  });
});
