/**
 * Wave B acceptance: recruiter review decisions deterministically reshape
 * the String Lab vocabulary with a visible reason per term; dismissals
 * never negate; protected-trait and contact-looking quotes are blocked;
 * persisted rows carry calibration and requirement linkage that pass the
 * fair-hiring scan.
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";
import {
  buildSignals,
  CORRECTION_NOTE,
  decisionsForQuery,
  deriveTermDecisions,
  EMPTY_SIGNALS,
  MUST_HAVE_CAP,
  shortQuoteTerm,
  signalsFingerprint,
  summarizeOutcomes,
  termMatches,
  type CalibrationSignals,
  type LinkOutcome,
} from "@/lib/domain/calibration";
import { scanPayloadForProtectedTraits } from "@/lib/domain/fair-hiring";
import type { StringLabInput } from "@/lib/domain/search-strings";
import {
  createSearchProject,
  saveJobDescription,
} from "@/lib/services/search-projects";
import { createCandidate } from "@/lib/services/candidates";
import { listDocuments } from "@/lib/services/documents";
import {
  addReviewRequirement,
  generatePlannedQueries,
} from "@/lib/services/intelligence";
import {
  addConnection,
  correctConnection,
  recordReview,
  startComparison,
} from "@/lib/services/document-review";
import { loadCalibrationSignals } from "@/lib/services/calibration";
import { generateSearchStrings } from "@/lib/services/generation";
import { listQueries } from "@/lib/services/workflow";

const base: StringLabInput = {
  titles: ["Research Scientist"],
  alternateTitles: [],
  adjacentTitles: [],
  mustHave: ["alignment"],
  anyOf: ["interpretability", "evaluation"],
  credentials: ["PhD"],
  locations: [],
  companies: [],
  exclusions: ["recruiter"],
};

function signalsFrom(
  quotes: {
    requirementId: string;
    label: string;
    kind: "must_have" | "preferred" | "trainable" | "disqualifier";
    quote: string;
    candidateId: string;
    assessment?: "relevant" | "partial" | "contradictory" | "unknown";
    latest?: LinkOutcome["latest"];
  }[],
): { signals: CalibrationSignals; outcomes: LinkOutcome[] } {
  const outcomes: LinkOutcome[] = quotes.map((q, i) => ({
    linkId: `l${i}`,
    candidateId: q.candidateId,
    requirementId: q.requirementId,
    quote: q.quote,
    assessment: q.assessment ?? "relevant",
    latest: q.latest ?? "accepted",
  }));
  const requirements = [
    ...new Map(
      quotes.map((q) => [
        q.requirementId,
        { id: q.requirementId, label: q.label, kind: q.kind },
      ]),
    ).values(),
  ];
  return { signals: buildSignals(outcomes, requirements), outcomes };
}

describe("outcomes and signals", () => {
  it("reports the latest decision per link and classifies the correction convention", () => {
    const outcomes = summarizeOutcomes(
      [
        {
          id: "a",
          comparisonId: "c1",
          payload: {
            requirementId: "r1",
            cvAnchor: { start: 0, end: 5, quote: "Rust" },
            jdAnchor: null,
            explanation: "x",
            limitation: "",
            assessment: "relevant",
          },
        },
        {
          id: "b",
          comparisonId: "c1",
          payload: {
            requirementId: "r1",
            cvAnchor: { start: 0, end: 5, quote: "Rust" },
            jdAnchor: null,
            explanation: "x",
            limitation: "",
            assessment: "relevant",
          },
        },
      ],
      [
        {
          linkId: "a",
          decision: "accepted",
          note: "ok",
          createdAt: "2026-01-01T00:00:00Z",
        },
        {
          linkId: "a",
          decision: "dismissed",
          note: "Corrected by connection b",
          createdAt: "2026-01-02T00:00:00Z",
        },
      ],
      [{ id: "c1", candidateId: "cand" }],
    );
    expect(CORRECTION_NOTE.test("Corrected by connection b")).toBe(true);
    expect(outcomes.find((o) => o.linkId === "a")?.latest).toBe("corrected");
    expect(outcomes.find((o) => o.linkId === "b")?.latest).toBe("unreviewed");
    expect(outcomes[0].candidateId).toBe("cand");
  });

  it("joins requirement kind from the live IR and counts accepted by assessment", () => {
    const { signals } = signalsFrom([
      {
        requirementId: "r1",
        label: "Rust",
        kind: "must_have",
        quote: "Rust",
        candidateId: "a",
      },
      {
        requirementId: "r1",
        label: "Rust",
        kind: "must_have",
        quote: "Rust",
        candidateId: "b",
        assessment: "partial",
      },
      {
        requirementId: "r1",
        label: "Rust",
        kind: "must_have",
        quote: "Go",
        candidateId: "c",
        latest: "dismissed",
      },
    ]);
    const r = signals.requirements[0];
    expect(r.kind).toBe("must_have");
    expect(r.accepted.relevant).toBe(1);
    expect(r.accepted.partial).toBe(1);
    expect(r.dismissed).toBe(1);
    expect(r.candidates).toBe(2);
    expect(signals.reviewedLinks).toBe(3);
    expect(signals.candidates).toBe(3);
  });

  it("fingerprints decisions so a flipped decision on the same link reads as changed", () => {
    const accepted = signalsFrom([
      {
        requirementId: "r1",
        label: "Rust",
        kind: "must_have",
        quote: "Rust",
        candidateId: "a",
      },
    ]);
    const dismissed = signalsFrom([
      {
        requirementId: "r1",
        label: "Rust",
        kind: "must_have",
        quote: "Rust",
        candidateId: "a",
        latest: "dismissed",
      },
    ]);
    expect(signalsFingerprint(accepted.outcomes)).not.toBe(
      signalsFingerprint(dismissed.outcomes),
    );
    expect(signalsFingerprint(accepted.outcomes)).toBe(
      signalsFingerprint(accepted.outcomes),
    );
    expect(signalsFingerprint([])).toBe(signalsFingerprint([]));
  });

  it("matches terms word-bounded and case-insensitively", () => {
    expect(termMatches("Built reliable Python services", "python")).toBe(true);
    expect(termMatches("Pythonic code", "python")).toBe(false);
    expect(termMatches('("Research Scientist" OR x) "C++"', "C++")).toBe(true);
  });

  it("turns only short, non-PII quotes into terms", () => {
    expect(shortQuoteTerm("Built reliable Python services.")).toBe(
      "Built reliable Python services",
    );
    expect(
      shortQuoteTerm("Led a team that shipped a distributed system in 2019."),
    ).toBeNull();
    expect(shortQuoteTerm("jane@example.com")).toBeNull();
    expect(shortQuoteTerm("+44 7700 900123")).toBeNull();
    expect(shortQuoteTerm("ab")).toBeNull();
  });
});

describe("deriveTermDecisions", () => {
  it("is the identity with no reviews", () => {
    const { input, decisions } = deriveTermDecisions(base, EMPTY_SIGNALS);
    expect(input).toEqual(base);
    expect(decisions).toEqual([]);
  });

  it("promotes an any-of term only with accepted evidence from two candidates", () => {
    const one = signalsFrom([
      {
        requirementId: "r1",
        label: "Interp",
        kind: "must_have",
        quote: "interpretability work",
        candidateId: "a",
      },
      {
        requirementId: "r1",
        label: "Interp",
        kind: "must_have",
        quote: "more interpretability",
        candidateId: "a",
      },
    ]);
    const single = deriveTermDecisions(base, one.signals, one.outcomes);
    expect(
      single.decisions.find((d) => d.term === "interpretability")?.action,
    ).toBe("supported");
    expect(single.input.mustHave).toEqual(["alignment"]);

    const two = signalsFrom([
      {
        requirementId: "r1",
        label: "Interp",
        kind: "must_have",
        quote: "interpretability work",
        candidateId: "a",
      },
      {
        requirementId: "r1",
        label: "Interp",
        kind: "must_have",
        quote: "more interpretability",
        candidateId: "b",
      },
    ]);
    const promoted = deriveTermDecisions(base, two.signals, two.outcomes);
    const d = promoted.decisions.find((x) => x.term === "interpretability");
    expect(d?.action).toBe("promoted_to_must_have");
    expect(d?.reason).toBe(
      "2 accepted anchors across 2 candidates, 0 dismissed (R: Interp)",
    );
    expect(promoted.input.mustHave).toEqual(["alignment", "interpretability"]);
    expect(promoted.input.anyOf).toEqual(["evaluation"]);
  });

  it("respects the must-have cap", () => {
    const two = signalsFrom([
      {
        requirementId: "r1",
        label: "Interp",
        kind: "must_have",
        quote: "interpretability",
        candidateId: "a",
      },
      {
        requirementId: "r1",
        label: "Interp",
        kind: "must_have",
        quote: "interpretability",
        candidateId: "b",
      },
    ]);
    const capped = deriveTermDecisions(
      { ...base, mustHave: ["alignment", "safety", "RLHF"] },
      two.signals,
      two.outcomes,
    );
    expect(capped.input.mustHave).toHaveLength(MUST_HAVE_CAP);
    expect(
      capped.decisions.find((d) => d.term === "interpretability")?.action,
    ).toBe("supported");
  });

  it("demotes a must-have with two dismissals and no accepted evidence, never removes it", () => {
    const s = signalsFrom([
      {
        requirementId: "r1",
        label: "Align",
        kind: "must_have",
        quote: "alignment research",
        candidateId: "a",
        latest: "dismissed",
      },
      {
        requirementId: "r1",
        label: "Align",
        kind: "must_have",
        quote: "alignment lead",
        candidateId: "b",
        latest: "dismissed",
      },
    ]);
    const { input, decisions } = deriveTermDecisions(
      base,
      s.signals,
      s.outcomes,
    );
    expect(decisions.find((d) => d.term === "alignment")?.action).toBe(
      "demoted_to_any_of",
    );
    expect(input.mustHave).toEqual([]);
    expect(input.anyOf).toContain("alignment");
  });

  it("removes an any-of term only on accepted contradictory evidence", () => {
    const dismissedOnly = signalsFrom([
      {
        requirementId: "r1",
        label: "Eval",
        kind: "preferred",
        quote: "evaluation",
        candidateId: "a",
        latest: "dismissed",
      },
      {
        requirementId: "r1",
        label: "Eval",
        kind: "preferred",
        quote: "evaluation",
        candidateId: "b",
        latest: "dismissed",
      },
    ]);
    const flagged = deriveTermDecisions(
      base,
      dismissedOnly.signals,
      dismissedOnly.outcomes,
    );
    expect(flagged.decisions.find((d) => d.term === "evaluation")?.action).toBe(
      "flagged",
    );
    expect(flagged.input.anyOf).toContain("evaluation");

    const contradictory = signalsFrom([
      {
        requirementId: "r1",
        label: "Eval",
        kind: "preferred",
        quote: "evaluation",
        candidateId: "a",
        assessment: "contradictory",
      },
      {
        requirementId: "r1",
        label: "Eval",
        kind: "preferred",
        quote: "evaluation",
        candidateId: "b",
        assessment: "contradictory",
      },
    ]);
    const removed = deriveTermDecisions(
      base,
      contradictory.signals,
      contradictory.outcomes,
    );
    expect(removed.decisions.find((d) => d.term === "evaluation")?.action).toBe(
      "removed",
    );
    expect(removed.input.anyOf).not.toContain("evaluation");
  });

  it("adds a short accepted quote as any-of with the reason text, and a disqualifier quote as an exclusion", () => {
    const s = signalsFrom([
      {
        requirementId: "r1",
        label: "Build reliable Python services.",
        kind: "must_have",
        quote: "Built reliable Python services.",
        candidateId: "a",
      },
      {
        requirementId: "r2",
        label: "No agencies",
        kind: "disqualifier",
        quote: "staffing agency",
        candidateId: "a",
      },
    ]);
    const { input, decisions } = deriveTermDecisions(
      base,
      s.signals,
      s.outcomes,
    );
    const added = decisions.find((d) => d.action === "added_any_of");
    expect(added?.term).toBe("Built reliable Python services");
    expect(added?.reason).toBe(
      "1 accepted anchor across 1 candidate, 0 dismissed (R: Build reliable Python services.)",
    );
    expect(input.anyOf).toContain("Built reliable Python services");
    const excluded = decisions.find((d) => d.action === "added_exclusion");
    expect(excluded?.term).toBe("staffing agency");
    expect(input.exclusions).toContain("staffing agency");
  });

  it("blocks protected-trait and contact-looking quotes and never adds them", () => {
    const s = signalsFrom([
      {
        requirementId: "r1",
        label: "Service",
        kind: "must_have",
        quote: "veteran status",
        candidateId: "a",
      },
      {
        requirementId: "r1",
        label: "Service",
        kind: "must_have",
        quote: "jane@example.com",
        candidateId: "a",
      },
    ]);
    const { input, decisions } = deriveTermDecisions(
      base,
      s.signals,
      s.outcomes,
    );
    const blocked = decisions.filter((d) => d.action === "blocked");
    expect(blocked.map((d) => d.term)).toEqual(["veteran status"]);
    expect(input.anyOf).toEqual(base.anyOf);
    expect(JSON.stringify(input)).not.toContain("example.com");
  });

  it("never touches titles and leaves trainable requirements at supported/flagged", () => {
    const s = signalsFrom([
      {
        requirementId: "r1",
        label: "Coaching",
        kind: "trainable",
        quote: "interpretability",
        candidateId: "a",
      },
      {
        requirementId: "r1",
        label: "Coaching",
        kind: "trainable",
        quote: "interpretability",
        candidateId: "b",
      },
    ]);
    const { input, decisions } = deriveTermDecisions(
      base,
      s.signals,
      s.outcomes,
    );
    expect(input.titles).toEqual(base.titles);
    expect(decisions.find((d) => d.term === "interpretability")?.action).toBe(
      "supported",
    );
  });

  it("filters decisions to the terms present in a string", () => {
    const s = signalsFrom([
      {
        requirementId: "r1",
        label: "Interp",
        kind: "must_have",
        quote: "interpretability",
        candidateId: "a",
      },
    ]);
    const { decisions } = deriveTermDecisions(base, s.signals, s.outcomes);
    expect(
      decisionsForQuery('"Research Scientist" alignment', decisions),
    ).toEqual([]);
    expect(
      decisionsForQuery(
        '"Research Scientist" (interpretability OR x)',
        decisions,
      ),
    ).toHaveLength(1);
  });
});

describe("persisted calibration", () => {
  let db: Db,
    sqlite: Database.Database,
    dir: string,
    project: string,
    candidate: string,
    requirement: string;
  const cv = "Built reliable Python services. Led incident reviews.";
  const jd = "Build reliable Python services. Own production incidents.";

  beforeEach(async () => {
    dir = mkdtempSync(path.join(tmpdir(), "calibration-"));
    process.env.TALENTOS_DOCUMENT_DIR = path.join(dir, "originals");
    process.env.TALENTOS_MODEL_PROVIDER = "mock";
    sqlite = new Database(path.join(dir, "test.db"));
    sqlite.pragma("foreign_keys = ON");
    db = drizzle(sqlite, { schema });
    migrate(db, { migrationsFolder: path.resolve("drizzle") });
    project = (
      await createSearchProject(db, {
        name: "Calibration",
        roleTitle: "Engineer",
      })
    ).id;
    candidate = (
      await createCandidate(db, {
        searchProjectId: project,
        name: "Fixture Person",
        resumeText: cv,
        profileUrls: [],
        stage: "identified",
      })
    ).id;
    await saveJobDescription(db, {
      searchProjectId: project,
      rawText: jd,
      source: "pasted",
    });
    const doc = listDocuments(db, project, undefined, "jd")[0];
    requirement = (
      await addReviewRequirement(db, {
        searchProjectId: project,
        statement: "Build reliable Python services.",
        origin: "jd",
        jdVersionId: doc.id,
        anchor: { start: 0, end: 31, quote: jd.slice(0, 31) },
      })
    ).id!;
  });
  afterEach(() => {
    sqlite.close();
    rmSync(dir, { recursive: true, force: true });
    delete process.env.TALENTOS_DOCUMENT_DIR;
  });

  function link(assessment: "relevant" | "partial" = "relevant") {
    return {
      requirementId: requirement,
      cvAnchor: { start: 0, end: 31, quote: cv.slice(0, 31) },
      jdAnchor: { start: 0, end: 31, quote: jd.slice(0, 31) },
      assessment,
      explanation: "Python services are stated.",
      limitation: "Self-authored.",
    };
  }

  it("loads signals from review decisions, including corrections", async () => {
    const c = startComparison(db, project, candidate);
    const l = addConnection(db, c.id, link());
    recordReview(db, { linkId: l.id, decision: "accepted", note: "ok" });
    const replacement = correctConnection(db, c.id, l.id, link("partial"));
    recordReview(db, {
      linkId: replacement.id,
      decision: "accepted",
      note: "better",
    });
    const { signals } = await loadCalibrationSignals(db, project);
    const r = signals.requirements.find(
      (x) => x.requirementId === requirement,
    )!;
    expect(r.kind).toBe("must_have");
    expect(r.corrected).toBe(1);
    expect(r.accepted.partial).toBe(1);
    expect(signals.reviewedLinks).toBe(2);
  });

  it("persists calibration decisions and requirement linkage that pass the fair-hiring scan", async () => {
    const c = startComparison(db, project, candidate);
    const l = addConnection(db, c.id, link());
    recordReview(db, { linkId: l.id, decision: "accepted", note: "ok" });
    const result = await generateSearchStrings(db, project);
    expect(result.calibration.reviewedLinks).toBe(1);
    expect(
      result.calibration.decisions.some((d) => d.action === "added_any_of"),
    ).toBe(true);
    const rows = await listQueries(db, project);
    const withTerm = rows.filter((r) =>
      r.query.includes("Built reliable Python services"),
    );
    expect(withTerm.length).toBeGreaterThan(0);
    for (const row of withTerm) {
      expect(row.calibration?.decisions.map((d) => d.term)).toContain(
        "Built reliable Python services",
      );
      expect(row.linkedRequirementIds).toContain(requirement);
      expect(scanPayloadForProtectedTraits(row.calibration)).toEqual([]);
    }
    const untouched = rows.filter(
      (r) => !r.query.includes("Built reliable Python services"),
    );
    for (const row of untouched) {
      expect(row.calibration?.decisions ?? []).toEqual([]);
    }
  });

  it("composes and persists plan-derived strings with requirement links, merging on collision", async () => {
    await db
      .update(schema.hiringIntelligence)
      .set({
        payload: {
          ...(await db
            .select()
            .from(schema.hiringIntelligence)
            .where(eq(schema.hiringIntelligence.searchProjectId, project))
            .get())!.payload,
          searchPlan: {
            queryPlans: [
              {
                segmentLabel: "Core",
                titles: ["Engineer"],
                alternateTitles: [],
                adjacentTitles: [],
                mustHaveTerms: ["Python"],
                anyOfTerms: [],
                credentials: [],
                locations: [],
                exclusions: [],
                linkedRequirementIds: [requirement],
                rationale: "fixture",
              },
            ],
            sequencing: [],
          },
        },
      })
      .where(eq(schema.hiringIntelligence.searchProjectId, project));
    const first = await generatePlannedQueries(db, project);
    expect(first.added).toBeGreaterThan(0);
    expect(first.segments).toBe(1);
    const rows = await listQueries(db, project);
    expect(
      rows.every((r) => r.linkedRequirementIds?.includes(requirement)),
    ).toBe(true);
    const keys = rows.map((r) =>
      r.query.toLowerCase().replace(/\s+/g, " ").trim(),
    );
    expect(new Set(keys).size).toBe(keys.length);
    const second = await generatePlannedQueries(db, project);
    expect(second.added).toBe(0);
  });
});
