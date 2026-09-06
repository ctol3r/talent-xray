/**
 * Wave D acceptance at the service layer: preview writes nothing; commit
 * creates candidates with a visible source label, skips nothing on its own,
 * never merges, never writes resume_text or a document version, keeps
 * vendor contact data only on opt-in and only as unverified evidence, and
 * rejects a payload that carries a blocked key.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { createCandidate, listCandidates } from "@/lib/services/candidates";
import { commitImport, previewImport } from "@/lib/services/imports";
import { createSearchProject } from "@/lib/services/search-projects";
import { HEARTBEAT_CSV, HIREEZ_CSV } from "../fixtures/import-fixtures";

let sqlite: Database.Database, db: Db, projectId: string;
beforeEach(async () => {
  sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: resolve("drizzle") });
  projectId = (
    await createSearchProject(db, {
      name: "Import fixture",
      roleTitle: "Engineer",
    })
  ).id;
});
afterEach(() => sqlite.close());

describe("previewImport", () => {
  it("writes nothing and detects the source", async () => {
    const preview = await previewImport(db, {
      searchProjectId: projectId,
      filename: "hireez.csv",
      text: HIREEZ_CSV,
    });
    expect(preview.rows.length).toBe(4);
    expect(await listCandidates(db, projectId)).toHaveLength(0);
    expect(db.select().from(schema.tasks).all()).toHaveLength(0);
  });
});

describe("commitImport", () => {
  it("creates candidates with the import source label and no CV material", async () => {
    const preview = await previewImport(db, {
      searchProjectId: projectId,
      filename: "hireez.csv",
      text: HIREEZ_CSV,
      source: "hireez",
    });
    const rows = preview.rows
      .filter((r) => r.decision !== "skip")
      .map((r) => r.row);
    const result = await commitImport(db, {
      searchProjectId: projectId,
      source: "hireez",
      filename: "hireez.csv",
      rows,
    });
    expect(result.created).toHaveLength(3);
    const candidates = await listCandidates(db, projectId);
    expect(candidates).toHaveLength(3);
    for (const c of candidates) {
      expect(c.resumeText).toBeNull();
      expect(c.recruiterNotes).toMatch(/Imported from hireEZ file hireez.csv/);
    }
    const sources = db.select().from(schema.candidateSources).all();
    expect(sources.every((s) => s.addedVia === "import:hireez")).toBe(true);
    expect(sources[0].label).toBe("hireEZ export");
    expect(db.select().from(schema.documentVersions).all()).toHaveLength(0);
    expect(db.select().from(schema.candidateSourceEvidence).all()).toHaveLength(
      0,
    );
    const ada = candidates.find((c) => c.name === "Ada Example")!;
    expect(ada.profile.skills).toEqual(["Rust", "Go", "Kubernetes"]);
  });

  it("keeps vendor contact fields only on opt-in, as unverified imported evidence", async () => {
    const preview = await previewImport(db, {
      searchProjectId: projectId,
      filename: "hireez.csv",
      text: HIREEZ_CSV,
      source: "hireez",
    });
    await commitImport(db, {
      searchProjectId: projectId,
      source: "hireez",
      filename: "hireez.csv",
      keepContactData: true,
      rows: [preview.rows[0].row],
    });
    const evidence = db.select().from(schema.candidateSourceEvidence).all();
    expect(evidence).toHaveLength(2);
    for (const e of evidence) {
      expect(e.provenance).toBe("imported");
      expect(e.verificationStatus).toBe("unverified");
      expect(e.sourceType).toBe("vendor_contact");
    }
  });

  it("creates a separate record plus an identity-review task for a lookalike, never a merge", async () => {
    await createCandidate(db, {
      searchProjectId: projectId,
      name: "Ben Sample",
      currentCompany: "Other Corp",
    });
    const preview = await previewImport(db, {
      searchProjectId: projectId,
      filename: "hireez.csv",
      text: HIREEZ_CSV,
      source: "hireez",
    });
    const ben = preview.rows.find((r) => r.row.name === "Ben Sample")!;
    expect(ben.decision).toBe("create_flagged");
    const result = await commitImport(db, {
      searchProjectId: projectId,
      source: "hireez",
      filename: "hireez.csv",
      rows: [ben.row],
    });
    expect(result.flagged).toHaveLength(1);
    expect(await listCandidates(db, projectId)).toHaveLength(2);
    const task = db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.kind, "identity_review"))
      .get();
    expect(task?.title).toMatch(
      /Identity review: "Ben Sample" may be "Ben Sample"/,
    );
  });

  it("adds a registry link-out for a Heartbeat NPI", async () => {
    const preview = await previewImport(db, {
      searchProjectId: projectId,
      filename: "heartbeat.csv",
      text: HEARTBEAT_CSV,
    });
    expect(preview.source).toBe("heartbeat");
    await commitImport(db, {
      searchProjectId: projectId,
      source: "heartbeat",
      filename: "heartbeat.csv",
      rows: preview.rows.map((r) => r.row),
    });
    const registry = db
      .select()
      .from(schema.candidateSources)
      .all()
      .filter((s) => s.sourceType === "registry");
    expect(registry).toHaveLength(1);
    expect(registry[0].url).toMatch(
      /^https:\/\/npiregistry\.cms\.hhs\.gov\/provider-view\/1234567893$/,
    );
    expect(registry[0].label).toMatch(/unverified/);
  });

  it("rejects a payload that carries a blocked key", async () => {
    await expect(
      commitImport(db, {
        searchProjectId: projectId,
        source: "generic_ats",
        filename: "x.csv",
        rows: [{ name: "Zed", nationality: "x" } as never],
      }),
    ).rejects.toThrow(/blocked field/);
    expect(await listCandidates(db, projectId)).toHaveLength(0);
  });
});
