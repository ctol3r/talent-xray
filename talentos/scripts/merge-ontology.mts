/**
 * Merge a drafted-and-refuted ontology expansion into `ontology-data.ts`.
 *
 *   pnpm tsx scripts/merge-ontology.mts <journal.jsonl> [--kind=capability|location]
 *
 * The generating run produces concepts and, separately, an adversarial verdict
 * on each one. This applies the verdict mechanically — a DROP removes the
 * offending alias, edge or concept; anything else replaces it — then drops
 * edges that point nowhere and aliases another concept already claims, and
 * prints what it did. Whatever survives still has to pass
 * `tests/unit/sourcing-ontology.test.ts`, which is the real gate; this script
 * exists so the obvious corrections are not made by hand, one at a time, with
 * the mistakes that implies.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { CAPABILITIES, LOCATIONS } from "../src/lib/sourcing/ontology-data";
import { normalizeText } from "../src/lib/sourcing/normalize";
import { GENERIC_ALIAS_WORDS } from "../src/lib/sourcing/ontology-validate";

interface Edge {
  key: string;
  weight: number;
  reason: string;
}
interface Concept {
  key: string;
  label: string;
  onet?: string;
  aliases: string[];
  adjacent: Edge[];
}
interface Problem {
  conceptKey?: string;
  placeKey?: string;
  kind: string;
  detail: string;
  target: string;
  fix: string;
}

const [journalPath] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!journalPath) {
  console.error("usage: merge-ontology.mts <journal.jsonl>");
  process.exit(2);
}

/** Every agent return value the run recorded, newest wins. */
function readJournal(path: string): unknown[] {
  return readFileSync(path, "utf8")
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
}

const entries = readJournal(journalPath);
const drafts = entries.filter(
  (e): e is { concepts: Concept[] } =>
    typeof e === "object" &&
    e !== null &&
    Array.isArray((e as { concepts?: unknown }).concepts),
);
const verdicts = entries.filter(
  (e): e is { problems: Problem[] } =>
    typeof e === "object" &&
    e !== null &&
    Array.isArray((e as { problems?: unknown }).problems),
);

const problems = verdicts.flatMap((v) => v.problems);
const byConcept = new Map<string, Problem[]>();
for (const problem of problems) {
  const key = problem.conceptKey ?? problem.placeKey ?? "";
  byConcept.set(key, [...(byConcept.get(key) ?? []), problem]);
}

const existingKeys = new Set([
  ...Object.keys(CAPABILITIES),
  ...Object.keys(LOCATIONS),
]);
const claimedAliases = new Map<string, string>();
for (const [key, concept] of Object.entries(CAPABILITIES)) {
  for (const alias of concept.aliases)
    claimedAliases.set(normalizeText(alias), key);
}

const dropped: string[] = [];
const merged: Concept[] = [];
const seenKeys = new Set<string>();

