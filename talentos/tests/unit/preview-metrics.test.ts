import { afterAll, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";
import { emptyCandidateProfile } from "@/lib/core/payloads";
import { GET } from "@/app/api/preview/route";
vi.mock("@/lib/db/client", () => ({ getDb: vi.fn() }));
const sqlite = new Database(":memory:");
const db = drizzle(sqlite, { schema });
migrate(db, { migrationsFolder: "drizzle" });
vi.mocked(getDb).mockReturnValue(db);
afterAll(() => sqlite.close());
const job = db
  .insert(schema.searchProjects)
  .values({ name: "Preview test", roleTitle: "Engineer" })
  .returning()
  .get();
const people = db
  .insert(schema.candidates)
  .values([
    {
      name: "Same name",
      searchProjectId: job.id,
      profile: emptyCandidateProfile(),
    },
    {
      name: "Same name",
      searchProjectId: job.id,
      profile: emptyCandidateProfile(),
    },
  ])
  .returning()
  .all();
const url = (target: string) =>
  new Request(
    `http://localhost/api/preview?target=${encodeURIComponent(target)}`,
  );
it("counts recorded scorecards and moves for the exact candidate, excluding creation", async () => {
  db.insert(schema.scorecards)
    .values([
      {
        candidateId: people[0].id,
        searchProjectId: job.id,
        stageName: "Screen",
        status: "draft",
        entries: [],
      },
      {
        candidateId: people[0].id,
        searchProjectId: job.id,
        stageName: "Screen",
        status: "submitted",
        entries: [],
      },
      {
        candidateId: people[1].id,
        searchProjectId: job.id,
        stageName: "Screen",
        status: "submitted",
        entries: [],
      },
    ])
    .run();
  db.insert(schema.pipelineEvents)
    .values([
      {
        candidateId: people[0].id,
        searchProjectId: job.id,
        fromStage: null,
        toStage: "identified",
      },
      {
        candidateId: people[0].id,
        searchProjectId: job.id,
        fromStage: "identified",
        toStage: "contacted",
      },
    ])
    .run();
  const response = await GET(url(`candidate:${people[0].id}`));
  const payload = await response.json();
  expect(payload.facts).toContain("Scorecards: 1 submitted · 1 draft");
  expect(payload.facts).toContain("Pipeline: 1 recorded moves");
  expect(payload.target).toBe(`candidate:${people[0].id}`);
  expect(payload.facts.join(" ")).not.toMatch(
    /qualified|interested|available|match score/i,
  );
});
it("prevents browser and intermediary caching of saved candidate facts", async () => {
  expect(
    (await GET(url(`candidate:${people[1].id}`))).headers.get("Cache-Control"),
  ).toBe("private, no-store");
});
it("refuses malformed targets and missing candidate records", async () => {
  expect((await GET(url("anything:missing"))).status).toBe(400);
  expect((await GET(url("candidate:missing"))).status).toBe(404);
});
