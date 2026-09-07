/**
 * Wave H acceptance, part 3: the two declared-link adapters.
 *
 * The properties that matter are not "does it parse JSON" but:
 *  - off by default, and zero network calls when off (D-032's rule);
 *  - the mapper picks fields by name, so nothing else a platform returns can
 *    ever leave the module — asserted against a fixture that contains every
 *    field we must not keep;
 *  - a token is sent in a header and never appears in a return value;
 *  - an address on a surface the search has not turned on is never shown as
 *    a URL, and can never be kept from a suggestion at all.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import type { DeclaredFetch } from "@/lib/profiles/declared";
import {
  buildGithubSocialAccountsUrl,
  buildGithubUserUrl,
  createGithubClient,
  githubLoginFromUrl,
  mapGithubLinks,
} from "@/lib/profiles/github";
import {
  buildKeybaseLookupUrl,
  createKeybaseClient,
  keybaseUsernameFromUrl,
  mapKeybaseProofs,
} from "@/lib/profiles/keybase";
import {
  acceptDeclaredLink,
  declaredAccounts,
  readDeclaredLinks,
} from "@/lib/services/declared-links";
import { addProfileLink, listProfileLinks } from "@/lib/services/profile-links";
import { createCandidate } from "@/lib/services/candidates";
import { createSearchProject } from "@/lib/services/search-projects";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

/** Everything GitHub's user endpoint really returns, so the mapper is tested against reality. */
const GITHUB_USER = {
  login: "jrivera-dev",
  id: 1,
  node_id: "MDQ6VXNlcjE=",
  avatar_url: "https://avatars.githubusercontent.com/u/1?v=4",
  gravatar_id: "",
  name: "Jordan Rivera",
  company: "@acme",
  blog: "https://jrivera.dev",
  location: "Austin, TX",
  email: "jordan@example.com",
  hireable: true,
  bio: "Distributed systems. She/her. Dog person.",
  twitter_username: "jrivera",
  public_repos: 42,
  followers: 512,
  following: 12,
  created_at: "2011-01-25T18:44:36Z",
};

const GITHUB_SOCIAL = [
  { provider: "linkedin", url: "https://www.linkedin.com/in/jordan-rivera" },
  { provider: "mastodon", url: "https://mastodon.social/@jrivera" },
  { provider: "instagram", url: "https://www.instagram.com/jrivera" },
  { provider: "generic", url: "mailto:jordan@example.com" },
];

/** Values that must never survive the mapper. */
const FORBIDDEN = [
  "avatars.githubusercontent.com",
  "Jordan Rivera",
  "Austin, TX",
  "jordan@example.com",
  "Distributed systems",
  "She/her",
  "512",
  "@acme",
];

function fetchStub(
  routes: Record<
    string,
    { status: number; body: unknown; headers?: Record<string, string> }
  >,
  calls: string[] = [],
): DeclaredFetch {
  return async (url, init) => {
    calls.push(`${url} ${JSON.stringify(init?.headers ?? {})}`);
    const route = routes[url] ?? { status: 404, body: {} };
    return {
      ok: route.status >= 200 && route.status < 300,
      status: route.status,
      headers: {
        get: (name: string) => route.headers?.[name.toLowerCase()] ?? null,
      },
      json: async () => route.body,
    };
  };
}

describe("github: what may leave the module", () => {
  it("keeps only the addresses the person listed, and drops everything else", () => {
    const links = mapGithubLinks(GITHUB_USER, GITHUB_SOCIAL, "jrivera-dev");
    expect(links.map((l) => l.url)).toEqual([
      "https://jrivera.dev/",
      "https://x.com/jrivera",
      "https://www.linkedin.com/in/jordan-rivera",
      "https://mastodon.social/@jrivera",
      "https://www.instagram.com/jrivera",
    ]);
    // mailto: is not an address of a page, and this app does not touch email.
    expect(links.some((l) => l.url.startsWith("mailto:"))).toBe(false);
    const serialised = JSON.stringify(links);
    for (const value of FORBIDDEN) {
      expect(`${value} in output → ${serialised.includes(value)}`).toBe(
        `${value} in output → false`,
      );
    }
    expect(links.every((l) => l.assertedBy === "github:jrivera-dev")).toBe(
      true,
    );
    expect(links.every((l) => l.reciprocal === false)).toBe(true);
  });

  it("says the X address was built from a handle field, not written by the person", () => {
    const links = mapGithubLinks(GITHUB_USER, [], "jrivera-dev");
    const x = links.find((l) => l.url.includes("x.com"));
    expect(x?.label).toBe("twitter handle field");
  });

  it("reads a login only from a real profile URL", () => {
    expect(githubLoginFromUrl("https://github.com/jrivera-dev")).toBe(
      "jrivera-dev",
    );
    expect(githubLoginFromUrl("https://github.com/acme/repo")).toBeNull();
    expect(githubLoginFromUrl("https://gist.github.com/jrivera")).toBeNull();
    expect(githubLoginFromUrl("https://github.com/orgs")).toBeNull();
    expect(githubLoginFromUrl("https://example.com/jrivera")).toBeNull();
  });
});

