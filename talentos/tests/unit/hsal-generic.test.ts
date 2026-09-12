import { describe, expect, it } from "vitest";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/domain/pipeline";
import {
  applicabilityFor,
  criteriaFromLines,
  criteriaToLines,
  defaultPeriod,
  deriveCountsFromEvents,
  inferCriterionCategory,
  localDay,
  mergeCriteriaIntoPayload,
  nextLearningId,
  parseProfileLists,
  sameProfile,
  snapshotId,
  textToList,
} from "@/lib/hsal/generic";
import {
  experimentInput,
  learningInput,
  profileChangeInput,
  snapshotInput,
} from "@/lib/hsal/action-schemas";
import { successProfilePayloadSchema } from "@/lib/core/payloads";
import { sp104 } from "../../fixtures/sp104";

describe("pipeline counts derived from workstation events", () => {
  const ev = (
    candidateId: string,
    toStage: string,
    occurredAt = "2026-09-10T10:00:00.000Z",
  ) => ({ candidateId, toStage, occurredAt });

  it("counts candidates who reached a stage or any later non-terminal stage; positive replies are never derived", () => {
    const events = [
      ev("c1", "identified"),
      ev("c1", "contacted"),
      ev("c1", "responded"),
      ev("c1", "recruiter_screen"),
      ev("c1", "hm_review"),
      ev("c2", "identified"),
      ev("c2", "contacted"),
      ev("c3", "identified"),
      ev("c3", "offer_accepted"), // skipped straight to accepted
    ];
    const { counts, unmapped, candidates } = deriveCountsFromEvents(
      DEFAULT_PIPELINE_STAGES,
      events,
    );
    expect(candidates).toBe(3);
    expect(unmapped).toEqual(["positive_reply"]);
    expect(counts).toEqual({
      sourced: 3,
      outreach_sent: 3,
      reply: 2,
      recruiter_screen: 2,
      hm_screen: 2,
      onsite: 1,
      offer: 1,
      hire: 1,
    });
    expect(counts.positive_reply).toBeUndefined();
  });

  it("keeps a candidate rejected in the window in the population, never counts terminal stages as progress, and takes progress made before the window", () => {
    const events = [
      ev("c1", "identified", "2026-08-01T00:00:00.000Z"),
      ev("c1", "hm_review", "2026-08-20T00:00:00.000Z"), // reached before the window
      ev("c1", "archived", "2026-09-05T00:00:00.000Z"), // rejected inside the window
      ev("c2", "identified", "2026-01-01T00:00:00.000Z"), // no activity in the window
      ev("c3", "closed"), // only a terminal event, inside the window
      ev("c4", "identified", "2026-10-01T00:00:00.000Z"), // after the window
    ];
    const r = deriveCountsFromEvents(DEFAULT_PIPELINE_STAGES, events, {
      start: "2026-09-01",
      end: "2026-09-30",
    });
    expect(r.candidates).toBe(2); // c1 and c3 were active in September
    expect(r.counts.sourced).toBe(1); // c1 (c3 never reached a non-terminal stage)
    expect(r.counts.hm_screen).toBe(1); // c1's earlier progress still counts
    expect(r.counts.hire).toBe(0);
  });

  it("reports funnel stages a custom stage list cannot express, leaving them for the recruiter", () => {
    const stages = [
      {
        key: "identified",
        label: "Identified",
        position: 0,
        isTerminal: false,
      },
      {
        key: "interviewing",
        label: "Interviewing",
        position: 1,
        isTerminal: false,
      },
    ];
    const r = deriveCountsFromEvents(stages, [ev("c1", "interviewing")]);
    expect(r.counts.sourced).toBe(1);
    expect(r.counts.onsite).toBe(1);
    expect(r.unmapped).toEqual([
      "outreach_sent",
      "reply",
      "positive_reply",
      "recruiter_screen",
      "hm_screen",
      "offer",
      "hire",
    ]);
    expect(Object.keys(r.counts).sort()).toEqual(["onsite", "sourced"]);
  });

  it("defaults the baseline window to the previous six weeks in local time", () => {
    const now = new Date(2026, 8, 21, 23, 30); // 21 Sep 2026, 23:30 local
    expect(defaultPeriod(now)).toEqual({
      start: "2026-08-10",
      end: "2026-09-21",
    });
    expect(localDay(now)).toBe("2026-09-21");
  });

  it("names snapshots by project and period, so a baseline and a same-day follow-up never collide", () => {
    expect(snapshotId("SP200", "2026-08-10", "2026-09-21")).toBe(
      "PIPE-SP200-20260810-20260921",
    );
    expect(snapshotId("SP200", "2026-09-21", "2026-09-21")).not.toBe(
      snapshotId("SP200", "2026-08-10", "2026-09-21"),
    );
  });
});

