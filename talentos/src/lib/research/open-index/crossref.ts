/**
 * Crossref as a people source.
 *
 * Crossref indexes works, not people, so the people come out of the author
 * lists. That sounds like a weakness and is actually the one thing it does
 * that the others do not: it finds the co-authors of a specific piece of
 * work, which is how a recruiter reaches the third name on a paper nobody
 * has approached yet.
 *
 * Licence: bibliographic metadata is treated as public-domain fact and
 * Crossref-generated data is released CC0. There is no non-commercial term
 * on the free API. Note that the paid Metadata Plus tier is contractually
 * NARROWER for a product like this — it restricts use to the subscriber's
 * internal business purposes — so the free API is the correct one, not a
 * compromise.
 *
 * CORS on this API is undocumented; the wildcard header is observed server
 * behaviour, not a promise. That is why every adapter here sits behind an
 * interface that can be moved server-side without touching a caller.
 *
 * Read: given name, family name, ORCID, the first affiliation, and the work
 * the person authored. Nothing else on the record.
 */
import type { DiscoveryResult } from "../discovery-provider";
import {
  politeContact,
  type OpenIndexFetch,
  type OpenIndexRequest,
  type OpenIndexSource,
  type OpenIndexSpec,
} from "./types";

export const CROSSREF_API = "https://api.crossref.org";

/**
 * Two questions again, for the same reason. Sending topic and affiliation
 * together let the affiliation dominate: a search for interpretability
 * researchers at a Montreal university came back with clinical authors who
 * happened to be there. Asked separately, the topic question returns people
 * who work on the subject and the affiliation question returns people at the
 * place, and the recruiter can see which is which.
 */
export function crossrefQueries(
  spec: OpenIndexSpec,
): { params: URLSearchParams; purpose: string }[] {
  const out: { params: URLSearchParams; purpose: string }[] = [];
  const base = () =>
    new URLSearchParams({
      rows: String(Math.min(spec.limit * 2, 40)),
      select: "title,author,DOI",
    });

  if (spec.name) {
    const params = base();
    params.set("query.author", spec.name);
    out.push({ params, purpose: `Works by ${spec.name}` });
  }
  const topic = spec.terms.slice(0, 2).join(" ").trim();
  if (topic) {
    const params = base();
    params.set("query.bibliographic", topic);
    out.push({ params, purpose: `Authors of works on ${topic}` });
  }
  const organisation = spec.organisations[0]?.trim();
  if (organisation && topic) {
    const params = base();
    params.set("query.bibliographic", topic);
    params.set("query.affiliation", organisation);
    out.push({
      params,
      purpose: `Authors on ${topic} at ${organisation}`,
    });
  }
  return out.slice(0, 3);
}

export function buildCrossrefUrl(params: URLSearchParams): string {
  const contact = politeContact();
  if (contact) params.set("mailto", contact);
  return `${CROSSREF_API}/works?${params.toString()}`;
}

interface WorksPayload {
  message?: {
    items?: {
      title?: unknown;
      DOI?: unknown;
      author?: {
        given?: unknown;
        family?: unknown;
        ORCID?: unknown;
        affiliation?: { name?: unknown }[];
      }[];
    }[];
  };
}

/**
 * One row per person, not per work. The same author across three papers is
 * one result, and the works they appeared in become the evidence line.
 */
export function mapCrossref(
  payload: WorksPayload,
  query: string,
  retrievedAt: string,
  limit: number,
): DiscoveryResult[] {
  const items = payload.message?.items;
  if (!Array.isArray(items)) return [];
  const people = new Map<
    string,
    {
      name: string;
      orcid: string | null;
      affiliation: string | null;
      works: string[];
    }
  >();

  for (const item of items) {
    const title =
      Array.isArray(item.title) && typeof item.title[0] === "string"
        ? item.title[0]
        : null;
    if (!Array.isArray(item.author)) continue;
    for (const author of item.author) {
      const given = typeof author.given === "string" ? author.given : "";
      const family = typeof author.family === "string" ? author.family : "";
      const name = `${given} ${family}`.trim();
      if (!name) continue;
      const orcid = typeof author.ORCID === "string" ? author.ORCID : null;
      // Without an ORCID two people with one name merge. Keyed on the ORCID
      // when there is one, so the merge only happens where it is safe.
      const key = orcid ?? `name:${name.toLowerCase()}`;
      const affiliation =
        Array.isArray(author.affiliation) &&
        typeof author.affiliation[0]?.name === "string"
          ? (author.affiliation[0].name as string)
          : null;
      const found = people.get(key);
      if (found) {
        if (title && !found.works.includes(title)) found.works.push(title);
        if (!found.orcid && orcid) found.orcid = orcid;
        if (!found.affiliation && affiliation) found.affiliation = affiliation;
      } else {
        people.set(key, {
          name,
          orcid,
          affiliation,
          works: title ? [title] : [],
        });
      }
    }
  }

  return [...people.values()]
    .sort((a, b) => b.works.length - a.works.length)
    .slice(0, limit)
    .map((person, index) => ({
      // An ORCID is a page about the person; without one the best available
      // address is the search that found them, never a guessed profile URL.
      url:
        person.orcid ??
        `${CROSSREF_API}/works?${new URLSearchParams({ "query.author": person.name }).toString()}`,
      title: person.name,
      snippet: [
        person.affiliation,
        person.works.length > 0 ? `on: ${person.works[0]}` : null,
        person.works.length > 1 ? `+${person.works.length - 1} more` : null,
        person.orcid ? null : "no ORCID on this record — identity unconfirmed",
      ]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 300),
      provider: "open-index",
      engine: "crossref",
      query,
      retrievedAt,
      providerRank: index + 1,
    }));
}

export const crossrefSource: OpenIndexSource = {
  id: "crossref",
  label: "Crossref",
  licence:
    "Bibliographic metadata treated as public-domain fact; Crossref-generated data CC0. No non-commercial term on the free API.",
  population:
    "Authors of works with a DOI. Reaches the co-authors nobody has approached, and reaches nobody who has not published. An author without an ORCID on the record cannot be told apart from a namesake.",
  enabled: true,
  plan(spec): OpenIndexRequest[] {
    return crossrefQueries(spec).map((entry) => ({
      source: "crossref" as const,
      url: buildCrossrefUrl(entry.params),
      purpose: entry.purpose,
    }));
  },
  async search(spec, fetchImpl = fetch as unknown as OpenIndexFetch) {
    const headers = { Accept: "application/json" };
    const retrievedAt = new Date().toISOString();
    const seen = new Set<string>();
    const out: DiscoveryResult[] = [];
    let lastError: Error | null = null;

    for (const entry of crossrefQueries(spec)) {
      const url = buildCrossrefUrl(entry.params);
      try {
        const response = await fetchImpl(url, { headers });
        if (!response.ok) {
          lastError = new Error(`Crossref answered HTTP ${response.status}.`);
          continue;
        }
        for (const result of mapCrossref(
          (await response.json()) as WorksPayload,
          url,
          retrievedAt,
          spec.limit,
        )) {
          if (seen.has(result.url)) continue;
          seen.add(result.url);
          out.push({ ...result, providerRank: out.length + 1 });
          if (out.length >= spec.limit) return out;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
    if (out.length === 0 && lastError) throw lastError;
    return out;
  },
};
