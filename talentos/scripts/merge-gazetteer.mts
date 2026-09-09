/**
 * Merge a drafted-and-refuted gazetteer expansion.
 *
 *   pnpm tsx scripts/merge-gazetteer.mts <journal.jsonl>
 *
 * Places go into `LOCATIONS` in `ontology-data.ts`; the metro folding rules go
 * into `LOCATION_ALIASES` in `normalize.ts`. The verdict is applied
 * mechanically — DROP removes, anything else replaces — and then two rules that
 * only a machine will apply consistently: an alias another place already claims
 * is dropped, and so is one that normalises to something a bare compass point
 * or ordinary word would match. Whatever survives still has to pass
 * `tests/unit/sourcing-ontology.test.ts`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { CAPABILITIES, LOCATIONS } from "../src/lib/sourcing/ontology-data";
import { LOCATION_ALIASES, normalizeText } from "../src/lib/sourcing/normalize";

interface Place {
  key: string;
  label: string;
  aliases: string[];
  note?: string;
}
interface Fold {
  from: string;
  to: string;
  why: string;
}
interface Problem {
  placeKey?: string;
  conceptKey?: string;
  kind: string;
  detail: string;
  target: string;
  fix: string;
}

const [journalPath] = process.argv.slice(2);
if (!journalPath) {
  console.error("usage: merge-gazetteer.mts <journal.jsonl>");
  process.exit(2);
}

const entries = readFileSync(journalPath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    try {
      return JSON.parse(line) as Record<string, unknown>;
    } catch {
      return null;
    }
  })
  .filter(
    (row): row is Record<string, unknown> =>
      row !== null && row.type === "result",
  )
  .map((row) => row.result);

const drafts = entries.filter(
  (e): e is { places: Place[]; folding: Fold[] } =>
    typeof e === "object" &&
    e !== null &&
    Array.isArray((e as { places?: unknown }).places),
);
const problems = entries
  .filter(
    (e): e is { problems: Problem[] } =>
      typeof e === "object" &&
      e !== null &&
      Array.isArray((e as { problems?: unknown }).problems),
  )
  .flatMap((v) => v.problems);

const byPlace = new Map<string, Problem[]>();
for (const problem of problems) {
  const key = problem.placeKey ?? problem.conceptKey ?? "";
  byPlace.set(key, [...(byPlace.get(key) ?? []), problem]);
}

/** Compass points and bare directions match anything and locate nobody. */
const NEVER_A_PLACE = new Set([
  "north",
  "south",
  "east",
  "west",
  "central",
  "north east",
  "north west",
  "south east",
  "south west",
  "midlands",
  "region",
  "county",
  "city",
  "town",
  "greater",
  "metro",
  "area",
  "district",
  "province",
  "state",
  "capital",
]);

const claimed = new Map<string, string>();
for (const [key, place] of Object.entries(LOCATIONS)) {
  for (const alias of place.aliases) claimed.set(normalizeText(alias), key);
}

const dropped: string[] = [];
const kept: Place[] = [];
const seen = new Set<string>();

for (const draft of drafts) {
  for (const place of draft.places) {
    const notes = byPlace.get(place.key) ?? [];
    if (
      notes.some(
        (n) => n.target === "" && n.fix.trim().toUpperCase() === "DROP",
      )
    ) {
      dropped.push(`${place.key}: refuted whole (${notes[0].kind})`);
      continue;
    }
    if (
      place.key in LOCATIONS ||
      place.key in CAPABILITIES ||
      seen.has(place.key)
    ) {
      dropped.push(`${place.key}: key already taken`);
      continue;
    }

    const aliases: string[] = [];
    for (const raw of place.aliases) {
      const note = notes.find(
        (n) => n.target.toLowerCase() === raw.toLowerCase(),
      );
      const value = note
        ? note.fix.trim().toUpperCase() === "DROP"
          ? ""
          : note.fix.trim()
        : raw;
      if (!value) continue;
      const normalized = normalizeText(value);
      if (!normalized) continue;
      if (NEVER_A_PLACE.has(normalized)) {
        dropped.push(
          `${place.key} alias "${value}": names a direction, not a place`,
        );
        continue;
      }
      if (normalized.split(" ").every((t) => t.length < 2)) {
        dropped.push(`${place.key} alias "${value}": normalises to initials`);
        continue;
      }
      const owner = claimed.get(normalized);
      if (owner !== undefined && owner !== place.key) {
        dropped.push(
          `${place.key} alias "${value}": already claimed by ${owner}`,
        );
        continue;
      }
      claimed.set(normalized, place.key);
      if (!aliases.includes(value.toLowerCase()))
        aliases.push(value.toLowerCase());
    }
    if (aliases.length === 0) {
      dropped.push(`${place.key}: no alias survived`);
      continue;
    }
    seen.add(place.key);
    kept.push({ key: place.key, label: place.label, aliases });
  }
}

// ── folding: a city folds onto the metro a brief would name
const folds = new Map<string, string>();
for (const draft of drafts) {
  for (const fold of draft.folding ?? []) {
    const from = normalizeText(fold.from);
    const to = normalizeText(fold.to);
    if (!from || !to || from === to) continue;
    if (from in LOCATION_ALIASES) continue;
    if (NEVER_A_PLACE.has(from)) continue;
    if (from.split(" ").every((t) => t.length < 2)) continue;
    // `normalizeLocation` applies the map ONCE, so a fold pointing at another
    // fold's source silently stops one hop short of the metro it meant. Both
    // the new rules and the ones already in the file have to be checked, and a
    // fold onto something that folds back is a cycle with no fixed point at all.
    if (folds.has(to) || to in LOCATION_ALIASES) continue;
    if (folds.get(to) === from) continue;
    folds.set(from, to);
  }
}

const placeLines = kept
  .sort((a, b) => a.key.localeCompare(b.key))
  .map(
    (place) =>
      `  ${place.key}: { label: ${JSON.stringify(place.label)}, aliases: [${place.aliases
        .map((a) => JSON.stringify(a))
        .join(", ")}] },`,
  );

const dataPath = "src/lib/sourcing/ontology-data.ts";
const data = readFileSync(dataPath, "utf8");
const end = data.lastIndexOf("};");
if (end < 0) throw new Error("could not find the end of LOCATIONS");
writeFileSync(
  dataPath,
  `${data.slice(0, end)}${placeLines.join("\n")}\n${data.slice(end)}`,
);

const normPath = "src/lib/sourcing/normalize.ts";
const norm = readFileSync(normPath, "utf8");
const marker = "\n};\n\n/** Free mail hosts.";
const at = norm.indexOf(marker);
if (at < 0) throw new Error("could not find the end of LOCATION_ALIASES");
const foldLines = [...folds.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([from, to]) => `  ${JSON.stringify(from)}: ${JSON.stringify(to)},`);
writeFileSync(
  normPath,
  `${norm.slice(0, at)}\n${foldLines.join("\n")}${norm.slice(at)}`,
);

console.log(`regions read:   ${drafts.length}`);
console.log(`problems:       ${problems.length}`);
console.log(`places kept:    ${kept.length}`);
console.log(
  `aliases kept:   ${kept.reduce((n, p) => n + p.aliases.length, 0)}`,
);
console.log(`folding rules:  ${folds.size}`);
console.log(`dropped:        ${dropped.length}`);
for (const line of dropped.slice(0, 40)) console.log(`  - ${line}`);
