/**
 * Deterministic boolean / x-ray search-string composer.
 *
 * Term quoting and OR-group semantics are ported from the validated
 * Talent X-Ray reference console (reference/talent-xray.html — buildQuery),
 * extended here with multi-platform targets and breadth variants.
 * The composed query is always shown to, and editable by, the user.
 */
import type { Breadth } from "@/lib/core/enums";

export interface StringLabInput {
  /** Primary titles for the role. */
  titles: string[];
  /** Alternate titles — added in balanced/broad variants. */
  alternateTitles: string[];
  /** Adjacent-population titles — used by the adjacent variant. */
  adjacentTitles: string[];
  /** Every term is required (AND). */
  mustHave: string[];
  /** At least one should match (OR group). */
  anyOf: string[];
  /** Credentials / certifications (OR group). */
  credentials: string[];
  locations: string[];
  companies: string[];
  /** Excluded terms (negated). */
  exclusions: string[];
}

export interface ComposedQuery {
  platform: string;
  query: string;
  purpose: string;
  breadth: Breadth;
  expectedPrecision: "high" | "medium" | "low";
  targetPhenotype?: string;
}

/** Quote multiword terms; leave operators/prefixed terms alone. */
export function quoteTerm(term: string): string {
  const t = String(term).trim();
  if (!t) return "";
  if (/^[-"(]/.test(t) || /^\w+:/.test(t)) return t;
  return /\s/.test(t) ? `"${t.replace(/"/g, "")}"` : t;
}

/** OR-join a list into a parenthesised group. */
export function orGroup(terms: string[]): string {
  const cleaned = terms.filter(Boolean).map(quoteTerm).filter(Boolean);
  if (cleaned.length === 0) return "";
  return cleaned.length === 1 ? cleaned[0] : `(${cleaned.join(" OR ")})`;
}

function joinParts(parts: string[]): string {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

function siteGroup(sites: string[]): string {
  if (sites.length === 0) return "";
  const clauses = sites.map((s) => `site:${s}`);
  return clauses.length === 1 ? clauses[0] : `(${clauses.join(" OR ")})`;
}

interface PlatformTarget {
  platform: string;
  sites: string[];
  /** Plain boolean without site: operators (e.g. LinkedIn's own search box). */
  nativeBoolean?: boolean;
  purpose: string;
}

export const PLATFORM_TARGETS: PlatformTarget[] = [
  {
    platform: "Google (LinkedIn x-ray)",
    sites: ["linkedin.com/in", "linkedin.com/pub"],
    purpose: "Public LinkedIn profiles via Google",
  },
  {
    platform: "LinkedIn (native boolean)",
    sites: [],
    nativeBoolean: true,
    purpose: "Paste into LinkedIn people search",
  },
  {
    platform: "Google (GitHub x-ray)",
    sites: ["github.com"],
    purpose: "Engineer profiles, READMEs, org membership",
  },
  {
    platform: "Google (Scholar/arXiv x-ray)",
    sites: ["scholar.google.com", "arxiv.org", "openreview.net"],
    purpose: "Research authors and publication records",
  },
  {
    platform: "Google (portfolio x-ray)",
    sites: ["behance.net", "dribbble.com"],
    purpose: "Design portfolios",
  },
  {
    platform: "Google (open web)",
    sites: [],
    purpose: "CVs, personal sites, rosters, directories",
  },
];

interface VariantSpec {
  breadth: Breadth;
  expectedPrecision: "high" | "medium" | "low";
  description: string;
}

export const VARIANT_SPECS: VariantSpec[] = [
  {
    breadth: "narrow",
    expectedPrecision: "high",
    description: "Primary titles + all requirements",
  },
  {
    breadth: "balanced",
    expectedPrecision: "medium",
    description: "Titles incl. alternates + core requirements",
  },
  {
    breadth: "broad",
    expectedPrecision: "low",
    description: "All titles, requirements relaxed to an OR group",
  },
  {
    breadth: "adjacent",
    expectedPrecision: "low",
    description: "Adjacent-population titles + core skills",
  },
];

function variantParts(input: StringLabInput, breadth: Breadth): string[] {
  const parts: string[] = [];
  const allTitles = [...input.titles, ...input.alternateTitles];

  switch (breadth) {
    case "narrow":
      parts.push(orGroup(input.titles));
      input.mustHave.forEach((m) => parts.push(quoteTerm(m)));
      parts.push(orGroup(input.anyOf));
      parts.push(orGroup(input.credentials));
      break;
    case "balanced":
      parts.push(orGroup(allTitles));
      input.mustHave.slice(0, 2).forEach((m) => parts.push(quoteTerm(m)));
      parts.push(orGroup(input.anyOf));
      break;
    case "broad":
      parts.push(orGroup(allTitles));
      parts.push(orGroup([...input.mustHave, ...input.anyOf]));
      break;
    case "adjacent":
      parts.push(
        orGroup(
          input.adjacentTitles.length > 0
            ? input.adjacentTitles
            : input.alternateTitles,
        ),
      );
      parts.push(orGroup([...input.mustHave, ...input.anyOf].slice(0, 6)));
      break;
    default:
      break;
  }

  parts.push(orGroup(input.locations));
  if (breadth === "narrow" && input.companies.length > 0) {
    parts.push(orGroup(input.companies));
  }
  input.exclusions.forEach((e) => parts.push(`-${quoteTerm(e)}`));
  return parts;
}

/**
 * Compose the full variant matrix: every platform × narrow/balanced/broad/
 * adjacent. Platforms with empty title/term input produce no rows.
 */
export function composeQueries(
  input: StringLabInput,
  platforms: PlatformTarget[] = PLATFORM_TARGETS,
): ComposedQuery[] {
  const results: ComposedQuery[] = [];
  for (const target of platforms) {
    for (const spec of VARIANT_SPECS) {
      if (spec.breadth === "adjacent" && input.adjacentTitles.length === 0) {
        continue;
      }
      const parts = variantParts(input, spec.breadth);
      const site = target.nativeBoolean ? "" : siteGroup(target.sites);
      const query = joinParts([...parts, site]);
      if (!query) continue;
      results.push({
        platform: target.platform,
        query,
        purpose: `${target.purpose} — ${spec.description}`,
        breadth: spec.breadth,
        expectedPrecision: spec.expectedPrecision,
        targetPhenotype:
          spec.breadth === "adjacent"
            ? "Adjacent population"
            : "Primary target profile",
      });
    }
  }
  return results;
}