describe("github: the client", () => {
  afterEach(() => {
    delete process.env.TALENTOS_PROFILES_GITHUB;
    delete process.env.TALENTOS_GITHUB_TOKEN;
  });

  it("is off by default and makes no request", async () => {
    const calls: string[] = [];
    const client = createGithubClient(fetchStub({}, calls));
    expect(client.configured).toBe(false);
    await expect(client.read("jrivera-dev")).rejects.toThrow(/is off/);
    expect(calls).toEqual([]);
  });

  it("watermarks its mock and still makes no request", async () => {
    process.env.TALENTOS_PROFILES_GITHUB = "mock";
    const calls: string[] = [];
    const links = await createGithubClient(fetchStub({}, calls)).read("jr");
    expect(calls).toEqual([]);
    expect(links.every((l) => l.label?.startsWith("[Mock]"))).toBe(true);
  });

  it("sends the token as a header and never returns it", async () => {
    process.env.TALENTOS_PROFILES_GITHUB = "1";
    process.env.TALENTOS_GITHUB_TOKEN = "ghp_secret_value";
    const calls: string[] = [];
    const links = await createGithubClient(
      fetchStub(
        {
          [buildGithubUserUrl("jrivera-dev")]: {
            status: 200,
            body: GITHUB_USER,
          },
          [buildGithubSocialAccountsUrl("jrivera-dev")]: {
            status: 200,
            body: GITHUB_SOCIAL,
          },
        },
        calls,
      ),
    ).read("jrivera-dev");
    expect(calls.join(" ")).toContain("Bearer ghp_secret_value");
    expect(JSON.stringify(links)).not.toContain("ghp_secret_value");
    expect(links.length).toBeGreaterThan(0);
  });

  it("returns nothing for a missing account and names the reset on a rate limit", async () => {
    process.env.TALENTOS_PROFILES_GITHUB = "1";
    const missing = await createGithubClient(
      fetchStub({
        [buildGithubUserUrl("ghost")]: { status: 404, body: {} },
      }),
    ).read("ghost");
    expect(missing).toEqual([]);

    await expect(
      createGithubClient(
        fetchStub({
          [buildGithubUserUrl("busy")]: {
            status: 403,
            body: {},
            headers: {
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": "1788800000",
            },
          },
        }),
      ).read("busy"),
    ).rejects.toThrow(/rate limit reached; try after/);
  });
});

describe("keybase: proofs are the one reciprocal claim", () => {
  it("keeps proven links and drops broken ones", () => {
    const links = mapKeybaseProofs(
      [
        {
          proof_type: "github",
          service_url: "https://github.com/jrivera-dev",
          state: 1,
        },
        {
          proof_type: "twitter",
          service_url: "https://x.com/jrivera",
          state: 2,
        },
        { proof_type: "dns", service_url: "https://jrivera.dev", state: 1 },
      ],
      "jrivera",
      "2026-09-07T00:00:00.000Z",
    );
    expect(links.map((l) => l.url)).toEqual([
      "https://github.com/jrivera-dev",
      "https://jrivera.dev/",
    ]);
    expect(links.every((l) => l.reciprocal)).toBe(true);
    expect(links[0].assertedAt).toBe("2026-09-07T00:00:00.000Z");
  });

  it("reads a username only from a profile URL, and is off by default", async () => {
    expect(keybaseUsernameFromUrl("https://keybase.io/jrivera")).toBe(
      "jrivera",
    );
    expect(keybaseUsernameFromUrl("https://keybase.io/jrivera/pgp")).toBeNull();
    const calls: string[] = [];
    const client = createKeybaseClient(fetchStub({}, calls));
    expect(client.configured).toBe(false);
    await expect(client.read("jrivera")).rejects.toThrow(/is off/);
    expect(calls).toEqual([]);
    expect(buildKeybaseLookupUrl("jrivera")).toContain("fields=proofs_summary");
  });
});

