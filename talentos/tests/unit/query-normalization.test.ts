/**
 * Wave A acceptance: pre/post-composer normalization is deterministic,
 * never touches the validated composer, never truncates a string, and
 * every transformation leaves a visible note.
 */
import { describe, expect, it } from "vitest";
import {
  channelCoverage,
  countTerms,
  dedupeAcrossSurfaces,
  fitToBudget,
  normalizeQueryKey,
  normalizeStringLabInput,
  platformsForChannels,
  prepareQueries,
  qaQuery,
  termBudgetFor,
} from "@/lib/domain/query-normalization";
import { normalizeRoleTitle } from "@/lib/domain/role-title";
import {
  composeQueries,
  PLATFORM_TARGETS,
  type StringLabInput,
} from "@/lib/domain/search-strings";

const base: StringLabInput = {
  titles: ["Research Scientist"],
  alternateTitles: ["Research Engineer"],
  adjacentTitles: [],
  mustHave: ["alignment"],
  anyOf: ["interpretability", "evaluation"],
  credentials: ["PhD"],
  locations: ["London"],
  companies: [],
  exclusions: ["recruiter"],
};

const mlChannels = [
  { name: "Google Scholar", kind: "database" },
  { name: "arXiv / OpenReview", kind: "publication" },
  { name: "GitHub", kind: "open_source" },
  { name: "NeurIPS / ICML / ICLR programs", kind: "conference" },
];
const fallbackChannels = [
  { name: "LinkedIn", kind: "social" },
  { name: "Industry association directories", kind: "association" },
];

describe("normalizeStringLabInput", () => {
  it("removes case-insensitive duplicates within lists and across tiers", () => {
    const { input, notes } = normalizeStringLabInput({
      ...base,
      titles: ["Research Scientist", "research scientist"],
      alternateTitles: ["Research Scientist", "Research Engineer"],
      adjacentTitles: ["Research Engineer", "ML Engineer"],
      anyOf: ["alignment", "interpretability"],
      credentials: ["interpretability", "PhD"],
    });
    expect(input.titles).toEqual(["Research Scientist"]);
    expect(input.alternateTitles).toEqual(["Research Engineer"]);
    expect(input.adjacentTitles).toEqual(["ML Engineer"]);
    expect(input.anyOf).toEqual(["interpretability"]);
    expect(input.credentials).toEqual(["PhD"]);
    expect(notes.length).toBeGreaterThanOrEqual(4);
  });

  it("drops an exclusion that is also required, with a note", () => {
    const { input, notes } = normalizeStringLabInput({
      ...base,
      exclusions: ["alignment", "recruiter"],
    });
    expect(input.exclusions).toEqual(["recruiter"]);
    expect(notes.some((n) => /exclusions/.test(n.message))).toBe(true);
  });

  it("is the identity on already-clean input", () => {
    const { input, notes } = normalizeStringLabInput(base);
    expect(input).toEqual(base);
    expect(notes).toEqual([]);
  });
});

describe("countTerms / budgets / keys", () => {
  it("counts terms the way the artifact compiler does", () => {
    const fixtures: Array<[string, number]> = [
      // Whitespace tokens: a quoted phrase counts per word, as Google does.
      ['("Research Scientist" OR "Research Engineer") alignment', 5],
      ["a OR b OR c", 3],
      ['(site:linkedin.com/in OR site:linkedin.com/pub) "ml"', 3],
      ["( a ) AND ( b )", 2],
      ["single", 1],
    ];
    for (const [query, expected] of fixtures) {
      expect(countTerms(query)).toBe(expected);
    }
  });

  it("budgets Google surfaces at 32 terms and leaves LinkedIn native open", () => {
    expect(termBudgetFor("Google (LinkedIn x-ray)")).toBe(32);
    expect(termBudgetFor("Google (open web)")).toBe(32);
    expect(termBudgetFor("LinkedIn (native boolean)")).toBeNull();
    expect(termBudgetFor("PubMed")).toBeNull();
  });

  it("normalizes keys by case and whitespace only", () => {
    expect(normalizeQueryKey('  "A"   OR  "b" ')).toBe('"a" or "b"');
  });
});

