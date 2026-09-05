import type {
  CandidateDiscoveryProvider,
  DiscoveryResult,
} from "./discovery-provider";

/**
 * TalentXRayCandidateDiscoveryProvider — the two live Talent X-Ray Google
 * Programmable Search engines. People-only search by construction of the
 * engines themselves: profiles, portfolios, CVs, credential registries,
 * rosters; company marketing pages and job postings are absent.
 *
 * This is a CANDIDATE DISCOVERY provider (D-010), never the general
 * ResearchProvider — a people index must not answer market-research
 * questions.
 *
 * Product rules honored here, not just in the UI:
 * - This calls Google's JSON API; it NEVER fetches, crawls, or scrapes a
 *   result page.
 * - Results are returned in memory only. Persisting anything is a separate,
 *   per-result, user-explicit act (services/discovery.ts).
 * - Result position is preserved as providerRank (1-based) — no synthetic
 *   relevance score is derived from it.
 */
export const CSE_ENGINES = {
  /** "Talent X-Ray · Core" — 50-domain universal spine. */
  core: "a157d37906e1141cc",
  /** "Verified & Reach" — registries + contact + rosters. */
  reach: "918bc00e18d0c46e5",
} as const;
export type CseEngine = keyof typeof CSE_ENGINES;

export const TALENT_XRAY_PROVIDER_NAME = "talent-xray";

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
): DiscoveryResult[] {
  const retrievedAt = new Date().toISOString();
  return (payload.items ?? [])
    .filter((item): item is CseItem & { link: string } => Boolean(item.link))
    .map((item, index) => ({
      url: item.link,
      title: item.title,
      snippet: item.snippet,
      provider: TALENT_XRAY_PROVIDER_NAME,
      engine,
      query,
      retrievedAt,
      providerRank: index + 1,
    }));
}

export function createTalentXRayDiscoveryProvider(
  fetchImpl: FetchLike = fetch,
): CandidateDiscoveryProvider {
  const key = process.env.TALENTOS_GOOGLE_CSE_KEY ?? "";
  return {
    name: TALENT_XRAY_PROVIDER_NAME,
    configured: key !== "",
    async search(query, options) {
      if (!key) {
        throw new Error(
          "Talent X-Ray discovery key not configured — set TALENTOS_GOOGLE_CSE_KEY in .env.",
        );
      }
      const engine: CseEngine = options?.engine === "reach" ? "reach" : "core";
      const response = await fetchImpl(
        buildCseUrl(key, engine, query, options?.limit ?? 10),
      );
      const payload = (await response.json()) as CseResponse;
      if (!response.ok) {
        throw new Error(
          `Talent X-Ray discovery error (HTTP ${response.status}): ${payload.error?.message ?? "unknown"}`,
        );
      }
      return mapCseItems(payload, query, engine);
    },
  };
}
