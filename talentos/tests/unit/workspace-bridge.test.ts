/**
 * The bridge between the two shells, tested as a round trip.
 *
 * The claim is not "the export produces JSON" — it is that a desk exported
 * from the app arrives intact in the portable build's own store. So the test
 * exports from a real database and imports into a store that behaves like the
 * real one, then asserts on what the portable build would read back.
 *
 * The suppression case is the one worth being loud about: an address somebody
 * objected to must not survive a trip through a file.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import { candidateSources, profileSuppressions } from "@/lib/db/schema";
import { normUrl } from "@/lib/domain/identity";
import { createCandidate } from "@/lib/services/candidates";
import { createSearchProject } from "@/lib/services/search-projects";
import { exportWorkspace } from "@/lib/services/workspace-export";
import {
  BundleShapeError,
  WORKSPACE_BUNDLE_KIND,
  WORKSPACE_BUNDLE_VERSION,
  bundleFilename,
  countBundle,
  readBundle,
} from "@/lib/core/workspace-bundle";
import {
  describeOutcome,
  importWorkspace,
  type WorkspaceStore,
} from "../../artifact-src/core/workspace-import";
import type { SearchFacts } from "../../artifact-src/core/search-context";
import type { StoredCandidate } from "../../artifact-src/core/store";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

/** Structurally the real store, kept in memory so the assertions can read it. */
function fakeStore(seed: SearchFacts[] = []): WorkspaceStore & {
  searches: Map<string, SearchFacts>;
  candidates: Map<string, StoredCandidate[]>;
} {
  const searches = new Map(seed.map((s) => [s.id, s]));
  const candidates = new Map<string, StoredCandidate[]>();
  return {
    searches,
    candidates,
    listSearches: async () => [...searches.values()],
    saveSearch: async (facts) => {
      searches.set(facts.id, facts);
    },
    saveCandidate: async (searchId, candidate) => {
      candidates.set(searchId, [
        ...(candidates.get(searchId) ?? []).filter(
          (c) => c.id !== candidate.id,
        ),
        candidate,
      ]);
    },
  };
}

let db: Db;
let projectId: string;
let keptId: string;

beforeAll(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-bridge-"));
  const sqlite = new Database(path.join(dir, "test.db"));
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema }) as unknown as Db;
  migrate(db, { migrationsFolder: path.resolve("drizzle") });

  const project = await createSearchProject(db, {
    name: "CAIS — Founding Recruiter",
    roleTitle: "Founding Recruiter",
  });
  projectId = project.id;

  const kept = await createCandidate(db, {
    searchProjectId: projectId,
    name: "Priya Raghunathan",
  });
  keptId = kept.id;

  const objected = "https://example.com/in/objected";
  await db.insert(candidateSources).values([
    { candidateId: keptId, url: "https://github.com/priya" },
    { candidateId: keptId, url: objected },
  ]);
  await db.insert(profileSuppressions).values({
    normalizedValue: normUrl(objected),
    candidateId: keptId,
    reason: "objection",
  });
});

describe("the bundle contract", () => {
  it("refuses a file that is not ours, by name rather than by stack trace", () => {
    expect(() => readBundle({ some: "other json" })).toThrow(BundleShapeError);
    expect(() => readBundle({ some: "other json" })).toThrow(
      /not a TalentOS workspace file/,
    );
  });

  it("names the field that was wrong", () => {
    expect(() =>
      readBundle({
        kind: WORKSPACE_BUNDLE_KIND,
        version: WORKSPACE_BUNDLE_VERSION,
        exportedAt: "2026-09-09T00:00:00.000Z",
        storeVersion: 2,
        searches: { s1: { facts: { id: "s1" } } },
      }),
    ).toThrow(/searches\.s1\.facts\.roleTitle/);
  });

  it("stamps a filename that says when it was taken", () => {
    expect(bundleFilename("2026-09-09T07:49:37.000Z")).toBe(
      "talentos-workspace-2026-09-09T07-49-37-000.json",
    );
  });
});

describe("export", () => {
  it("carries the desk", async () => {
    const { bundle } = await exportWorkspace(db);
    const counts = countBundle(bundle);
    expect(counts.searches).toBe(1);
    expect(counts.candidates).toBe(1);
    expect(bundle.searches[projectId].facts.roleTitle).toBe(
      "Founding Recruiter",
    );
    // Never mistakeable for the build's own bundled demo.
    expect(bundle.searches[projectId].facts.example).toBe(false);
  });

  it("leaves out an address the person objected to, and says how many", async () => {
    const { bundle, suppressedAddresses } = await exportWorkspace(db);
    const urls = bundle.searches[projectId].candidates[keptId].profileUrls;
    expect(urls).toEqual(["https://github.com/priya"]);
    expect(urls).not.toContain("https://example.com/in/objected");
    expect(suppressedAddresses).toBe(1);
  });

  it("survives its own validator", async () => {
    const { bundle } = await exportWorkspace(db);
    expect(() => readBundle(JSON.parse(JSON.stringify(bundle)))).not.toThrow();
  });
});

describe("import", () => {
  it("lands the exported desk in the portable store", async () => {
    const { bundle } = await exportWorkspace(db);
    const store = fakeStore();
    const outcome = await importWorkspace(bundle, store);

    expect(outcome.searches).toBe(1);
    expect(outcome.candidates).toBe(1);
    expect(outcome.replaced).toBe(0);
    expect(store.searches.get(projectId)?.roleTitle).toBe("Founding Recruiter");
    expect(store.candidates.get(projectId)?.[0].name).toBe("Priya Raghunathan");
  });

  it("merges rather than replacing — a job only the phone knows about stays", async () => {
    const { bundle } = await exportWorkspace(db);
    const local: SearchFacts = {
      id: "only-here",
      roleTitle: "Written on the train",
    };
    const store = fakeStore([local]);
    await importWorkspace(bundle, store);
    expect(store.searches.get("only-here")).toEqual(local);
    expect(store.searches.size).toBe(2);
  });

  it("counts a second import as replaced, not as new", async () => {
    const { bundle } = await exportWorkspace(db);
    const store = fakeStore();
    await importWorkspace(bundle, store);
    const second = await importWorkspace(bundle, store);
    expect(second.replaced).toBe(1);
    expect(store.searches.size).toBe(1);
  });

  it("trusts the key over a disagreeing id, so nothing is written unfindable", async () => {
    const { bundle } = await exportWorkspace(db);
    const moved = {
      ...bundle,
      searches: {
        "the-key": {
          ...bundle.searches[projectId],
          facts: { ...bundle.searches[projectId].facts, id: "a-different-id" },
        },
      },
    };
    const store = fakeStore();
    await importWorkspace(moved, store);
    expect(store.searches.has("the-key")).toBe(true);
    expect(store.searches.get("the-key")?.id).toBe("the-key");
  });

  it("says what it did in one readable sentence", () => {
    expect(
      describeOutcome({
        searches: 10,
        candidates: 1,
        replaced: 2,
        exportedAt: "x",
      }),
    ).toBe("Imported 10 jobs and 1 person — 2 already here, overwritten.");
  });
});
