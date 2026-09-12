/**
 * Turning a public-API row into somebody the ranker can score.
 *
 * The open index returns a name and a line the source itself wrote — an
 * author's institutions, a registry's one-line description. That line is the
 * source's assertion, not a page anybody read, so the claims built from it are
 * real evidence carrying the source's own URL.
 *
 * Two honesties are load-bearing here:
 *
 *  - a row whose title is not a person's name becomes nothing at all, rather
 *    than a candidate nobody can contact;
 *  - a capability named after a qualifying verb ("hiring for perception",
 *    "supports the battery team") is marked derived, so it counts as support
 *    and never as evidence of doing the work.
 */
import type { DiscoveryResult } from "@/lib/research/discovery-provider";
import type { Claim, SourcedPerson } from "@/lib/sourcing/evidence";
import { looksLikePersonName } from "@/lib/sourcing/person-name";
import {
  normalizeLocation,
  normalizeOrganization,
  normalizeText,
  urlDomain,
} from "@/lib/sourcing/normalize";
import {
  conceptLabel,
  matchCapabilities,
  matchLocations,
} from "@/lib/sourcing/ontology";
import { QUALIFYING_VERBS } from "@/lib/sourcing/query-language";

/** Institutions and the like, as the sources separate them. */
function segments(snippet: string): string[] {
  return snippet
    .split(/\s·\s|\s\|\s|\s—\s/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * True when a capability was named as something the person works ON rather than
 * something they do — "hiring for perception" is not perception experience.
 */
function isQualified(text: string, surface: string): boolean {
  const norm = ` ${normalizeText(text)} `;
  const at = norm.indexOf(` ${normalizeText(surface)} `);
  if (at < 0) return false;
  const before = norm.slice(Math.max(0, at - 40), at);
  return QUALIFYING_VERBS.some((verb) =>
    before.includes(` ${normalizeText(verb)} `),
  );
}

/** One public-API row as a person, or null when it does not name one. */
export function personFromDiscovery(
  result: DiscoveryResult,
): SourcedPerson | null {
  const name = (result.title ?? "").trim();
  if (!looksLikePersonName(name)) return null;

  const snippet = (result.snippet ?? "").trim();
  const source = result.engine ?? result.provider;
  const id = `${source}:${result.url}`;
  const claims: Claim[] = [];
  let n = 0;
  const next = () => `${id}#${(n += 1)}`;

  // The address itself: what makes the row corroborable and openable.
  claims.push({
    id: next(),
    kind: "identity",
    claim: name,
    normalized: result.url.toLowerCase(),
    sourceUrl: result.url,
    sourceTitle: source,
    quote: snippet || null,
    date: result.retrievedAt.slice(0, 10),
    confidence: 0.6,
  });

  const parts = segments(snippet);
  let organization: string | null = null;
  for (const part of parts) {
    // A segment naming an institution is the source's own employment field.
    if (
      /\b(university|institute|college|school|hospital|laborator|centre|center|ltd|inc|gmbh|corporation|company|agency|trust)\b/i.test(
        part,
      )
    ) {
      organization ??= part;
      claims.push({
        id: next(),
        kind: "employment",
        claim: part,
        normalized: normalizeOrganization(part),
        sourceUrl: result.url,
        sourceTitle: source,
        confidence: 0.7,
        organization: part,
        title: null,
      });
    }
  }

  const haystack = `${name} ${snippet}`;
  for (const [key, surfaces] of Object.entries(matchCapabilities(snippet))) {
    claims.push({
      id: next(),
      kind: "capability",
      claim: conceptLabel(key),
      normalized: key,
      sourceUrl: result.url,
      sourceTitle: source,
      quote: snippet || null,
      // A one-line description is a real assertion, and a thin one. It is not a
      // CV, so it earns less than a CV — through confidence, not by pretending
      // the source never said it.
      confidence: 0.6,
      derived: isQualified(snippet, surfaces[0]),
    });
  }

  let location: string | null = null;
  for (const place of matchLocations(haystack)) {
    location ??= place.label;
    claims.push({
      id: next(),
      kind: "location",
      claim: place.label,
      normalized: normalizeLocation(place.label),
      sourceUrl: result.url,
      sourceTitle: source,
      confidence: 0.55,
    });
  }

  return {
    id,
    name,
    title: null,
    organization,
    location,
    summary: snippet || null,
    claims,
  };
}

export interface OpenIndexPeople {
  people: SourcedPerson[];
  /** Rows that did not name a person, and were therefore not invented into one. */
  discarded: { url: string; title: string; domain: string }[];
}

export function peopleFromDiscovery(
  results: DiscoveryResult[],
): OpenIndexPeople {
  const people: SourcedPerson[] = [];
  const discarded: OpenIndexPeople["discarded"] = [];
  const seen = new Set<string>();

  for (const result of results) {
    const person = personFromDiscovery(result);
    if (person === null) {
      discarded.push({
        url: result.url,
        title: result.title ?? "",
        domain: urlDomain(result.url),
      });
      continue;
    }
    if (seen.has(person.id)) continue;
    seen.add(person.id);
    people.push(person);
  }
  return { people, discarded };
}