describe("qaQuery", () => {
  it("flags unbalanced parens, quotes, dangling and doubled operators, empty groups", () => {
    const codes = (q: string, p = "Google (open web)") =>
      qaQuery(q, p).map((w) => w.code);
    expect(codes('("a" OR "b"')).toContain("unbalanced_parens");
    expect(codes('"a OR b')).toContain("unbalanced_quotes");
    expect(codes("a OR b OR")).toContain("dangling_operator");
    expect(codes("a OR OR b")).toContain("doubled_operator");
    expect(codes("a () b")).toContain("empty_group");
    expect(codes("a site: b")).toContain("empty_site");
    expect(codes('("a" OR "b") c')).toEqual([]);
  });

  it("flags over-budget on Google platforms but not on LinkedIn native", () => {
    const long = Array.from({ length: 40 }, (_, i) => `t${i}`).join(" OR ");
    expect(qaQuery(long, "Google (open web)").map((w) => w.code)).toContain(
      "over_budget",
    );
    expect(qaQuery(long, "LinkedIn (native boolean)")).toEqual([]);
  });
});

describe("platformsForChannels", () => {
  it("keeps GitHub and Scholar and prunes portfolio for the ML channel list", () => {
    const { kept, pruned } = platformsForChannels(mlChannels);
    const names = kept.map((k) => k.platform);
    expect(names).toContain("Google (GitHub x-ray)");
    expect(names).toContain("Google (Scholar/arXiv x-ray)");
    expect(names).not.toContain("Google (portfolio x-ray)");
    expect(pruned.map((p) => p.platform)).toEqual(["Google (portfolio x-ray)"]);
  });

  it("prunes three surfaces for the fallback list and always keeps the universal three", () => {
    const { kept, pruned } = platformsForChannels(fallbackChannels);
    expect(kept.map((k) => k.platform)).toEqual([
      "Google (LinkedIn x-ray)",
      "LinkedIn (native boolean)",
      "Google (open web)",
    ]);
    expect(pruned).toHaveLength(3);
  });

  it("emits every surface with one note when there are no channels", () => {
    const { kept, pruned, notes } = platformsForChannels([]);
    expect(kept).toHaveLength(PLATFORM_TARGETS.length);
    expect(pruned).toEqual([]);
    expect(notes).toHaveLength(1);
  });

  it("ignores rejected channels", () => {
    const { kept } = platformsForChannels([
      { name: "GitHub", kind: "open_source", status: "rejected" },
      { name: "LinkedIn", kind: "social" },
    ]);
    expect(kept.map((k) => k.platform)).not.toContain("Google (GitHub x-ray)");
  });
});

describe("fitToBudget", () => {
  const platforms = PLATFORM_TARGETS.filter(
    (p) => p.platform === "Google (LinkedIn x-ray)",
  );

  it("splits a 40-term any-of group into parts that each fit, keeping must-have and the site group", () => {
    const input: StringLabInput = {
      ...base,
      anyOf: Array.from({ length: 40 }, (_, i) => `skill${i}`),
    };
    const composed = composeQueries(input, platforms);
    const narrow = composed.filter((q) => q.breadth === "narrow");
    expect(countTerms(narrow[0].query)).toBeGreaterThan(32);
    const fitted = fitToBudget(narrow, input, platforms);
    expect(fitted.length).toBeGreaterThan(1);
    for (const part of fitted) {
      expect(part.qa.termCount).toBeLessThanOrEqual(32);
      expect(part.qa.part?.of).toBe(fitted.length);
      expect(part.query).toContain("alignment");
      expect(part.query).toContain("site:linkedin.com/in");
      expect(part.qa.notes[0]?.code).toBe("budget_split");
    }
    // Every any-of term survives across the parts.
    const joined = fitted.map((p) => p.query).join(" ");
    for (let i = 0; i < 40; i += 1) expect(joined).toContain(`skill${i}`);
  });

  it("keeps an AND-only over-budget query whole with a note, never truncated", () => {
    const input: StringLabInput = {
      ...base,
      anyOf: [],
      alternateTitles: [],
      locations: [],
      mustHave: Array.from({ length: 40 }, (_, i) => `must${i}`),
    };
    const composed = composeQueries(input, platforms).filter(
      (q) => q.breadth === "narrow",
    );
    const fitted = fitToBudget(composed, input, platforms);
    expect(fitted).toHaveLength(1);
    expect(fitted[0].query).toBe(composed[0].query);
    expect(fitted[0].qa.part).toBeUndefined();
    expect(fitted[0].qa.termCount).toBeGreaterThan(32);
    expect(
      qaQuery(fitted[0].query, fitted[0].platform).map((w) => w.code),
    ).toContain("over_budget");
  });

  it("passes in-budget rows through untouched", () => {
    const composed = composeQueries(base, platforms);
    const fitted = fitToBudget(composed, base, platforms);
    expect(fitted.map((f) => f.query)).toEqual(composed.map((c) => c.query));
    expect(fitted.every((f) => f.qa.notes.length === 0)).toBe(true);
  });
});

