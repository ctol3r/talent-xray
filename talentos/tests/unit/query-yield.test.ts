/**
 * Wave A acceptance: the yield ledger credits a stored string only with
 * runs and explicit saves that used its text verbatim, rolls up per search
 * and per normalized role title, and `generateSearchStrings` never persists
 * two rows with the same normalized text or an unflagged over-budget
 * Google string.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import {
  normalizeQueryKey,
  termBudgetFor,
} from "@/lib/domain/query-normalization";
import {
  createSearchProject,
  saveJobDescription,
} from "@/lib/services/search-projects";
import { saveDiscoveryResult } from "@/lib/services/discovery";
import { generateSearchStrings } from "@/lib/services/generation";
import {
  queryYieldForProject,
  recordQueryRun,
  roleTitleYield,
} from "@/lib/services/query-yield";
import { listQueries, upsertQuery } from "@/lib/services/workflow";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

let db: Db;
let sqlite: Database.Database;
let dir: string;
let projectId: string;

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-yield-"));
  sqlite = new Database(path.join(dir, "test.db"));
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema }) as unknown as Db;
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
  const project = await createSearchProject(db, {
    name: "Yield test",
    roleTitle: "Senior Research Engineer",
  });
  projectId = project.id;
});

afterAll(() => {
  sqlite.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("yield ledger", () => {
  let queryId: string;

  it("credits a verbatim run and its explicit save to the stored string", async () => {
    const query = await upsertQuery(db, {
      searchProjectId: projectId,
      platform: "Google (LinkedIn x-ray)",
      query: '"Research Engineer" alignment site:linkedin.com/in',
      breadth: "narrow",
    });
    queryId = query.id;
    await recordQueryRun(db, {
      searchProjectId: projectId,
      queryId,
      queryText: query.query,
      engine: "core",
      resultCount: 3,
    });
    await saveDiscoveryResult(db, {
      searchProjectId: projectId,
      url: "https://example.invalid/mock/core/1",
      title: "[Mock] Result 1",
      provider: "mock-discovery",
      engine: "core",
      query: query.query,
      providerRank: 1,
      candidateName: "Mock Person",
      queryId,
    });
    const y = await queryYieldForProject(db, projectId);
    expect(y.byQuery.get(queryId)).toMatchObject({
      runs: 1,
      savedUrls: 1,
      candidates: 1,
      lastResultCount: 3,
    });
    expect(y.totals).toEqual({ runs: 1, savedUrls: 1, candidates: 1 });
    expect(y.zeroYield).toEqual([]);
  });

  it("records an edited run but never credits the stored string with its save", async () => {
    const run = await recordQueryRun(db, {
      searchProjectId: projectId,
      queryId,
      queryText:
        '"Research Engineer" alignment interpretability site:linkedin.com/in',
      edited: true,
      engine: "core",
      resultCount: 2,
    });
    expect(run.queryId).toBeNull();
    await saveDiscoveryResult(db, {
      searchProjectId: projectId,
      url: "https://example.invalid/mock/core/2",
      provider: "mock-discovery",
      engine: "core",
      query: run.queryText,
      providerRank: 2,
      // No queryId: the panel withholds it for edited runs.
    });
    const y = await queryYieldForProject(db, projectId);
    expect(y.byQuery.get(queryId)?.runs).toBe(1);
    expect(y.byQuery.get(queryId)?.savedUrls).toBe(1);
    expect(y.totals.runs).toBe(2);
    expect(y.totals.savedUrls).toBe(2);
  });

  it("lists strings that ran without a save as zero-yield", async () => {
    const q = await upsertQuery(db, {
      searchProjectId: projectId,
      platform: "Google (open web)",
      query: '"Research Engineer" alignment',
      breadth: "broad",
    });
    await recordQueryRun(db, {
      searchProjectId: projectId,
      queryId: q.id,
      queryText: q.query,
      engine: "reach",
      resultCount: 0,
    });
    const y = await queryYieldForProject(db, projectId);
    expect(y.zeroYield).toEqual([q.id]);
  });

  it("rolls up by normalized role title only across other searches", async () => {
    expect(await roleTitleYield(db, projectId)).toBeNull();
    const sibling = await createSearchProject(db, {
      name: "Sibling",
      roleTitle: "Research Engineer",
    });
    const rollup = await roleTitleYield(db, sibling.id);
    expect(rollup).not.toBeNull();
    expect(rollup?.searches).toBe(1);
    expect(rollup?.rows[0]).toMatchObject({
      platform: "Google (LinkedIn x-ray)",
      breadth: "narrow",
      runs: 1,
      savedUrls: 1,
      candidates: 1,
    });
    const unrelated = await createSearchProject(db, {
      name: "Unrelated",
      roleTitle: "Research Scientist",
    });
    expect(await roleTitleYield(db, unrelated.id)).toBeNull();
  });
});

describe("generateSearchStrings with normalization", () => {
  it("persists no duplicate normalized keys and flags every over-budget Google row", async () => {
    const project = await createSearchProject(db, {
      name: "Strings",
      roleTitle: "Research Scientist",
      industry: "AI safety research",
    });
    await saveJobDescription(db, {
      searchProjectId: project.id,
      rawText:
        "Research scientist working on alignment, interpretability and evaluation of large language models.",
      source: "pasted",
    });
    const result = await generateSearchStrings(db, project.id);
    expect(result.added).toBeGreaterThan(0);
    const rows = await listQueries(db, project.id);
    const keys = rows.map((r) => normalizeQueryKey(r.query));
    expect(new Set(keys).size).toBe(keys.length);
    for (const row of rows) {
      const budget = termBudgetFor(row.platform);
      expect(row.qaMeta).not.toBeNull();
      if (budget !== null && (row.qaMeta?.termCount ?? 0) > budget) {
        expect(row.qaMeta?.notes.some((n) => n.code === "budget_split")).toBe(
          true,
        );
      }
    }
    // A regenerate never re-adds the same strings.
    const again = await generateSearchStrings(db, project.id);
    expect(again.added).toBe(0);
  });
});
