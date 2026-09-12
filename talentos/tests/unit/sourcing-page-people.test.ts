/**
 * Reading people out of a page, measured against a corpus written to be hard.
 *
 * `pnpm extraction` prints the score; this holds the floor. Two numbers that
 * mean different things: on the PAGES, did it find the people a competent
 * human agreed were there. On the TRAPS, did it refuse — because a reader that
 * scores well on pages and badly on traps is worse than useless, filling a
 * shortlist with rows nobody can contact, corroborate or remove.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractPeopleFromPage,
  classifyPage,
} from "@/lib/sourcing/page-people";
import { normalizeName } from "@/lib/sourcing/normalize";

interface Fixture {
  id: string;
  label: string;
  url: string;
  title: string;
  text: string;
  isRoster: boolean;
  people: { name: string }[];
}

const corpus = JSON.parse(
  readFileSync(join(__dirname, "..", "fixtures", "page-corpus.json"), "utf8"),
) as { pages: Fixture[]; traps: Fixture[] };

function score(rows: Fixture[]) {
  let expected = 0;
  let found = 0;
  let correct = 0;
  const inventions: string[] = [];
  for (const row of rows) {
    const got = new Set(
      extractPeopleFromPage(row).people.map((p) => normalizeName(p.name)),
    );
    const want = new Set(row.people.map((p) => normalizeName(p.name)));
    expected += want.size;
    found += got.size;
    for (const name of want) if (got.has(name)) correct += 1;
    for (const name of got) {
      if (!want.has(name)) inventions.push(`${row.id}: "${name}"`);
    }
  }
  return {
    recall: expected === 0 ? 1 : correct / expected,
    precision: found === 0 ? 1 : correct / found,
    inventions,
  };
}

const pages = score(corpus.pages);
const traps = score(corpus.traps);

describe("the corpus itself", () => {
  it("covers the surfaces and carries traps for each", () => {
    expect(corpus.pages.length).toBeGreaterThanOrEqual(15);
    expect(corpus.traps.length).toBeGreaterThanOrEqual(15);
    for (const row of [...corpus.pages, ...corpus.traps]) {
      expect(row.text.length).toBeGreaterThan(200);
      // Every fixture carries real page furniture, or it is not testing
      // surviving it.
      expect(row.text).toMatch(
        /cookie|privacy|©|back to top|home|contact|nav/i,
      );
    }
  });
});

describe("pages", () => {
  it("finds the people a competent reader would", () => {
    expect(pages.recall).toBeGreaterThanOrEqual(0.7);
  });

  it("keeps the list clean while doing it", () => {
    expect(pages.precision).toBeGreaterThanOrEqual(0.8);
  });
});

describe("traps", () => {
  it("refuses nearly everything a naive reader would invent", () => {
    // A first draft invented 42 across these pages. This is the number that
    // matters most: each one is a candidate nobody can contact.
    expect(traps.inventions.length).toBeLessThanOrEqual(8);
  });

  it("still finds the people the hard pages really do name", () => {
    // Refusing everything is easy and useless. Short rosters, form-labelled
    // rows and a vacancy that names its hiring manager are all real people.
    expect(traps.recall).toBeGreaterThanOrEqual(0.5);
  });
});

describe("the specific failures the traps were written for", () => {
  const find = (id: string) =>
    [...corpus.pages, ...corpus.traps].find((row) => row.id === id);

  it("does not read the page's own organisation as one of its people", () => {
    const page = find("team-001-vestfjell-leadership");
    if (!page) return;
    const names = extractPeopleFromPage(page).people.map((p) => p.name);
    expect(names).not.toContain("Vestfjell Kraft ASA");
  });

  it("reads a two- or three-person roster as two or three people", () => {
    const page = find("team-002-once-grados-studio");
    if (!page) return;
    expect(extractPeopleFromPage(page).people.length).toBeGreaterThanOrEqual(2);
  });

  it("reads people out of a table, not only out of prose", () => {
    const page = find("team-003-chandran-beh-partners");
    if (!page) return;
    expect(extractPeopleFromPage(page).people.length).toBeGreaterThanOrEqual(3);
  });

  it("says plainly when a page names nobody", () => {
    const trap = corpus.traps.find((row) => row.people.length === 0);
    if (!trap) return;
    const reading = extractPeopleFromPage(trap);
    expect(reading.why.length).toBeGreaterThan(10);
  });

  it("classifies rather than guessing, and says why", () => {
    for (const row of [...corpus.pages, ...corpus.traps]) {
      const { kind, why } = classifyPage(row.text, row.title, row.url);
      expect(["roster", "person", "document", "not_people"]).toContain(kind);
      expect(why.length).toBeGreaterThan(10);
    }
  });
});
