/**
 * Open-web search, so that the twelve angles that have always been composed
 * for a person to open can be run instead.
 *
 * Brave rather than a Google-SERP reseller, for the reason recorded in
 * `docs/AUTONOMOUS-SOURCING-2026-09-07.md`: it is its own index rather than
 * somebody else's results resold against their terms, and its operator support
 * is a documented feature rather than an accident. Its two costs are real. The
 * index is smaller than Google's, which hurts precisely the long-tail orphan
 * pages sourcing lives on. And the operator behaviour is documented but not
 * verified here — nobody has run a key against it — so this connector reports
 * its operator support as unverified until `pnpm probe:search` says otherwise,
 * and the sourcing page says so rather than implying a query was honoured.
 *
 * A search result is a URL, a title and the engine's own snippet. It is not a
 * page: reading one is the reader's job, behind the policy gate, and only for
 * an address that got through it.
 */
import type {
  CandidateDiscoveryProvider,
  DiscoveryResult,
} from "@/lib/research/discovery-provider";

export const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";
export const BRAVE_PROVIDER_NAME = "brave";
/** The free tier is one request a second; the paid tiers are not slower. */
export const BRAVE_MIN_INTERVAL_MS = 1100;
export const BRAVE_MAX_COUNT = 20;

/**
 * What we believe about each operator, and how sure we are.
 *
 * Every row is `unverified` until somebody runs the probe with a real key.
 * That is not humility for its own sake: an operator the index silently drops
 * turns a precise query into a broad one, and a connector that reports "ran"
 * over a query that was quietly widened is worse than one that reports
 * nothing, because the rows look like answers.
 */
export type OperatorConfidence = "verified" | "unverified" | "unsupported";

export const OPERATOR_SUPPORT: Record<string, OperatorConfidence> = {
  "site:": "unverified",
  "-site:": "unverified",
  "filetype:": "unverified",
  "intitle:": "unverified",
  "inurl:": "unverified",
  '"phrase"': "unverified",
  "OR between terms": "unverified",
  "(grouped OR)": "unverified",
};

export function unverifiedOperators(): string[] {
  return Object.entries(OPERATOR_SUPPORT)
    .filter(([, confidence]) => confidence !== "verified")
    .map(([operator]) => operator);
}

export function buildBraveUrl(query: string, count: number): string {
  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(Math.max(count, 1), BRAVE_MAX_COUNT)),
    // No spell correction: a composed boolean is not a typo, and letting the
    // index "fix" it is how a precise query becomes a different one.
    spellcheck: "0",
    text_decorations: "0",
    safesearch: "off",
    result_filter: "web",
  });
  return `${BRAVE_ENDPOINT}?${params.toString()}`;
}

interface BravePayload {
  web?: { results?: unknown[] };
}

/** Read an explicit list of fields. Never spread a response object. */
export function mapBrave(
  payload: BravePayload,
  query: string,
  retrievedAt: string,
): DiscoveryResult[] {
  const rows = payload.web?.results;
  if (!Array.isArray(rows)) return [];
  const out: DiscoveryResult[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const record = row as {
      url?: unknown;
      title?: unknown;
      description?: unknown;
    };
    if (typeof record.url !== "string" || !record.url.startsWith("https://"))
      continue;
    out.push({
      url: record.url,
      title:
        typeof record.title === "string"
          ? stripMarkup(record.title)
          : undefined,
      snippet:
        typeof record.description === "string"
          ? stripMarkup(record.description)
          : undefined,
      provider: BRAVE_PROVIDER_NAME,
      engine: "web",
      query,
      retrievedAt,
      providerRank: out.length + 1,
    });
  }
  return out;
}

function stripMarkup(value: string): string {
  return value
    .replace(/<[^>]*>/gu, "")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 300);
}

export type BraveFetch = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function createBraveDiscoveryProvider(
  key = process.env.TALENTOS_BRAVE_SEARCH_KEY,
  fetchImpl: BraveFetch = fetch as unknown as BraveFetch,
): CandidateDiscoveryProvider {
  const token = (key ?? "").trim();
  return {
    name: BRAVE_PROVIDER_NAME,
    configured: token.length > 0,
    async search(query, options) {
      if (!token) {
        throw new Error(
          "Open-web search needs TALENTOS_BRAVE_SEARCH_KEY. Until it is set the composed query is yours to open.",
        );
      }
      const url = buildBraveUrl(query, options?.limit ?? 10);
      const response = await fetchImpl(url, {
        headers: {
          Accept: "application/json",
          "X-Subscription-Token": token,
        },
      });
      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? "The search API asked us to slow down; nothing was retried."
            : response.status === 401 || response.status === 403
              ? "The search API rejected the key."
              : `The search API answered HTTP ${response.status}.`,
        );
      }
      const payload = (await response.json()) as BravePayload;
      const results = mapBrave(payload, query, new Date().toISOString());
      return results.slice(0, options?.limit ?? 10);
    },
  };
}
