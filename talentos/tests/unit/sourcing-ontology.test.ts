/**
 * The ontology's contract. Adding a concept that breaks it fails the build,
 * because a bad alias is not a small mistake — it puts an unrelated profession
 * on a recruiter's shortlist, silently, on every future search.
 */
import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  ENVIRONMENTS,
  LOCATIONS,
  SENIORITY,
} from "@/lib/sourcing/ontology-data";
import {
  validateOntologySection,
  type OntologyProblem,
} from "@/lib/sourcing/ontology-validate";
import {
  expand,
  matchCapabilities,
  matchLocations,
  resolveAlias,
} from "@/lib/sourcing/ontology";
import { LOCATION_ALIASES, normalizeLocation } from "@/lib/sourcing/normalize";

function report(problems: OntologyProblem[]): string[] {
  return problems.map((p) => `${p.concept} [${p.kind}] ${p.detail}`);
}

describe("capabilities", () => {
  it("meet the contract", () => {
    expect(
      report(
        validateOntologySection({
          name: "capability",
          concepts: CAPABILITIES,
          edgeTargets: new Set(Object.keys(CAPABILITIES)),
        }),
      ),
    ).toEqual([]);
  });

  it("cover enough professions to be a talent search engine, not a tech one", () => {
    expect(Object.keys(CAPABILITIES).length).toBeGreaterThanOrEqual(33);
  });
});

describe("locations and environments", () => {
  it("meet the contract", () => {
    expect(
      report(
        validateOntologySection({ name: "location", concepts: LOCATIONS }),
      ),
    ).toEqual([]);
    expect(
      report(
        validateOntologySection({
          name: "environment",
          concepts: ENVIRONMENTS,
        }),
      ),
    ).toEqual([]);
  });

  it("rank seniority as an ordered ladder", () => {
    const ranks = Object.values(SENIORITY).map((b) => b.rank);
    expect(new Set(ranks).size).toBe(ranks.length);
    expect(Math.min(...ranks)).toBeGreaterThan(0);
  });
});

describe("aliases that would match ordinary prose", () => {
  it("does not read a middle initial as a programming language", () => {
    // `c++` normalises to the single character `c`, so "John C Smith" and
    // "vitamin c" both read as software engineering.
    expect(matchCapabilities("John C Smith")).toEqual({});
    expect(matchCapabilities("vitamin c deficiency")).toEqual({});
  });

  it("does not read initials as a finance capability", () => {
    // `m&a` normalises to `m a`.
    expect(matchCapabilities("John M A Smith")).toEqual({});
  });

  it("does not read a CV as computer vision", () => {
    // In a sourcing product "cv" means curriculum vitae far more often than it
    // means computer vision, and the angle library is full of the former.
    expect(Object.keys(matchCapabilities("public cv pdf"))).not.toContain(
      "computer_vision",
    );
  });

  it("still reads the terms these replaced", () => {
    expect(
      Object.keys(matchCapabilities("mergers and acquisitions")),
    ).toContain("corporate_finance");
    expect(Object.keys(matchCapabilities("computer vision"))).toContain(
      "computer_vision",
    );
  });
});

describe("expansion", () => {
  it("cites an edge for every adjacent concept it returns", () => {
    for (const key of Object.keys(CAPABILITIES)) {
      for (const expansion of expand([key])) {
        expect(expansion.reason.length).toBeGreaterThan(10);
        if (expansion.origin !== "") {
          expect(
            CAPABILITIES[expansion.origin].adjacent?.[expansion.key],
          ).toBeDefined();
        }
      }
    }
  });

  it("resolves every concept from its own label", () => {
    const unresolved: string[] = [];
    for (const [key, concept] of Object.entries(CAPABILITIES)) {
      if (resolveAlias(concept.label) === null)
        unresolved.push(`${key} (${concept.label})`);
    }
    expect(unresolved).toEqual([]);
  });
});

describe("place names that are also ordinary words", () => {
  const places = (text: string) => matchLocations(text).map((p) => p.key);

  it("does not move somebody to Berkshire for reading a book", () => {
    expect(places("spent the afternoon reading the brief")).not.toContain(
      "reading_uk",
    );
    expect(places("based in Reading, Berkshire")).toContain("reading_uk");
  });

  it("does not read a bath, a derby or a cork as a place", () => {
    expect(places("fitted the bathroom and the bath")).not.toContain("bath_uk");
    expect(places("won the local derby")).not.toContain("derby_uk");
    expect(places("cork flooring specialist")).not.toContain("cork_ie");
  });

  it("does not put a New South Wales engineer in Wales", () => {
    // The exact wrong-hemisphere failure the gazetteer exists to prevent:
    // "wales" is a whole-phrase substring of "new south wales".
    expect(places("Sydney, New South Wales")).not.toContain("wales");
  });

  it("does not put a New Englander in England, or a New Yorker in York", () => {
    expect(places("Boston, New England")).not.toContain("england");
    expect(places("Brooklyn, New York")).not.toContain("york_uk");
  });

  it("keeps the places these guards protect", () => {
    expect(places("Cardiff, Wales, United Kingdom")).toContain("cardiff");
    expect(places("York, England")).toContain("york_uk");
  });
});

describe("metro folding", () => {
  it("folds a commuter town onto the market a brief would name", () => {
    expect(normalizeLocation("Maidenhead")).toBe("thames valley");
    expect(normalizeLocation("Palo Alto")).toBe("san francisco bay area");
  });

  it("does not fold a town into a market it is not part of", () => {
    // Reading is not London: folding it would silently widen every London
    // search into a different labour market.
    expect(normalizeLocation("Reading, Berkshire")).not.toBe("london");
  });

  it("never chains one fold into another", () => {
    const folded = new Set(Object.values(LOCATION_ALIASES));
    for (const source of Object.keys(LOCATION_ALIASES)) {
      expect(folded.has(source)).toBe(false);
    }
  });
});
