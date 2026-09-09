/**
 * Capability ontology: alias matching, adjacency expansion, seniority ranking,
 * and recognising places named in prose.
 *
 * Ported from Hu (`app/query/ontology.py`). Expansion is inspectable — every
 * expanded concept carries the ontology edge, and its stated reason, that
 * produced it. Nothing is invented at runtime.
 */
import {
  CAPABILITIES,
  ENVIRONMENTS,
  LOCATIONS,
  SENIORITY,
  type OntologyConcept,
} from "@/lib/sourcing/ontology-data";
import { normalizeText } from "@/lib/sourcing/normalize";

export type { OntologyConcept };
export { CAPABILITIES, ENVIRONMENTS, LOCATIONS, SENIORITY };

export interface Expansion {
  /** Ontology key. */
  key: string;
  label: string;
  weight: number;
  /** Why this concept is in the brief — the edge's own words, or "matched directly". */
  reason: string;
  /** The concept it was expanded from; "" when the query named it directly. */
  origin: string;
}

export function isDirect(expansion: Expansion): boolean {
  return expansion.origin === "";
}

/** The alias as written, plus its plural. Only the last word inflects. */
function surfaceForms(alias: string): string[] {
  const idx = alias.lastIndexOf(" ");
  const prefix = idx === -1 ? "" : `${alias.slice(0, idx)} `;
  const last = idx === -1 ? alias : alias.slice(idx + 1);
  const forms = [alias];
  if (last.endsWith("y") && last.length > 3)
    forms.push(`${prefix}${last.slice(0, -1)}ies`);
  else if (/(ch|sh|ss|x|s)$/.test(last)) forms.push(`${prefix}${last}es`);
  else forms.push(`${prefix}${last}s`);
  return forms;
}

function singularise(word: string): string[] {
  if (word.length > 4 && word.endsWith("ies")) return [`${word.slice(0, -3)}y`];
  if (word.length > 4 && /(ches|shes|sses|xes)$/.test(word))
    return [word.slice(0, -2)];
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss"))
    return [word.slice(0, -1)];
  return [];
}

/**
 * `norm` plus its singular/plural forms, most specific first. Only the final
 * word is inflected: "technical recruiters" → "technical recruiter", never
 * "technicals recruiters".
 */
function numberVariants(norm: string): string[] {
  if (!norm) return [];
  const out = [norm];
  const idx = norm.lastIndexOf(" ");
  const prefix = idx === -1 ? "" : `${norm.slice(0, idx)} `;
  const last = idx === -1 ? norm : norm.slice(idx + 1);
  for (const singular of singularise(last)) out.push(`${prefix}${singular}`);
  out.push(`${prefix}${last}s`);
  return [...new Set(out.filter(Boolean))];
}

/** Longest alias first, so "technical recruiting" beats "recruiting". */
function buildAliasIndex(
  concepts: Readonly<Record<string, OntologyConcept>>,
): [string, string][] {
  const pairs: [string, string][] = [];
  for (const [key, concept] of Object.entries(concepts)) {
    for (const alias of concept.aliases) {
      const norm = normalizeText(alias);
      if (norm) pairs.push([norm, key]);
    }
  }
  pairs.sort((a, b) => b[0].length - a[0].length);
  return pairs;
}

const CAPABILITY_ALIASES = buildAliasIndex(CAPABILITIES);
/**
 * Exact-alias lookup, so resolving a term is a map hit rather than a scan of
 * every alias in the ontology. It matters as the ontology grows: `resolveAlias`
 * is called once per stated skill per person when the workspace is loaded, and
 * a linear scan there turns an O(people × skills) loop into
 * O(people × skills × aliases).
 */
const CAPABILITY_BY_ALIAS = new Map(CAPABILITY_ALIASES);
const ENVIRONMENT_ALIASES = buildAliasIndex(ENVIRONMENTS);
const LOCATION_ALIAS_INDEX = buildAliasIndex(LOCATIONS);

/**
 * capability key → the alias surface forms actually found in `text`.
 *
 * Aliases are stored in the singular but written in the plural at least as
 * often ("technical recruiters", "perception engineers"), so each is tried in
 * both numbers. The surface form found is returned, because it is what the
 * recruiter sees.
 */
/**
 * Every alias with its plural, computed once. Rebuilding these per call made
 * the cost of a match grow with the ontology twice over — once for the aliases
 * and again for the inflection of each.
 */
const CAPABILITY_SURFACES: [string[], string][] = CAPABILITY_ALIASES.map(
  ([alias, key]) => [surfaceForms(alias), key],
);

