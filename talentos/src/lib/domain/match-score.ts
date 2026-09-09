/**
 * A match percentage, and the scorecard it is a summary of.
 *
 * A single number about a person is the most dangerous thing this product
 * can produce, so it is built to be argued with rather than trusted.
 *
 * **Two numbers, never one.** `match` is how the evidence went on the
 * criteria that could be assessed. `coverage` is how much of the profile
 * could be assessed at all. Reporting only the first is how a score lies:
 * a candidate with three strong criteria and thirteen unexamined ones scores
 * 100%, and the number would be true and useless. Absence of evidence is not
 * evidence of absence, so `unknown` and `missing` are never counted as
 * failures — they are removed from the denominator and reported separately.
 *
 * **Nothing here decides anything.** The score orders review, never people:
 * no threshold rejects, no ranking is persisted, and the scorecard is always
 * rendered beside the number so the parts are visible. A recruiter who
 * disagrees with a criterion's status changes the status, not the score.
 *
 * **A disqualifier inverts.** Contradicting one is a point in the person's
 * favour, because the criterion says what would rule them out.
 */
import type { EvidenceItem } from "@/lib/core/payloads";

export type RequirementKind =
  "must_have" | "preferred" | "trainable" | "disqualifier";

/**
 * How much each kind counts. A must-have is worth three preferred ones;
 * trainable counts least because the definition of trainable is that its
 * absence is recoverable.
 */
const WEIGHTS: Record<RequirementKind, number> = {
  must_have: 3,
  preferred: 1.5,
  trainable: 0.75,
  disqualifier: 3,
};

/** How much credit each status earns, before weighting. */
const CREDIT: Record<string, number | null> = {
  strong: 1,
  partial: 0.5,
  contradictory: 0,
  // Not scored at all: these say the profile has not been examined, which is
  // a fact about the search, not about the person.
  missing: null,
  unknown: null,
};

export interface ScoredCriterion {
  criterion: string;
  kind: RequirementKind;
  status: string;
  evidenceText: string;
  sourceUrl?: string;
  weight: number;
  /** 0–1, or null when the criterion could not be assessed. */
  credit: number | null;
  /** True when contradicting this criterion is good news. */
  inverted: boolean;
}

export interface MatchScore {
  /** Percentage across the criteria that could be assessed. Null when none could. */
  match: number | null;
  /** Percentage of weighted criteria that were assessable at all. */
  coverage: number;
  assessed: number;
  total: number;
  /** Criteria that could not be assessed, by name, so the gap is nameable. */
  notAssessed: string[];
  /** A disqualifier the evidence supports. Never automatic, always surfaced. */
  disqualifiersMet: string[];
  rows: ScoredCriterion[];
  /** One sentence, honest when the number should not be leaned on. */
  caveat: string;
}

export function scoreMatch(
  items: EvidenceItem[],
  kindOf: (criterion: string, id?: string) => RequirementKind,
): MatchScore {
  const rows: ScoredCriterion[] = items.map((item) => {
    const kind = kindOf(item.criterion, item.id);
    const inverted = kind === "disqualifier";
    const base = CREDIT[item.status] ?? null;
    // For a disqualifier the scale runs the other way: contradicting it is
    // the good outcome, and supporting it is the bad one.
    const credit = base === null ? null : inverted ? 1 - base : base;
    return {
      criterion: item.criterion,
      kind,
      status: item.status,
      evidenceText: item.evidenceText,
      ...(item.sourceUrl ? { sourceUrl: item.sourceUrl } : {}),
      weight: WEIGHTS[kind],
      credit,
      inverted,
    };
  });

  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  const scored = rows.filter((row) => row.credit !== null);
  const scoredWeight = scored.reduce((sum, row) => sum + row.weight, 0);
  const earned = scored.reduce(
    (sum, row) => sum + row.weight * (row.credit ?? 0),
    0,
  );

  const match =
    scoredWeight === 0 ? null : Math.round((earned / scoredWeight) * 100);
  const coverage =
    totalWeight === 0 ? 0 : Math.round((scoredWeight / totalWeight) * 100);

  const notAssessed = rows
    .filter((row) => row.credit === null)
    .map((row) => row.criterion);
  const disqualifiersMet = rows
    .filter((row) => row.inverted && row.status === "strong")
    .map((row) => row.criterion);

  return {
    match,
    coverage,
    assessed: scored.length,
    total: rows.length,
    notAssessed,
    disqualifiersMet,
    rows,
    caveat: caveatFor(match, coverage, notAssessed.length, disqualifiersMet),
  };
}

/**
 * The sentence beside the number. It exists because a percentage with no
 * qualification is read as a verdict, and this one is not.
 */
export function caveatFor(
  match: number | null,
  coverage: number,
  notAssessed: number,
  disqualifiersMet: string[],
): string {
  if (disqualifiersMet.length > 0) {
    return `The evidence supports a disqualifier (${disqualifiersMet.join(", ")}). Read that criterion before anything else here.`;
  }
  if (match === null) {
    return "Nothing could be assessed yet, so there is no number to give. Run the evidence alignment, or add material to assess.";
  }
  if (coverage < 50) {
    return `Only ${coverage}% of what this job asks for could be assessed, so this is a number about a fraction of the profile. ${notAssessed} criteria have no evidence either way.`;
  }
  if (notAssessed > 0) {
    return `Across the ${coverage}% that could be assessed. ${notAssessed} criteria have no evidence either way and are not counted against them.`;
  }
  return "Across every criterion, all of which had evidence one way or the other.";
}

/** Band for colour only. Never a decision, and never persisted. */
export function matchBand(
  match: number | null,
): "none" | "low" | "mid" | "high" {
  if (match === null) return "none";
  if (match >= 70) return "high";
  if (match >= 40) return "mid";
  return "low";
}
