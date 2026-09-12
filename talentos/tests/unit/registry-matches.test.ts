/**
 * Wave E acceptance at the service layer: a search never writes; confirm
 * persists one human-attributed row per candidate and registry and
 * replaces on re-confirm; clear removes; delete cascades; export includes
 * the match; prefill reads name, state and an imported NPI link-out.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { createNppesClient } from "@/lib/registries/nppes";
import {
  createCandidate,
  deleteCandidate,
  exportCandidate,
} from "@/lib/services/candidates";
import {
  clearRegistryMatch,
  confirmRegistryMatch,
  getRegistryMatch,
  prefillFromCandidate,
  searchNppesForCandidate,
} from "@/lib/services/registries";
import { createSearchProject } from "@/lib/services/search-projects";
import { NPPES_SEARCH_PAYLOAD } from "../fixtures/nppes-fixtures";

let sqlite: Database.Database, db: Db, projectId: string, candidateId: string;
beforeEach(async () => {
  process.env.TALENTOS_REGISTRY_NPPES = "1";
  sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: resolve("drizzle") });
  projectId = (
    await createSearchProject(db, {
      name: "Registry fixture",
      roleTitle: "Physician",
    })
  ).id;
  candidateId = (
    await createCandidate(db, {
      searchProjectId: projectId,
      name: "Dr Priya Patel",
      geography: "Austin, TX",
    })
  ).id;
});
afterEach(() => {
  sqlite.close();
  delete process.env.TALENTOS_REGISTRY_NPPES;
});

const liveClient = () =>
  createNppesClient(async () => ({
    ok: true,
    status: 200,
    json: async () => NPPES_SEARCH_PAYLOAD,
  }));

describe("prefill", () => {
  it("splits the name, reads the state and picks up an imported NPI link-out", async () => {
    expect(
      prefillFromCandidate(
        { name: "Dr Priya Patel", geography: "Austin, TX" },
        [],
      ),
    ).toEqual({
      firstName: "Priya",
      lastName: "Patel",
      state: "TX",
      npi: undefined,
    });
    expect(
      prefillFromCandidate({ name: "Priya Patel" }, [
        { url: "https://npiregistry.cms.hhs.gov/provider-view/1234567893" },
      ]).npi,
    ).toBe("1234567893");
  });
});

describe("search", () => {
  it("returns API order with a match strength and writes nothing", async () => {
    const hits = await searchNppesForCandidate(
      db,
      { candidateId, firstName: "Priya", lastName: "Patel" },
      liveClient(),
    );
    expect(hits.map((h) => h.record.number)).toEqual([
      "1234567893",
      "1987654321",
    ]);
    expect(hits[0].match?.strength).toBe("same_name_same_location");
    expect(hits[1].match?.strength).toBe("similar_name");
    expect("score" in hits[0]).toBe(false);
    expect(
      db.select().from(schema.candidateRegistryMatches).all(),
    ).toHaveLength(0);
  });
});

describe("confirm / clear / delete / export", () => {
  it("persists one human-attributed row, replaces on re-confirm, clears, cascades and exports", async () => {
    const [first, second] = await searchNppesForCandidate(
      db,
      { candidateId, lastName: "Patel" },
      liveClient(),
    );
    await confirmRegistryMatch(db, {
      candidateId,
      record: first.record,
      matchStrength: first.match?.strength,
    });
    let row = await getRegistryMatch(db, candidateId);
    expect(row).toMatchObject({
      registryId: "1234567893",
      matchedBy: "local-owner",
      registry: "nppes",
    });
    const sources = db.select().from(schema.candidateSources).all();
    expect(
      sources.some(
        (s) =>
          s.url.endsWith("/provider-view/1234567893") &&
          s.addedVia === "registry_match",
      ),
    ).toBe(true);

    await confirmRegistryMatch(db, { candidateId, record: second.record });
    row = await getRegistryMatch(db, candidateId);
    expect(row?.registryId).toBe("1987654321");
    expect(
      db.select().from(schema.candidateRegistryMatches).all(),
    ).toHaveLength(1);

    const exported = await exportCandidate(db, candidateId);
    expect(exported.registryMatches).toHaveLength(1);

    await clearRegistryMatch(db, candidateId);
    expect(await getRegistryMatch(db, candidateId)).toBeUndefined();

    await confirmRegistryMatch(db, { candidateId, record: first.record });
    await deleteCandidate(db, candidateId);
    expect(
      db.select().from(schema.candidateRegistryMatches).all(),
    ).toHaveLength(0);
  });

  it("rejects a record that fails the allow-listed schema", async () => {
    await expect(
      confirmRegistryMatch(db, {
        candidateId,
        record: {
          number: "12",
          firstName: "x",
          lastName: "y",
          taxonomies: [],
        } as never,
      }),
    ).rejects.toThrow();
  });
});