describe("success profile criteria editing", () => {
  const before = sp104.searchProject.successProfile;

  it("round-trips lines and keeps ids for labels that already exist, in any list", () => {
    const pool = [
      ...before.mustHave,
      ...before.preferred,
      ...before.transferable,
    ];
    const lines = criteriaToLines(before.mustHave);
    expect(criteriaFromLines(lines, pool).map((c) => c.id)).toEqual(
      before.mustHave.map((c) => c.id),
    );
    // move "Professional Go experience" to transferable: same id, no new criterion
    const moved = criteriaFromLines("Professional Go experience\nRust", pool);
    expect(moved[0]?.id).toBe("CRIT-GO");
    expect(moved[1]).toMatchObject({
      id: "CRIT-RUST",
      label: "Rust",
      category: "skill",
    });
  });

  it("dedupes, strips bullets, ignores blanks and avoids id collisions", () => {
    const out = criteriaFromLines(
      "- Kubernetes experience\n\n* kubernetes experience\nGo\nGo!",
      [],
    );
    expect(out.map((c) => c.label)).toEqual([
      "Kubernetes experience",
      "Go",
      "Go!",
    ]);
    expect(new Set(out.map((c) => c.id)).size).toBe(3);
  });

  it("parses the three lists together: a seeded 'after' profile keeps its ids and categories, ids never collide across lists, and one label in two lists is an error", () => {
    const after = sp104.successProfileAfter;
    const known = [
      ...before.mustHave,
      ...before.preferred,
      ...before.transferable,
      ...after.mustHave,
      ...after.preferred,
      ...after.transferable,
    ];
    const parsed = parseProfileLists(
      {
        mustHave: criteriaToLines(after.mustHave),
        preferred: criteriaToLines(after.preferred),
        transferable: criteriaToLines(after.transferable),
      },
      known,
    );
    expect(parsed).toEqual(after);
    const fresh = parseProfileLists(
      { mustHave: "Go", preferred: "", transferable: "Go!" },
      [],
    );
    expect(fresh.mustHave[0]?.id).toBe("CRIT-GO");
    expect(fresh.transferable[0]?.id).toBe("CRIT-GO-2");
    expect(() =>
      parseProfileLists(
        { mustHave: "Rust", preferred: "rust", transferable: "" },
        [],
      ),
    ).toThrow(/more than one list/);
  });

  it("keeps a criterion's identity but takes the recruiter's spelling, and treats a spelling fix as a change", () => {
    const stored = [
      {
        id: "CRIT-K8S",
        label: "kubernetes experience",
        category: "skill" as const,
        rationale: "platform team",
      },
    ];
    const edited = criteriaFromLines("Kubernetes Experience", stored);
    expect(edited[0]).toEqual({
      id: "CRIT-K8S",
      label: "Kubernetes Experience",
      category: "skill",
      rationale: "platform team",
    });
    const before = { mustHave: stored, preferred: [], transferable: [] };
    expect(
      sameProfile(before, {
        mustHave: edited,
        preferred: [],
        transferable: [],
      }),
    ).toBe(false);
    expect(
      sameProfile(before, {
        mustHave: criteriaFromLines("kubernetes experience", stored),
        preferred: [],
        transferable: [],
      }),
    ).toBe(true);
    // two known criteria that share an id can never both be selected
    const clashing = [
      { id: "CRIT-X", label: "Alpha", category: "skill" as const },
      { id: "CRIT-X", label: "Beta", category: "skill" as const },
    ];
    expect(() =>
      parseProfileLists(
        { mustHave: "Alpha", preferred: "Beta", transferable: "" },
        clashing,
      ),
    ).toThrow(/already used in another list/);
  });

  it("does not read 'Staff-equivalent scope' as a title proxy", () => {
    expect(inferCriterionCategory("Evidence of Staff-equivalent scope")).toBe(
      "experience",
    );
    expect(inferCriterionCategory("Current Staff Engineer title")).toBe(
      "title",
    );
    expect(inferCriterionCategory("Professional Go experience")).toBe("skill");
  });

  it("detects an unchanged profile", () => {
    expect(sameProfile(before, { ...before })).toBe(true);
    expect(
      sameProfile(before, { ...before, mustHave: before.mustHave.slice(1) }),
    ).toBe(false);
  });

  it("writes criteria into the payload without touching other sections and attributes new lines to the recruiter", () => {
    const previous = successProfilePayloadSchema.parse({
      mission: "Own the scheduler.",
      outcomes: [{ text: "Ship v2", provenance: "hiring_manager" }],
      responsibilities: [],
      mustHave: [
        {
          id: "CRIT-GO",
          text: "Professional Go experience",
          provenance: "jd",
          note: "from JD",
        },
      ],
      preferred: [],
      trainable: [],
      evidenceSignals: [],
      negativeSignals: [],
      adjacentBackgrounds: [],
      exemplarPeople: [],
      exemplarCompanies: [],
      targetIndustries: [],
      targetCompanies: [],
      alternateTitles: [],
      targetGeographies: [{ text: "Bay Area", provenance: "hiring_manager" }],
      compensationNote: "Budget $240K",
      candidateMotivators: [],
      sellingPoints: [],
      risks: [],
      unresolvedQuestions: [],
    });
    const after = {
      mustHave: [
        {
          id: "CRIT-SCOPE",
          label: "Evidence of Staff-equivalent scope",
          category: "experience" as const,
        },
      ],
      preferred: [],
      transferable: [
        {
          id: "CRIT-GO",
          label: "Professional Go experience",
          category: "skill" as const,
        },
      ],
    };
    const merged = mergeCriteriaIntoPayload(previous, after);
    expect(merged.mission).toBe("Own the scheduler.");
    expect(merged.outcomes).toEqual(previous.outcomes);
    expect(merged.targetGeographies).toEqual(previous.targetGeographies);
    expect(merged.compensationNote).toBe("Budget $240K");
    expect(merged.trainable[0]).toMatchObject({
      id: "CRIT-GO",
      provenance: "jd",
      note: "from JD",
    });
    expect(merged.mustHave[0]).toMatchObject({
      id: "CRIT-SCOPE",
      provenance: "recruiter",
    });
    // no previous payload: neutral defaults, nothing product-specific
    const fresh = mergeCriteriaIntoPayload(undefined, after);
    expect(fresh.mission).toBe("");
    expect(fresh.compensationNote).toBeUndefined();
  });
});

