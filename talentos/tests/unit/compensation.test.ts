import { expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import {
  compensationWorkspace,
  saveCompensation,
} from "@/lib/services/compensation";
import {
  COMPENSATION_REQUEST_KIND,
  buildCompensationRequest,
  compensationInputSchema,
  parseCompensationFindings,
  recommendCompensation,
  type CompensationInput,
} from "@/lib/core/compensation";
const source = {
  title: "Synthetic source",
  url: "https://one.example/pay",
  quote: "Example range 100000 to 140000",
  dataDate: "2026-06-01",
  role: "Engineer",
  geography: "Boston",
  employmentType: "Employee",
  currency: "USD",
  basis: "annual" as const,
  component: "base" as const,
  low: 100000,
  high: 140000,
  comparability: "Same role and level",
  reviewed: true,
};
const input: CompensationInput = {
  geography: "Boston",
  employmentType: "Employee",
  currency: "USD",
  basis: "annual",
  sources: [
    source,
    { ...source, url: "https://two.example/pay", low: 120000, high: 160000 },
  ],
};
it("calculates a transparent provisional band and never imports approval", () => {
  const result = recommendCompensation(input, "2026-09-05");
  expect(result.range).toEqual({ low: 110000, high: 150000 });
  expect(result).toMatchObject({
    status: "provisional",
    includedCount: 2,
    publisherCount: 2,
  });
  const sources = parseCompensationFindings(
    { contextHash: "abc", sources: input.sources },
    "abc",
  );
  expect(sources.every((s) => !s.reviewed)).toBe(true);
  expect(
    recommendCompensation({ ...input, sources }, "2026-09-05").range,
  ).toBeNull();
});
it("binds imported findings to the request that is on screen", () => {
  expect(() =>
    parseCompensationFindings({ contextHash: "older", sources: [] }, "abc"),
  ).toThrow(/different role context/);
  expect(() =>
    parseCompensationFindings({ sources: input.sources }, "abc"),
  ).toThrow();
});
it("the research request carries its kind, context hash, fair-hiring directive and schema", () => {
  const request = buildCompensationRequest({
    context: { role: "Engineer" },
    contextHash: "abc",
    target: {
      geography: "Boston",
      employmentType: "Employee",
      currency: "USD",
      basis: "annual",
    },
  });
  expect(request).toMatchObject({
    kind: COMPENSATION_REQUEST_KIND,
    contextHash: "abc",
  });
  expect(request.fairHiring).toContain("protected characteristics");
  expect(request.responseInstructions).toContain('"abc"');
  expect(request.outputSchema.required).toEqual(["contextHash", "sources"]);
});
it.each([
  [{ currency: "EUR" }, "Currency or pay period differs"],
  [{ basis: "hourly" }, "Currency or pay period differs"],
  [{ component: "total" }, "Total compensation cannot establish"],
  [{ geography: "London" }, "Location or employment type differs"],
  [{ employmentType: "Contractor" }, "Location or employment type differs"],
  [{ dataDate: "2020-01-01" }, "older than two years"],
  [{ dataDate: "2027-01-01" }, "Future data date"],
  [{ reviewed: false }, "Needs recruiter source"],
  [{ url: "https://one.example/pay?tracking=2" }, "Duplicate source URL"],
  [{ url: "http://WWW.one.example/pay/#top" }, "Duplicate source URL"],
])(
  "withholds ranges with mismatched, stale, future, duplicate or unreviewed evidence: %j",
  (patch, reason) => {
    const result = recommendCompensation(
      { ...input, sources: [source, { ...input.sources[1], ...patch }] },
      "2026-09-05",
    );
    expect(result.range).toBeNull();
    expect(result.status).toBe("insufficient_evidence");
    expect(result.sources[1].exclusion).toContain(reason);
  },
);
it("tolerates a one-day calendar difference between the recruiter and the app's UTC date", () => {
  const result = recommendCompensation(
    {
      ...input,
      sources: [source, { ...input.sources[1], dataDate: "2026-09-06" }],
    },
    "2026-09-05",
  );
  expect(result.sources[1].exclusion).toBeNull();
  expect(result.range).not.toBeNull();
});
it("counts a publisher once across www., scheme and host case, and flags aging data", () => {
  const result = recommendCompensation(
    {
      ...input,
      sources: [
        source,
        {
          ...source,
          url: "http://WWW.One.Example/other",
          dataDate: "2025-06-01",
        },
      ],
    },
    "2026-09-05",
  );
  expect(result.publisherCount).toBe(1);
  expect(result.range).toBeNull();
  expect(result.sources[1].aging).toBe(true);
});
it("rejects invalid ranges, unsafe URLs and invalid dates", () => {
  for (const patch of [
    { low: 170000 },
    { low: 0 },
    { url: "javascript:alert(1)" },
    { dataDate: "2026-02-30" },
  ])
    expect(
      compensationInputSchema.safeParse({
        ...input,
        sources: [{ ...source, ...patch }],
      }).success,
    ).toBe(false);
});
function withDatabase<T>(
  run: (open: () => ReturnType<typeof drizzle<typeof schema>>) => T,
) {
  const dir = mkdtempSync(path.join(tmpdir(), "talentos-compensation-"));
  const file = path.join(dir, "test.db");
  const opened: Database.Database[] = [];
  const open = () => {
    opened.splice(0).forEach((handle) => handle.close());
    const sqlite = new Database(file);
    opened.push(sqlite);
    const db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: "drizzle" });
    return db;
  };
  try {
    return run(open);
  } finally {
    opened.forEach((handle) => handle.close());
    rmSync(dir, { recursive: true, force: true });
  }
}
function seedProject(db: ReturnType<typeof drizzle<typeof schema>>) {
  db.insert(schema.searchProjects)
    .values({
      id: "salary-search",
      name: "Fixture",
      roleTitle: "Engineer",
      geography: "Boston",
      compensationNote: "Owner budget unchanged",
    })
    .run();
}
it("persists after restart, suppresses stale role recommendations and rejects a stale writer", () => {
  withDatabase((open) => {
    let db = open();
    seedProject(db);
    const w = compensationWorkspace(db, "salary-search");
    saveCompensation(db, {
      projectId: "salary-search",
      contextHash: w.contextHash,
      input,
    });
    db = open();
    expect(compensationWorkspace(db, "salary-search").saved?.input).toEqual(
      input,
    );
    expect(
      db.select().from(schema.searchProjects).get()?.compensationNote,
    ).toBe("Owner budget unchanged");
    db.update(schema.searchProjects)
      .set({ roleTitle: "Executive" })
      .where(eq(schema.searchProjects.id, "salary-search"))
      .run();
    expect(compensationWorkspace(db, "salary-search")).toMatchObject({
      stale: true,
      recommendation: null,
    });
    expect(() =>
      saveCompensation(db, {
        projectId: "salary-search",
        contextHash: w.contextHash,
        input,
      }),
    ).toThrow(/context changed/);
    expect(() => compensationWorkspace(db, "missing")).toThrow(/not found/);
  });
});
it("survives an unreadable saved record and refuses protected-trait source text", () => {
  withDatabase((open) => {
    const db = open();
    seedProject(db);
    db.insert(schema.settings)
      .values({ key: "compensation:salary-search", value: { garbage: true } })
      .run();
    const w = compensationWorkspace(db, "salary-search");
    expect(w).toMatchObject({
      saved: null,
      unreadable: true,
      stale: false,
      recommendation: null,
    });
    expect(() =>
      saveCompensation(db, {
        projectId: "salary-search",
        contextHash: w.contextHash,
        input: {
          ...input,
          sources: [
            { ...source, quote: "Median pay for engineers under 30 years old" },
          ],
        },
      }),
    ).toThrow(/protected characteristic/);
    saveCompensation(db, {
      projectId: "salary-search",
      contextHash: w.contextHash,
      input,
    });
    expect(compensationWorkspace(db, "salary-search")).toMatchObject({
      unreadable: false,
      recommendation: { status: "provisional" },
    });
  });
});
