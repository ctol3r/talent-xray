/**
 * Platform-aware deterministic query compilation (spec P0-D).
 *
 * This WRAPS the validated composer (`@/lib/domain/search-strings`, itself
 * ported from the reference console — CLAUDE.md: do not redesign it). It
 * adds what the composer deliberately does not know: each platform's
 * practical limits, operator dialect, automatic splitting of over-budget
 * OR groups into several runnable queries, cross-platform dedupe, and an
 * explanation of what each breadth variant tests. A query is `runnable`
 * only when it satisfies the selected platform's constraints.
 */
import {
  composeQueries,
  orGroup,
  quoteTerm,
  type ComposedQuery,
  type StringLabInput,
} from "@/lib/domain/search-strings";
import type { Breadth } from "@/lib/core/enums";

export type PlatformId =
  | "google_linkedin"
  | "linkedin_native"
  | "google_github"
  | "google_scholar"
  | "google_portfolio"
  | "google_web";

export interface PlatformConstraints {
  id: PlatformId;
  /** Display name — must match the composer's `platform` string. */
  platform: string;
  tag: "general" | "engineering" | "research" | "design";
  sites: string[];
  nativeBoolean: boolean;
  /** Maximum counted terms; `null` = no term limit (character-limited instead). */
  maxTerms: number | null;
  /** Maximum characters; `null` = not character-limited. */
  maxChars: number | null;
  operators: {
    or: "OR";
    and: "implicit" | "AND";
    not: "-" | "NOT";
    site: boolean;
    quotes: boolean;
    parentheses: boolean;
  };
  purpose: string;
  /** Why the numbers are what they are. Editable constants, recorded reasons. */
  rationale: string;
}

/**
 * Google: 32-word limit on the query (documented Google Search behaviour —
 * words past the 32nd are ignored silently). We count every whitespace
 * token except the operator word OR; a quoted phrase counts each word.
 * LinkedIn: no published limit; 1,000 characters keeps a string pasteable
 * into the people-search box and readable in Recruiter's boolean field.
 */
export const PLATFORM_CONSTRAINTS: PlatformConstraints[] = [
  {
    id: "google_linkedin",
    platform: "Google (LinkedIn x-ray)",
    tag: "general",
    sites: ["linkedin.com/in", "linkedin.com/pub"],
    nativeBoolean: false,
    maxTerms: 32,
    maxChars: null,
    operators: {
      or: "OR",
      and: "implicit",
      not: "-",
      site: true,
      quotes: true,
      parentheses: true,
    },
    purpose: "Public LinkedIn profiles via Google",
    rationale: "Google ignores words beyond the 32nd; each quoted word counts.",
  },
  {
    id: "linkedin_native",
    platform: "LinkedIn (native boolean)",
    tag: "general",
    sites: [],
    nativeBoolean: true,
    maxTerms: null,
    maxChars: 1000,
    operators: {
      or: "OR",
      and: "AND",
      not: "NOT",
      site: false,
      quotes: true,
      parentheses: true,
    },
    purpose: "Paste into LinkedIn people search",
    rationale:
      "LinkedIn publishes no limit; 1,000 chars is the practical pasteable size. Uses NOT, never '-'; no site: operator.",
  },
  {
    id: "google_github",
    platform: "Google (GitHub x-ray)",
    tag: "engineering",
    sites: ["github.com"],
    nativeBoolean: false,
    maxTerms: 32,
    maxChars: null,
    operators: {
      or: "OR",
      and: "implicit",
      not: "-",
      site: true,
      quotes: true,
      parentheses: true,
    },
    purpose: "Engineer profiles, READMEs, org membership",
    rationale: "Google 32-word limit.",
  },
  {
    id: "google_scholar",
    platform: "Google (Scholar/arXiv x-ray)",
    tag: "research",
    sites: ["scholar.google.com", "arxiv.org", "openreview.net"],
    nativeBoolean: false,
    maxTerms: 32,
    maxChars: null,
    operators: {
      or: "OR",
      and: "implicit",
      not: "-",
      site: true,
      quotes: true,
      parentheses: true,
    },
    purpose: "Research authors and publication records",
    rationale:
      "Google 32-word limit; three site: clauses already spend 5 words.",
  },
  {
    id: "google_portfolio",
    platform: "Google (portfolio x-ray)",
    tag: "design",
    sites: ["behance.net", "dribbble.com"],
    nativeBoolean: false,
    maxTerms: 32,
    maxChars: null,
    operators: {
      or: "OR",
      and: "implicit",
      not: "-",
      site: true,
      quotes: true,
      parentheses: true,
    },
    purpose: "Design portfolios",
    rationale: "Google 32-word limit.",
  },
  {
    id: "google_web",
    platform: "Google (open web)",
    tag: "general",
    sites: [],
    nativeBoolean: false,
    maxTerms: 32,
    maxChars: null,
    operators: {
      or: "OR",
      and: "implicit",
      not: "-",
      site: true,
      quotes: true,
      parentheses: true,
    },
    purpose: "CVs, personal sites, rosters, directories",
    rationale: "Google 32-word limit.",
  },
];

