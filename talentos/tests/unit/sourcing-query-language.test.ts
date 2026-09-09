/**
 * The sourcing query language. These assertions are the contract the angle
 * renderer and the ranker both compile against, so a change here is a change
 * to what TalentOS searches for.
 */
import { describe, expect, it } from "vitest";
import {
  describeBrief,
  freeText,
  keywords,
  negativeTerms,
  parseDate,
  parseQuery,
  positiveTerms,
  unparseBrief,
  windowContains,
} from "@/lib/sourcing/query-language";

describe("parseQuery — fields", () => {
  it("reads every filter the vocabulary names", () => {
    const brief = parseQuery(
      'skill:robotics title:"head of" org:stripe loc:"united kingdom" ' +
        "filetype:pdf after:2022 has:email -site:linkedin.com industry:automotive",
    );
    expect(brief.skills).toContain("robotics");
    // normalizeTitle strips seniority words; when nothing survives, the
    // recruiter's own words are kept rather than an empty filter.
    expect(brief.titles).toEqual(["head of"]);
    expect(brief.orgs).toEqual(["stripe"]);
    expect(brief.locations).toEqual(["united kingdom"]);
    expect(brief.filetypes).toEqual(["pdf"]);
    expect(brief.window.after).toBe("2022-01-01");
    expect(brief.has).toEqual(["email"]);
    expect(brief.excludeSites).toEqual(["linkedin.com"]);
    expect(brief.industries).toEqual(["automotive"]);
  });

  it("accepts every alias for a field", () => {
    const a = parseQuery("company:acme location:london capability:robotics");
    expect(a.orgs).toEqual(["acme"]);
    expect(a.locations).toEqual(["london"]);
    expect(a.skills).toContain("robotics");
  });

  it("splits comma- and pipe-separated values", () => {
    expect(parseQuery("skill:robotics,perception").skills).toEqual([
      "robotics",
      "perception",
    ]);
    expect(parseQuery("skill:robotics|perception").skills).toEqual([
      "robotics",
      "perception",
    ]);
  });

  it("treats an unknown field as a keyword rather than erroring", () => {
    const brief = parseQuery("wibble:thing robotics");
    expect(brief.warnings[0]).toMatch(/unknown filter 'wibble:'/);
    expect(keywords(brief)).toContain("wibble:thing");
  });

  it("names a filetype it cannot read instead of pretending", () => {
    const brief = parseQuery("skill:robotics filetype:psd");
    expect(brief.filetypes).toEqual([]);
    expect(brief.warnings[0]).toMatch(/filetype 'psd'/);
  });
});

describe("parseQuery — terms", () => {
  it("keeps quoted phrases and drops bare stopwords", () => {
    const brief = parseQuery(
      'find me someone with "motion planning" experience',
    );
    expect(positiveTerms(brief).map((t) => t.text)).toEqual([
      "motion planning",
    ]);
  });

  it("negates with a leading dash", () => {
    const brief = parseQuery("robotics -recruiter");
    expect(negativeTerms(brief).map((t) => t.text)).toEqual(["recruiter"]);
  });

  it("groups OR alternatives so they are not ANDed", () => {
    const brief = parseQuery("perception OR lidar");
    const groups = new Set(positiveTerms(brief).map((t) => t.group));
    expect(groups.size).toBe(1);
    expect([...groups][0]).toBeGreaterThan(0);
  });
});

