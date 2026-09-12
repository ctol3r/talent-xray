/**
 * What to ask the open index, derived from what this search already knows.
 *
 * The model work happened upstream: the job description became a hiring
 * need, the need became a success profile, the profile became a talent
 * population, and the population became a search plan with per-segment
 * titles, terms, credentials and places. All of that is canonical IR. This
 * reads it and turns it into a source-neutral spec.
 *
 * That is deliberately not a second planner. A separate model pass here
 * would produce a second opinion about the same search and the two would
 * drift; the plan the recruiter already reviewed is the one that runs. The
 * spec is then shown and is editable before anything is called, because a
 * search the user cannot see is not a search they authorised.
 */
import type { CanonicalIntelligence } from "@/lib/core/ir";
import type { OpenIndexSpec } from "@/lib/research/open-index/types";

/**
 * Surfaces that appear in `whereTheyAre` but name a website rather than an
 * employer. Passing one to an institution filter finds nobody.
 */
const NOT_AN_ORGANISATION =
  /\b(linkedin|github|twitter|x\.com|facebook|instagram|profile|profiles|job board|boards|community|communities|forum|newsletter|conference|conferences|meetup|events?|alumni|networks?|search engines?|directories|databases?)\b/i;

/** Strip the operators a boolean string carries; the APIs take plain words. */
export function plainTerm(raw: string): string {
  return raw
    .replace(/[()"]/gu, " ")
    .replace(/\b(AND|OR|NOT)\b/gu, " ")
    .replace(/\B[-+~]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function unique(values: (string | null | undefined)[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const clean = plainTerm(value ?? "");
    if (clean.length < 2 || clean.length > 60) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= max) break;
  }
  return out;
}

export interface SpecInputs {
  project: {
    roleTitle: string;
    industry?: string | null;
    geography?: string | null;
  };
  intelligence?: CanonicalIntelligence | null;
  /** Which segment's plan to use. Defaults to the first. */
  segmentLabel?: string;
  limit?: number;
}

/**
 * Derive the spec. Everything it puts in is traceable to a record the
 * recruiter has already seen, which is what lets the panel show, beside each
 * field, where the words came from.
 */
export function deriveOpenIndexSpec(inputs: SpecInputs): OpenIndexSpec {
  const plans = inputs.intelligence?.searchPlan?.queryPlans ?? [];
  const plan =
    plans.find(
      (entry: { segmentLabel: string }) =>
        entry.segmentLabel === inputs.segmentLabel,
    ) ?? plans[0];
  const segments = inputs.intelligence?.population?.segments ?? [];
  const segment =
    segments.find(
      (entry) => entry.label === (plan?.segmentLabel ?? inputs.segmentLabel),
    ) ?? segments[0];

  const terms = unique(
    [
      ...(plan?.titles ?? []),
      ...(plan?.mustHaveTerms ?? []),
      ...(plan?.anyOfTerms ?? []),
      plan ? null : inputs.project.roleTitle,
      plan ? null : inputs.project.industry,
    ],
    8,
  );

  const organisations = unique(
    (segment?.whereTheyAre ?? []).filter(
      (where: string) => !NOT_AN_ORGANISATION.test(where),
    ),
    3,
  );

  const geography = unique(
    [
      ...(plan?.locations ?? []),
      ...(inputs.project.geography ?? "").split(/[,/•|]/u),
    ],
    3,
  );

  return {
    terms,
    organisations,
    geography,
    technologies: [],
    limit: inputs.limit ?? 10,
  };
}

/** Where each part of the spec came from, for the panel to render. */
export function specProvenance(inputs: SpecInputs): Record<string, string> {
  const hasPlan =
    (inputs.intelligence?.searchPlan?.queryPlans?.length ?? 0) > 0;
  const hasSegments =
    (inputs.intelligence?.population?.segments?.length ?? 0) > 0;
  return {
    terms: hasPlan
      ? "the search plan's titles and terms for this segment"
      : "the role title and industry — no search plan exists yet",
    organisations: hasSegments
      ? "where this segment is, from the talent population, with website names removed"
      : "nothing on file; add one by hand",
    geography: hasPlan
      ? "the search plan's locations, then the search's own geography"
      : "the search's geography",
    technologies: "typed by you; nothing in the search implies a language",
  };
}
