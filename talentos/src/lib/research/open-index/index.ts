/**
 * The open index, assembled: the sources, the mock, and one search across
 * whichever the owner has turned on.
 *
 * Sources run in parallel but capped, because Wikimedia's 2026 rate-limit
 * policy asks for three concurrent requests or fewer and the others are not
 * more generous. One source failing does not fail the search: its error is
 * reported beside the results that did arrive, because a partial answer with
 * a named gap is more use than nothing.
 */
import type { DiscoveryResult } from "../discovery-provider";
import { crossrefSource } from "./crossref";
import { gitHubSource } from "./github";
import { openAlexSource } from "./openalex";
import { wikidataSource } from "./wikidata";
import {
  enabledSources,
  type OpenIndexFetch,
  type OpenIndexRequest,
  type OpenIndexSource,
  type OpenIndexSourceId,
  type OpenIndexSpec,
} from "./types";

const ALL: Record<OpenIndexSourceId, OpenIndexSource> = {
  wikidata: wikidataSource,
  openalex: openAlexSource,
  github: gitHubSource,
  crossref: crossrefSource,
};

export function allOpenIndexSources(): OpenIndexSource[] {
  return Object.values(ALL);
}

export function activeOpenIndexSources(raw = process.env.TALENTOS_OPEN_INDEX): {
  sources: OpenIndexSource[];
  mock: boolean;
} {
  const { ids, mock } = enabledSources(raw);
  return { sources: ids.map((id) => ALL[id]), mock };
}

/** What the search would ask, before it asks. Nothing is hidden (rule 6). */
export function planOpenIndex(
  spec: OpenIndexSpec,
  raw = process.env.TALENTOS_OPEN_INDEX,
): OpenIndexRequest[] {
  return activeOpenIndexSources(raw).sources.flatMap((source) =>
    source.plan(spec),
  );
}

export interface OpenIndexRun {
  results: DiscoveryResult[];
  /** Per source: how many rows, or why none. */
  reports: {
    source: OpenIndexSourceId;
    label: string;
    count: number;
    error?: string;
  }[];
  requests: OpenIndexRequest[];
}

/** Mock rows, so the whole path can be exercised without calling anyone. */
function mockResults(
  source: OpenIndexSource,
  spec: OpenIndexSpec,
): DiscoveryResult[] {
  const at = "2026-01-01T00:00:00.000Z";
  return [1, 2].map((rank) => ({
    url: `https://example.invalid/${source.id}/${rank}`,
    title: `[Mock] ${source.label} person ${rank}`,
    snippet: `[Mock] matched on ${spec.terms.slice(0, 2).join(", ") || "no terms"}`,
    provider: "open-index",
    engine: source.id,
    query: source.plan(spec)[0]?.url ?? source.id,
    retrievedAt: at,
    providerRank: rank,
  }));
}

/** Run at most three source calls at a time, in the order given. */
async function inBatches<T>(
  tasks: (() => Promise<T>)[],
  size = 3,
): Promise<T[]> {
  const out: T[] = [];
  for (let index = 0; index < tasks.length; index += size) {
    out.push(
      ...(await Promise.all(tasks.slice(index, index + size).map((t) => t()))),
    );
  }
  return out;
}

export async function searchOpenIndex(
  spec: OpenIndexSpec,
  options: { raw?: string; fetchImpl?: OpenIndexFetch } = {},
): Promise<OpenIndexRun> {
  const { sources, mock } = activeOpenIndexSources(
    options.raw ?? process.env.TALENTOS_OPEN_INDEX,
  );
  const requests = sources.flatMap((source) => source.plan(spec));
  if (sources.length === 0) {
    return { results: [], reports: [], requests };
  }

  const settled = await inBatches(
    sources.map((source) => async () => {
      try {
        const results = mock
          ? mockResults(source, spec)
          : await source.search(spec, options.fetchImpl);
        return { source, results, error: undefined as string | undefined };
      } catch (error) {
        return {
          source,
          results: [] as DiscoveryResult[],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  return {
    results: settled.flatMap((entry) => entry.results),
    reports: settled.map((entry) => ({
      source: entry.source.id,
      label: entry.source.label,
      count: entry.results.length,
      error: entry.error,
    })),
    requests,
  };
}

export * from "./types";
export { buildCrossrefUrl, crossrefQueries, mapCrossref } from "./crossref";
export { buildGitHubUrl, gitHubQueries, mapGitHub } from "./github";
export {
  buildAuthorsUrl,
  buildInstitutionLookupUrl,
  buildTopicLookupUrl,
  mapOpenAlex,
  shortId,
  topicMatchesTerm,
} from "./openalex";
export {
  buildLabelUrl,
  buildWikidataSearch,
  buildWikidataUrl,
  mapLabels,
  mapWikidata,
  wikidataWordSets,
} from "./wikidata";