describe("suggestions, against a database", () => {
  let db: Db;
  let sqlite: Database.Database;
  let dir: string;
  let candidateId: string;
  let projectId: string;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-declared-"));
    sqlite = new Database(path.join(dir, "test.db"));
    sqlite.pragma("foreign_keys = ON");
    db = drizzle(sqlite, { schema }) as unknown as Db;
    migrate(db, { migrationsFolder: path.resolve("drizzle") });
    const project = await createSearchProject(db, {
      name: "Declared links",
      roleTitle: "Staff Engineer",
    });
    projectId = project.id;
    const candidate = await createCandidate(db, {
      searchProjectId: projectId,
      name: "Jordan Rivera",
    });
    candidateId = candidate.id;
    addProfileLink(db, {
      candidateId,
      url: "https://github.com/jrivera-dev",
      addedVia: "manual",
      provenance: "recruiter_added",
    });
  });

  afterAll(() => {
    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("offers to read only the accounts this candidate actually has", () => {
    const accounts = declaredAccounts(db, candidateId);
    expect(accounts.map((a) => `${a.platform}:${a.account}`)).toEqual([
      "github:jrivera-dev",
    ]);
    expect(accounts[0].configured).toBe(false);
  });

  it("never shows an off-family address as a URL, only a count", async () => {
    const accounts = declaredAccounts(db, candidateId);
    const result = await readDeclaredLinks(
      db,
      { candidateId, sourceId: accounts[0].sourceId },
      {
        github: {
          platform: "github",
          configured: true,
          mode: "live",
          read: async () =>
            mapGithubLinks(GITHUB_USER, GITHUB_SOCIAL, "jrivera-dev"),
        },
      },
      () => "2026-09-07T12:00:00.000Z",
    );
    const shown = result.suggestions.map((s) => s.link.url);
    // LinkedIn and the personal site are shown; X (broadcast) and Instagram
    // (personal life) are off for this search, so they are counted, not shown.
    expect(shown).toEqual([
      "https://jrivera.dev/",
      "https://www.linkedin.com/in/jordan-rivera",
    ]);
    expect(result.hiddenCount).toBe(3);
    const serialised = JSON.stringify(result);
    expect(serialised).not.toContain("instagram.com");
    expect(serialised).not.toContain("x.com/jrivera");
    // Nothing was written by reading.
    expect(listProfileLinks(db, candidateId)).toHaveLength(1);
  });

  it("keeps a suggestion as declared, with the origin and the read date", async () => {
    const accounts = declaredAccounts(db, candidateId);
    const result = await readDeclaredLinks(
      db,
      { candidateId, sourceId: accounts[0].sourceId },
      {
        github: {
          platform: "github",
          configured: true,
          mode: "live",
          read: async () =>
            mapGithubLinks(GITHUB_USER, GITHUB_SOCIAL, "jrivera-dev"),
        },
      },
      () => "2026-09-07T12:00:00.000Z",
    );
    const linkedin = result.suggestions.find((s) =>
      s.link.url.includes("linkedin.com"),
    )!;
    acceptDeclaredLink(db, {
      candidateId,
      originSourceId: accounts[0].sourceId,
      retrievedAt: result.retrievedAt,
      link: linkedin.link,
    });
    const rows = listProfileLinks(db, candidateId);
    const kept = rows.find((r) => r.url.includes("linkedin.com"))!;
    expect(kept.badge).toBe("unverified · declared on GitHub");
    expect(kept.provenanceLine).toContain(
      "read from the GitHub API on 2026-09-07",
    );
    expect(kept.originUrl).toBe("https://github.com/jrivera-dev");
  });

  it("refuses to keep a private-surface address even if a client posts one back", async () => {
    const accounts = declaredAccounts(db, candidateId);
    expect(() =>
      acceptDeclaredLink(db, {
        candidateId,
        originSourceId: accounts[0].sourceId,
        retrievedAt: "2026-09-07T12:00:00.000Z",
        link: {
          url: "https://www.instagram.com/jrivera",
          platform: "github",
          assertedBy: "github:jrivera-dev",
          assertedAt: null,
          reciprocal: false,
          label: "instagram",
        },
      }),
    ).toThrow(/only be added by hand/);
  });
});
