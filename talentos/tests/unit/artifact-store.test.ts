/**
 * Existing user data must survive. This loads a blob written by the
 * PREVIOUS artifact — the same localStorage key, the same document shape,
 * with none of the W13 fields — and asserts every search, generated module
 * and candidate still reads back, and that new fields are additive.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  LS_KEY,
  STORE_VERSION,
  normalizeCandidate,
  normalizeFacts,
  normalizeRecord,
  setDb,
  storageMode,
  store,
} from "../../artifact-src/core/store";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
}

const memory = new MemoryStorage();
(globalThis as unknown as { localStorage: MemoryStorage }).localStorage =
  memory;

/** Exactly what the pre-W13 artifact wrote: no storeVersion, no new fields. */
const LEGACY = {
  searches: {
    s_old: {
      facts: {
        id: "s_old",
        createdAt: "2026-08-01T09:00:00.000Z",
        name: "CAIS — Research Engineer",
        companyName: "CAIS",
        roleTitle: "Research Engineer",
        geography: "San Francisco",
        compensationNote: "$220k",
        jd: "Alignment research engineering.",
      },
      artifacts: {
        success_profile: {
          payload: { sections: [{ title: "Must have", items: ["PyTorch"] }] },
          meta: {
            provider: "claude-artifact",
            generatedAt: "2026-08-01T09:05:00.000Z",
          },
          traitWarnings: [],
        },
      },
      candidates: {
        c1: {
          id: "c1",
          name: "Jordan Lee",
          currentTitle: "ML Engineer",
          profileUrls: ["https://github.com/jlee"],
          createdAt: "2026-08-01T10:00:00.000Z",
        },
      },
    },
  },
};

beforeEach(() => {
  setDb(null);
  memory.clear();
  memory.setItem(LS_KEY, JSON.stringify(LEGACY));
});