export const VARIANT_EXPLANATIONS: Record<Breadth, string> = {
  narrow:
    "Tests the strictest reading: primary titles AND every must-have AND the credential group. Few results, high precision — if this returns nothing, a must-have is too tight.",
  balanced:
    "Tests title breadth: alternate titles OR'd in, only the two most important must-haves kept. The everyday working query.",
  broad:
    "Tests recall: all titles, requirements relaxed into one OR group. Expect noise; use it to discover vocabulary you are missing.",
  adjacent:
    "Tests the adjacent population: neighbouring titles plus core skills. Finds people who do the job under a different name.",
  experimental:
    "A model-suggested query the deterministic matrix cannot express. Verify the platform and operators before relying on it.",
};

export interface CompiledQuery {
  id: string;
  platformId: PlatformId;
  platform: string;
  breadth: Breadth;
  query: string;
  purpose: string;
  expectedPrecision: ComposedQuery["expectedPrecision"];
  explanation: string;
  /** 1-based part index when a query was split, and the total. */
  part?: { index: number; of: number };
  termCount: number;
  charCount: number;
  runnable: boolean;
  /** Empty when runnable. */
  violations: string[];
}

/** Count the way Google does: whitespace tokens, excluding the OR keyword. */
export function countTerms(query: string): number {
  return query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(
      (t) =>
        t && t !== "OR" && t !== "AND" && t !== "NOT" && t !== "(" && t !== ")",
    ).length;
}

