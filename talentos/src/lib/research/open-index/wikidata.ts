/**
 * Wikidata as a people source.
 *
 * Licence: the structured data is CC0, with no attribution condition and no
 * non-commercial clause. That makes it the cleanest of the four, and it is
 * the only one whose records carry a person's identifiers across platforms
 * in one row — an item can hold ORCID, GitHub, a homepage and a LinkedIn
 * slug together, which is exactly the profile-connection problem (D-035).
 *
 * Two traps, both found by reading the live API rather than the docs:
 *  - `origin=*` is a query parameter, not the HTTP Origin header, and the
 *    response carries no CORS header without it. It is sent always, so the
 *    same URL works from a browser and from here.
 *  - `wbsearchentities` cannot filter to people. It answered a search for a
 *    researcher with a podcast episode. This uses CirrusSearch with
 *    `haswbstatement:P31=Q5`, which genuinely constrains to humans.
 *
 * Only the item id and the search snippet are read. No claim is fetched, so
 * the properties Wikidata holds that describe a person rather than locate
 * them are never in memory, let alone in the product.
 *
 * CC0 waives copyright. It does not waive anyone's data-protection rights,
 * so a person found here is subject to the same notice duty as any other
 * (D-035, `profile-confirmations`).
 */
import type { DiscoveryResult } from "../discovery-provider";
import {
  plainSnippet,
  politeContact,
  type OpenIndexFetch,
  type OpenIndexRequest,
  type OpenIndexSource,
  type OpenIndexSpec,
} from "./types";

export const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

/**
 * The search returns item ids, not names. One extra call turns a page of
 * `Q56397868` into "Nicolas Torquet · CNRS research engineer", which is the
 * difference between a result a recruiter can read and one they cannot.
 * Only labels and descriptions are asked for, so the properties Wikidata
 * holds that describe a person rather than name them are never returned.
 */
export function buildLabelUrl(ids: string[]): string {
  const params = new URLSearchParams({
    action: "wbgetentities",
    ids: ids.slice(0, 50).join("|"),
    props: "labels|descriptions",
    languages: "en",
    format: "json",
    origin: "*",
  });
  return `${WIKIDATA_API}?${params.toString()}`;
}

interface LabelPayload {
  entities?: Record<
    string,
    {
      labels?: { en?: { value?: unknown } };
      descriptions?: { en?: { value?: unknown } };
    }
  >;
}

export function mapLabels(
  payload: LabelPayload,
): Map<string, { label: string; description: string | null }> {
  const out = new Map<string, { label: string; description: string | null }>();
  for (const [id, entity] of Object.entries(payload.entities ?? {})) {
    const label = entity?.labels?.en?.value;
    if (typeof label !== "string") continue;
    const description = entity?.descriptions?.en?.value;
    out.set(id, {
      label,
      description: typeof description === "string" ? description : null,
    });
  }
  return out;
}

/** `instance of: human`. Without this the results are not people. */
const HUMAN = "haswbstatement:P31=Q5";

/**
 * CirrusSearch ANDs every word, so piling the whole spec into one string
 * returns nothing — six words about interpretability at Montreal matched
 * zero people, while three words matched 267. The free text is capped, and
 * the organisation gets its own request rather than narrowing this one.
 */
export function buildWikidataSearch(words: string[]): string {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: `${HUMAN} ${words.join(" ")}`.trim(),
    srlimit: "20",
    format: "json",
    // Not the Origin header. Without it the response carries no CORS header
    // at all and a browser refuses it, silently.
    origin: "*",
  });
  return `${WIKIDATA_API}?${params.toString()}`;
}

/** At most three words: enough to mean something, few enough to match. */
export function wikidataWordSets(spec: OpenIndexSpec): string[][] {
  const sets: string[][] = [];
  if (spec.name) sets.push([spec.name]);
  const terms = spec.terms
    .map((term) => term.trim())
    .filter(Boolean)
    .slice(0, 2);
  for (const term of terms) {
    sets.push(term.split(/\s+/u).slice(0, 3));
  }
  const organisation = spec.organisations[0]?.trim();
  if (organisation) sets.push(organisation.split(/\s+/u).slice(0, 3));
  return sets.length > 0 ? sets.slice(0, 3) : [[]];
}

