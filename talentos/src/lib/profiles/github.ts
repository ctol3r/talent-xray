/**
 * GitHub declared links (Wave H), on the D-032 registry pattern: opt-in env
 * flag, injectable fetch, an allow-listed record schema, and `configured`
 * false unless the owner turns it on — nothing calls out otherwise.
 *
 * What this reads: the fields a person filled in on their own GitHub profile
 * — their website, the Twitter/X handle GitHub stores, and the social
 * accounts they added. Two requests, one person, per click.
 *
 * GitHub's Acceptable Use Policies, quoted rather than paraphrased so the
 * reading is checkable:
 *   §7 "Information Usage Restrictions": "You may not use information from
 *   the Service (whether scraped, collected through our API, or obtained
 *   otherwise) for spamming purposes, including for the purposes of sending
 *   unsolicited emails to users or selling User Personal Information".
 *   §8 "Scraping and API Usage Restrictions": "Scraping refers to extracting
 *   information from our Service via an automated process... You may scrape
 *   the website for the following reasons: Researchers may scrape public,
 *   non-personal information... Archivists may scrape GitHub for public data".
 *
 * This module does not assert that recruiting use is permitted. It reads one
 * person's own declared links when a human clicks, sells nothing and emails
 * nothing. Whether that use is within §7 for a recruiting product is an open
 * question for a lawyer, recorded in docs/WAVE-H-PROFILE-CONNECTIONS.md. A
 * "read every candidate" button must never be added.
 */
import {
  declaredLinkSchema,
  httpOnly,
  resolveDeclaredMode,
  USER_AGENT,
  type DeclaredClient,
  type DeclaredFetch,
  type DeclaredLink,
  type DeclaredMode,
} from "./declared";

export const GITHUB_API = "https://api.github.com";

export function buildGithubUserUrl(login: string): string {
  return `${GITHUB_API}/users/${encodeURIComponent(login)}`;
}

export function buildGithubSocialAccountsUrl(login: string): string {
  return `${GITHUB_API}/users/${encodeURIComponent(login)}/social_accounts`;
}

/** Reserved GitHub paths that are not a person. */
const RESERVED = new Set([
  "orgs",
  "topics",
  "sponsors",
  "marketplace",
  "features",
  "about",
  "login",
  "settings",
  "explore",
  "apps",
  "collections",
  "events",
  "pricing",
  "security",
  "enterprise",
]);

/**
 * The login in a github.com profile URL, or null. Exactly one path segment,
 * in GitHub's own charset; a repository URL or a gist is not a profile.
 */
export function githubLoginFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") return null;
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return null;
  const login = segments[0];
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(login))
    return null;
  if (RESERVED.has(login.toLowerCase())) return null;
  return login;
}

/** Exactly the fields this module is allowed to see. */
interface GithubUser {
  login?: unknown;
  blog?: unknown;
  twitter_username?: unknown;
}
interface GithubSocialAccount {
  provider?: unknown;
  url?: unknown;
}

/**
 * Map a GitHub profile to declared links. Picks four fields by name and
 * drops everything else the API returns — email, hireable, company,
 * location, bio, avatar_url, name, gravatar_id and every count.
 */
export function mapGithubLinks(
  user: GithubUser,
  social: GithubSocialAccount[],
  login: string,
): DeclaredLink[] {
  const assertedBy = `github:${login}`;
  const out: DeclaredLink[] = [];

  const blog = httpOnly(typeof user.blog === "string" ? user.blog : null);
  if (blog) {
    out.push({
      url: blog,
      platform: "github",
      assertedBy,
      assertedAt: null,
      reciprocal: false,
      label: "website",
    });
  }

  const handle =
    typeof user.twitter_username === "string"
      ? user.twitter_username.trim()
      : "";
  if (handle && /^[A-Za-z0-9_]{1,15}$/.test(handle)) {
    out.push({
      url: `https://x.com/${handle}`,
      platform: "github",
      assertedBy,
      assertedAt: null,
      reciprocal: false,
      // Named so the card can say the address was built from a handle field
      // rather than copied from something the person wrote.
      label: "twitter handle field",
    });
  }

  for (const account of social) {
    const url = httpOnly(typeof account.url === "string" ? account.url : null);
    if (!url) continue;
    const provider =
      typeof account.provider === "string"
        ? account.provider.slice(0, 120)
        : "social";
    out.push({
      url,
      platform: "github",
      assertedBy,
      assertedAt: null,
      reciprocal: false,
      label: provider,
    });
  }

  const seen = new Set<string>();
  return out
    .filter((link) => {
      const key = link.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((link) => declaredLinkSchema.parse(link));
}

const MOCK_LINKS = (login: string): DeclaredLink[] => [
  {
    url: `https://www.linkedin.com/in/mock-${login}`,
    platform: "github",
    assertedBy: `github:${login}`,
    assertedAt: null,
    reciprocal: false,
    label: "[Mock] linkedin",
  },
  {
    url: `https://x.com/mock-${login}`,
    platform: "github",
    assertedBy: `github:${login}`,
    assertedAt: null,
    reciprocal: false,
    label: "[Mock] twitter handle field",
  },
  {
    url: `https://www.instagram.com/mock-${login}`,
    platform: "github",
    assertedBy: `github:${login}`,
    assertedAt: null,
    reciprocal: false,
    label: "[Mock] instagram",
  },
];

export function resolveGithubMode(): DeclaredMode {
  return resolveDeclaredMode(process.env.TALENTOS_PROFILES_GITHUB);
}

export function createGithubClient(
  fetchImpl: DeclaredFetch = fetch as unknown as DeclaredFetch,
): DeclaredClient {
  const mode = resolveGithubMode();
  return {
    platform: "github",
    mode,
    configured: mode !== "off",
    async read(account: string) {
      if (mode === "off") {
        throw new Error(
          "Reading declared links from GitHub is off. Set TALENTOS_PROFILES_GITHUB=1 to enable it; nothing calls out otherwise.",
        );
      }
      const login = account.trim();
      if (!login) throw new Error("No GitHub account on this candidate.");
      if (mode === "mock") return MOCK_LINKS(login);

      const token = process.env.TALENTOS_GITHUB_TOKEN?.trim();
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": USER_AGENT,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const userResponse = await fetchImpl(buildGithubUserUrl(login), {
        headers,
      });
      if (userResponse.status === 404) return [];
      if (!userResponse.ok) throw rateLimitOrError(userResponse);
      const user = (await userResponse.json()) as GithubUser;

      const socialResponse = await fetchImpl(
        buildGithubSocialAccountsUrl(login),
        { headers },
      );
      const social =
        socialResponse.ok && socialResponse.status !== 404
          ? ((await socialResponse.json()) as GithubSocialAccount[])
          : [];

      return mapGithubLinks(user, Array.isArray(social) ? social : [], login);
    },
  };
}

function rateLimitOrError(response: {
  status: number;
  headers: { get(name: string): string | null };
}): Error {
  const remaining = response.headers.get("x-ratelimit-remaining");
  if (
    (response.status === 403 || response.status === 429) &&
    remaining === "0"
  ) {
    const reset = response.headers.get("x-ratelimit-reset");
    const when = reset
      ? new Date(Number(reset) * 1000)
          .toISOString()
          .slice(0, 16)
          .replace("T", " ")
      : "the reset time GitHub reports";
    return new Error(`GitHub rate limit reached; try after ${when}.`);
  }
  return new Error(`GitHub answered HTTP ${response.status}.`);
}
