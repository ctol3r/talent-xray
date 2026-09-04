/**
 * The Research Gate (spec §8): source-specific freshness, a status that is
 * computed now rather than trusted from the stamp, and a gate that fails
 * closed on CURRENCY — generation is still possible, but only after an
 * explicit acknowledgement and only labelled model-knowledge-only.
 */
import { describe, expect, it } from "vitest";
import {
  FRESHNESS_RULES,
  buildSnapshot,
  computeValidUntil,
  gateDecision,
  npiAdapter,
  publicationsAdapter,
  bigdataAdapter,
  researchStatusOf,
  sourceFreshness,
  userSource,
  viableAdapters,
  type ResearchSource,
} from "../../artifact-src/core/research";
import { contextFromFacts } from "../../artifact-src/core/search-context";

const NOW = "2026-09-04T00:00:00.000Z";
const daysAgo = (n: number) =>
  new Date(Date.parse(NOW) - n * 86_400_000).toISOString();

const ctx = contextFromFacts(
  {
    id: "s1",
    roleTitle: "Staff Nurse, ICU",
    companyName: "Example Health",
    country: "United Kingdom",
    industry: "Healthcare",
  },
  [],
  NOW,
);

const src = (over: Partial<ResearchSource> = {}): ResearchSource => ({
  id: over.id ?? "src1",
  title: "A source",
  sourceType: "reputable_secondary",
  kind: "compensation",
  retrievedAt: NOW,
  accessStatus: "available",
  limitations: [],
  adapterId: "user_supplied",
  ...over,
});

describe("source-specific freshness", () => {
  it("uses a different window per source kind, not one universal TTL", () => {
    expect(FRESHNESS_RULES.job_openings.staleAfterDays).toBeLessThan(
      FRESHNESS_RULES.compensation.staleAfterDays,
    );
    expect(
      FRESHNESS_RULES.occupational_taxonomy.staleAfterDays,
    ).toBeGreaterThan(FRESHNESS_RULES.publications.staleAfterDays);
    for (const rule of Object.values(FRESHNESS_RULES)) {
      expect(rule.agingAfterDays).toBeLessThan(rule.staleAfterDays);
      expect(rule.rationale.length).toBeGreaterThan(20);
    }
  });

  it("a 10-day-old job-openings source is stale while a 10-day-old pay source is current", () => {
    expect(
      sourceFreshness(
        src({ kind: "job_openings", retrievedAt: daysAgo(10) }),
        NOW,
      ),
    ).toBe("aging");
    expect(
      sourceFreshness(
        src({ kind: "job_openings", retrievedAt: daysAgo(30) }),
        NOW,
      ),
    ).toBe("stale");
    expect(
      sourceFreshness(
        src({ kind: "compensation", retrievedAt: daysAgo(10) }),
        NOW,
      ),
    ).toBe("current");
  });

  it("an unreachable source is 'unavailable', never quietly current", () => {
    expect(sourceFreshness(src({ accessStatus: "unavailable" }), NOW)).toBe(
      "unavailable",
    );
    expect(sourceFreshness(src({ accessStatus: "blocked" }), NOW)).toBe(
      "unavailable",
    );
  });

  it("validUntil is the earliest expiry across usable sources", () => {
    const until = computeValidUntil([
      src({ id: "a", kind: "compensation", retrievedAt: NOW }),
      src({ id: "b", kind: "job_openings", retrievedAt: NOW }),
    ]);
    expect(until).toBe(
      new Date(
        Date.parse(NOW) +
          FRESHNESS_RULES.job_openings.staleAfterDays * 86_400_000,
      ).toISOString(),
    );
    expect(
      computeValidUntil([src({ accessStatus: "unavailable" })]),
    ).toBeUndefined();
  });
});

describe("snapshot status is computed now, not trusted", () => {
  it("a snapshot written 'current' goes stale on its own as its sources age", () => {
    const fresh = buildSnapshot({
      id: "rs",
      ctx,
      brief: "b",
      sources: [src({ kind: "job_openings" })],
      nowIso: NOW,
    });
    expect(fresh.status).toBe("current");
    expect(researchStatusOf(fresh, NOW)).toBe("current");
    expect(researchStatusOf(fresh, "2026-09-14T00:00:00.000Z")).toBe("aging");
    expect(researchStatusOf(fresh, "2026-10-14T00:00:00.000Z")).toBe("stale");
  });

  it("no sources is 'blocked' and a provider failure is 'failed' — never an empty success", () => {
    const empty = buildSnapshot({
      id: "e",
      ctx,
      brief: "b",
      sources: [],
      nowIso: NOW,
    });
    const failed = buildSnapshot({
      id: "f",
      ctx,
      brief: "b",
      sources: [],
      nowIso: NOW,
      failed: "connector returned server_unavailable",
    });
    expect(empty.status).toBe("blocked");
    expect(failed.status).toBe("failed");
    expect(failed.missingInformation).toContain(
      "connector returned server_unavailable",
    );
    expect(researchStatusOf(undefined, NOW)).toBe("blocked");
  });
});

