/**
 * OpenAlex as a people source.
 *
 * The strongest of the four for research populations, but only when it is
 * asked correctly, and the obvious way is wrong. `?search=` on the authors
 * endpoint matches NAMES: searching it for "mechanistic interpretability"
 * returns nothing, because nobody is called that. Topics and institutions
 * are filters, and they take ids, not words — `last_known_institutions.
 * display_name.search` is not a field and the API answers 400.
 *
 * So this resolves first and filters second: the terms become a topic id
 * through `/topics?search=`, the organisation becomes an institution id
 * through `/institutions?filter=display_name.search:`, and the authors call
 * filters on those ids sorted by works count. Asked that way it returns the
 * people you would actually want — the machine-learning group at a named
 * university, in order of output.
 *
 * The licence question is narrower than it looks and the narrow reading is
 * the one this obeys. The data is CC0, but the terms of service last revised
 * 15 August 2026 bar "unauthorized use, reproduction, modification,
 * distribution or republication of the Data or Database" and assert database
 * ownership. So: query live, show, link out, store nothing. A design that
 * cached an index here would breach those terms; this product's rule against
 * bulk-persisting results is what makes the source usable at all.
 *
 * Read: display name, institutions, ORCID, works count, the OpenAlex id.
 */
import type { DiscoveryResult } from "../discovery-provider";
import {
  politeContact,
  type OpenIndexFetch,
  type OpenIndexRequest,
  type OpenIndexSource,
  type OpenIndexSpec,
} from "./types";

export const OPENALEX_API = "https://api.openalex.org";

function withContact(params: URLSearchParams): URLSearchParams {
  const contact = politeContact();
  // The polite pool: documented as the faster, more reliable service. The
  // alternative is the shared pool, not anonymity.
  if (contact) params.set("mailto", contact);
  return params;
}

export function buildTopicLookupUrl(term: string): string {
  return `${OPENALEX_API}/topics?${withContact(
    new URLSearchParams({ search: term, per_page: "1" }),
  ).toString()}`;
}

export function buildInstitutionLookupUrl(name: string): string {
  return `${OPENALEX_API}/institutions?${withContact(
    new URLSearchParams({
      filter: `display_name.search:${name}`,
      per_page: "1",
    }),
  ).toString()}`;
}

/**
 * The authors call. `filters` are already-resolved ids; when there are none
 * and no name, there is nothing meaningful to ask and this returns null
 * rather than a query that would return the whole database.
 */
export function buildAuthorsUrl(
  spec: OpenIndexSpec,
  filters: string[],
): string | null {
  const clauses = [...filters];
  if (spec.name) clauses.push(`display_name.search:${spec.name}`);
  // An institution on its own is not a people search, it is a staff list:
  // filtering only on a university returned its particle physicists for a
  // search about interpretability. A topic or a name is required.
  const hasSubject =
    Boolean(spec.name) || filters.some((f) => f.startsWith("topics.id:"));
  if (!hasSubject) return null;
  const params = new URLSearchParams({
    filter: clauses.join(","),
    per_page: String(Math.min(spec.limit, 25)),
    // Not a relevance score and not a judgement about a person: it is the
    // only ordering the API offers that is not alphabetical.
    sort: "works_count:desc",
  });
  return `${OPENALEX_API}/authors?${withContact(params).toString()}`;
}

interface LookupPayload {
  results?: { id?: unknown; display_name?: unknown }[];
}

/**
 * True when a resolved topic is plausibly what was asked for.
 *
 * The topic search always answers, and its answer to a job title is
 * nonsense: "research engineer" resolved to "Tribology and Lubrication
 * Engineering", which then returned particle physicists. A topic is only
 * used when its own name repeats a real word from the term, which rejects
 * that pairing (engineer is not engineering) and accepts "machine learning"
 * against "Machine Learning in Materials Science".
 */
export function topicMatchesTerm(topicName: string, term: string): boolean {
  const words = (value: string) =>
    new Set(
      value
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length >= 4),
    );
  const wanted = words(term);
  if (wanted.size === 0) return false;
  const got = words(topicName);
  for (const word of wanted) if (got.has(word)) return true;
  return false;
}

interface AuthorsPayload {
  results?: {
    id?: unknown;
    display_name?: unknown;
    orcid?: unknown;
    works_count?: unknown;
    last_known_institutions?: { display_name?: unknown }[];
  }[];
}

