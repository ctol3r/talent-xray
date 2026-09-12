import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import { eq } from "drizzle-orm";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type { Db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import * as aiRun from "@/lib/ai/run";
import {
  createSearchProject,
  saveJobDescription,
} from "@/lib/services/search-projects";
import {
  prepareSourceRecommendations,
  previewSourceRecommendations,
  saveSourceRecommendations,
} from "@/lib/services/source-recommendations";
import {
  safeSourceUrl,
  readSourceRecommendationNote,
  type SourceRecommendations,
} from "@/lib/core/source-recommendations";

let db: Db;
let sqlite: Database.Database;
let project: string;
beforeEach(async () => {
  sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
  project = (
    await createSearchProject(db, {
      name: "Source fixture",
      roleTitle: "Software engineer",
      geography: "California",
    })
  ).id;
});
afterEach(() => {
  sqlite.close();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function response(): Promise<SourceRecommendations> {
  const request = await prepareSourceRecommendations(db, project);
  return {
    contextHash: request.contextHash,
    recommendations: [
      {
        id: "community",
        name: "Fixture community",
        kind: "community",
        url: "https://example.org/community",
        audience: "Software engineers",
        geography: "California membership is not established",
        whyRelevant:
          "Technical discussions may help discover engineers; geography needs confirmation.",
        costModel: "unknown",
        priority: "high",
        purpose: "sourcing",
        evidence: [],
        limitation:
          "Synthetic test suggestion; membership and access not checked.",
      },
      {
        id: "board",
        name: "Fixture board",
        kind: "job_board",
        url: "https://example.org/board",
        audience: "People looking for engineering roles",
        geography: "California listings",
        whyRelevant:
          "An opportunity board may reach engineers considering a role change.",
        costModel: "paid",
        priority: "medium",
        purpose: "exposure",
        evidence: [
          {
            url: "https://example.org/pricing",
            excerpt: "Fixture paid listing",
            checkedOn: "2026-01-01",
            dataAsOf: null,
            limitation:
              "Fixture only; actual price and access are not verified.",
          },
        ],
        limitation:
          "No posting or purchase is authorized by saving this venue.",
      },
    ],
    reasoningSummary:
      "Use separate channels for finding people and increasing role exposure.",
    limitations: ["Synthetic fixture; not an exhaustive venue list."],
  };
}
describe("role-specific source research handoff", () => {
  it("prepares keyless role context and preview without persisting any venue or generation", async () => {
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network must not run"));
    vi.stubEnv("TALENTOS_MODEL_PROVIDER", "anthropic");
    const request = await prepareSourceRecommendations(db, project);
    expect(request.data.roleTitle).toBe("Software engineer");
    expect(request.outputSchema).toBeDefined();
    const output = await response();
    const preview = await previewSourceRecommendations(db, project, output);
    expect(preview.recommendations.map((r) => r.purpose)).toEqual([
      "sourcing",
      "exposure",
    ]);
    expect(db.select().from(schema.sourceChannels).all()).toHaveLength(0);
    expect(db.select().from(schema.aiGenerations).all()).toHaveLength(0);
    expect(network).not.toHaveBeenCalled();
  });
  it("saves only explicit selections as unverified suggestions in the existing channel owner", async () => {
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network must not run"));
    vi.stubEnv("TALENTOS_MODEL_PROVIDER", "anthropic");
    const output = await response();
    expect(
      await saveSourceRecommendations(db, project, output, ["board"]),
    ).toEqual({ added: 1, skipped: 0 });
    const saved = db.select().from(schema.sourceChannels).all();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      name: "Fixture board",
      status: "suggested",
      certainty: "inferred",
      verifiedAt: null,
    });
    expect(readSourceRecommendationNote(saved[0].note)).toMatchObject({
      purpose: "exposure",
      contextHash: output.contextHash,
      author: "Imported session response; author unverified",
      researchLimitations: output.limitations,
    });
    expect(db.select().from(schema.aiGenerations).all()[0].model).toMatch(
      /author unverified/,
    );
    expect(network).not.toHaveBeenCalled();
    expect(
      await saveSourceRecommendations(db, project, output, [
        "board",
        "community",
      ]),
    ).toEqual({ added: 1, skipped: 1 });
    expect(db.select().from(schema.sourceChannels).all()).toHaveLength(2);
  });
  it("preserves existing verified or rejected channels when an import repeats their URL", async () => {
    const output = await response();
    db.insert(schema.sourceChannels)
      .values({
        searchProjectId: project,
        name: "Already reviewed",
        kind: "community",
        url: "https://example.org/community/",
        whyRelevant: "Recruiter note",
        priority: "experimental",
        status: "rejected",
        note: "Preserve this reasoning",
      })
      .run();
    expect(
      await saveSourceRecommendations(db, project, output, ["community"]),
    ).toEqual({ added: 0, skipped: 1 });
    expect(db.select().from(schema.sourceChannels).all()[0]).toMatchObject({
      status: "rejected",
      note: "Preserve this reasoning",
      priority: "experimental",
    });
  });
  it("fails closed on another search, revised role or revised JD", async () => {
    const output = await response();
    const other = (
      await createSearchProject(db, {
        name: "Other",
        roleTitle: "Software engineer",
        geography: "California",
      })
    ).id;
    await expect(
      previewSourceRecommendations(db, other, output),
    ).rejects.toThrow(/older/);
    db.update(schema.searchProjects)
      .set({ geography: "New York" })
      .where(eq(schema.searchProjects.id, project))
      .run();
    await expect(
      saveSourceRecommendations(db, project, output, ["community"]),
    ).rejects.toThrow(/older/);
    const fresh = await response();
    await saveJobDescription(db, {
      searchProjectId: project,
      rawText: "Own distributed data systems and production reliability.",
      source: "pasted",
    });
    await expect(
      previewSourceRecommendations(db, project, fresh),
    ).rejects.toThrow(/older/);
    expect(db.select().from(schema.sourceChannels).all()).toHaveLength(0);
  });
  it("rechecks freshness after asynchronous generation validation before saving", async () => {
    const output = await response();
    const realRun = aiRun.runAiTask;
    vi.spyOn(aiRun, "runAiTask").mockImplementation(async (...args) => {
      const result = await realRun(...args);
      db.update(schema.searchProjects)
        .set({ roleTitle: "Engineering manager" })
        .where(eq(schema.searchProjects.id, project))
        .run();
      return result;
    });
    await expect(
      saveSourceRecommendations(db, project, output, ["community"]),
    ).rejects.toThrow(/changed/);
    expect(db.select().from(schema.sourceChannels).all()).toHaveLength(0);
  });
  it.each([
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:secret@example.org",
    "http://127.0.0.1",
    "http://localhost:3997",
    "http://[::1]",
    "https://10.0.0.1",
    "http://corp.internal",
    "https://a.test",
    "https://2130706433",
  ])("rejects unsafe venue URL %s", async (url) => {
    expect(safeSourceUrl(url)).toBe(false);
    const output = await response();
    output.recommendations[0].url = url;
    await expect(
      previewSourceRecommendations(db, project, output),
    ).rejects.toThrow();
  });
  it("rejects fabricated verification fields, invalid/future dates, unsupported cost, unknown selection and duplicate identifiers", async () => {
    let output: unknown = await response();
    (output as SourceRecommendations).recommendations[0] = {
      ...(output as SourceRecommendations).recommendations[0],
      certainty: "verified",
    } as SourceRecommendations["recommendations"][number];
    await expect(
      previewSourceRecommendations(db, project, output),
    ).rejects.toThrow();
    for (const value of ["2999-01-01", "2026-02-30"]) {
      const dated = await response();
      dated.recommendations[1].evidence[0].checkedOn = value;
      await expect(
        previewSourceRecommendations(db, project, dated),
      ).rejects.toThrow();
    }
    const cost = await response();
    cost.recommendations[0].costModel = "free";
    await expect(
      previewSourceRecommendations(db, project, cost),
    ).rejects.toThrow(/supporting evidence/);
    const duplicate = await response();
    duplicate.recommendations[1].id = duplicate.recommendations[0].id;
    await expect(
      previewSourceRecommendations(db, project, duplicate),
    ).rejects.toThrow(/unique/);
    output = await response();
    await expect(
      saveSourceRecommendations(db, project, output, ["missing"]),
    ).rejects.toThrow(/current preview/);
    await expect(
      saveSourceRecommendations(db, project, output, []),
    ).rejects.toThrow(/Select/);
    expect(db.select().from(schema.sourceChannels).all()).toHaveLength(0);
  });
  it("rejects protected-characteristic targeting and preserves arbitrary old channel notes", async () => {
    const output = await response();
    output.recommendations[0].audience = "Young candidates under 30";
    await expect(
      previewSourceRecommendations(db, project, output),
    ).rejects.toThrow(/protected/);
    expect(readSourceRecommendationNote("Keep legacy note as text")).toBeNull();
    expect(
      readSourceRecommendationNote(
        "talentos:source-recommendation:v1\n{broken",
      ),
    ).toBeNull();
    expect(db.select().from(schema.sourceChannels).all()).toHaveLength(0);
  });
});
