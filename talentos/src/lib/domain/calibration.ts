/**
 * Decision-to-query calibration (Wave B, D-030).
 *
 * Recruiter accept / dismiss / correct decisions on exact CV passages —
 * across every candidate reviewed for a search — deterministically reshape
 * the String Lab vocabulary BEFORE composition, and every affected term
 * carries a reason the String Lab renders verbatim. No model call. The
 * validated composer is untouched; this runs ahead of
 * `prepareQueries` like the rest of the normalization (D-029).
 *
 * Doctrine encoded here:
 * - A dismissal never negates. "This passage was not evidence" is not "this
 *   term is noise". Demotion only moves a term from AND to OR; removal needs
 *   accepted CONTRADICTORY evidence; exclusions come only from accepted
 *   evidence on a `disqualifier` requirement.
 * - Every candidate term and every reason passes the fair-hiring scan and a
 *   PII check; a hit is a visible `blocked` decision and the term is never
 *   added.
 * - Titles are never touched.
 */
import type { TermDecision } from "@/lib/core/payloads";
import type { RequirementIR } from "@/lib/core/ir";
import type { LinkInput } from "@/lib/documents/contracts";
import { scanTextForProtectedTraits } from "./fair-hiring";
import type { StringLabInput } from "./search-strings";

// ── Thresholds (named so the DECISIONS record and the tests agree) ─────────

/** Accepted anchors needed, across at least PROMOTE_MIN_CANDIDATES, to promote an any-of term to must-have. */
export const PROMOTE_MIN_ACCEPTED = 2;
export const PROMOTE_MIN_CANDIDATES = 2;
/** The expansion prompt's own cap on ANDed terms. */
export const MUST_HAVE_CAP = 3;
/** Dismissals (plus contradictory) needed, with zero accepted, to demote a must-have to any-of. */
export const DEMOTE_MIN_NEGATIVE = 2;
/** Accepted contradictory anchors needed, with zero accepted, to remove an any-of/credential term. */
export const REMOVE_MIN_CONTRADICTORY = 2;
/** Dismissals needed, with zero accepted, to flag a term (visible only). */
export const FLAG_MIN_DISMISSED = 2;
/** Cap on terms added from accepted quotes per generation. */
export const MAX_ADDED_TERMS = 6;
/** A quote becomes a term only when it is this short. */
export const MAX_QUOTE_TERM_WORDS = 4;
export const MIN_QUOTE_TERM_CHARS = 3;

export const CORRECTION_NOTE = /^Corrected by connection (\S+)$/;

// ── Shapes ────────────────────────────────────────────────────────────────

export interface LinkOutcome {
  linkId: string;
  candidateId: string;
  requirementId: string;
  quote: string;
  assessment: LinkInput["assessment"];
  latest: "accepted" | "dismissed" | "corrected" | "unreviewed";
}

export interface RequirementSignal {
  requirementId: string;
  label: string;
  kind?: RequirementIR["kind"];
  accepted: Record<LinkInput["assessment"], number>;
  dismissed: number;
  corrected: number;
  unreviewed: number;
  acceptedQuotes: {
    quote: string;
    candidateId: string;
    assessment: LinkInput["assessment"];
  }[];
  candidates: number;
}

export interface CalibrationSignals {
  requirements: RequirementSignal[];
  /** Links with at least one review decision, across the search. */
  reviewedLinks: number;
  /** Distinct candidates with at least one reviewed link. */
  candidates: number;
}

export const EMPTY_SIGNALS: CalibrationSignals = {
  requirements: [],
  reviewedLinks: 0,
  candidates: 0,
};

interface LinkRow {
  id: string;
  comparisonId: string;
  payload: LinkInput;
}
interface ReviewRow {
  linkId: string;
  decision: "accepted" | "dismissed";
  note: string;
  createdAt: string;
}
interface ComparisonRow {
  id: string;
  candidateId: string;
}

// ── Signal extraction ─────────────────────────────────────────────────────

/**
 * Latest decision per link. A dismissal whose note follows the correction
 * convention (`services/document-review.ts` `correctConnection`) counts as
 * `corrected`, not as a dismissal; the replacement link is its own outcome.
 */
export function summarizeOutcomes(
  links: LinkRow[],
  reviews: ReviewRow[],
  comparisons: ComparisonRow[],
): LinkOutcome[] {
  const candidateOf = new Map(comparisons.map((c) => [c.id, c.candidateId]));
  const latest = new Map<string, ReviewRow>();
  for (const review of reviews) {
    const current = latest.get(review.linkId);
    if (!current || review.createdAt > current.createdAt) {
      latest.set(review.linkId, review);
    }
  }
  return links.map((link) => {
    const review = latest.get(link.id);
    let outcome: LinkOutcome["latest"] = "unreviewed";
    if (review?.decision === "accepted") outcome = "accepted";
    else if (review?.decision === "dismissed") {
      outcome = CORRECTION_NOTE.test(review.note) ? "corrected" : "dismissed";
    }
    return {
      linkId: link.id,
      candidateId: candidateOf.get(link.comparisonId) ?? "",
      requirementId: link.payload.requirementId,
      quote: link.payload.cvAnchor.quote,
      assessment: link.payload.assessment,
      latest: outcome,
    };
  });
}