for (const draft of drafts) {
  for (const concept of draft.concepts) {
    const notes = byConcept.get(concept.key) ?? [];
    if (
      notes.some(
        (n) => n.target === "" && n.fix.trim().toUpperCase() === "DROP",
      )
    ) {
      dropped.push(`${concept.key}: refuted whole (${notes[0].kind})`);
      continue;
    }
    if (existingKeys.has(concept.key) || seenKeys.has(concept.key)) {
      dropped.push(`${concept.key}: key already taken`);
      continue;
    }

    const aliases: string[] = [];
    for (const raw of concept.aliases) {
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
      if (GENERIC_ALIAS_WORDS.has(normalized)) {
        dropped.push(`${concept.key} alias "${value}": generic`);
        continue;
      }
      if (normalized.split(" ").every((t) => t.length < 2)) {
        dropped.push(`${concept.key} alias "${value}": normalises to initials`);
        continue;
      }
      const owner = claimedAliases.get(normalized);
      if (owner !== undefined && owner !== concept.key) {
        dropped.push(
          `${concept.key} alias "${value}": already claimed by ${owner}`,
        );
        continue;
      }
      claimedAliases.set(normalized, concept.key);
      if (!aliases.includes(value.toLowerCase()))
        aliases.push(value.toLowerCase());
    }
    // A concept must answer to its own name. Without this a recruiter who
    // reads "Acoustics and Noise Consulting" off the page and types it back
    // gets nothing, which is the most obvious query there is.
    const labelAlias = normalizeText(concept.label);
    if (labelAlias && !claimedAliases.has(labelAlias)) {
      claimedAliases.set(labelAlias, concept.key);
      aliases.push(concept.label.toLowerCase());
    }
    if (aliases.length === 0) {
      dropped.push(`${concept.key}: no alias survived`);
      continue;
    }

    const edges: Edge[] = [];
    for (const edge of concept.adjacent ?? []) {
      const note = notes.find((n) => n.target === edge.key);
      if (note && note.fix.trim().toUpperCase() === "DROP") continue;
      if (edge.key === concept.key) continue;
      const reason =
        note && note.fix.trim().length > 20 && /reason/i.test(note.kind)
          ? note.fix.trim()
          : edge.reason;
      if (!reason || reason.trim().length < 30) continue;
      if (/^\s*(related to|similar to|same as|both are|also a)\b/i.test(reason))
        continue;
      const weight = Math.min(0.95, Math.max(0.4, edge.weight));
      edges.push({ key: edge.key, weight, reason: reason.trim() });
    }

    seenKeys.add(concept.key);
    merged.push({
      key: concept.key,
      label: concept.label,
      onet: concept.onet,
      aliases,
      adjacent: edges,
    });
  }
}

// Edges can only point at a concept that exists once every draft is in.
const allKeys = new Set([...existingKeys, ...merged.map((c) => c.key)]);
let danglingDropped = 0;
for (const concept of merged) {
  const before = concept.adjacent.length;
  concept.adjacent = concept.adjacent.filter((e) => allKeys.has(e.key));
  danglingDropped += before - concept.adjacent.length;
}

const lines: string[] = [];
for (const concept of merged.sort((a, b) => a.key.localeCompare(b.key))) {
  lines.push(`  ${concept.key}: {`);
  lines.push(`    label: ${JSON.stringify(concept.label)},`);
  if (concept.onet) lines.push(`    onet: ${JSON.stringify(concept.onet)},`);
  lines.push(
    `    aliases: [${concept.aliases.map((a) => JSON.stringify(a)).join(", ")}],`,
  );
  if (concept.adjacent.length > 0) {
    lines.push("    adjacent: {");
    for (const edge of concept.adjacent) {
      lines.push(
        `      ${edge.key}: { weight: ${edge.weight}, reason: ${JSON.stringify(edge.reason)} },`,
      );
    }
    lines.push("    },");
  }
  lines.push("  },");
}

const target = "src/lib/sourcing/ontology-data.ts";
const source = readFileSync(target, "utf8");
const marker = "};\n\n/** Company-context signals.";
const at = source.indexOf(marker);
if (at < 0)
  throw new Error("could not find the end of CAPABILITIES in ontology-data.ts");
writeFileSync(
  target,
  `${source.slice(0, at)}${lines.join("\n")}\n${source.slice(at)}`,
);

console.log(`drafts read:        ${drafts.length}`);
console.log(`verdict problems:   ${problems.length}`);
console.log(`concepts merged:    ${merged.length}`);
console.log(
  `aliases kept:       ${merged.reduce((n, c) => n + c.aliases.length, 0)}`,
);
console.log(
  `edges kept:         ${merged.reduce((n, c) => n + c.adjacent.length, 0)}`,
);
console.log(`dangling edges cut: ${danglingDropped}`);
console.log(`dropped:            ${dropped.length}`);
for (const line of dropped.slice(0, 60)) console.log(`  - ${line}`);
