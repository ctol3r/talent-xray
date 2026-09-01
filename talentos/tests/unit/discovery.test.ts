/**
 * W8 acceptance: the google-cse provider builds correct requests, maps
 * results, and never persists anything by itself; saving is explicit and
 * can create a candidate.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import {
  buildCseUrl,
  createGoogleCseProvider,
  mapCseItems,
} from "@/lib/research/google-cse";
import { candidateNameFromTitle } from "@/lib/domain/discovery";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

describe("google-cse provider", () => {
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

  it("maps items to ResearchResults with provenance", () => {
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
      source: "google-cse:reach",
      query: "the query",
    });
    expect(results[0].retrievedAt).toBeTruthy();
  });

  it("reports unconfigured without a key and never calls fetch", async () => {
    delete process.env.TALENTOS_GOOGLE_CSE_KEY;
    let called = 0;
    const provider = createGoogleCseProvider(async () => {
      called += 1;
      return { ok: true, status: 200, json: async () => ({}) };
    });
    expect(provider.configured).toBe(false);
    await expect(provider.search("x")).rejects.toThrow(/not configured/);
    expect(called).toBe(0);
  });

  it("surfaces API errors with status and message", async () => {
    process.env.TALENTOS_GOOGLE_CSE_KEY = "k";
    const provider = createGoogleCseProvider(async () => ({
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

  it("saves one result explicitly, optionally as a candidate", async () => {
    const { saveDiscoveryResult, listSavedSources } =
      await import("@/lib/services/discovery");
    const { saved, candidateId } = await saveDiscoveryResult(db, {
      searchProjectId: projectId,
      url: "https://example.com/profile",
      title: "Sample Person - Profile",
      snippet: "A snippet the recruiter chose to save.",
      source: "google-cse:core",
      query: "test query",
      candidateName: "Sample Person",
    });
    expect(saved.url).toBe("https://example.com/profile");
    expect(candidateId).toBeTruthy();
    const sources = await listSavedSources(db, projectId);
    expect(sources).toHaveLength(1);

    const { getCandidate, getCandidateSources } =
      await import("@/lib/services/candidates");
    const candidate = await getCandidate(db, candidateId as string);
    expect(candidate?.name).toBe("Sample Person");
    const candidateSources = await getCandidateSources(
      db,
      candidateId as string,
    );
    expect(candidateSources.map((s) => s.url)).toContain(
      "https://example.com/profile",
    );
  });
});
