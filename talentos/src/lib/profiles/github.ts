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

/**
 * GitHub's limits, verified live on 2026-09-08 against api.github.com rather
 * than read off the documentation:
 *
 *   GET /rate_limit                    limit 60, used 0
 *   GET /users/octocat                 remaining 59
 *   GET /users/octocat/social_accounts remaining 58
 *
 * So the keyless limit is 60 an hour per IP, and a person costs two requests:
 * thirty people an hour, not sixty. A token raises it to 5,000, which is 2,500
 * people. Asking what is left is free — `/rate_limit` read 60 of 60 before and
 * after itself — so the budget can be checked without spending it.
 *
 * Two different limits answer with the same status codes and they are not the
 * same thing. The **primary** limit is that counter: 403 or 429 with
 * `x-ratelimit-remaining: 0` and a reset. A **secondary** limit is GitHub
 * deciding a caller is going too fast whatever the counter says: 403 or 429
 * with `retry-after`, and the counter still positive. Reading only the counter
 * turns the second one into an unexplained 403 and throws away the one useful
 * fact in it, which is how long to wait.
 *
 * Nothing here retries. A retry is what turns being asked to slow down into
 * being blocked, and the click behind this is one person looking up one
 * person.
 */
export const GITHUB_KEYLESS_LIMIT = 60;
export const GITHUB_TOKEN_LIMIT = 5000;
/** The profile, then the social accounts. Verified above: each costs one. */
export const GITHUB_REQUESTS_PER_PERSON = 2;
/** GitHub asks for at least a second between requests from one caller. */
export const GITHUB_MIN_INTERVAL_MS = 1000;

export interface GithubBudget {
  limit: number | null;
  remaining: number | null;
  /** When the counter refills, ms since the epoch. */
  resetAt: number | null;
  /** When GitHub asked us to wait until — a secondary limit, not the counter. */
  waitUntil: number | null;
  /** When any of this was last seen. Null means we have never asked. */
  observedAt: number | null;
}

/**
 * What the last response said, held for the process rather than the click.
 *
 * A client is built per click, so per-client state would forget the limit
 * between the click that hit it and the next one — which is exactly the pair
 * of clicks that needs to remember. Best effort by design: it is a courtesy to
 * GitHub and to the next click, not a boundary. The response headers remain
 * the authority.
 */
const budget: GithubBudget = {
  limit: null,
  remaining: null,
  resetAt: null,
  waitUntil: null,
  observedAt: null,
};
let nextAllowedAt = 0;

export function githubBudget(): GithubBudget {
  return { ...budget };
}

/** Tests only: forget the limit and the pace between cases. */
export function resetGithubLimiter(): void {
  budget.limit = null;
  budget.remaining = null;
  budget.resetAt = null;
  budget.waitUntil = null;
  budget.observedAt = null;
  nextAllowedAt = 0;
}

type HeaderBag = { get(name: string): string | null };

function num(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw.trim());
  return Number.isFinite(value) ? value : null;
}

/** `retry-after` is a count of seconds or an HTTP date. Both are answers. */
function retryAfterAt(raw: string | null, now: number): number | null {
  if (!raw) return null;
  const seconds = num(raw);
  if (seconds !== null && seconds >= 0) return now + seconds * 1000;
  const at = Date.parse(raw);
  return Number.isNaN(at) ? null : at;
}

