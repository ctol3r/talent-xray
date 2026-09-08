/**
 * Real action → service → session outbox → SQLite integration.
 * Responses are explicitly synthetic, watermarked task fixtures; this tests
 * handoff and persistence behavior, not the quality of a model's analysis.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/lib/actions/helpers";
import type { PlanningOutcome } from "@/lib/actions/planning";
import type { Db } from "@/lib/db/client";

const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);

let db: Db;
let previousDb: Db | undefined;
let tmpDir: string;
let projectId: string;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-planning-session-"));
  // Configure the real provider and storage before importing application code.
  vi.stubEnv("TALENTOS_MODEL_PROVIDER", "session");
  vi.stubEnv("TALENTOS_DATABASE_PATH", path.join(tmpDir, "planning.db"));
  vi.stubEnv("TALENTOS_SESSION_OUTBOX", path.join(tmpDir, "outbox"));
  vi.stubEnv("TALENTOS_DOCUMENT_DIR", path.join(tmpDir, "documents"));
  previousDb = globalThis.__talentosDb;
  globalThis.__talentosDb = undefined;

  const { getDb } = await import("@/lib/db/client");
  db = getDb();
  const { createSearchProject, saveJobDescription } =
    await import("@/lib/services/search-projects");
  const project = await createSearchProject(db, {
    name: "Synthetic session-planning integration fixture",
    roleTitle: "Research Scientist",
    companyName: "Synthetic Research Company",
    businessObjective: "[Mock] Expand the synthetic research team.",
  });
  projectId = project.id;
  await saveJobDescription(db, {
    searchProjectId: projectId,
    rawText:
      "[Synthetic fixture] We are looking for a research scientist. " +
      "Research taste matters more than citation counts. " +
      "The role designs experiments and publishes reproducible findings.",
    source: "pasted",
  });
});

afterAll(() => {
  if (db) {
    // Drizzle exposes its SQLite connection at runtime; close only ours.
    (db as Db & { $client: Database.Database }).$client.close();
  }
  globalThis.__talentosDb = previousDb;
  vi.unstubAllEnvs();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

function pendingRequest(
  result: ActionResult<PlanningOutcome>,
  schemaName: string,
) {
  expect(result).toMatchObject({ ok: true, data: { state: "pending" } });
  if (!result.ok || result.data.state !== "pending") {
    throw new Error("Expected a prepared session request, not a saved draft");
  }
  const { requestPath, responsePath } = result.data;
  expect(path.dirname(requestPath)).toBe(path.join(tmpDir, "outbox"));
  expect(path.dirname(responsePath)).toBe(path.join(tmpDir, "outbox"));
  const request = JSON.parse(fs.readFileSync(requestPath, "utf8")) as {
    schemaName: string;
    respondTo: string;
  };
  expect(request.schemaName).toBe(schemaName);
  expect(request.respondTo).toBe(responsePath);
  expect(fs.existsSync(responsePath)).toBe(false);
  return result.data;
}

describe("planning actions with the real session provider", () => {
  it("resumes both handoffs, rejects malformed output, and preserves reviewed intent on repeated initialization", async () => {
    const { initializeHiringNeedAction, deriveSearchPlanAction } =
      await import("@/lib/actions/planning");
    const { addReviewRequirement, getIntelligence } =
      await import("@/lib/services/intelligence");
    const { loadProjectContext } = await import("@/lib/ai/context");
    const { hiringNeedTask } = await import("@/lib/ai/tasks/hiring-need");
    const { searchPlanTask } = await import("@/lib/ai/tasks/search-plan");
    const input = { searchProjectId: projectId };

    const needRequest = pendingRequest(
      await initializeHiringNeedAction(input),
      "HiringNeed",
    );
    expect(await getIntelligence(db, projectId)).toBeUndefined();
    expect(cache.revalidatePath).not.toHaveBeenCalled();
    expect(await initializeHiringNeedAction(input)).toEqual({
      ok: true,
      data: needRequest,
    });

    const syntheticNeed = hiringNeedTask.mock(
      await loadProjectContext(db, projectId),
    );
    expect(syntheticNeed.need.roleSummary).toContain("[Mock]");
    fs.writeFileSync(needRequest.responsePath, JSON.stringify(syntheticNeed));
    expect(await initializeHiringNeedAction(input)).toMatchObject({
      ok: true,
      data: { state: "ready" },
    });
    const initialized = await getIntelligence(db, projectId);
    expect(initialized?.meta?.provider).toBe("session");
    expect(initialized?.payload.intent.revision).toBe(0);
    expect(initialized?.payload.intent.requirements.length).toBeGreaterThan(0);
    expect(initialized?.payload.searchPlan).toBeUndefined();
    expect(cache.revalidatePath).toHaveBeenCalledExactlyOnceWith(
      `/searches/${projectId}`,
      "layout",
    );

    const managerStatement =
      "[Synthetic fixture] The hiring manager requires reproducible experiment logs.";
    await addReviewRequirement(db, {
      searchProjectId: projectId,
      statement: managerStatement,
      origin: "manager_statement",
    });
    const reviewedIntent = (await getIntelligence(db, projectId))!.payload
      .intent;
    expect(reviewedIntent.revision).toBe(1);
    expect(reviewedIntent.requirements.at(-1)?.statement).toBe(
      managerStatement,
    );

    cache.revalidatePath.mockClear();
    const planRequest = pendingRequest(
      await deriveSearchPlanAction(input),
      "SearchPlan",
    );
    expect((await getIntelligence(db, projectId))?.payload.searchPlan).toBe(
      undefined,
    );
    expect(cache.revalidatePath).not.toHaveBeenCalled();
    expect(await deriveSearchPlanAction(input)).toEqual({
      ok: true,
      data: planRequest,
    });

    fs.writeFileSync(planRequest.responsePath, "{invalid JSON");
    expect(await deriveSearchPlanAction(input)).toMatchObject({
      ok: false,
      kind: "error",
      error: expect.stringContaining("not valid JSON"),
    });
    const afterFailure = await getIntelligence(db, projectId);
    expect(afterFailure?.payload.searchPlan).toBeUndefined();
    expect(afterFailure?.payload.intent).toEqual(reviewedIntent);
    expect(cache.revalidatePath).not.toHaveBeenCalled();

    const syntheticPlan = searchPlanTask.mock(
      await loadProjectContext(db, projectId),
    );
    expect(syntheticPlan.searchPlan.queryPlans[0].rationale).toContain(
      "[Mock]",
    );
    fs.writeFileSync(planRequest.responsePath, JSON.stringify(syntheticPlan));
    expect(await deriveSearchPlanAction(input)).toMatchObject({
      ok: true,
      data: { state: "ready" },
    });
    const planned = await getIntelligence(db, projectId);
    expect(planned?.payload.searchPlan?.queryPlans.length).toBeGreaterThan(0);
    expect(planned?.payload.intent).toEqual(reviewedIntent);
    expect(cache.revalidatePath).toHaveBeenCalledExactlyOnceWith(
      `/searches/${projectId}`,
      "layout",
    );

    const filesBeforeReinitialize = fs.readdirSync(path.join(tmpDir, "outbox"));
    expect(await initializeHiringNeedAction(input)).toMatchObject({
      ok: true,
      data: { state: "ready" },
    });
    expect((await getIntelligence(db, projectId))?.payload).toEqual(
      planned?.payload,
    );
    expect(fs.readdirSync(path.join(tmpDir, "outbox"))).toEqual(
      filesBeforeReinitialize,
    );
  });
});