function emptyAccepted(): Record<LinkInput["assessment"], number> {
  return { relevant: 0, partial: 0, contradictory: 0, unknown: 0 };
}

/** Group outcomes per requirement, joining `kind` from the live IR. */
export function buildSignals(
  outcomes: LinkOutcome[],
  requirements: Pick<RequirementIR, "id" | "label" | "kind">[],
): CalibrationSignals {
  const byId = new Map<string, RequirementSignal>();
  const labelOf = new Map(
    requirements.filter((r) => r.id).map((r) => [r.id!, r]),
  );
  const reviewedCandidates = new Set<string>();
  let reviewedLinks = 0;
  for (const outcome of outcomes) {
    let signal = byId.get(outcome.requirementId);
    if (!signal) {
      const req = labelOf.get(outcome.requirementId);
      signal = {
        requirementId: outcome.requirementId,
        label: req?.label ?? outcome.requirementId,
        kind: req?.kind,
        accepted: emptyAccepted(),
        dismissed: 0,
        corrected: 0,
        unreviewed: 0,
        acceptedQuotes: [],
        candidates: 0,
      };
      byId.set(outcome.requirementId, signal);
    }
    if (outcome.latest !== "unreviewed") {
      reviewedLinks += 1;
      reviewedCandidates.add(outcome.candidateId);
    }
    switch (outcome.latest) {
      case "accepted":
        signal.accepted[outcome.assessment] += 1;
        signal.acceptedQuotes.push({
          quote: outcome.quote,
          candidateId: outcome.candidateId,
          assessment: outcome.assessment,
        });
        break;
      case "dismissed":
        signal.dismissed += 1;
        break;
      case "corrected":
        signal.corrected += 1;
        break;
      default:
        signal.unreviewed += 1;
    }
  }
  for (const signal of byId.values()) {
    signal.candidates = new Set(
      signal.acceptedQuotes.map((q) => q.candidateId),
    ).size;
  }
  return {
    requirements: [...byId.values()],
    reviewedLinks,
    candidates: reviewedCandidates.size,
  };
}

/**
 * Deterministic fingerprint of the decisions (per link: latest outcome and
 * assessment). Pure — no crypto dependency — so the String Lab can compare
 * the stored value with the live one on every render.
 */
export function signalsFingerprint(outcomes: LinkOutcome[]): string {
  const material = outcomes
    .filter((o) => o.latest !== "unreviewed")
    .map((o) => `${o.linkId}:${o.latest}:${o.assessment}`)
    .sort()
    .join("|");
  let hash = 5381;
  for (let i = 0; i < material.length; i += 1) {
    hash = ((hash << 5) + hash + material.charCodeAt(i)) | 0;
  }
  return `${outcomes.filter((o) => o.latest !== "unreviewed").length}-${(hash >>> 0).toString(16)}`;
}