/** Said in the reader's own time; a UTC stamp is a fact about Greenwich. */
function whenLocal(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function noteHeaders(headers: HeaderBag, now: number): void {
  const limit = num(headers.get("x-ratelimit-limit"));
  const remaining = num(headers.get("x-ratelimit-remaining"));
  const reset = num(headers.get("x-ratelimit-reset"));
  const waitUntil = retryAfterAt(headers.get("retry-after"), now);
  if (limit !== null) budget.limit = limit;
  if (remaining !== null) budget.remaining = remaining;
  if (reset !== null) budget.resetAt = reset * 1000;
  if (waitUntil !== null) budget.waitUntil = waitUntil;
  if (limit !== null || remaining !== null || waitUntil !== null) {
    budget.observedAt = now;
  }
}

/**
 * Whether the last response already told us not to ask yet.
 *
 * Spending a request to be told the same thing again is the one thing a caller
 * that has been rate-limited must not do, and it is what makes a limit into a
 * block.
 */
export function githubHold(now: number): { until: number; why: string } | null {
  if (budget.waitUntil !== null && budget.waitUntil > now) {
    return { until: budget.waitUntil, why: "GitHub asked us to wait" };
  }
  if (
    budget.remaining !== null &&
    budget.remaining <= 0 &&
    budget.resetAt !== null &&
    budget.resetAt > now
  ) {
    return {
      until: budget.resetAt,
      why: `GitHub's hourly limit is spent (0 of ${budget.limit ?? GITHUB_KEYLESS_LIMIT})`,
    };
  }
  return null;
}

function limitError(
  response: { status: number; headers: HeaderBag },
  now: number,
): Error {
  const throttled = response.status === 403 || response.status === 429;
  const waitUntil = retryAfterAt(response.headers.get("retry-after"), now);
  if (throttled && waitUntil !== null) {
    return new Error(
      `GitHub asked us to slow down until ${whenLocal(waitUntil)}; nothing was retried.`,
    );
  }
  if (throttled && num(response.headers.get("x-ratelimit-remaining")) === 0) {
    const reset = num(response.headers.get("x-ratelimit-reset"));
    const when =
      reset !== null
        ? whenLocal(reset * 1000)
        : "the reset time GitHub reports";
    return new Error(
      `GitHub rate limit reached; try after ${when}. Nothing was retried.`,
    );
  }
  if (response.status === 401) {
    return new Error(
      "GitHub rejected the token in TALENTOS_GITHUB_TOKEN. Clear it to fall back to the keyless limit of 60 requests an hour.",
    );
  }
  return new Error(`GitHub answered HTTP ${response.status}.`);
}

export interface GithubClientOptions {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export function createGithubClient(
  fetchImpl: DeclaredFetch = fetch as unknown as DeclaredFetch,
  options: GithubClientOptions = {},
): DeclaredClient {
  const mode = resolveGithubMode();
  const now = options.now ?? (() => Date.now());
  const sleep =
    options.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  async function ask(url: string, headers: Record<string, string>) {
    const wait = nextAllowedAt - now();
    if (wait > 0) await sleep(wait);
    nextAllowedAt = now() + GITHUB_MIN_INTERVAL_MS;
    const response = await fetchImpl(url, { headers });
    noteHeaders(response.headers, now());
    return response;
  }

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

      const held = githubHold(now());
      if (held) {
        throw new Error(
          `${held.why}. Nothing was sent; try after ${whenLocal(held.until)}.`,
        );
      }

      const token = process.env.TALENTOS_GITHUB_TOKEN?.trim();
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": USER_AGENT,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const userResponse = await ask(buildGithubUserUrl(login), headers);
      if (userResponse.status === 404) return [];
      if (!userResponse.ok) throw limitError(userResponse, now());
      const user = (await userResponse.json()) as GithubUser;

      const socialResponse = await ask(
        buildGithubSocialAccountsUrl(login),
        headers,
      );
      // A refused second request is not "this person listed nothing". Reading
      // it as an empty list shows the website off their profile and silently
      // drops every social account they added — a wrong answer that looks
      // like a complete one, and the exact shape a rate limit produces
      // half-way through a person.
      if (socialResponse.status === 404) return mapGithubLinks(user, [], login);
      if (!socialResponse.ok) throw limitError(socialResponse, now());
      const social = (await socialResponse.json()) as GithubSocialAccount[];

      return mapGithubLinks(user, Array.isArray(social) ? social : [], login);
    },
  };
}
