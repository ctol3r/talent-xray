import { describe, expect, it } from "vitest";
import {
  composeQueries,
  orGroup,
  quoteTerm,
  type StringLabInput,
} from "@/lib/domain/search-strings";

const caisInput: StringLabInput = {
  titles: ["Research Scientist", "Research Engineer"],
  alternateTitles: ["Member of Technical Staff", "ML Researcher"],
  adjacentTitles: ["PhD Student", "Postdoctoral Researcher"],
  mustHave: ["machine learning"],
  anyOf: ["NeurIPS", "ICML", "ICLR"],
  credentials: [],
  locations: ["San Francisco", "Bay Area"],
  companies: ["Anthropic", "OpenAI"],
  exclusions: ["recruiter"],
};

describe("quoteTerm (ported from validated reference composer)", () => {
  it("quotes multiword terms", () => {
    expect(quoteTerm("machine learning")).toBe('"machine learning"');
  });
  it("leaves single words alone", () => {
    expect(quoteTerm("NeurIPS")).toBe("NeurIPS");
  });
  it("leaves operators and prefixed terms alone", () => {
    expect(quoteTerm("site:github.com")).toBe("site:github.com");
    expect(quoteTerm("-recruiter")).toBe("-recruiter");
    expect(quoteTerm('("already quoted")')).toBe('("already quoted")');
  });
  it("strips inner double quotes when quoting", () => {
    expect(quoteTerm('senior "ML" engineer')).toBe('"senior ML engineer"');
  });
});

describe("orGroup", () => {
  it("returns single term unwrapped", () => {
    expect(orGroup(["NeurIPS"])).toBe("NeurIPS");
  });
  it("wraps multiple terms", () => {
    expect(orGroup(["a", "b c"])).toBe('(a OR "b c")');
  });
  it("returns empty string for empty input", () => {
    expect(orGroup([])).toBe("");
  });
});

describe("composeQueries", () => {
  const queries = composeQueries(caisInput);

  it("produces every breadth variant for platforms with input", () => {
    const linkedin = queries.filter((q) =>
      q.platform.includes("LinkedIn x-ray"),
    );
    expect(linkedin.map((q) => q.breadth).sort()).toEqual([
      "adjacent",
      "balanced",
      "broad",
      "narrow",
    ]);
  });

  it("narrow variant ANDs every must-have and includes companies", () => {
    const narrow = queries.find(
      (q) => q.platform.includes("LinkedIn x-ray") && q.breadth === "narrow",
    );
    expect(narrow?.query).toContain('"machine learning"');
    expect(narrow?.query).toContain("(Anthropic OR OpenAI)");
    expect(narrow?.query).toContain(
      '("Research Scientist" OR "Research Engineer")',
    );
  });

  it("x-ray variants carry the site group; native boolean does not", () => {
    const xray = queries.find(
      (q) => q.platform.includes("LinkedIn x-ray") && q.breadth === "narrow",
    );
    const native = queries.find(
      (q) => q.platform.includes("native") && q.breadth === "narrow",
    );
    expect(xray?.query).toContain("site:linkedin.com/in");
    expect(native?.query).not.toContain("site:");
  });

  it("negates exclusions", () => {
    for (const q of queries) {
      expect(q.query).toContain("-recruiter");
    }
  });

  it("adjacent variant uses adjacent titles, not primary titles", () => {
    const adjacent = queries.find(
      (q) => q.platform.includes("LinkedIn x-ray") && q.breadth === "adjacent",
    );
    expect(adjacent?.query).toContain('"PhD Student"');
    expect(adjacent?.query).not.toContain('"Research Scientist"');
  });

  it("skips the adjacent variant when no adjacent titles exist", () => {
    const noAdjacent = composeQueries({ ...caisInput, adjacentTitles: [] });
    expect(noAdjacent.some((q) => q.breadth === "adjacent")).toBe(false);
  });

  it("normalizes whitespace and never emits empty queries", () => {
    for (const q of queries) {
      expect(q.query).not.toMatch(/\s{2,}/);
      expect(q.query.length).toBeGreaterThan(0);
    }
  });
});
