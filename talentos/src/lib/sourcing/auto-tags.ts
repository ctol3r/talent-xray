/**
 * Tags read off the evidence, with no model and no key.
 *
 * A tag in this product is not a record — the word written in the text IS the
 * tag. So auto-tagging cannot mean writing rows into a table; it means reading
 * a person's evidence and proposing words, each one carrying the sentence and
 * the source that produced it, for a recruiter to accept or ignore.
 *
 * Deterministic on purpose, and that is the point rather than a limitation:
 *
 *  - It runs on every person the moment their evidence lands, with no key, no
 *    queue and no cost, which is the difference between a feature that is on
 *    and a feature that is available.
 *  - Every tag can say why it is there, in the page's own words. A model's tag
 *    can only be trusted; this one can be checked, and challenged.
 *  - The 408-capability ontology and the 390-place gazetteer already encode
 *    what the tags should be, so the reading is consistent between two people,
 *    two surfaces and two months apart.
 *
 * What it cannot do is name something the ontology has never heard of — a
 * company's own vocabulary, a niche method, a named internal system. That is
 * the gap a model fills, and `suggestCandidateTags` is where it fills it.
 */
import { tagIsAllowed, tagSlug } from "@/lib/core/tags";
import {
  conceptLabel,
  matchCapabilities,
  matchLocations,
} from "@/lib/sourcing/ontology";
import { normalizeOrganization, urlDomain } from "@/lib/sourcing/normalize";
import type { Claim, SourcedPerson } from "@/lib/sourcing/evidence";

export type SuggestedTagKind =
  "capability" | "place" | "organisation" | "evidence";

export interface TagEvidence {
  /** Where it was read: the source's own words for the page it came from. */
  surface: string;
  /** The phrase that produced the tag, in the page's words. */
  quote: string;
  sourceUrl: string;
  domain: string;
}

export interface SuggestedTag {
  slug: string;
  /** How the word should be written when it is accepted. */
  display: string;
  kind: SuggestedTagKind;
  /** 0..1: how much independent evidence agrees. */
  confidence: number;
  /** Never empty. A tag that cannot say where it came from is not offered. */
  evidence: TagEvidence[];
}

/** Everything a claim contributes to the reading, as one string. */
function claimText(claim: Claim): string {
  return [claim.claim, claim.quote, claim.title, claim.organization]
    .filter(Boolean)
    .join(" · ");
}

function evidenceOf(claim: Claim, quote: string): TagEvidence {
  return {
    surface: claim.sourceTitle || claim.kind,
    quote: quote.slice(0, 240),
    sourceUrl: claim.sourceUrl,
    domain: urlDomain(claim.sourceUrl),
  };
}

/**
 * Shape-of-evidence tags: what a person has published, not what they know.
 *
 * Worth a tag of its own because it is the filter a sourcer actually reaches
 * for — "who here has a patent" is a different question from "who here does
 * materials science", and the ontology cannot answer the first one.
 */
const ARTIFACT_TAGS: Record<string, string> = {
  publication: "published",
  patent: "patent-holder",
  repository: "open-source",
  talk: "speaker",
  cv: "public-cv",
  resume: "public-cv",
  portfolio: "portfolio",
  dataset: "in-a-public-dataset",
  government_record: "in-a-public-register",
  directory_record: "in-a-public-directory",
  conference_profile: "speaker",
};

interface Accumulated {
  display: string;
  kind: SuggestedTagKind;
  evidence: TagEvidence[];
  /** The best single claim confidence seen for this tag. */
  strength: number;
}

export interface AutoTagOptions {
  /** Slugs the person already carries, so nothing is offered twice. */
  already?: Iterable<string>;
  /** Drop anything below this. Defaults to offering everything with a source. */
  minConfidence?: number;
  limit?: number;
}

/**
 * Read a person's evidence and propose tags.
 *
 * Works on whatever evidence exists — a structured API row, a document the
 * recruiter pasted, an imported record, a saved address — so every surface
 * feeds the same reading rather than each one needing its own tagger.
 */
export function suggestTagsFromEvidence(
  person: SourcedPerson,
  options: AutoTagOptions = {},
): SuggestedTag[] {
  const already = new Set(options.already ?? []);
  const found = new Map<string, Accumulated>();

  const add = (
    display: string,
    kind: SuggestedTagKind,
    claim: Claim,
    quote: string,
  ) => {
    const slug = tagSlug(display);
    // The fair-hiring gate runs on the slug, before anything is offered — an
    // auto-tagger that reads pages is exactly where a protected characteristic
    // would otherwise walk in unnoticed.
    if (!slug || !tagIsAllowed(slug) || already.has(slug)) return;
    const entry = found.get(slug) ?? {
      display,
      kind,
      evidence: [],
      strength: 0,
    };
    const next = evidenceOf(claim, quote);
    if (
      !entry.evidence.some(
        (e) => e.sourceUrl === next.sourceUrl && e.quote === next.quote,
      )
    ) {
      entry.evidence.push(next);
    }
    entry.strength = Math.max(entry.strength, claim.confidence ?? 0.5);
    found.set(slug, entry);
  };

  for (const claim of person.claims) {
    const text = claimText(claim);
    if (!text.trim()) continue;

    for (const [key, surfaces] of Object.entries(matchCapabilities(text))) {
      // A capability the source only mentions in passing — "hiring for
      // robotics" — is support, not a tag. Tagging it would put the word on
      // the person as though they did the work.
      if (claim.derived === true) continue;
      add(conceptLabel(key), "capability", claim, surfaces[0]);
    }

    for (const place of matchLocations(text)) {
      add(place.label, "place", claim, place.label);
    }

    if (claim.kind === "employment" && claim.organization) {
      const normalized = normalizeOrganization(claim.organization);
      if (normalized.length > 2) {
        add(claim.organization, "organisation", claim, claim.claim);
      }
    }

    if (claim.kind === "artifact" && claim.artifactType) {
      const word = ARTIFACT_TAGS[claim.artifactType];
      if (word) add(word, "evidence", claim, claim.claim);
    }
  }

  const out: SuggestedTag[] = [];
  for (const [slug, entry] of found) {
    const domains = new Set(
      entry.evidence.map((e) => e.domain).filter(Boolean),
    );
    // Two independent sources saying the same thing is the signal. One strong
    // source still counts; one weak one is offered quietly.
    const corroboration = Math.min(1, domains.size / 2);
    const confidence =
      Math.round((0.6 * entry.strength + 0.4 * corroboration) * 100) / 100;
    if (
      options.minConfidence !== undefined &&
      confidence < options.minConfidence
    ) {
      continue;
    }
    out.push({
      slug,
      display: entry.display,
      kind: entry.kind,
      confidence,
      evidence: entry.evidence.slice(0, 4),
    });
  }

  out.sort(
    (a, b) =>
      b.confidence - a.confidence ||
      b.evidence.length - a.evidence.length ||
      a.display.localeCompare(b.display),
  );
  return options.limit ? out.slice(0, options.limit) : out;
}

/** The words to write, so accepting a suggestion is one edit to the notes. */
export function tagsAsText(tags: SuggestedTag[]): string {
  return tags
    .map((tag) =>
      tag.display.includes(" ") ? `[[${tag.display}]]` : `#${tag.display}`,
    )
    .join(" ");
}
