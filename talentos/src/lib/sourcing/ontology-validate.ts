/**
 * The ontology's own contract, enforced.
 *
 * An alias is matched as a whole phrase against normalised free text, longest
 * first, so a bad one is not a small mistake: a single generic word puts an
 * unrelated profession on a recruiter's shortlist, and an alias claimed by two
 * concepts makes which one wins an accident of string length.
 *
 * `tests/unit/sourcing-ontology.test.ts` runs this over the whole ontology, so
 * a new concept cannot be added without meeting it. Three real defects in the
 * first import were found by writing it:
 *
 *  - `c++` normalises to the single character `c`, so any standalone "c" —
 *    a middle initial, "vitamin c" — read as software engineering.
 *  - `m&a` normalises to `m a`, so "John M A Smith" read as corporate finance.
 *  - `cv` meant computer vision, in a product where CV means curriculum vitae.
 */
import { normalizeText } from "@/lib/sourcing/normalize";
import type { OntologyConcept } from "@/lib/sourcing/ontology-data";

/**
 * Single words that appear in every profession. As a whole alias each of them
 * would match almost everybody; inside a longer phrase they are fine, which is
 * why this is checked against the complete alias rather than its words.
 */
export const GENERIC_ALIAS_WORDS: ReadonlySet<string> = new Set([
  "lead",
  "senior",
  "junior",
  "manager",
  "management",
  "director",
  "head",
  "operations",
  "data",
  "system",
  "systems",
  "project",
  "team",
  "work",
  "business",
  "service",
  "services",
  "product",
  "quality",
  "design",
  "engineer",
  "engineering",
  "analyst",
  "consultant",
  "consulting",
  "specialist",
  "coordinator",
  "associate",
  "officer",
  "executive",
  "professional",
  "technical",
  "digital",
  "strategy",
  "strategic",
  "planning",
  "development",
  "support",
  "delivery",
  "administration",
  "technology",
  "solution",
  "solutions",
  "process",
  "program",
  "programme",
  "performance",
  "client",
  "customer",
  "account",
  "sales",
  "marketing",
  "finance",
  "legal",
  "medical",
  "clinical",
  "science",
  "scientific",
  "practice",
  "expert",
  "experience",
  "skill",
  "skills",
  "role",
  "job",
  "position",
  "company",
  "organisation",
  "organization",
  "industry",
  "sector",
  "market",
  "global",
  "international",
  "national",
  "regional",
  "local",
  "public",
  "private",
  "general",
  "principal",
  "staff",
  "chief",
  "vice",
  "president",
  "partner",
  "advisor",
  "adviser",
  "leader",
  "leadership",
  "professional services",
]);

/** Protected-characteristic vocabulary, which must never appear in the data. */
const BANNED_ONTOLOGY_WORDS: RegExp[] = [
  /\bethnic/i,
  /\breligio/i,
  /\bdisabilit/i,
  /\bnational origin\b/i,
  /\bnationalit/i,
  /\bcitizenship\b/i,
  /\bsexual orientation\b/i,
  /\bpregnan/i,
  /\bmarital/i,
  /\bveteran/i,
  /\bdate of birth\b/i,
];

export interface OntologyProblem {
  concept: string;
  kind:
    | "bad_key"
    | "duplicate_key"
    | "no_aliases"
    | "empty_alias"
    | "uppercase_alias"
    | "initials_alias"
    | "generic_alias"
    | "duplicate_alias"
    | "self_edge"
    | "dangling_edge"
    | "bad_weight"
    | "thin_reason"
    | "vacuous_reason"
    | "banned_word";
  detail: string;
}

const KEY_RE = /^[a-z][a-z0-9_]*$/;
const VACUOUS_RE = /^\s*(related to|similar to|same as|both are|also a)\b/i;

/** Tokens of an alias after the same normalisation the matcher applies. */
function aliasTokens(alias: string): string[] {
  return normalizeText(alias).split(" ").filter(Boolean);
}

/**
 * True when nothing survives normalisation but single characters — the alias
 * the matcher would actually hold is then a letter, not a term.
 */
function isInitialsOnly(alias: string): boolean {
  const tokens = aliasTokens(alias);
  return tokens.length > 0 && tokens.every((t) => t.length < 2);
}

export interface OntologySection {
  name: string;
  concepts: Readonly<Record<string, OntologyConcept>>;
  /** Keys an adjacency edge may point at. Omit to forbid edges entirely. */
  edgeTargets?: ReadonlySet<string>;
}

export function validateOntologySection(
  section: OntologySection,
): OntologyProblem[] {
  const problems: OntologyProblem[] = [];
  const aliasOwner = new Map<string, string>();

  for (const [key, concept] of Object.entries(section.concepts)) {
    const add = (kind: OntologyProblem["kind"], detail: string) =>
      problems.push({ concept: `${section.name}.${key}`, kind, detail });

    if (!KEY_RE.test(key)) add("bad_key", `"${key}" is not snake_case`);

    const text = [
      key,
      concept.label,
      ...concept.aliases,
      ...Object.values(concept.adjacent ?? {}).map((e) => e.reason),
    ].join(" ");
    for (const pattern of BANNED_ONTOLOGY_WORDS) {
      const hit = pattern.exec(text);
      if (hit)
        add("banned_word", `"${hit[0]}" must not appear in ontology data`);
    }

    if (concept.aliases.length === 0)
      add("no_aliases", "a concept with no alias can never match");

    for (const alias of concept.aliases) {
      if (alias !== alias.toLowerCase())
        add("uppercase_alias", `"${alias}" is not lowercase`);
      const normalized = normalizeText(alias);
      if (!normalized) {
        add("empty_alias", `"${alias}" normalises to nothing`);
        continue;
      }
      if (isInitialsOnly(alias)) {
        add(
          "initials_alias",
          `"${alias}" normalises to "${normalized}", which is single letters and would match ordinary prose`,
        );
      }
      if (GENERIC_ALIAS_WORDS.has(normalized)) {
        add(
          "generic_alias",
          `"${alias}" appears in every profession and would match almost anybody`,
        );
      }
      const owner = aliasOwner.get(normalized);
      if (owner !== undefined && owner !== key) {
        add(
          "duplicate_alias",
          `"${alias}" is also claimed by ${owner}; which one wins is an accident`,
        );
      } else {
        aliasOwner.set(normalized, key);
      }
    }

    for (const [target, edge] of Object.entries(concept.adjacent ?? {})) {
      if (target === key)
        add("self_edge", "a concept cannot be adjacent to itself");
      if (section.edgeTargets && !section.edgeTargets.has(target)) {
        add("dangling_edge", `adjacent key "${target}" does not exist`);
      }
      if (!(edge.weight >= 0.4 && edge.weight <= 0.95)) {
        add(
          "bad_weight",
          `edge to "${target}" has weight ${edge.weight}, outside 0.40..0.95`,
        );
      }
      if (!edge.reason || edge.reason.trim().length < 30) {
        add(
          "thin_reason",
          `edge to "${target}" has no reason a recruiter could read`,
        );
      } else if (VACUOUS_RE.test(edge.reason)) {
        add(
          "vacuous_reason",
          `edge to "${target}" says "${edge.reason}", which tells nobody anything`,
        );
      }
    }
  }

  return problems;
}