function violationsFor(query: string, p: PlatformConstraints): string[] {
  const out: string[] = [];
  const terms = countTerms(query);
  if (p.maxTerms !== null && terms > p.maxTerms) {
    out.push(
      `${terms} terms exceeds the ${p.maxTerms}-term budget for ${p.platform}.`,
    );
  }
  if (p.maxChars !== null && query.length > p.maxChars) {
    out.push(
      `${query.length} characters exceeds the ${p.maxChars}-character limit for ${p.platform}.`,
    );
  }
  if (!p.operators.site && /\bsite:/.test(query)) {
    out.push(`${p.platform} does not support the site: operator.`);
  }
  if (p.operators.not === "NOT" && /(^|\s)-["(\w]/.test(query)) {
    out.push(`${p.platform} uses NOT rather than a leading minus.`);
  }
  return out;
}

/** Translate composer output into the platform's operator dialect. */
function toDialect(query: string, p: PlatformConstraints): string {
  if (p.operators.not === "NOT") {
    // "-term" / -"multi word" → NOT term
    return query.replace(/(^|\s)-("[^"]+"|\S+)/g, "$1NOT $2");
  }
  return query;
}

/**
 * When an OR group pushes a query over budget, split that group so every
 * part fits. Keeps AND terms on every part. Returns the parts, or `null`
 * when even a single-member group cannot fit (then the query is not
 * runnable and the caller says why).
 */
function splitOverBudget(
  input: StringLabInput,
  breadth: Breadth,
  p: PlatformConstraints,
  buildQuery: (i: StringLabInput) => string | undefined,
): string[] | null {
  // Which group is biggest? Titles+alternates for balanced/broad, anyOf otherwise.
  const candidates: Array<{ key: keyof StringLabInput; terms: string[] }> = [
    { key: "anyOf", terms: input.anyOf },
    { key: "alternateTitles", terms: input.alternateTitles },
    { key: "titles", terms: input.titles },
    { key: "locations", terms: input.locations },
  ];
  const groups = candidates.filter((g) => g.terms.length > 1);
  if (groups.length === 0) return null;
  groups.sort((a, b) => b.terms.length - a.terms.length);
  const target = groups[0];
  for (let chunk = target.terms.length - 1; chunk >= 1; chunk--) {
    const parts: string[] = [];
    let ok = true;
    for (let i = 0; i < target.terms.length; i += chunk) {
      const slice = target.terms.slice(i, i + chunk);
      const q = buildQuery({ ...input, [target.key]: slice });
      if (!q) {
        ok = false;
        break;
      }
      if (violationsFor(toDialect(q, p), p).length > 0) {
        ok = false;
        break;
      }
      parts.push(q);
    }
    if (ok && parts.length > 0) return parts;
  }
  void breadth;
  return null;
}

export interface CompileOptions {
  /** Which platform tags the model judged relevant; "general" always included. */
  relevantTags?: string[];
  /** Restrict to these platform ids (e.g. the one the user selected). */
  platformIds?: PlatformId[];
}

export function compileQueries(
  input: StringLabInput,
  options: CompileOptions = {},
): CompiledQuery[] {
  const tags = new Set(["general", ...(options.relevantTags ?? [])]);
  const platforms = PLATFORM_CONSTRAINTS.filter(
    (p) =>
      (options.platformIds ? options.platformIds.includes(p.id) : true) &&
      (p.tag === "general" || tags.has(p.tag)),
  );
  const out: CompiledQuery[] = [];
  const seen = new Set<string>();
  for (const p of platforms) {
    const composerTarget = {
      platform: p.platform,
      sites: p.sites,
      nativeBoolean: p.nativeBoolean,
      purpose: p.purpose,
    };
    const composed = composeQueries(input, [composerTarget]);
    for (const c of composed) {
      const buildOne = (i: StringLabInput): string | undefined =>
        composeQueries(i, [composerTarget]).find((x) => x.breadth === c.breadth)
          ?.query;
      const dialect = toDialect(c.query, p);
      const violations = violationsFor(dialect, p);
      let parts: string[] | null = null;
      if (violations.some((v) => /exceeds/.test(v))) {
        parts = splitOverBudget(input, c.breadth, p, buildOne);
      }
      const emit = (
        query: string,
        part?: CompiledQuery["part"],
        forcedViolations?: string[],
      ) => {
        const q = toDialect(query, p);
        const key = `${p.id}::${q.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        const v = forcedViolations ?? violationsFor(q, p);
        out.push({
          id: `${p.id}-${c.breadth}${part ? `-${part.index}` : ""}`,
          platformId: p.id,
          platform: p.platform,
          breadth: c.breadth,
          query: q,
          purpose: c.purpose,
          expectedPrecision: c.expectedPrecision,
          explanation: VARIANT_EXPLANATIONS[c.breadth],
          part,
          termCount: countTerms(q),
          charCount: q.length,
          runnable: v.length === 0,
          violations: v,
        });
      };
      if (parts && parts.length > 1) {
        parts.forEach((q, i) => emit(q, { index: i + 1, of: parts.length }));
      } else if (parts && parts.length === 1) {
        emit(parts[0]);
      } else if (violations.length > 0) {
        emit(c.query, undefined, [
          ...violations,
          "Could not split automatically: an AND-only requirement set already exceeds the budget. Trim must-haves or exclusions.",
        ]);
      } else {
        emit(c.query);
      }
    }
  }
  return out;
}

/** Model-suggested extra queries are checked, never trusted. */
export function checkExtraQuery(
  platformName: string,
  query: string,
): { runnable: boolean; violations: string[]; platformId?: PlatformId } {
  const p =
    PLATFORM_CONSTRAINTS.find((x) => x.platform === platformName) ??
    PLATFORM_CONSTRAINTS.find((x) =>
      platformName.toLowerCase().includes(x.id.split("_")[1] ?? "~"),
    );
  if (!p) {
    return {
      runnable: false,
      violations: [
        `"${platformName}" is not a platform this build knows the limits of; verify manually.`,
      ],
    };
  }
  const v = violationsFor(query, p);
  return { runnable: v.length === 0, violations: v, platformId: p.id };
}

export { orGroup, quoteTerm };
export type { StringLabInput };
