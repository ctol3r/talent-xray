/**
 * Score the extractor against the page corpus.
 *
 *   pnpm extraction
 *
 * Two numbers that mean different things. On the PAGES: did it find the people
 * a competent human agreed were there, and no others. On the TRAPS: did it
 * refuse. A reader that scores well on pages and badly on traps is worse than
 * useless — it fills a shortlist with rows nobody can contact.
 */
import { readFileSync } from "node:fs";
import { extractPeopleFromPage } from "../src/lib/sourcing/page-people";
import { normalizeName } from "../src/lib/sourcing/normalize";

interface Fixture {
  id: string;
  label: string;
  url: string;
  title: string;
  text: string;
  isRoster: boolean;
  why?: string;
  people: { name: string; title?: string; organization?: string }[];
}

const corpus = JSON.parse(
  readFileSync("tests/fixtures/page-corpus.json", "utf8"),
) as { pages: Fixture[]; traps: Fixture[] };

function score(rows: Fixture[]) {
  let expected = 0;
  let found = 0;
  let correct = 0;
  const misses: string[] = [];
  const inventions: string[] = [];

  for (const row of rows) {
    const reading = extractPeopleFromPage(row);
    const want = new Set(row.people.map((p) => normalizeName(p.name)));
    const got = new Set(reading.people.map((p) => normalizeName(p.name)));
    expected += want.size;
    found += got.size;
    for (const name of want) {
      if (got.has(name)) correct += 1;
      else misses.push(`${row.id}: missed ${name}`);
    }
    for (const name of got) {
      if (!want.has(name)) inventions.push(`${row.id}: invented "${name}"`);
    }
  }
  return {
    expected,
    found,
    correct,
    recall: expected === 0 ? 1 : correct / expected,
    precision: found === 0 ? 1 : correct / found,
    misses,
    inventions,
  };
}

const pages = score(corpus.pages);
const traps = score(corpus.traps);

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
console.log("=".repeat(72));
console.log("EXTRACTION AGAINST THE PAGE CORPUS");
console.log("=".repeat(72));
console.log(
  `\nPAGES  ${corpus.pages.length} pages, ${pages.expected} people expected`,
);
console.log(
  `  recall     ${pct(pages.recall)}   (${pages.correct}/${pages.expected} found)`,
);
console.log(
  `  precision  ${pct(pages.precision)}   (${pages.correct}/${pages.found} kept)`,
);
console.log(
  `\nTRAPS  ${corpus.traps.length} pages, ${traps.expected} people expected`,
);
console.log(`  recall     ${pct(traps.recall)}`);
console.log(
  `  precision  ${pct(traps.precision)}   — anything invented here is a candidate nobody can contact`,
);
console.log(`  invented   ${traps.inventions.length}`);

for (const line of [...pages.inventions, ...traps.inventions].slice(0, 25)) {
  console.log(`    + ${line}`);
}
for (const line of [...pages.misses, ...traps.misses].slice(0, 25)) {
  console.log(`    - ${line}`);
}
console.log(
  "\nThese are invented pages written to be hard, not a sample of the web. They\n" +
    "say the reader handles the shapes it has been shown; they say nothing about\n" +
    "the shapes it has not.",
);