describe("learning defaults", () => {
  it("allocates sequential ids per project", () => {
    expect(nextLearningId("SP200", [])).toBe("LEARN-SP200-001");
    expect(
      nextLearningId("SP200", [
        "LEARN-SP200-001",
        "LEARN-SP200-007",
        "LEARN-SP104-001",
      ]),
    ).toBe("LEARN-SP200-008");
  });

  it("scopes applicability from the project record", () => {
    const a = applicabilityFor({
      roleTitle: "Senior / Staff Distributed Systems Engineer",
      seniority: "senior, staff",
      industry: "AI infrastructure",
      geography: "Bay Area",
    });
    expect(a.roleFamilies).toEqual(["Distributed Systems Engineer"]);
    expect(a.seniority).toEqual(["senior", "staff"]);
    expect(textToList("Go/Rust, Kubernetes; SRE")).toEqual([
      "Go/Rust",
      "Kubernetes",
      "SRE",
    ]);
    expect(a.industries).toEqual(["AI infrastructure"]);
    expect(a.geographies).toEqual(["Bay Area"]);
    expect(applicabilityFor({ roleTitle: "Recruiter" })).toEqual({
      roleFamilies: ["Recruiter"],
    });
  });
});

describe("action boundaries", () => {
  const counts = {
    sourced: "124",
    outreach_sent: "118",
    reply: "17",
    positive_reply: "9",
    recruiter_screen: "6",
    hm_screen: "4",
    onsite: "1",
    offer: "0",
    hire: "0",
  };

  it("rejects a blank count instead of recording a zero, and a reversed period", () => {
    const ok = snapshotInput.safeParse({
      searchProjectId: "SP200",
      periodStart: "2026-08-10",
      periodEnd: "2026-09-21",
      counts,
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.counts.sourced).toBe(124);
    const blank = snapshotInput.safeParse({
      searchProjectId: "SP200",
      periodStart: "2026-08-10",
      periodEnd: "2026-09-21",
      counts: { ...counts, positive_reply: "" },
    });
    expect(blank.success).toBe(false);
    const reversed = snapshotInput.safeParse({
      searchProjectId: "SP200",
      periodStart: "2026-09-22",
      periodEnd: "2026-09-21",
      counts,
    });
    expect(reversed.success).toBe(false);
  });

  it("requires observations with content and a consistent advanced/total pair", () => {
    const base = {
      searchProjectId: "SP200",
      interventionId: "I-1",
      summary: "x",
    };
    expect(
      experimentInput.safeParse({ ...base, observations: ["  ", ""] }).success,
    ).toBe(false);
    expect(
      experimentInput.safeParse({
        ...base,
        observations: [" seven advanced "],
        advanced: "7",
        total: "10",
      }).success,
    ).toBe(true);
    expect(
      experimentInput.safeParse({
        ...base,
        observations: ["a"],
        advanced: "11",
        total: "10",
      }).success,
    ).toBe(false);
    expect(
      experimentInput.safeParse({ ...base, observations: ["a"], advanced: "7" })
        .success,
    ).toBe(false);
  });

  it("scopes client-supplied learning ids to the search and splits tags on commas only", () => {
    const base = {
      searchProjectId: "SP200",
      title: "t",
      statement: "s",
      category: "other",
      confidence: "0.6",
    };
    expect(
      learningInput.safeParse({ ...base, id: "LEARN-SP104-001" }).success,
    ).toBe(false);
    const ok = learningInput.safeParse({
      ...base,
      id: "LEARN-SP200-001",
      applicability: { skills: "Go/Rust, K8s" },
    });
    expect(ok.success).toBe(true);
    if (ok.success)
      expect(ok.data.applicability.skills).toEqual(["Go/Rust", "K8s"]);
  });

  it("accepts known criteria on a profile change", () => {
    const r = profileChangeInput.safeParse({
      searchProjectId: "SP104",
      mustHave: "x",
      knownCriteria: sp104.successProfileAfter.mustHave,
    });
    expect(r.success).toBe(true);
  });
});