describe("legacy data survives", () => {
  it("reads a pre-W13 blob back under the same key", async () => {
    expect(storageMode()).toBe("local");
    const searches = await store.listSearches();
    expect(searches).toHaveLength(1);
    expect(searches[0].id).toBe("s_old");
    expect(searches[0].compensationNote).toBe("$220k");

    const artifacts = await store.loadArtifacts("s_old");
    expect(Object.keys(artifacts)).toEqual(["success_profile"]);
    expect(artifacts.success_profile.meta.provider).toBe("claude-artifact");
    expect(artifacts.success_profile.traitWarnings).toEqual([]);

    const candidates = await store.listCandidates("s_old");
    expect(candidates[0].name).toBe("Jordan Lee");
    expect(candidates[0].profileUrls).toEqual(["https://github.com/jlee"]);
  });

  it("stamps the store version only when it writes, and keeps the legacy search", async () => {
    await store.saveArtifact("s_old", "channels", {
      meta: {
        provider: "claude-artifact",
        generatedAt: "2026-09-04T00:00:00.000Z",
        inputVersion: "v1",
      },
      traitWarnings: [],
      payload: { channels: [] },
    });
    const blob = JSON.parse(memory.getItem(LS_KEY)!);
    expect(blob.storeVersion).toBe(STORE_VERSION);
    expect(Object.keys(blob.searches.s_old.artifacts).sort()).toEqual([
      "channels",
      "success_profile",
    ]);
    expect(blob.searches.s_old.facts.name).toBe("CAIS — Research Engineer");
  });

  it("round-trips contexts, research snapshots, actions and initiatives", async () => {
    await store.saveContext({
      searchId: "s_old",
      searchVersion: "v1",
      searchName: "CAIS",
      company: "CAIS",
      companyStage: "",
      companySize: "",
      companyBusinessModel: "",
      companyReputationContext: "",
      industry: "",
      subindustry: "",
      profession: "",
      roleFamily: "",
      roleTitle: "Research Engineer",
      seniority: "",
      employmentType: "",
      geography: "",
      country: "",
      jurisdiction: "",
      workplaceModel: "",
      compensationContext: "",
      businessObjective: "",
      teamContext: "",
      hiringReason: "",
      openedAt: "",
      desiredStartDate: "",
      urgency: "",
      availableTimeframe: "",
      constraints: [],
      recruiterNotes: "",
      jobDescription: "",
      hiringManagerStatements: [],
      selectedIndustryPack: "universal",
      createdAt: "2026-09-04T00:00:00.000Z",
      updatedAt: "2026-09-04T00:00:00.000Z",
    });
    await store.saveAction("s_old", {
      id: "a1",
      title: "Ask the hiring manager about on-call",
      description: "",
      owner: "recruiter",
      status: "open",
      sourceOutputId: "env-1",
    });
    await store.saveInitiative("s_old", {
      id: "init-1",
      title: "Close the pay-band question",
      why: "Three candidates stalled on compensation.",
      createdAt: "2026-09-04T00:00:00.000Z",
    });
    expect((await store.listInitiatives("s_old"))[0].title).toContain(
      "pay-band",
    );
    await store.appendEvent("s_old", {
      id: "ev-2",
      candidateId: "c1",
      at: "2026-09-04T10:00:00.000Z",
      recordedBy: "recruiter",
      type: "outreach_recorded",
      note: "",
    });
    await store.appendEvent("s_old", {
      id: "ev-1",
      candidateId: "c1",
      at: "2026-09-03T10:00:00.000Z",
      recordedBy: "recruiter",
      type: "stage_change",
      toStage: "sourced",
      note: "",
    });
    // Events come back in the order they happened, not the order written.
    expect((await store.listEvents("s_old")).map((e) => e.id)).toEqual([
      "ev-1",
      "ev-2",
    ]);
    expect((await store.listContexts("s_old"))[0].searchVersion).toBe("v1");
    expect((await store.listActions("s_old"))[0].title).toContain("on-call");
    // The legacy artifacts are untouched by the additions.
    expect(Object.keys(await store.loadArtifacts("s_old"))).toEqual([
      "success_profile",
    ]);
  });

  it("survives a corrupt blob rather than throwing", async () => {
    memory.setItem(LS_KEY, "{not json");
    await expect(store.listSearches()).resolves.toEqual([]);
  });
});

describe("normalizers accept what older versions wrote", () => {
  it("fills the meta an old record lacks", () => {
    const rec = normalizeRecord({ payload: { a: 1 } })!;
    expect(rec.meta.provider).toBe("claude-artifact");
    expect(rec.meta.generatedAt).toBe("");
    expect(rec.traitWarnings).toEqual([]);
    expect(normalizeRecord(null)).toBeUndefined();
  });

  it("keeps the W13 fields when they are present", () => {
    const rec = normalizeRecord({
      payload: {},
      meta: {
        provider: "p",
        generatedAt: "t",
        inputVersion: "v2",
        researchStatus: "blocked",
      },
      traitWarnings: ["age"],
      validationIssues: ["B: unresolvable target"],
      lastError: { at: "t", message: "rate_limited" },
    })!;
    expect(rec.meta.inputVersion).toBe("v2");
    expect(rec.meta.researchStatus).toBe("blocked");
    expect(rec.validationIssues).toEqual(["B: unresolvable target"]);
    expect(rec.lastError?.message).toBe("rate_limited");
  });

  it("rejects a candidate with no id or name instead of storing a ghost", () => {
    expect(normalizeCandidate({ name: "No id" })).toBeUndefined();
    expect(
      normalizeCandidate({ id: "x", name: "Has both" })?.profileUrls,
    ).toEqual([]);
  });

  it("rejects facts with no role title", () => {
    expect(normalizeFacts({ id: "x" })).toBeUndefined();
    expect(normalizeFacts({ id: "x", roleTitle: "Nurse" })?.roleTitle).toBe(
      "Nurse",
    );
  });
});
