/**
 * W11 acceptance (D-013): research before outreach.
 *
 * - The research provider resolves honestly (explicit value wins; unset
 *   follows the model provider; the people-only engines never qualify).
 * - The session research provider is a file handoff: request written,
 *   ResearchPendingError thrown, response validated on re-run.
 * - The research gate refuses personas with no findings.
 * - Personas cite only findings that were actually provided; findings are
 *   stored with the exact query and provider that produced them.
 * - Outreach derives intent + personas (hence research) when missing, and
 *   the stored sequence records which persona it was written for.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db/client";
import type { AudiencePersonaIR } from "@/lib/core/ir";

process.env.TALENTOS_MODEL_PROVIDER = "mock";

let db: Db;
let tmpDir: string;
let projectId: string;
let candidateId: string;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "talentos-research-"));
  process.env.TALENTOS_DATABASE_PATH = path.join(tmpDir, "r.db");
  process.env.TALENTOS_SESSION_OUTBOX = path.join(tmpDir, "outbox");
  delete process.env.TALENTOS_RESEARCH_PROVIDER;
  globalThis.__talentosDb = undefined;
  const { getDb } = await import("@/lib/db/client");
  db = getDb();
  const { createSearchProject, saveJobDescription } =
    await import("@/lib/services/search-projects");
  const { createCandidate, createCandidateInput } =
    await import("@/lib/services/candidates");
  const { GOLDEN_FIXTURES } = await import("@/lib/db/seed");
  const cais = GOLDEN_FIXTURES[0];
  const project = await createSearchProject(db, {
    name: `Research gate — ${cais.name}`,
    companyName: cais.company,
    roleTitle: cais.roleTitle,
    geography: cais.geography,
    country: cais.country,
    industry: cais.industry,
    seniority: cais.seniority,
    businessObjective: cais.businessObjective,
  });
  projectId = project.id;
  await saveJobDescription(db, {
    searchProjectId: projectId,
    rawText: cais.jd,
    source: "pasted",
  });
  const candidate = await createCandidate(
    db,
    createCandidateInput.parse({
      searchProjectId: projectId,
      name: "Fixture Candidate (test — not a real person)",
      currentTitle: "Research Engineer",
    }),
  );
  candidateId = candidate.id;
});

afterAll(() => {
  globalThis.__talentosDb = undefined;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

afterEach(() => {
  delete process.env.TALENTOS_RESEARCH_PROVIDER;
});

describe("research provider resolution (D-013)", () => {
  it("follows the model provider when unset, and honours explicit values", async () => {
    const { resolveResearchProviderKind } =
      await import("@/lib/research/provider");
    expect(resolveResearchProviderKind()).toBe("mock"); // model provider is mock
    process.env.TALENTOS_RESEARCH_PROVIDER = "none";
    expect(resolveResearchProviderKind()).toBe("none");
    process.env.TALENTOS_RESEARCH_PROVIDER = "session";
    expect(resolveResearchProviderKind()).toBe("session");
    process.env.TALENTOS_RESEARCH_PROVIDER = "google-cse"; // people-only engine
    expect(resolveResearchProviderKind()).toBe("none");
  });
});

describe("session research provider — file handoff", () => {
  it("writes a request, throws pending, then returns validated findings on re-run", async () => {
    const { createSessionResearchProvider, ResearchPendingError } =
      await import("@/lib/research/session-research");
    const provider = createSessionResearchProvider();
    const query = "AI safety researchers community conferences";
    let requestPath = "";
    let responsePath = "";
    try {
      await provider.search(query, { limit: 2 });
      throw new Error("expected ResearchPendingError");
    } catch (error) {
      expect(error).toBeInstanceOf(ResearchPendingError);
      requestPath = (error as InstanceType<typeof ResearchPendingError>)
        .requestPath;
      responsePath = (error as InstanceType<typeof ResearchPendingError>)
        .responsePath;
    }
    const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
    expect(request.kind).toBe("research");
    expect(request.query).toBe(query);
    expect(request.limit).toBe(2);
    expect(request.instructions).toMatch(/never a specific person/i);
    expect(request.respondTo).toBe(responsePath);

    // A malformed response is refused, not silently accepted.
    fs.writeFileSync(responsePath, JSON.stringify({ findings: [{ url: 1 }] }));
    await expect(provider.search(query, { limit: 2 })).rejects.toThrow(
      /does not match/,
    );

    fs.writeFileSync(
      responsePath,
      JSON.stringify({
        findings: [
          { url: "https://example.org/a", title: "A", snippet: "s-a" },
          { url: "https://example.org/b", title: "B" },
          { url: "https://example.org/c" },
        ],
      }),
    );
    const findings = await provider.search(query, { limit: 2 });
    expect(findings.map((f) => f.url)).toEqual([
      "https://example.org/a",
      "https://example.org/b",
    ]);
    expect(findings.map((f) => f.providerRank)).toEqual([1, 2]);
    expect(findings.every((f) => f.source === "session-research")).toBe(true);
    expect(findings.every((f) => f.query === query)).toBe(true);
    expect((findings[0] as { relevance?: number }).relevance).toBeUndefined();
  });
});

describe("research gate", () => {
  it("refuses personas when no research provider is configured", async () => {
    const { noneResearchProvider } = await import("@/lib/research/provider");
    const { derivePersonas } = await import("@/lib/services/intelligence");
    const { ResearchRequiredError } = await import("@/lib/services/research");
    await expect(
      derivePersonas(db, projectId, { researchProvider: noneResearchProvider }),
    ).rejects.toBeInstanceOf(ResearchRequiredError);
    // The gate ran after intent derivation, so the IR exists but has no personas.
    const { getIntelligence } = await import("@/lib/services/intelligence");
    const row = await getIntelligence(db, projectId);
    expect(row?.payload.intent).toBeTruthy();
    expect(row?.payload.personas).toBeUndefined();
  });

  it("drops fabricated citations and refuses an ungrounded persona", async () => {
    const { groundPersonas } = await import("@/lib/services/intelligence");
    const base: AudiencePersonaIR = {
      label: "P",
      segmentLabel: "S",
      whoTheyAre: "w",
      whatTheyValue: [],
      concerns: [],
      whereTheyRead: [],
      toneGuidance: "t",
      proofPoints: [],
      doNotSay: [],
      researchCitations: [
        { url: "https://example.org/real", whatItSupports: "x" },
        { url: "https://example.org/invented", whatItSupports: "y" },
      ],
      provenance: "model_inference",
    };
    const { personas, droppedCitations } = groundPersonas(
      [base],
      ["https://example.org/real"],
    );
    expect(droppedCitations).toBe(1);
    expect(personas[0].researchCitations.map((c) => c.url)).toEqual([
      "https://example.org/real",
    ]);
    expect(personas[0].provenance).toBe("research");
    expect(() => groundPersonas([base], ["https://example.org/other"])).toThrow(
      /ungrounded persona/,
    );
  });
});

describe("mock research → personas → outreach", () => {
  it("researches the audience, stores findings with their query, and builds cited personas", async () => {
    const { derivePersonas, getIntelligence } =
      await import("@/lib/services/intelligence");
    const { audienceQueries, listResearchFindings, researchAudience } =
      await import("@/lib/services/research");
    const { personas, findings } = await derivePersonas(db, projectId);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.source === "mock-research")).toBe(true);
    expect(findings.every((f) => typeof f.query === "string")).toBe(true);
    expect(findings.every((f) => f.url.includes("mock-research.invalid"))).toBe(
      true,
    );
    // Queries are deterministic and derived from the search, never a person.
    const row = await getIntelligence(db, projectId);
    const { searchProjects } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const [project] = await db
      .select()
      .from(searchProjects)
      .where(eq(searchProjects.id, projectId));
    const queries = audienceQueries(project, row?.payload);
    expect(queries.length).toBeGreaterThan(0);
    expect(queries.join(" ")).not.toMatch(/Fixture Candidate/);

    expect(personas.length).toBeGreaterThan(0);
    const allowed = new Set(findings.map((f) => f.url));
    for (const persona of personas) {
      expect(persona.researchCitations.length).toBeGreaterThan(0);
      expect(persona.researchCitations.every((c) => allowed.has(c.url))).toBe(
        true,
      );
      expect(persona.provenance).toBe("research");
    }
    expect(row?.payload.personas?.length).toBe(personas.length);

    // Re-running research is idempotent: no duplicate rows.
    const before = (await listResearchFindings(db, projectId)).length;
    await researchAudience(db, projectId);
    expect((await listResearchFindings(db, projectId)).length).toBe(before);
  });

  it("outreach is written for the persona and cites research findings", async () => {
    const { generateOutreach } = await import("@/lib/services/generation");
    const { getIntelligence } = await import("@/lib/services/intelligence");
    const { sequence } = await generateOutreach(db, candidateId);
    const personas = (await getIntelligence(db, projectId))?.payload.personas;
    expect(sequence.payload.personaLabel).toBe(personas?.[0].label);
    const cited = sequence.payload.steps.flatMap((s) =>
      s.citations.map((c) => c.evidence),
    );
    expect(cited.some((e) => e.includes("mock-research.invalid"))).toBe(true);
  });

  it("outreach on a fresh search derives intent and personas automatically", async () => {
    const { createSearchProject, saveJobDescription } =
      await import("@/lib/services/search-projects");
    const { createCandidate, createCandidateInput } =
      await import("@/lib/services/candidates");
    const { GOLDEN_FIXTURES } = await import("@/lib/db/seed");
    const nurse = GOLDEN_FIXTURES[5];
    const project = await createSearchProject(db, {
      name: `Fresh — ${nurse.name}`,
      companyName: nurse.company,
      roleTitle: nurse.roleTitle,
      geography: nurse.geography,
      country: nurse.country,
      industry: nurse.industry,
      seniority: nurse.seniority,
      businessObjective: nurse.businessObjective,
    });
    await saveJobDescription(db, {
      searchProjectId: project.id,
      rawText: nurse.jd,
      source: "pasted",
    });
    const candidate = await createCandidate(
      db,
      createCandidateInput.parse({
        searchProjectId: project.id,
        name: "Fixture Candidate B (test — not a real person)",
      }),
    );
    const { generateOutreach } = await import("@/lib/services/generation");
    const { getIntelligence } = await import("@/lib/services/intelligence");
    const { listResearchFindings } = await import("@/lib/services/research");
    expect(await getIntelligence(db, project.id)).toBeUndefined();
    const { sequence } = await generateOutreach(db, candidate.id);
    const row = await getIntelligence(db, project.id);
    expect(row?.payload.intent.revision).toBe(0);
    expect(row?.payload.personas?.length).toBeGreaterThan(0);
    expect((await listResearchFindings(db, project.id)).length).toBeGreaterThan(
      0,
    );
    expect(sequence.payload.personaLabel).toBe(
      row?.payload.personas?.[0].label,
    );
  });

  it("refuses outreach when research cannot happen", async () => {
    process.env.TALENTOS_RESEARCH_PROVIDER = "none";
    const { createSearchProject } =
      await import("@/lib/services/search-projects");
    const { createCandidate, createCandidateInput } =
      await import("@/lib/services/candidates");
    const project = await createSearchProject(db, {
      name: "No research",
      roleTitle: "CNC Machinist",
    });
    const candidate = await createCandidate(
      db,
      createCandidateInput.parse({
        searchProjectId: project.id,
        name: "Fixture Candidate C (test — not a real person)",
      }),
    );
    const { generateOutreach } = await import("@/lib/services/generation");
    const { ResearchRequiredError } = await import("@/lib/services/research");
    await expect(generateOutreach(db, candidate.id)).rejects.toBeInstanceOf(
      ResearchRequiredError,
    );
    const { outreachSequences } = await import("@/lib/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await db
      .select()
      .from(outreachSequences)
      .where(eq(outreachSequences.candidateId, candidate.id));
    expect(rows).toHaveLength(0);
  });
});
