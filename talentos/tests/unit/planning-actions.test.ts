import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GenerationFailedError,
  ProviderNotConfiguredError,
} from "@/lib/ai/provider";
import { SessionFulfillmentPendingError } from "@/lib/ai/session";
import {
  deriveSearchPlanAction,
  initializeHiringNeedAction,
} from "@/lib/actions/planning";

const mocks = vi.hoisted(() => {
  const db = {};
  return {
    db,
    getDb: vi.fn(() => db),
    getIntelligence: vi.fn(),
    deriveHiringNeed: vi.fn(),
    deriveSearchPlan: vi.fn(),
    loadProjectContext: vi.fn(),
    revalidatePath: vi.fn(),
  };
});

vi.mock("@/lib/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("@/lib/services/intelligence", () => ({
  getIntelligence: mocks.getIntelligence,
  deriveHiringNeed: mocks.deriveHiringNeed,
  deriveSearchPlan: mocks.deriveSearchPlan,
}));
vi.mock("@/lib/ai/context", () => ({
  loadProjectContext: mocks.loadProjectContext,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const projectId = "planning-search";
const input = { searchProjectId: projectId };
const existingIntelligence = Object.freeze({
  payload: Object.freeze({
    intent: Object.freeze({
      revision: 3,
      requirements: Object.freeze([{ id: "requirement-1" }]),
      statements: Object.freeze([{ id: "manager-decision-1" }]),
    }),
  }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getIntelligence.mockReset().mockResolvedValue(null);
  mocks.loadProjectContext.mockReset().mockResolvedValue({
    jdText: "Hire a recruiter to establish the sourcing practice.",
  });
  mocks.deriveHiringNeed.mockReset().mockResolvedValue({ warnings: [] });
  mocks.deriveSearchPlan.mockReset().mockResolvedValue({ warnings: [] });
});

const actions = [
  {
    name: "initialize hiring need",
    action: initializeHiringNeedAction,
    generate: mocks.deriveHiringNeed,
    needsIntent: false,
  },
  {
    name: "derive search plan",
    action: deriveSearchPlanAction,
    generate: mocks.deriveSearchPlan,
    needsIntent: true,
  },
];

describe.each(actions)("$name action boundary", ({ action }) => {
  it.each([
    undefined,
    null,
    "planning-search",
    {},
    { searchProjectId: "" },
    { searchProjectId: 42 },
  ])("rejects malformed input %j before touching storage", async (value) => {
    expect(await action(value)).toMatchObject({
      ok: false,
      kind: "validation",
    });
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.getIntelligence).not.toHaveBeenCalled();
    expect(mocks.loadProjectContext).not.toHaveBeenCalled();
    expect(mocks.deriveHiringNeed).not.toHaveBeenCalled();
    expect(mocks.deriveSearchPlan).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("initialize hiring need", () => {
  it("preserves the current interpretation and manager decisions without regeneration", async () => {
    mocks.getIntelligence.mockResolvedValue(existingIntelligence);

    expect(await initializeHiringNeedAction(input)).toEqual({
      ok: true,
      data: { state: "ready", warnings: [] },
    });
    expect(mocks.getIntelligence).toHaveBeenCalledWith(mocks.db, projectId);
    expect(mocks.loadProjectContext).not.toHaveBeenCalled();
    expect(mocks.deriveHiringNeed).not.toHaveBeenCalled();
    expect(mocks.deriveSearchPlan).not.toHaveBeenCalled();
    expect(existingIntelligence.payload.intent.revision).toBe(3);
    expect(existingIntelligence.payload.intent.statements).toEqual([
      { id: "manager-decision-1" },
    ]);
  });

  it.each([undefined, "", " \n\t "])(
    "requires a saved nonblank JD before generating (%j)",
    async (jdText) => {
      mocks.loadProjectContext.mockResolvedValue({ jdText });

      expect(await initializeHiringNeedAction(input)).toMatchObject({
        ok: false,
      });
      expect(mocks.loadProjectContext).toHaveBeenCalledWith(
        mocks.db,
        projectId,
      );
      expect(mocks.deriveHiringNeed).not.toHaveBeenCalled();
      expect(mocks.deriveSearchPlan).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("generates only the missing hiring need and refreshes the search", async () => {
    const warnings = [{ trait: "review required", excerpt: "source text" }];
    mocks.deriveHiringNeed.mockResolvedValue({ warnings });

    expect(await initializeHiringNeedAction(input)).toEqual({
      ok: true,
      data: { state: "ready", warnings },
    });
    expect(mocks.deriveHiringNeed).toHaveBeenCalledExactlyOnceWith(
      mocks.db,
      projectId,
    );
    expect(mocks.deriveSearchPlan).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledExactlyOnceWith(
      `/searches/${projectId}`,
      "layout",
    );
  });
});

describe("derive search plan", () => {
  it.each([null, { payload: { intent: { requirements: [] } } }])(
    "requires existing requirements before generation (%j)",
    async (ir) => {
      mocks.getIntelligence.mockResolvedValue(ir);

      expect(await deriveSearchPlanAction(input)).toMatchObject({ ok: false });
      expect(mocks.getIntelligence).toHaveBeenCalledWith(mocks.db, projectId);
      expect(mocks.loadProjectContext).not.toHaveBeenCalled();
      expect(mocks.deriveHiringNeed).not.toHaveBeenCalled();
      expect(mocks.deriveSearchPlan).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("derives a plan from the current interpretation without replacing it", async () => {
    mocks.getIntelligence.mockResolvedValue(existingIntelligence);
    const warnings = [{ trait: "review required", excerpt: "plan text" }];
    mocks.deriveSearchPlan.mockResolvedValue({ warnings });

    expect(await deriveSearchPlanAction(input)).toEqual({
      ok: true,
      data: { state: "ready", warnings },
    });
    expect(mocks.deriveSearchPlan).toHaveBeenCalledExactlyOnceWith(
      mocks.db,
      projectId,
    );
    expect(mocks.deriveHiringNeed).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledExactlyOnceWith(
      `/searches/${projectId}`,
      "layout",
    );
  });
});

describe.each(actions)(
  "$name provider outcomes",
  ({ action, generate, needsIntent }) => {
    beforeEach(() => {
      if (needsIntent)
        mocks.getIntelligence.mockResolvedValue(existingIntelligence);
    });

    it("reports the exact waiting paths without claiming generation is ready", async () => {
      const requestPath = "/private/outbox/request.json";
      const responsePath = "/private/outbox/response.json";
      generate.mockRejectedValue(
        new SessionFulfillmentPendingError(requestPath, responsePath),
      );

      expect(await action(input)).toEqual({
        ok: true,
        data: { state: "pending", requestPath, responsePath },
      });
      expect(generate).toHaveBeenCalledExactlyOnceWith(mocks.db, projectId);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([
      { error: new Error("Provider transport failed"), kind: "error" },
      {
        error: new GenerationFailedError("Generated output failed validation"),
        kind: "error",
      },
      {
        error: new ProviderNotConfiguredError("Provider is unavailable"),
        kind: "provider",
      },
    ])("keeps real failures as failures ($kind)", async ({ error, kind }) => {
      generate.mockRejectedValue(error);

      expect(await action(input)).toEqual({
        ok: false,
        kind,
        error: error.message,
      });
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
  },
);