export function buildWikidataUrl(spec: OpenIndexSpec): string {
  return buildWikidataSearch(wikidataWordSets(spec)[0]);
}

interface SearchPayload {
  query?: {
    searchinfo?: { totalhits?: number };
    search?: { title?: unknown; snippet?: unknown }[];
  };
}

export function mapWikidata(
  payload: SearchPayload,
  query: string,
  retrievedAt: string,
): DiscoveryResult[] {
  const rows = payload.query?.search;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row, index) => {
    const id = typeof row.title === "string" ? row.title : null;
    if (!id || !/^Q\d+$/.test(id)) return [];
    return [
      {
        url: `https://www.wikidata.org/wiki/${id}`,
        title: id,
        snippet:
          typeof row.snippet === "string"
            ? plainSnippet(row.snippet)
            : undefined,
        provider: "open-index",
        engine: "wikidata",
        query,
        retrievedAt,
        providerRank: index + 1,
      },
    ];
  });
}

export const wikidataSource: OpenIndexSource = {
  id: "wikidata",
  label: "Wikidata",
  licence:
    "CC0 on structured data. No attribution condition, no non-commercial term.",
  population:
    "People with a public record notable enough for an editor to have created one: academics, executives, public figures, some open-source maintainers. Sparse for ordinary professionals, and skewed towards people already written about.",
  enabled: true,
  plan(spec): OpenIndexRequest[] {
    return wikidataWordSets(spec).map((words) => ({
      source: "wikidata" as const,
      url: buildWikidataSearch(words),
      purpose: `People (instance of: human) matching ${words.join(" ") || "no terms"}`,
    }));
  },
  async search(spec, fetchImpl = fetch as unknown as OpenIndexFetch) {
    const contact = politeContact();
    const headers = {
      Accept: "application/json",
      // Wikimedia's policy asks a browser-hosted client to identify itself
      // through this header rather than User-Agent, which a browser owns.
      "Api-User-Agent": contact
        ? `talent-xray-open-index (${contact})`
        : "talent-xray-open-index",
    };
    const retrievedAt = new Date().toISOString();
    const seen = new Set<string>();
    const out: DiscoveryResult[] = [];
    let lastError: Error | null = null;

    // Each word set is a separate question. One returning nothing is normal
    // and is not a failure; all of them failing is. The loop finishes before
    // any labelling, so a full page of results still gets its names.
    for (const words of wikidataWordSets(spec)) {
      if (out.length >= spec.limit) break;
      const url = buildWikidataSearch(words);
      try {
        const response = await fetchImpl(url, { headers });
        if (!response.ok) {
          lastError = new Error(`Wikidata answered HTTP ${response.status}.`);
          continue;
        }
        for (const result of mapWikidata(
          (await response.json()) as SearchPayload,
          url,
          retrievedAt,
        )) {
          if (out.length >= spec.limit) break;
          if (seen.has(result.url)) continue;
          seen.add(result.url);
          out.push({ ...result, providerRank: out.length + 1 });
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (out.length === 0) {
      if (lastError) throw lastError;
      return out;
    }

    // Second call: turn the ids into names. A failure here costs the names,
    // not the results, so it is swallowed deliberately.
    try {
      const ids = out.map((result) => result.url.split("/").pop()!);
      const response = await fetchImpl(buildLabelUrl(ids), { headers });
      if (response.ok) {
        const labels = mapLabels((await response.json()) as LabelPayload);
        return out.map((result) => {
          const found = labels.get(result.url.split("/").pop()!);
          if (!found) return result;
          return {
            ...result,
            title: found.label,
            snippet: [found.description, result.snippet]
              .filter(Boolean)
              .join(" · ")
              .slice(0, 300),
          };
        });
      }
    } catch {
      // Names are a nicety; the addresses are the result.
    }
    return out;
  },
};
