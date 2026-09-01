import type { ResearchProvider, ResearchResult } from "./provider";

/**
 * Google Programmable Search provider (W8) backed by the two live
 * Talent X-Ray engines — people-only search: profiles, portfolios, CVs,
 * credential registries, rosters. Company marketing pages and job postings
 * are absent by construction of the engines themselves.
 *
 * Product rules honored here, not just in the UI:
 * - This calls Google's JSON API; it NEVER fetches, crawls, or scrapes a
 *   result page.
 * - Results are returned in memory only. Persisting anything is a separate,
 *   per-result, user-explicit act (services/discovery.ts).
 */
export const CSE_ENGINES = {
  /** "Talent X-Ray · Core" — 50-domain universal spine. */
  core: "a157d37906e1141cc",
  /** "Verified & Reach" — registries + contact + rosters. */
  reach: "918bc00e18d0c46e5",
} as const;
export type CseEngine = keyof typeof CSE_ENGINES;

interface CseItem {
  link?: string;
  title?: string;
  snippet?: string;
}
interface CseResponse {
  items?: CseItem[];
  error?: { message?: string };
}

export type FetchLike = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

export function buildCseUrl(
  key: string,
  engine: CseEngine,
  query: string,
  limit: number,
): string {
  const cx =
    engine === "reach"
      ? (process.env.TALENTOS_CSE_REACH_CX ?? CSE_ENGINES.reach)
      : (process.env.TALENTOS_CSE_CORE_CX ?? CSE_ENGINES.core);
  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    num: String(Math.min(Math.max(limit, 1), 10)),
  });
  return `https://www.googleapis.com/customsearch/v1?${params.toString()}`;
}

export function mapCseItems(
  payload: CseResponse,
  query: string,
  engine: CseEngine,
): ResearchResult[] {
  const retrievedAt = new Date().toISOString();
  return (payload.items ?? [])
    .filter((item): item is CseItem & { link: string } => Boolean(item.link))
    .map((item, index) => ({
      url: item.link,
      title: item.title,
      snippet: item.snippet,
      source: `google-cse:${engine}`,
      query,
      retrievedAt,
      relevance: 1 - index * 0.05,
    }));
}

export function createGoogleCseProvider(
  fetchImpl: FetchLike = fetch,
): ResearchProvider {
  const key = process.env.TALENTOS_GOOGLE_CSE_KEY ?? "";
  return {
    name: "google-cse",
    configured: key !== "",
    async search(query, options) {
      if (!key) {
        throw new Error(
          "Google CSE key not configured — set TALENTOS_GOOGLE_CSE_KEY in .env.",
        );
      }
      const engine: CseEngine = options?.engine === "reach" ? "reach" : "core";
      const response = await fetchImpl(
        buildCseUrl(key, engine, query, options?.limit ?? 10),
      );
      const payload = (await response.json()) as CseResponse;
      if (!response.ok) {
        throw new Error(
          `Google CSE error (HTTP ${response.status}): ${payload.error?.message ?? "unknown"}`,
        );
      }
      return mapCseItems(payload, query, engine);
    },
  };
}
