/**
 * W8 acceptance (corrected per D-010): the Talent X-Ray candidate-discovery
 * provider builds correct requests, maps results with providerRank (never a
 * synthetic relevance score), and never persists anything by itself; saving
 * is explicit, and a saved snippet becomes unverified source evidence —
 * never resumeText. The general ResearchProvider is a separate boundary.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import {
  buildCseUrl,
  buildHostedEngineUrl,
  createTalentXRayDiscoveryProvider,
  hostedEngineIds,
  mapCseItems,
} from "@/lib/research/talent-xray";
import { getCandidateDiscoveryProvider } from "@/lib/research/discovery-provider";
import { getResearchProvider } from "@/lib/research/provider";
import {
  buildHostedSearchUrl,
  candidateNameFromTitle,
  isHttpUrl,
  parseSaveLines,
} from "@/lib/domain/discovery";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

describe("provider boundary (D-010)", () => {
  it("never returns the people-only engines as the general research provider", () => {
    process.env.TALENTOS_RESEARCH_PROVIDER = "google-cse"; // legacy value
    const research = getResearchProvider();
    expect(research.name).toBe("none");
    expect(research.configured).toBe(false);
    delete process.env.TALENTOS_RESEARCH_PROVIDER;
  });

  it("defaults candidate discovery to the talent-xray provider", () => {
    const discovery = getCandidateDiscoveryProvider();
    expect(discovery.name).toBe("talent-xray");
  });
});

describe("talent-xray candidate-discovery provider", () => {
  it("builds the JSON API url with the live engine ids", () => {
    const url = new URL(
      buildCseUrl("test-key", "core", 'site:linkedin.com/in "ml"', 10),
    );
    expect(url.origin + url.pathname).toBe(
      "https://www.googleapis.com/customsearch/v1",
    );
    expect(url.searchParams.get("cx")).toBe("a157d37906e1141cc");
    expect(url.searchParams.get("q")).toBe('site:linkedin.com/in "ml"');
    expect(url.searchParams.get("num")).toBe("10");
    const reach = new URL(buildCseUrl("test-key", "reach", "x", 25));
    expect(reach.searchParams.get("cx")).toBe("918bc00e18d0c46e5");
    expect(reach.searchParams.get("num")).toBe("10"); // clamped to API max
  });

  it("maps items with providerRank and no synthetic relevance", () => {
    const results = mapCseItems(
      {
        items: [
          {
            link: "https://example.com/p1",
            title: "A — Profile",
            snippet: "s1",
          },
          { title: "no link, dropped" },
          { link: "https://example.com/p2" },
        ],
      },
      "the query",
      "reach",
    );
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      url: "https://example.com/p1",
      provider: "talent-xray",
      engine: "reach",
      query: "the query",
      providerRank: 1,
    });
    expect(results[1].providerRank).toBe(2);
    expect(results[0].retrievedAt).toBeTruthy();
    // Result position is preserved as rank; never dressed up as a score.
    expect("relevance" in results[0]).toBe(false);
  });

  it("reports unconfigured without a key and never calls fetch", async () => {
    delete process.env.TALENTOS_GOOGLE_CSE_KEY;
    let called = 0;
    const provider = createTalentXRayDiscoveryProvider(async () => {
      called += 1;
      return { ok: true, status: 200, json: async () => ({}) };
    });
    expect(provider.configured).toBe(false);
    await expect(provider.search("x")).rejects.toThrow(/not configured/);
    expect(called).toBe(0);
  });

  it("surfaces API errors with status and message", async () => {
    process.env.TALENTOS_GOOGLE_CSE_KEY = "k";
    const provider = createTalentXRayDiscoveryProvider(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: { message: "Quota exceeded" } }),
    }));
    await expect(provider.search("x")).rejects.toThrow(/429.*Quota exceeded/);
    delete process.env.TALENTOS_GOOGLE_CSE_KEY;
  });

  it("prefills candidate names from result titles", () => {
    expect(
      candidateNameFromTitle("Jane Doe - Research Scientist | LinkedIn"),
    ).toBe("Jane Doe");
    expect(candidateNameFromTitle("John Q. Public – CV")).toBe(
      "John Q. Public",
    );
    expect(candidateNameFromTitle(undefined)).toBe("");
  });
});

describe("link-out discovery (D-034)", () => {
  const query =
    '("Founding Recruiter" OR "First Recruiter") recruiting -"recruiter job" (site:linkedin.com/in OR site:linkedin.com/pub)';

  it("builds the hosted results page url per engine with the string verbatim", () => {
    const core = new URL(buildHostedEngineUrl("core", query));
    expect(core.origin + core.pathname).toBe("https://cse.google.com/cse");
    expect(core.searchParams.get("cx")).toBe("a157d37906e1141cc");
    expect(core.searchParams.get("q")).toBe(query);
    const reach = new URL(buildHostedEngineUrl("reach", query));
    expect(reach.searchParams.get("cx")).toBe("918bc00e18d0c46e5");
    // No key, ever, on the link-out path.
    expect(core.searchParams.has("key")).toBe(false);
    expect(buildHostedSearchUrl("abc", "x y")).toBe(
      "https://cse.google.com/cse?cx=abc&q=x+y",
    );
  });

  it("honours the engine id overrides", () => {
    process.env.TALENTOS_CSE_REACH_CX = "override-reach";
    expect(hostedEngineIds().reach).toBe("override-reach");
    expect(hostedEngineIds().core).toBe("a157d37906e1141cc");
    delete process.env.TALENTOS_CSE_REACH_CX;
  });

  it("parses pasted save lines: names, blanks, duplicates, rejects", () => {
    const { saves, rejected } = parseSaveLines(
      [
        "https://www.linkedin.com/in/jane-doe | Jane Doe",
        "",
        "https://github.com/janedoe",
        "http://www.linkedin.com/in/jane-doe/",
        "javascript:alert(1)",
        "linkedin.com/in/no-scheme",
        "https://x.com/janedoe | ",
      ].join("\n"),
    );
    expect(saves).toEqual([
      {
        url: "https://www.linkedin.com/in/jane-doe",
        candidateName: "Jane Doe",
      },
      { url: "https://github.com/janedoe" },
      { url: "https://x.com/janedoe" },
    ]);
    expect(rejected).toEqual([
      "javascript:alert(1)",
      "linkedin.com/in/no-scheme",
    ]);
    expect(isHttpUrl("https://user:pw@example.com/")).toBe(false);
    expect(isHttpUrl("https://example.com/a b")).toBe(false);
  });
});

describe("explicit save flow", () => {
  let db: Db;
  let tmpDir: string;
  let projectId: string;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-discovery-"));
    process.env.TALENTOS_DATABASE_PATH = path.join(tmpDir, "d.db");
    globalThis.__talentosDb = undefined;
    const { getDb } = await import("@/lib/db/client");
    db = getDb();
    const { createSearchProject } =
      await import("@/lib/services/search-projects");
    const project = await createSearchProject(db, {
      name: "Discovery test",
      roleTitle: "Test Role",
    });
    projectId = project.id;
  });

  afterAll(() => {
    globalThis.__talentosDb = undefined;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saves one result explicitly; the snippet becomes unverified source evidence, never resumeText", async () => {
    const {
      saveDiscoveryResult,
      listSavedSources,
      listCandidateSourceEvidence,
    } = await import("@/lib/services/discovery");
    const { saved, candidateId } = await saveDiscoveryResult(db, {
      searchProjectId: projectId,
      url: "https://example.com/profile",
      title: "Sample Person - Profile",
      snippet: "A snippet the recruiter chose to save.",
      provider: "talent-xray",
      engine: "core",
      query: "test query",
      providerRank: 3,
      candidateName: "Sample Person",
    });
    expect(saved.url).toBe("https://example.com/profile");
    expect(candidateId).toBeTruthy();
    const sources = await listSavedSources(db, projectId);
    expect(sources).toHaveLength(1);
    expect(sources[0].source).toBe("talent-xray:core");

    const { getCandidate, getCandidateSources } =
      await import("@/lib/services/candidates");
    const candidate = await getCandidate(db, candidateId as string);
    expect(candidate?.name).toBe("Sample Person");
    // The correction that matters: the snippet must NOT masquerade as a resume.
    expect(candidate?.resumeText ?? null).toBeNull();
    const candidateSources = await getCandidateSources(
      db,
      candidateId as string,
    );
    expect(candidateSources.map((s) => s.url)).toContain(
      "https://example.com/profile",
    );
    const evidence = await listCandidateSourceEvidence(
      db,
      candidateId as string,
    );
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      sourceUrl: "https://example.com/profile",
      sourceType: "search_result",
      snippet: "A snippet the recruiter chose to save.",
      provider: "talent-xray",
      providerRank: 3,
      verificationStatus: "unverified",
      provenance: "search_result",
    });
  });

  it("records a link-out run: verbatim runs and saves are credited, edited runs are not", async () => {
    const { recordLinkOutRun } = await import("@/lib/services/discovery");
    const { upsertQuery } = await import("@/lib/services/workflow");
    const { queryYieldForProject } = await import("@/lib/services/query-yield");
    const stored = await upsertQuery(db, {
      searchProjectId: projectId,
      platform: "Google (LinkedIn x-ray)",
      query: '"Founding Recruiter" site:linkedin.com/in',
      breadth: "narrow",
    });
    const verbatim = await recordLinkOutRun(db, {
      searchProjectId: projectId,
      queryId: stored.id,
      queryText: stored.query,
      engine: "core",
      resultCount: 230,
      saves: [
        {
          url: "https://www.linkedin.com/in/linkout-one",
          candidateName: "Linkout One",
        },
        { url: "https://github.com/linkout-two" },
      ],
    });
    expect(verbatim).toMatchObject({ savedUrls: 2, candidatesCreated: 1 });

    const edited = await recordLinkOutRun(db, {
      searchProjectId: projectId,
      queryId: stored.id,
      queryText: `${stored.query} extra`,
      edited: true,
      engine: "reach",
      resultCount: 0,
      saves: [{ url: "https://x.com/linkout-three" }],
    });
    expect(edited.savedUrls).toBe(1);

    const y = await queryYieldForProject(db, projectId);
    const credited = y.byQuery.get(stored.id);
    expect(credited).toMatchObject({
      runs: 1,
      lastResultCount: 230,
      savedUrls: 2,
      candidates: 1,
    });
    expect(y.totals.runs).toBe(2);
    // Saves are labelled by provider and engine, so the ledger counts them
    // exactly as an API save.
    const { listSavedSources } = await import("@/lib/services/discovery");
    const sources = await listSavedSources(db, projectId);
    expect(sources.map((s) => s.source).sort()).toEqual(
      [
        "talent-xray:core",
        "talent-xray:core",
        "talent-xray:core",
        "talent-xray:reach",
      ].sort(),
    );
    await expect(
      recordLinkOutRun(db, {
        searchProjectId: projectId,
        queryText: stored.query,
        engine: "core",
        resultCount: 1,
        saves: [{ url: "not a url" }],
      }),
    ).rejects.toThrow(/complete http/);
  });

  it("verification is a recruiter act, recorded explicitly", async () => {
    const { listCandidateSourceEvidence, setEvidenceVerification } =
      await import("@/lib/services/discovery");
    const { listCandidates } = await import("@/lib/services/candidates");
    const [candidate] = await listCandidates(db, projectId);
    const [evidence] = await listCandidateSourceEvidence(db, candidate.id);
    const updated = await setEvidenceVerification(db, {
      evidenceId: evidence.id,
      verificationStatus: "recruiter_verified",
    });
    expect(updated.verificationStatus).toBe("recruiter_verified");
  });
});