export function matchCapabilities(text: string): Record<string, string[]> {
  const norm = ` ${normalizeText(text)} `;
  const hits: Record<string, string[]> = {};
  for (const [surfaces, key] of CAPABILITY_SURFACES) {
    for (const surface of surfaces) {
      if (norm.includes(` ${surface} `)) {
        hits[key] ??= [];
        if (!hits[key].includes(surface)) hits[key].push(surface);
        break;
      }
    }
  }
  return hits;
}

export function matchEnvironments(text: string): Record<string, string[]> {
  const norm = ` ${normalizeText(text)} `;
  const hits: Record<string, string[]> = {};
  for (const [alias, key] of ENVIRONMENT_ALIASES) {
    if (alias && norm.includes(` ${alias} `)) {
      hits[key] ??= [];
      hits[key].push(alias);
    }
  }
  return hits;
}

/**
 * Places named anywhere in `text`, longest match first. Without this the whole
 * location dimension stays inactive on natural-language briefs, and Talent
 * happily returns the right skills in the wrong hemisphere.
 */
export function matchLocations(text: string): { key: string; label: string }[] {
  const norm = ` ${normalizeText(text)} `;
  const found: { key: string; label: string }[] = [];
  const claimed = new Set<string>();
  for (const [alias, key] of LOCATION_ALIAS_INDEX) {
    if (claimed.has(key) || !norm.includes(` ${alias} `)) continue;
    claimed.add(key);
    found.push({ key, label: LOCATIONS[key].label });
  }
  return found;
}

export function conceptLabel(key: string): string {
  return (
    CAPABILITIES[key]?.label ??
    ENVIRONMENTS[key]?.label ??
    LOCATIONS[key]?.label ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/**
 * Resolve one term to a capability key, tolerating plurals. Sourcers type
 * "recruiters", not "recruiter"; matching only the exact alias silently drops
 * the occupation from the brief, which is worse than any ranking error —
 * Talent then searches for the wrong kind of human.
 */
export function resolveAlias(term: string): string | null {
  for (const candidate of numberVariants(normalizeText(term))) {
    if (candidate in CAPABILITIES) return candidate;
    const key = candidate.replace(/ /g, "_");
    if (key in CAPABILITIES) return key;
    const byAlias = CAPABILITY_BY_ALIAS.get(candidate);
    if (byAlias !== undefined) return byAlias;
  }
  return null;
}

/** Breadth-first adjacency walk, with provenance for every hop. */
export function expand(
  keys: string[],
  depth = 1,
  minWeight = 0.55,
): Expansion[] {
  const out = new Map<string, Expansion>();
  for (const key of keys) {
    const concept = CAPABILITIES[key];
    if (concept) {
      out.set(key, {
        key,
        label: concept.label,
        weight: 1,
        reason: "matched directly in the query",
        origin: "",
      });
    }
  }

  let frontier = [...keys];
  for (let hop = 0; hop < depth; hop += 1) {
    const nextFrontier: string[] = [];
    const decay = 0.85 ** hop;
    for (const key of frontier) {
      const concept = CAPABILITIES[key];
      if (!concept?.adjacent) continue;
      for (const [adjKey, edge] of Object.entries(concept.adjacent)) {
        const adjacentConcept = CAPABILITIES[adjKey];
        if (!adjacentConcept) continue;
        const weight = edge.weight * decay;
        if (weight < minWeight) continue;
        const existing = out.get(adjKey);
        if (existing && (existing.weight >= weight || isDirect(existing)))
          continue;
        out.set(adjKey, {
          key: adjKey,
          label: adjacentConcept.label,
          weight: Math.round(weight * 1000) / 1000,
          reason: edge.reason,
          origin: key,
        });
        nextFrontier.push(adjKey);
      }
    }
    frontier = nextFrontier;
  }

  return [...out.values()].sort(
    (a, b) => b.weight - a.weight || a.key.localeCompare(b.key),
  );
}

export function seniorityRank(title: string | null | undefined): number {
  if (!title) return 0;
  const norm = ` ${normalizeText(title)} `;
  let best = 0;
  for (const band of Object.values(SENIORITY)) {
    for (const alias of band.aliases) {
      if (norm.includes(` ${normalizeText(alias)} `))
        best = Math.max(best, band.rank);
    }
  }
  return best;
}

export function allCapabilityTerms(): Set<string> {
  const out = new Set<string>();
  for (const concept of Object.values(CAPABILITIES)) {
    for (const alias of concept.aliases) out.add(alias);
  }
  return out;
}