describe("parseQuery — natural language", () => {
  it("promotes a multi-word capability the recruiter typed in prose", () => {
    // The bug this pins: matching a term at a time found neither half of
    // "technical recruiters", so the occupation dropped out of the brief and
    // the search returned engineers instead of the people who recruit them.
    const brief = parseQuery(
      "Find technical recruiters who hired robotics engineers",
    );
    expect(brief.skills).toContain("technical_recruiting");
    // Robotics is read too, but as the domain they hire INTO rather than a
    // capability they must hold — see the qualifier rule below.
    expect(brief.qualifierSkills).toContain("robotics");
  });

  it("reads a capability after a sourcing verb as the domain, not a requirement", () => {
    const brief = parseQuery(
      "a sales leader selling to hospitals and clinicians",
    );
    expect(brief.skills).toContain("sales_leadership");
    expect(brief.skills).not.toContain("clinical_practice");
    expect(brief.qualifierSkills).toContain("clinical_practice");
  });

  it("keeps the qualifier as the requirement when nothing else survives", () => {
    // "who has hired robotics engineers" still has to search for something.
    const brief = parseQuery("who has hired robotics engineers");
    expect(brief.skills).toContain("robotics");
    expect(brief.qualifierSkills).toEqual([]);
  });

  it("does not leave the halves of a matched phrase as keywords", () => {
    // Found by reading the rendered page: "in the Bay Area" resolved the
    // location correctly and then also scored "Bay" and "Area" separately,
    // printing "mentions Bay" as a reason a person was shortlisted.
    const brief = parseQuery("Find technical recruiters in the Bay Area");
    const kw = keywords(brief).map((k) => k.toLowerCase());
    expect(kw).not.toContain("bay");
    expect(kw).not.toContain("area");
    expect(kw).not.toContain("recruiters");
    expect(brief.locations).toEqual(["san francisco bay area"]);
    expect(brief.skills).toContain("technical_recruiting");
  });

  it("keeps a word that resolves to a capability on its own", () => {
    const brief = parseQuery("robotics engineers in the Bay Area");
    expect(keywords(brief).map((k) => k.toLowerCase())).toContain("robotics");
  });

  it("recognises a place named in prose, not just in loc:", () => {
    const brief = parseQuery("machine learning engineers in the Bay Area");
    expect(brief.locations).toEqual(["san francisco bay area"]);
  });

  it("expands to adjacent capabilities, each carrying its reason", () => {
    const brief = parseQuery("skill:robotics");
    const adjacent = brief.expansions.filter((e) => e.origin !== "");
    expect(adjacent.length).toBeGreaterThan(0);
    for (const e of adjacent) expect(e.reason.length).toBeGreaterThan(10);
  });
});

describe("parseDate", () => {
  const now = new Date("2026-09-07T00:00:00Z");

  it("reads absolute forms", () => {
    expect(parseDate("2022-03-04")).toBe("2022-03-04");
    expect(parseDate("2022-03")).toBe("2022-03-01");
    expect(parseDate("2022")).toBe("2022-01-01");
    expect(parseDate("04/03/2022")).toBe("2022-03-04");
  });

  it("reads relative forms against an injected now", () => {
    expect(parseDate("2y", now)).toBe("2024-09-07");
    expect(parseDate("today", now)).toBe("2026-09-07");
  });

  it("falls back to a trailing year in prose", () => {
    expect(parseDate("Published March 2019")).toBe("2019-01-01");
  });

  it("returns null when there is no date", () => {
    expect(parseDate("soonish")).toBeNull();
  });
});

describe("windowContains", () => {
  it("keeps undated evidence — a CV with no date is still a CV", () => {
    expect(windowContains({ after: "2022-01-01", before: null }, null)).toBe(
      true,
    );
    expect(windowContains({ after: "2022-01-01", before: null }, "")).toBe(
      true,
    );
  });

  it("excludes evidence known to fall outside", () => {
    expect(
      windowContains({ after: "2022-01-01", before: null }, "2019-05-01"),
    ).toBe(false);
    expect(
      windowContains({ after: null, before: "2020-01-01" }, "2021-05-01"),
    ).toBe(false);
  });
});

describe("round-tripping", () => {
  it("re-parses its own rendering to the same filters", () => {
    const original = parseQuery(
      'skill:robotics loc:"united kingdom" has:email -site:example.com',
    );
    const again = parseQuery(unparseBrief(original));
    expect(again.skills).toEqual(original.skills);
    expect(again.locations).toEqual(original.locations);
    expect(again.has).toEqual(original.has);
    expect(again.excludeSites).toEqual(original.excludeSites);
  });

  it("describes itself in words a recruiter can check", () => {
    const rows = describeBrief(
      parseQuery("skill:robotics loc:london has:email"),
    );
    expect(rows.join(" ")).toMatch(/skills: robotics/);
    expect(rows.join(" ")).toMatch(/locations: london/);
    expect(rows.join(" ")).toMatch(/must have: email/);
  });

  it("hands a plain keyword engine one string", () => {
    // Phrases stay quoted so a keyword engine keeps them together.
    expect(
      freeText(parseQuery('skill:robotics org:acme "motion planning"')),
    ).toBe('"motion planning" robotics acme');
  });
});