describe("dedupeAcrossSurfaces", () => {
  it("drops later duplicates by normalized text, first occurrence wins", () => {
    const { kept, dropped } = dedupeAcrossSurfaces([
      { platform: "Google (LinkedIn x-ray)", query: '"A" OR "B"' },
      { platform: "Google (LinkedIn x-ray)", query: '"a"  or "b"' },
      { platform: "Google (open web)", query: '"A" OR "B"' },
      { platform: "Google (open web)", query: '"C"' },
    ]);
    expect(kept.map((k) => k.query)).toEqual(['"A" OR "B"', '"C"']);
    expect(dropped).toHaveLength(2);
    expect(dropped[1].duplicateOf).toBe("Google (LinkedIn x-ray)");
  });

  it("drops the balanced duplicate of narrow produced by an empty vocabulary", () => {
    const thin: StringLabInput = {
      ...base,
      alternateTitles: [],
      anyOf: [],
      credentials: [],
      mustHave: ["alignment"],
    };
    const composed = composeQueries(thin, [PLATFORM_TARGETS[0]]);
    const narrow = composed.find((q) => q.breadth === "narrow");
    const balanced = composed.find((q) => q.breadth === "balanced");
    expect(narrow?.query).toBe(balanced?.query);
    const { kept } = dedupeAcrossSurfaces(composed);
    expect(kept.filter((k) => k.breadth === "balanced")).toHaveLength(0);
    expect(kept.filter((k) => k.breadth === "narrow")).toHaveLength(1);
  });
});

describe("channelCoverage", () => {
  it("covers a channel through an implied platform or a token in an extra query", () => {
    const coverage = channelCoverage(
      [
        { name: "GitHub", kind: "open_source" },
        {
          name: "PubMed",
          kind: "database",
          url: "https://pubmed.ncbi.nlm.nih.gov",
        },
        { name: "NeurIPS / ICML / ICLR programs", kind: "conference" },
      ],
      [
        { platform: "Google (GitHub x-ray)", query: "x site:github.com" },
        { platform: "PubMed", query: "pubmed author search alignment" },
      ],
    );
    const byName = Object.fromEntries(coverage.map((c) => [c.channelName, c]));
    expect(byName.GitHub.covered).toBe(true);
    expect(byName.PubMed.covered).toBe(true);
    expect(byName["NeurIPS / ICML / ICLR programs"].covered).toBe(false);
  });

  it("skips rejected channels", () => {
    expect(
      channelCoverage([{ name: "X", kind: "other", status: "rejected" }], []),
    ).toEqual([]);
  });
});

describe("prepareQueries", () => {
  it("prunes, composes, fits, de-duplicates and annotates in one pass", () => {
    const result = prepareQueries({
      input: { ...base, titles: ["Research Scientist", "research scientist"] },
      extras: [
        {
          platform: "PubMed",
          query: "pubmed alignment",
          purpose: "extra",
          breadth: "experimental",
          expectedPrecision: "low",
        },
      ],
      channels: mlChannels,
    });
    expect(result.pruned.map((p) => p.platform)).toEqual([
      "Google (portfolio x-ray)",
    ]);
    expect(
      result.rows.some((r) => r.platform === "Google (portfolio x-ray)"),
    ).toBe(false);
    expect(result.rows.some((r) => r.platform === "PubMed")).toBe(true);
    expect(result.inputNotes.some((n) => n.code === "or_group_duplicate")).toBe(
      true,
    );
    const keys = result.rows.map((r) => normalizeQueryKey(r.query));
    expect(new Set(keys).size).toBe(keys.length);
    for (const row of result.rows) {
      const budget = termBudgetFor(row.platform);
      if (budget !== null) expect(row.qa.termCount).toBeLessThanOrEqual(budget);
    }
  });
});

describe("normalizeRoleTitle", () => {
  it("collides seniority and ordering variants but not different roles", () => {
    expect(normalizeRoleTitle("Senior Research Engineer")).toBe(
      normalizeRoleTitle("Research Engineer"),
    );
    expect(normalizeRoleTitle("Research Scientist / Research Engineer")).toBe(
      normalizeRoleTitle("Research Engineer, Research Scientist"),
    );
    expect(normalizeRoleTitle("Research Engineer")).not.toBe(
      normalizeRoleTitle("Research Scientist"),
    );
    expect(normalizeRoleTitle("Staff Engineer II")).toBe("engineer");
  });
});