describe("the gate", () => {
  it("blocks currency without a snapshot, and only generates after acknowledgement", () => {
    const denied = gateDecision(undefined, NOW, false);
    expect(denied.allowed).toBe(false);
    expect(denied.researchStatus).toBe("blocked");
    expect(denied.acknowledgementRequired).toBe(true);
    expect(denied.banner).toContain("MODEL KNOWLEDGE ONLY");
    expect(denied.banner).toContain("no web access");

    const acknowledged = gateDecision(undefined, NOW, true);
    expect(acknowledged.allowed).toBe(true);
    expect(acknowledged.researchStatus).toBe("blocked");
  });

  it("allows current/aging without acknowledgement and names the as-of date", () => {
    const snap = buildSnapshot({
      id: "rs",
      ctx,
      brief: "b",
      sources: [src({ kind: "compensation" })],
      nowIso: NOW,
    });
    const gate = gateDecision(snap, NOW, false);
    expect(gate.allowed).toBe(true);
    expect(gate.researchStatus).toBe("current");
    expect(gate.acknowledgementRequired).toBe(false);
    expect(gate.snapshotId).toBe("rs");
    expect(gate.banner).toContain(NOW);
  });

  it("a stale snapshot needs the same acknowledgement and keeps the stale label", () => {
    const snap = buildSnapshot({
      id: "rs",
      ctx,
      brief: "b",
      sources: [src({ kind: "job_openings", retrievedAt: daysAgo(60) })],
      nowIso: daysAgo(60),
    });
    const gate = gateDecision(snap, NOW, true);
    expect(gate.researchStatus).toBe("stale");
    expect(gate.acknowledgementRequired).toBe(true);
    expect(gate.allowed).toBe(true);
  });
});

describe("adapter registry", () => {
  it("picks adapters by industry, role and location", () => {
    const rows = viableAdapters(ctx);
    const by = Object.fromEntries(
      rows.map((r) => [r.adapter.id, r.applicability]),
    );
    expect(by.user_supplied.viable).toBe(true);
    expect(by.bigdata.viable).toBe(true); // a company is named
    expect(by.npi_registry.viable).toBe(false); // healthcare, but United Kingdom
    expect(by.npi_registry.reason).toContain("US registry");

    const usCtx = contextFromFacts(
      {
        id: "s2",
        roleTitle: "ICU Nurse",
        industry: "Healthcare",
        country: "United States",
      },
      [],
      NOW,
    );
    expect(npiAdapter.applies(usCtx).viable).toBe(true);

    const salesCtx = contextFromFacts(
      {
        id: "s3",
        roleTitle: "Account Executive",
        industry: "SaaS",
        country: "United States",
      },
      [],
      NOW,
    );
    expect(npiAdapter.applies(salesCtx).viable).toBe(false);
    expect(publicationsAdapter.applies(salesCtx).viable).toBe(false);

    const mlCtx = contextFromFacts(
      {
        id: "s4",
        roleTitle: "Research Scientist",
        industry: "AI research",
        country: "United States",
      },
      [],
      NOW,
    );
    expect(publicationsAdapter.applies(mlCtx).viable).toBe(true);
  });

  it("connector adapters report themselves unwired rather than pretending to browse", async () => {
    for (const adapter of [bigdataAdapter, npiAdapter, publicationsAdapter]) {
      const availability = await adapter.availability();
      expect(availability.state).toBe("unavailable");
      expect("reason" in availability && availability.reason).toContain(
        "not wired",
      );
      await expect(adapter.retrieve("brief", ctx)).resolves.toEqual([]);
    }
  });

  it("a pasted source is labelled as supplied by the recruiter, not retrieved", () => {
    const s = userSource({
      id: "u1",
      title: "NHS pay scales 2026",
      url: "https://example.nhs.uk/pay",
      kind: "compensation",
      retrievedAt: NOW,
    });
    expect(s.sourceType).toBe("user_supplied");
    expect(s.adapterId).toBe("user_supplied");
    expect(s.limitations.join(" ")).toContain("not retrieved or verified");
  });
});