// ── Term matching ─────────────────────────────────────────────────────────

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-bounded, case-insensitive containment. */
export function termMatches(text: string, term: string): boolean {
  const t = term.trim();
  if (!t) return false;
  return new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(t)}(?=$|[^\\p{L}\\p{N}])`,
    "iu",
  ).test(text);
}

const PII_PATTERN = /@|https?:\/\//i;
/** Seven or more digits in a term, ignoring spaces and punctuation, reads as a phone number. */
function looksLikePhone(text: string): boolean {
  return text.replace(/\D/g, "").length >= 7;
}
function looksLikeContact(text: string): boolean {
  return PII_PATTERN.test(text) || looksLikePhone(text);
}

/**
 * A short accepted quote can become a search term; a sentence cannot.
 * Trailing punctuation is stripped; anything that looks like contact data
 * or a URL is refused.
 */
export function shortQuoteTerm(quote: string): string | null {
  const cleaned = quote
    .trim()
    .replace(/[\s.,;:!?"'()[\]{}]+$/u, "")
    .replace(/^[\s"'([{]+/u, "")
    .replace(/\s+/g, " ");
  if (cleaned.length < MIN_QUOTE_TERM_CHARS) return null;
  if (cleaned.split(" ").length > MAX_QUOTE_TERM_WORDS) return null;
  if (looksLikeContact(cleaned)) return null;
  return cleaned;
}

// ── Decisions ─────────────────────────────────────────────────────────────

interface TermCounts {
  accepted: number;
  contradictory: number;
  dismissed: number;
  corrected: number;
  candidates: Set<string>;
  requirementIds: Set<string>;
  hasMustHaveRequirement: boolean;
}

function countFor(term: string, signals: CalibrationSignals): TermCounts {
  const counts: TermCounts = {
    accepted: 0,
    contradictory: 0,
    dismissed: 0,
    corrected: 0,
    candidates: new Set(),
    requirementIds: new Set(),
    hasMustHaveRequirement: false,
  };
  for (const signal of signals.requirements) {
    let touched = false;
    for (const q of signal.acceptedQuotes) {
      if (!termMatches(q.quote, term)) continue;
      touched = true;
      if (q.assessment === "contradictory") counts.contradictory += 1;
      else if (q.assessment !== "unknown") {
        counts.accepted += 1;
        counts.candidates.add(q.candidateId);
      }
    }
    if (touched) {
      counts.requirementIds.add(signal.requirementId);
      if (signal.kind === "must_have") counts.hasMustHaveRequirement = true;
    }
  }
  return counts;
}

/**
 * Dismissals and corrections are counted per term from the outcomes
 * themselves, because a dismissed link's quote is not in `acceptedQuotes`.
 */
function negativeCountsFor(
  term: string,
  outcomes: LinkOutcome[],
): { dismissed: number; corrected: number; requirementIds: Set<string> } {
  const out = { dismissed: 0, corrected: 0, requirementIds: new Set<string>() };
  for (const o of outcomes) {
    if (!termMatches(o.quote, term)) continue;
    if (o.latest === "dismissed") {
      out.dismissed += 1;
      out.requirementIds.add(o.requirementId);
    } else if (o.latest === "corrected") {
      out.corrected += 1;
      out.requirementIds.add(o.requirementId);
    }
  }
  return out;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function reasonText(
  c: {
    accepted: number;
    candidates: number;
    dismissed: number;
    contradictory: number;
    corrected: number;
  },
  labels: string[],
): string {
  const parts = [
    `${plural(c.accepted, "accepted anchor")} across ${plural(c.candidates, "candidate")}`,
    `${c.dismissed} dismissed`,
  ];
  if (c.contradictory > 0) parts.push(`${c.contradictory} contradictory`);
  if (c.corrected > 0) parts.push(`${c.corrected} corrected`);
  const req = labels.length ? ` (R: ${labels.join(", ")})` : "";
  return `${parts.join(", ")}${req}`;
}

function blockedReason(text: string): string | null {
  const hits = scanTextForProtectedTraits(text);
  if (hits.length > 0) {
    return `blocked: references ${hits.map((h) => h.trait).join(", ")}`;
  }
  if (PII_PATTERN.test(text))
    return "blocked: looks like contact data or a URL";
  return null;
}

/**
 * Apply calibration to the vocabulary. Returns the adjusted input and one
 * decision per touched term. Pure and order-stable.
 */
export function deriveTermDecisions(
  input: StringLabInput,
  signals: CalibrationSignals,
  outcomes: LinkOutcome[] = [],
): { input: StringLabInput; decisions: TermDecision[] } {
  const decisions: TermDecision[] = [];
  const labelOf = new Map(
    signals.requirements.map((r) => [r.requirementId, r.label]),
  );
  const labels = (ids: Iterable<string>) =>
    [...ids].map((id) => labelOf.get(id) ?? id);

  let mustHave = [...input.mustHave];
  let anyOf = [...input.anyOf];
  let credentials = [...input.credentials];
  const exclusions = [...input.exclusions];
  const vocabulary = [...mustHave, ...anyOf, ...credentials];
  const seen = new Set(
    [...vocabulary, ...exclusions].map((t) => t.toLowerCase()),
  );

  const decide = (
    term: string,
    action: TermDecision["action"],
    counts: TermCounts,
    negatives: ReturnType<typeof negativeCountsFor>,
    reasonOverride?: string,
  ) => {
    const requirementIds = new Set([
      ...counts.requirementIds,
      ...negatives.requirementIds,
    ]);
    decisions.push({
      term,
      action,
      reason:
        reasonOverride ??
        reasonText(
          {
            accepted: counts.accepted,
            candidates: counts.candidates.size,
            dismissed: negatives.dismissed,
            contradictory: counts.contradictory,
            corrected: negatives.corrected,
          },
          labels(requirementIds),
        ),
      requirementIds: [...requirementIds],
      accepted: counts.accepted,
      dismissed: negatives.dismissed,
      contradictory: counts.contradictory,
      corrected: negatives.corrected,
      candidates: counts.candidates.size,
      provenance: "recruiter",
    });
  };

  if (signals.reviewedLinks === 0) {
    return { input, decisions };
  }

  // 1. Existing vocabulary: promote / support / demote / remove / flag.
  const evaluate = (
    term: string,
    tier: "mustHave" | "anyOf" | "credentials",
  ) => {
    const counts = countFor(term, signals);
    const negatives = negativeCountsFor(term, outcomes);
    const A = counts.accepted;
    const C = counts.contradictory;
    const D = negatives.dismissed;
    if (A === 0 && C === 0 && D === 0 && negatives.corrected === 0) return;

    if (
      tier === "anyOf" &&
      A >= PROMOTE_MIN_ACCEPTED &&
      counts.candidates.size >= PROMOTE_MIN_CANDIDATES &&
      D + C === 0 &&
      counts.hasMustHaveRequirement &&
      mustHave.length < MUST_HAVE_CAP
    ) {
      anyOf = anyOf.filter((t) => t !== term);
      mustHave.push(term);
      decide(term, "promoted_to_must_have", counts, negatives);
      return;
    }
    if (A >= 1 && D + C === 0) {
      decide(term, "supported", counts, negatives);
      return;
    }
    if (tier === "mustHave" && A === 0 && D + C >= DEMOTE_MIN_NEGATIVE) {
      mustHave = mustHave.filter((t) => t !== term);
      anyOf.push(term);
      decide(term, "demoted_to_any_of", counts, negatives);
      return;
    }
    if (tier !== "mustHave" && A === 0 && C >= REMOVE_MIN_CONTRADICTORY) {
      if (tier === "anyOf") anyOf = anyOf.filter((t) => t !== term);
      else credentials = credentials.filter((t) => t !== term);
      decide(term, "removed", counts, negatives);
      return;
    }
    if (A === 0 && D >= FLAG_MIN_DISMISSED) {
      decide(term, "flagged", counts, negatives);
      return;
    }
    if (A >= 1) decide(term, "supported", counts, negatives);
  };
  for (const term of [...input.mustHave]) evaluate(term, "mustHave");
  for (const term of [...input.anyOf]) evaluate(term, "anyOf");
  for (const term of [...input.credentials]) evaluate(term, "credentials");

  // 2. New terms from accepted quotes.
  interface Candidate {
    term: string;
    counts: TermCounts;
    negatives: ReturnType<typeof negativeCountsFor>;
    exclusion: boolean;
  }
  const candidates = new Map<string, Candidate>();
  for (const signal of signals.requirements) {
    for (const q of signal.acceptedQuotes) {
      const term = shortQuoteTerm(q.quote);
      if (!term) continue;
      const key = term.toLowerCase();
      if (seen.has(key) || candidates.has(key)) continue;
      // A quote that already contains a vocabulary term is covered by it;
      // adding the longer phrase would only narrow the OR group.
      if (vocabulary.some((v) => termMatches(term, v))) continue;
      const isDisqualifier = signal.kind === "disqualifier";
      const eligible = isDisqualifier
        ? q.assessment === "relevant"
        : (signal.kind === "must_have" || signal.kind === "preferred") &&
          q.assessment !== "contradictory" &&
          q.assessment !== "unknown";
      if (!eligible) continue;
      const counts = countFor(term, signals);
      const negatives = negativeCountsFor(term, outcomes);
      if (counts.accepted + counts.contradictory === 0) continue;
      candidates.set(key, {
        term,
        counts,
        negatives,
        exclusion: isDisqualifier,
      });
    }
  }
  const ordered = [...candidates.values()].sort(
    (a, b) =>
      b.counts.accepted - a.counts.accepted || a.term.localeCompare(b.term),
  );
  let added = 0;
  for (const c of ordered) {
    const blocked = blockedReason(c.term);
    if (blocked) {
      decide(c.term, "blocked", c.counts, c.negatives, blocked);
      continue;
    }
    if (c.exclusion) {
      exclusions.push(c.term);
      decide(c.term, "added_exclusion", c.counts, c.negatives);
      continue;
    }
    if (c.negatives.dismissed + c.counts.contradictory > 0) continue;
    if (added >= MAX_ADDED_TERMS) break;
    anyOf.push(c.term);
    added += 1;
    decide(c.term, "added_any_of", c.counts, c.negatives);
  }

  // 3. Reasons themselves pass the scan; a hit turns the decision into a block.
  for (const d of decisions) {
    if (d.action === "blocked") continue;
    const hit = blockedReason(d.reason);
    if (hit) {
      d.action = "blocked";
      d.reason = hit;
      mustHave = mustHave.filter((t) => t !== d.term);
      anyOf = anyOf.filter((t) => t !== d.term);
      credentials = credentials.filter((t) => t !== d.term);
    }
  }

  return {
    input: { ...input, mustHave, anyOf, credentials, exclusions },
    decisions,
  };
}

/** The decisions whose term appears in this string's text. */
export function decisionsForQuery(
  query: string,
  decisions: TermDecision[],
): TermDecision[] {
  return decisions.filter(
    (d) => d.action === "blocked" || termMatches(query, d.term),
  );
}