/** The short id OpenAlex filters take, from the full URL it returns. */
export function shortId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const last = raw.split("/").filter(Boolean).pop();
  return last && /^[A-Z]\d+$/.test(last) ? last : null;
}

export function mapOpenAlex(
  payload: AuthorsPayload,
  query: string,
  retrievedAt: string,
): DiscoveryResult[] {
  const rows = payload.results;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row, index) => {
    const id = typeof row.id === "string" ? row.id : null;
    const name = typeof row.display_name === "string" ? row.display_name : null;
    if (!id || !name) return [];
    const institutions = Array.isArray(row.last_known_institutions)
      ? row.last_known_institutions
          .map((entry) => entry?.display_name)
          .filter((value): value is string => typeof value === "string")
      : [];
    const works =
      typeof row.works_count === "number" ? `${row.works_count} works` : null;
    const orcid = typeof row.orcid === "string" ? row.orcid : null;
    return [
      {
        url: id,
        title: name,
        snippet:
          [institutions.join(", "), works, orcid]
            .filter(Boolean)
            .join(" · ")
            .slice(0, 300) || undefined,
        provider: "open-index",
        engine: "openalex",
        query,
        retrievedAt,
        providerRank: index + 1,
      },
    ];
  });
}

export const openAlexSource: OpenIndexSource = {
  id: "openalex",
  label: "OpenAlex",
  licence:
    "CC0 data, but the terms of service (15 Aug 2026) bar redistribution and assert database ownership. Query live, link out, store nothing.",
  population:
    "Anyone who has authored indexed scholarly work: researchers, research engineers, clinical academics, some industry scientists. Finds nobody who has not published.",
  enabled: true,
  plan(spec): OpenIndexRequest[] {
    const requests: OpenIndexRequest[] = [];
    if (spec.terms[0]) {
      requests.push({
        source: "openalex",
        url: buildTopicLookupUrl(spec.terms[0]),
        purpose: `Resolve "${spec.terms[0]}" to a topic id`,
      });
    }
    if (spec.organisations[0]) {
      requests.push({
        source: "openalex",
        url: buildInstitutionLookupUrl(spec.organisations[0]),
        purpose: `Resolve "${spec.organisations[0]}" to an institution id`,
      });
    }
    const authors = buildAuthorsUrl(spec, ["topics.id:<resolved>"]);
    if (authors) {
      requests.push({
        source: "openalex",
        url: authors,
        purpose:
          "Authors on that topic and at that institution, most published first",
      });
    }
    return requests;
  },
  async search(spec, fetchImpl = fetch as unknown as OpenIndexFetch) {
    const headers = { Accept: "application/json" };
    const lookup = async (
      url: string,
      accept?: (name: string) => boolean,
    ): Promise<string | null> => {
      const response = await fetchImpl(url, { headers });
      if (!response.ok) return null;
      const payload = (await response.json()) as LookupPayload;
      const first = payload.results?.[0];
      const name =
        typeof first?.display_name === "string" ? first.display_name : "";
      if (accept && !accept(name)) return null;
      return shortId(first?.id);
    };

    const filters: string[] = [];
    // Each term gets a try; the first one that resolves to a topic actually
    // about it wins. A term that resolves to something unrelated is dropped
    // rather than used, because a wrong topic is worse than no topic.
    for (const term of spec.terms.slice(0, 3)) {
      const topic = await lookup(buildTopicLookupUrl(term), (name) =>
        topicMatchesTerm(name, term),
      );
      if (topic) {
        filters.push(`topics.id:${topic}`);
        break;
      }
    }
    if (spec.organisations[0]) {
      const institution = await lookup(
        buildInstitutionLookupUrl(spec.organisations[0]),
      );
      if (institution)
        filters.push(`last_known_institutions.id:${institution}`);
    }

    const url = buildAuthorsUrl(spec, filters);
    if (!url) {
      throw new Error(
        `OpenAlex indexes people by research topic, and none of these terms matched one: ${spec.terms.join(", ") || "(none)"}. Try a broader field ("machine learning", "epidemiology") or search a specific name. An institution on its own returns its whole staff list, so it is refused.`,
      );
    }
    const response = await fetchImpl(url, { headers });
    if (!response.ok) {
      throw new Error(`OpenAlex answered HTTP ${response.status}.`);
    }
    return mapOpenAlex(
      (await response.json()) as AuthorsPayload,
      url,
      new Date().toISOString(),
    );
  },
};
