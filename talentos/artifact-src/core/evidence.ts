/**
 * Candidate evidence dossiers (spec §12).
 *
 * The load-bearing idea: a model claim about a person is only evidence if
 * it QUOTES something the recruiter actually supplied. Every evidence item
 * names a source and a verbatim quote, and `verifyEvidence` checks that
 * quote against the source text deterministically. A quote that is not in
 * any attached source is not "probably fine" — it is downgraded to an
 * unsupported model inference and labelled, because a fabricated quote
 * about a real person is the worst thing this product could produce.
 *
 * Sources are only ever what a human put there: text they pasted, or a URL
 * they added. Nothing is fetched, crawled or scraped — a URL is a link out
 * and its content is unknown to this page unless the recruiter pasted it.
 */
import { z } from "zod";
import type { StoredCandidate } from "./store";

export const candidateSourceSchema = z.object({
  id: z.string(),
  kind: z.enum(["pasted_text", "link", "recruiter_note"]),
  label: z.string(),
  /** Present for links. Rendered with rel="noopener"; never fetched. */
  url: z.string().optional(),
  /** The actual text, when a human supplied text. */
  text: z.string().default(""),
  addedAt: z.string(),
});
export type CandidateSource = z.infer<typeof candidateSourceSchema>;

export const EVIDENCE_STATUSES = [
  "strong",
  "partial",
  "missing",
  "contradictory",
  "unknown",
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const STATUS_LABELS: Record<EvidenceStatus, string> = {
  strong: "Strong",
  partial: "Partial",
  missing: "Missing",
  contradictory: "Contradictory",
  unknown: "Unknown",
};

/** What happened when the quote was checked against the named source. */
export type QuoteCheck =
  | "verified_in_source"
  | "not_found_in_source"
  | "no_source_named"
  | "no_quote_given"
  | "source_is_a_link";

export const QUOTE_LABELS: Record<QuoteCheck, string> = {
  verified_in_source: "Quote found in source",
  not_found_in_source: "Quote NOT in any source",
  no_source_named: "No source named",
  no_quote_given: "No quote given",
  source_is_a_link: "Source is a link — content not held here",
};

export interface DossierItem {
  criterion: string;
  status: EvidenceStatus;
  /** What the model said the evidence is. */
  evidenceText: string;
  /** The verbatim span it claims to be quoting. */
  quote: string;
  sourceId: string;
  sourceLabel: string;
  check: QuoteCheck;
  /** True only when a quote was verified against supplied text. */
  supported: boolean;
  /** Why this item reads the way it does. Always populated. */
  note: string;
}

/** Whitespace- and case-insensitive containment, so wrapping never matters. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteAppearsIn(quote: string, text: string): boolean {
  const q = normalize(quote);
  if (q.length < 8) return false; // too short to attribute either way
  return normalize(text).includes(q);
}

export interface RawEvidenceItem {
  criterion?: unknown;
  status?: unknown;
  evidenceText?: unknown;
  quote?: unknown;
  sourceId?: unknown;
}

/**
 * Check every claimed quote against the sources actually attached. Nothing
 * here trusts the model's own `status`: an item whose quote is not in a
 * supplied source cannot be "strong", whatever it says.
 */
export function verifyEvidence(
  items: RawEvidenceItem[],
  sources: CandidateSource[],
): { items: DossierItem[]; downgraded: number; unsupported: number } {
  const byId = new Map(sources.map((s) => [s.id, s]));
  let downgraded = 0;
  let unsupported = 0;

  const out = items.map((raw): DossierItem => {
    const criterion =
      typeof raw.criterion === "string" ? raw.criterion : "(unnamed criterion)";
    const claimed = EVIDENCE_STATUSES.includes(raw.status as EvidenceStatus)
      ? (raw.status as EvidenceStatus)
      : "unknown";
    const evidenceText =
      typeof raw.evidenceText === "string" ? raw.evidenceText : "";
    const quote = typeof raw.quote === "string" ? raw.quote.trim() : "";
    const sourceId = typeof raw.sourceId === "string" ? raw.sourceId : "";
    const source = byId.get(sourceId);

    let check: QuoteCheck;
    if (!quote) check = "no_quote_given";
    else if (!source) check = "no_source_named";
    else if (!source.text.trim()) check = "source_is_a_link";
    else
      check = quoteAppearsIn(quote, source.text)
        ? "verified_in_source"
        : "not_found_in_source";

    const supported = check === "verified_in_source";
    let status = claimed;
    let note: string;

    if (supported) {
      note = `Quoted from ${source?.label ?? "the attached source"} and found there verbatim.`;
    } else if (check === "not_found_in_source") {
      status = "unknown";
      downgraded += 1;
      unsupported += 1;
      note = `The quote is not in ${source?.label ?? "the named source"}. Treated as unsupported — do not use it, and re-read the source before relying on this criterion.`;
    } else if (check === "source_is_a_link") {
      if (status === "strong" || status === "contradictory") {
        status = "partial";
        downgraded += 1;
      }
      unsupported += 1;
      note = `${source?.label ?? "The source"} is a link. This page never fetches a page, so its contents are not held here — open it and check the claim yourself.`;
    } else if (check === "no_source_named") {
      if (status !== "missing" && status !== "unknown") {
        status = "unknown";
        downgraded += 1;
      }
      unsupported += 1;
      note =
        "No source named, so this is a model inference about a real person. It is not evidence.";
    } else {
      if (status === "strong" || status === "contradictory") {
        status = "partial";
        downgraded += 1;
      }
      unsupported += 1;
      note =
        "No quote given, so nothing can be checked. Ask for the specific line before treating this as evidence.";
    }

    return {
      criterion,
      status,
      evidenceText,
      quote,
      sourceId,
      sourceLabel: source?.label ?? "",
      check,
      supported,
      note,
    };
  });

  return { items: out, downgraded, unsupported };
}

export interface Dossier {
  candidateId: string;
  name: string;
  sources: CandidateSource[];
  items: DossierItem[];
  /** Criteria from the success profile with no evidence item at all. */
  uncovered: string[];
  supportedCount: number;
  downgraded: number;
  /** Questions a human should put to the candidate or the hiring manager. */
  questions: string[];
  /** One line a recruiter can read before opening anything. */
  summary: string;
}

/** The sources a candidate record already holds, as first-class objects. */
export function sourcesFor(cand: StoredCandidate): CandidateSource[] {
  const out: CandidateSource[] = [];
  if (cand.pastedText && cand.pastedText.trim()) {
    out.push({
      id: `${cand.id}:pasted`,
      kind: "pasted_text",
      label: "Profile text you pasted",
      text: cand.pastedText,
      addedAt: cand.createdAt,
    });
  }
  for (const [i, url] of (cand.profileUrls ?? []).entries()) {
    out.push({
      id: `${cand.id}:link:${i}`,
      kind: "link",
      label: url,
      url,
      text: "",
      addedAt: cand.createdAt,
    });
  }
  if (cand.notes && cand.notes.trim()) {
    out.push({
      id: `${cand.id}:notes`,
      kind: "recruiter_note",
      label: "Your notes",
      text: cand.notes,
      addedAt: cand.createdAt,
    });
  }
  return out;
}

export function buildDossier(input: {
  candidate: StoredCandidate;
  rawItems: RawEvidenceItem[];
  criteria: string[];
  questions?: string[];
}): Dossier {
  const sources = sourcesFor(input.candidate);
  const { items, downgraded } = verifyEvidence(input.rawItems, sources);
  const named = new Set(items.map((i) => normalize(i.criterion)));
  const uncovered = input.criteria.filter((c) => !named.has(normalize(c)));
  const supportedCount = items.filter((i) => i.supported).length;
  const summary =
    items.length === 0
      ? "No evidence assessed yet."
      : `${supportedCount} of ${items.length} criteria have a quote found in a source you supplied${downgraded ? `; ${downgraded} claim${downgraded === 1 ? " was" : "s were"} downgraded because the quote could not be found` : ""}${uncovered.length ? `; ${uncovered.length} criterion${uncovered.length === 1 ? "" : "s"} not assessed at all` : ""}.`;
  return {
    candidateId: input.candidate.id,
    name: input.candidate.name,
    sources,
    items,
    uncovered,
    supportedCount,
    downgraded,
    questions: input.questions ?? [],
    summary,
  };
}

/**
 * Criteria a dossier is assessed against: the success profile's must-haves
 * and evidence signals, in the profile's own words.
 */
export function criteriaFromProfile(profile: unknown): string[] {
  const p = (profile ?? {}) as Record<string, unknown>;
  const pull = (key: string): string[] => {
    const list = p[key];
    if (!Array.isArray(list)) return [];
    return list
      .map((x) =>
        typeof x === "string"
          ? x
          : typeof (x as { text?: unknown })?.text === "string"
            ? (x as { text: string }).text
            : "",
      )
      .filter((s): s is string => Boolean(s));
  };
  return [...pull("mustHave"), ...pull("evidenceSignals")];
}
