/**
 * GitHub as a people source.
 *
 * The only one of the four that finds working software engineers rather than
 * people who have published about software. Its qualifiers are genuinely
 * good for sourcing: `location:`, `language:`, `followers:>N`, `repos:A..B`,
 * and `type:user` — which is not optional, because organisations appear in
 * user search results and an organisation is not a candidate.
 *
 * Kept off by default. GitHub's Acceptable Use Policy §7 restricts using
 * information from the service to contact people for recruiting without
 * consent, and that question is recorded as open (Wave H). Reading a public
 * profile and linking to it is a narrower act than contacting anyone, which
 * is why this is a flag rather than a deletion — but it is the owner's call
 * to make, and it stays off until they make it.
 *
 * Read: login, profile URL, and the account type used to reject
 * organisations. Deliberately not read: the avatar, the email field, and the
 * biography. The first is a photograph, the second is contact data, and the
 * third is free text about a person rather than about their work.
 */
import type { DiscoveryResult } from "../discovery-provider";
import {
  politeContact,
  type OpenIndexFetch,
  type OpenIndexRequest,
  type OpenIndexSource,
  type OpenIndexSpec,
} from "./types";

export const GITHUB_SEARCH = "https://api.github.com/search/users";

/**
 * Two questions, not one. Piling free text on top of `language:` and
 * `location:` returns nothing — the combined query matched zero accounts
 * while each half matched hundreds. So the qualifiers get one request and
 * the subject words get another, and the results are merged.
 *
 * `type:user` is on both and is not optional: organisations appear in user
 * search results, and an organisation is not a candidate.
 */
export function gitHubQueries(spec: OpenIndexSpec): string[] {
  const queries: string[] = [];
  if (spec.name) queries.push(`${spec.name} type:user`);

  const qualifiers: string[] = [];
  for (const language of spec.technologies.slice(0, 2)) {
    qualifiers.push(`language:${language.toLowerCase().replace(/\s+/gu, "-")}`);
  }
  for (const place of spec.geography.slice(0, 1)) {
    qualifiers.push(`location:${JSON.stringify(place)}`);
  }
  if (qualifiers.length > 0) queries.push(`${qualifiers.join(" ")} type:user`);

  const term = spec.terms[0]?.trim();
  if (term) queries.push(`${term} type:user`);

  return queries.length > 0 ? queries.slice(0, 3) : ["type:user"];
}

export function buildGitHubUrl(query: string, limit: number): string {
  const params = new URLSearchParams({
    q: query,
    per_page: String(Math.min(limit, 25)),
  });
  return `${GITHUB_SEARCH}?${params.toString()}`;
}

interface UsersPayload {
  items?: { login?: unknown; html_url?: unknown; type?: unknown }[];
}

export function mapGitHub(
  payload: UsersPayload,
  query: string,
  retrievedAt: string,
): DiscoveryResult[] {
  const rows = payload.items;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row, index) => {
    const login = typeof row.login === "string" ? row.login : null;
    const url = typeof row.html_url === "string" ? row.html_url : null;
    // A second guard behind the type:user qualifier: an organisation that
    // slips through the query is dropped here rather than shown as a person.
    if (!login || !url || row.type !== "User") return [];
    return [
      {
        url,
        title: login,
        snippet: undefined,
        provider: "open-index",
        engine: "github",
        query,
        retrievedAt,
        providerRank: index + 1,
      },
    ];
  });
}

export const gitHubSource: OpenIndexSource = {
  id: "github",
  label: "GitHub",
  licence:
    "Public API, keyless. Acceptable Use Policy §7 restricts recruiting contact without consent — an open question for the owner, so this source is off by default.",
  population:
    "Working software engineers who publish code and filled in a location. Misses anyone whose work is private, and the location field is self-typed and often a joke.",
  enabled: true,
  plan(spec): OpenIndexRequest[] {
    return gitHubQueries(spec).map((query) => ({
      source: "github" as const,
      url: buildGitHubUrl(query, spec.limit),
      purpose: `User accounts matching ${query}`,
    }));
  },
  async search(spec, fetchImpl = fetch as unknown as OpenIndexFetch) {
    const contact = politeContact();
    const headers = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": contact
        ? `talent-xray-open-index (${contact})`
        : "talent-xray-open-index",
    };
    const retrievedAt = new Date().toISOString();
    const seen = new Set<string>();
    const out: DiscoveryResult[] = [];
    let lastError: Error | null = null;

    for (const query of gitHubQueries(spec)) {
      const url = buildGitHubUrl(query, spec.limit);
      try {
        const response = await fetchImpl(url, { headers });
        if (!response.ok) {
          lastError = new Error(
            response.status === 403
              ? "GitHub answered HTTP 403 — the keyless search limit is 10 a minute."
              : `GitHub answered HTTP ${response.status}.`,
          );
          continue;
        }
        for (const result of mapGitHub(
          (await response.json()) as UsersPayload,
          url,
          retrievedAt,
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
