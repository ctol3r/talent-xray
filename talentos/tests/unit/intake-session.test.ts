/**
 * The adaptive-intake loop must be resumable under the SESSION provider
 * (D-008 + D-011): a statement is appended verbatim before the reasoner
 * runs, so a re-run after the parked request is fulfilled reuses the same
 * stored statement (stable prompt hash) instead of minting a new one.
 * Found live on 2026-09-02; this pins the fix.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";

process.env.TALENTOS_MODEL_PROVIDER = "session";

let db: Db;
let tmpDir: string;
let projectId: string;

const HIRING_NEED_RESPONSE = {
  need: {
    businessProblem: "Expand safety-research capacity.",
    roleSummary: "Research Scientist / Research Engineer.",
    claims: [{ text: "Research taste matters more.", provenance: "jd" }],
    unknowns: ["Team size"],
  },
  requirements: [
    {
      id: "req-taste",
      label: "Research taste",
      statement: "Research taste matters more to us than citation counts.",
      definition: "Pending clarification.",
      kind: "must_have",
      origin: "jd",
      evidenceSpec: ["Self-initiated projects"],
      falseSignals: ["Citation totals"],
      status: "needs_clarification",
      linkedUncertaintyIds: ["unc-taste"],
    },
  ],
  uncertainties: [
    {
      id: "unc-taste",
      about: "What research taste means",
      kind: "ambiguity",
      consequence: "Sourcing targets the wrong evidence.",
      consequential: true,
      status: "open",
    },
  ],
  contradictions: [],
};

async function fulfill(requestPath: string, response: unknown) {
  const request = JSON.parse(fs.readFileSync(requestPath, "utf8")) as {
    respondTo: string;
  };
  fs.writeFileSync(request.respondTo, JSON.stringify(response));
}

async function pendingPathOf(run: () => Promise<unknown>): Promise<string> {
  const { SessionFulfillmentPendingError } = await import("@/lib/ai/session");
  try {
    await run();
  } catch (error) {
    if (error instanceof SessionFulfillmentPendingError)
      return error.requestPath;
    throw error;
  }
  throw new Error("expected a SessionFulfillmentPendingError");
}

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-intake-session-"));
  process.env.TALENTOS_DATABASE_PATH = path.join(tmpDir, "s.db");
  process.env.TALENTOS_SESSION_OUTBOX = path.join(tmpDir, "outbox");
  globalThis.__talentosDb = undefined;
  const { getDb } = await import("@/lib/db/client");
  db = getDb();
  const { createSearchProject, saveJobDescription } =
    await import("@/lib/services/search-projects");
  const { GOLDEN_FIXTURES } = await import("@/lib/db/seed");
  const cais = GOLDEN_FIXTURES[0];
  const project = await createSearchProject(db, {
    name: "Session intake test",
    roleTitle: cais.roleTitle,
    companyName: cais.company,
  });
  projectId = project.id;
  await saveJobDescription(db, {
    searchProjectId: projectId,
    rawText: cais.jd,
    source: "pasted",
  });
});

afterAll(() => {
  globalThis.__talentosDb = undefined;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("intake loop under the session provider", () => {
  it("derives the hiring need through the file handoff", async () => {
    const { deriveHiringNeed, getIntelligence } =
      await import("@/lib/services/intelligence");
    const requestPath = await pendingPathOf(() =>
      deriveHiringNeed(db, projectId),
    );
    await fulfill(requestPath, HIRING_NEED_RESPONSE);
    const { intent } = await deriveHiringNeed(db, projectId);
    expect(intent.requirements[0].id).toBe("req-taste");
    expect((await getIntelligence(db, projectId))?.meta?.provider).toBe(
      "session",
    );
  });

  it("appends the statement before reasoning and re-runs against the same request", async () => {
    const { recordManagerStatement, getIntelligence } =
      await import("@/lib/services/intelligence");
    const text = "By research taste I mean picking problems early.";
    const first = await pendingPathOf(() =>
      recordManagerStatement(db, { searchProjectId: projectId, text }),
    );
    // Phase 1 persisted the statement verbatim, not yet reasoned over.
    let stored = (await getIntelligence(db, projectId))!.payload.intent;
    expect(stored.statements).toHaveLength(1);
    expect(stored.statements[0].text).toBe(text);
    expect(stored.statements[0].reasonedAt).toBeUndefined();
    expect(stored.revision).toBe(0);

    // A re-run with the same text reuses the stored statement: same
    // request file, no second statement.
    const second = await pendingPathOf(() =>
      recordManagerStatement(db, { searchProjectId: projectId, text }),
    );
    expect(second).toBe(first);
    stored = (await getIntelligence(db, projectId))!.payload.intent;
    expect(stored.statements).toHaveLength(1);

    // A different statement while one is parked is refused, not silently
    // stacked.
    await expect(
      recordManagerStatement(db, {
        searchProjectId: projectId,
        text: "Something else entirely.",
      }),
    ).rejects.toThrow(/not been reasoned over/);

    await fulfill(first, {
      extractedClaims: [{ text, provenance: "manager_statement" }],
      requirements: [
        {
          ...HIRING_NEED_RESPONSE.requirements[0],
          status: "explicit",
          origin: "manager_statement",
          definition: text,
        },
      ],
      uncertainties: [
        {
          ...HIRING_NEED_RESPONSE.uncertainties[0],
          status: "resolved",
          resolution: text,
        },
      ],
      contradictions: [],
      nextQuestion: null,
    });
    const { intent, nextQuestion } = await recordManagerStatement(db, {
      searchProjectId: projectId,
      text,
    });
    expect(nextQuestion).toBeNull();
    expect(intent.revision).toBe(1);
    expect(intent.statements).toHaveLength(1);
    expect(intent.statements[0].reasonedAt).toBeTruthy();
    expect(intent.requirements[0].status).toBe("explicit");
    expect(intent.need.claims.at(-1)?.provenance).toBe("manager_statement");
  });
});
