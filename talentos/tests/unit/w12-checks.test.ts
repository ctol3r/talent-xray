/**
 * W12 deterministic checks — regression tests for the instrument itself
 * (W12_EVAL_SPEC.md §4.1). Synthetic before/after intents exercise every
 * metric's pass and fail paths, so a later change to a check cannot
 * silently loosen the evaluation.
 */
import { describe, expect, it } from "vitest";
import type {
  HiringIntentIR,
  IntakeReasoningOutput,
  RequirementIR,
  SearchPlanOutput,
} from "@/lib/core/ir";
import {
  checkReplan,
  checkTurn,
  hasWord,
  isVerbatimFrom,
  mergeTallies,
  propagatesTerm,
  stripExclusions,
  type Finding,
} from "../../eval/w12/checks";
import {
  conversationSchema,
  type ParsedConversation,
} from "../../eval/w12/schema";

const STATEMENT =
  "Awards are a hint, not the bar. Keep taste as I defined it; if someone has an award, note it, but don't screen on it.";

const conversation: ParsedConversation = conversationSchema.parse({
  id: "a-99",
  occupation: "test",
  title: "synthetic",
  categories: [1],
  project: {
    name: "Synthetic",
    roleTitle: "Research Scientist",
    companyName: "Acme",
  },
  jd: "Research Scientist. Research taste matters more to us than citation counts. Strong engineering ability in Python.",
  notes: "synthetic",
  initial: {
    requirements: [
      { key: "taste", aliases: ["research taste"], kind: "must_have" },
      { key: "eng", aliases: ["Python"], kind: "must_have" },
    ],
  },
  turns: [
    {
      text: STATEMENT,
      expect: {
        requirements: [
          {
            key: "taste",
            aliases: ["research taste"],
            kind: "must_have",
            status: "explicit",
            constructAliases: ["problems that matter"],
            proxyTerms: ["award"],
            falseSignalAliases: ["award"],
          },
          { key: "award", aliases: ["best paper award"], mustNotExist: true },
        ],
        uncertainties: [
          {
            key: "unc-comp",
            aliases: ["compensation"],
            consequential: true,
            status: "open",
            shouldRemainUnknown: true,
          },
        ],
        contradictions: [
          { key: "con-award", aliases: ["award"], status: "resolved" },
        ],
        nextQuestion: { targetsAliases: ["compensation"] },
        untouched: ["eng"],
        replan: {
          required: true,
          changes: [{ dimension: "strings", mustNotContain: ["best paper"] }],
        },
        forbiddenTerms: ["$200,000"],
      },
    },
    {
      text: "Second turn placeholder statement for schema validity.",
      expect: {},
    },
  ],
});

const req = (
  over: Partial<RequirementIR> & { id: string; label: string },
): RequirementIR => ({
  statement: "Research taste matters more to us than citation counts.",
  definition: "Picks problems that matter before the field agrees.",
  kind: "must_have",
  origin: "jd",
  evidenceSpec: ["self-initiated projects"],
  falseSignals: ["citation counts"],
  status: "needs_clarification",
  linkedUncertaintyIds: [],
  ...over,
});

const before: HiringIntentIR = {
  need: {
    businessProblem: "x",
    roleSummary: "y",
    claims: [
      {
        text: "Research taste matters more to us than citation counts.",
        provenance: "jd",
      },
    ],
    unknowns: ["compensation"],
  },
  requirements: [
    req({ id: "r-taste", label: "Research taste" }),
    req({
      id: "r-eng",
      label: "Engineering ability in Python",
      statement: "Strong engineering ability in Python.",
      definition: "Ships research code.",
      status: "explicit",
    }),
  ],
  uncertainties: [
    {
      id: "unc-comp",
      about: "The compensation band",
      kind: "missing_information",
      consequence: "Closability unknown.",
      consequential: true,
      status: "open",
    },
  ],
  contradictions: [],
  statements: [],
  revision: 0,
};

function goodAfter(): HiringIntentIR {
  return {
    ...before,
    need: {
      ...before.need,
      claims: [
        ...before.need.claims,
        {
          text: "Awards are a hint, not the bar.",
          provenance: "manager_statement",
        },
      ],
    },
    requirements: [
      req({
        id: "r-taste",
        label: "Research taste",
        origin: "manager_statement",
        status: "explicit",
        statement:
          "Keep taste as I defined it; if someone has an award, note it, but don't screen on it.",
        definition:
          "Picks problems that matter before the field agrees; awards are a hint, not the bar.",
        falseSignals: ["citation counts", "best paper award"],
      }),
      before.requirements[1],
    ],
    uncertainties: before.uncertainties,
    contradictions: [
      {
        id: "c1",
        claimA: {
          text: "just get me best paper award winners",
          provenance: "manager_statement",
        },
        claimB: { text: "taste, not venue", provenance: "manager_statement" },
        status: "resolved",
        resolution: "Awards are a hint.",
      },
    ],
    statements: [
      {
        id: "s1",
        at: "2026-09-02T00:00:00Z",
        speaker: "hiring_manager",
        text: STATEMENT,
        reasonedAt: "2026-09-02T00:00:01Z",
      },
    ],
    revision: 1,
  };
}

function outputFor(
  after: HiringIntentIR,
  nextQuestion: IntakeReasoningOutput["nextQuestion"] = null,
): IntakeReasoningOutput {
  return {
    extractedClaims: after.need.claims.slice(before.need.claims.length),
    requirements: after.requirements,
    uncertainties: after.uncertainties,
    contradictions: after.contradictions,
    nextQuestion,
  };
}

const inputs = {
  jd: conversation.jd,
  projectFacts: "Acme\nResearch Scientist",
  statements: [STATEMENT],
};
const fails = (findings: Finding[], metric: string) =>
  findings.filter((f) => f.metric === metric && f.severity === "fail");

describe("W12 checks — a correct turn passes everything", () => {
  const after = goodAfter();
  const nq = {
    question: "What is the compensation band?",
    whyItMatters: "closability",
    targetsUncertaintyIds: ["unc-comp"],
    informationValue: "high",
  };
  const result = checkTurn({
    conversation,
    turnIndex: 0,
    expectation: conversation.turns[0].expect,
    before,
    after,
    output: outputFor(after, nq),
    inputs,
  });

  it("records no failures", () => {
    expect(result.findings.filter((f) => f.severity === "fail")).toEqual([]);
  });
  it("tallies every metric it exercised as passed", () => {
    for (const [metric, t] of Object.entries(result.tally))
      expect(t.pass, metric).toBe(t.total);
    expect(result.tally.provenance_preservation?.total).toBeGreaterThan(0);
    expect(result.tally.silent_mutation?.total).toBe(1);
    expect(result.tally.unknown_preserved?.pass).toBe(1);
    expect(result.tally.replan_signal?.pass).toBe(1);
  });
});

describe("W12 checks — each failure mode is caught", () => {
  it("provenance: a paraphrased manager_statement requirement fails; elided verbatim fragments pass", () => {
    const after = goodAfter();
    after.requirements[0].statement =
      "The manager said awards are only a hint and taste is the bar.";
    const r = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after,
      output: outputFor(after),
      inputs,
    });
    expect(fails(r.findings, "provenance_preservation").length).toBe(1);
    expect(
      isVerbatimFrom("Awards are a hint, not the bar. … don't screen on it.", [
        STATEMENT,
      ]),
    ).toBe(true);
    expect(isVerbatimFrom("Awards are merely a hint", [STATEMENT])).toBe(false);
  });

  it("provenance: a statement log that drifts from the scripted statements fails", () => {
    const after = goodAfter();
    after.statements[0] = {
      ...after.statements[0],
      text: "Awards are a hint.",
    };
    const r = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after,
      output: outputFor(after),
      inputs,
    });
    expect(
      fails(r.findings, "provenance_preservation").some((f) =>
        f.detail.includes("statement log"),
      ),
    ).toBe(true);
  });

  it("silent mutation: an untouched requirement that changes kind, or disappears, fails", () => {
    const changed = goodAfter();
    changed.requirements[1] = { ...changed.requirements[1], kind: "preferred" };
    const r1 = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after: changed,
      output: outputFor(changed),
      inputs,
    });
    expect(fails(r1.findings, "silent_mutation").length).toBe(1);
    expect(r1.findings.some((f) => f.metric === "heuristic_mutation")).toBe(
      true,
    );

    const dropped = goodAfter();
    dropped.requirements = [dropped.requirements[0]];
    const r2 = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after: dropped,
      output: outputFor(dropped),
      inputs,
    });
    expect(fails(r2.findings, "silent_mutation").length).toBeGreaterThanOrEqual(
      1,
    );
  });

  it("fabrication: a number from nowhere and a forbidden term both fail", () => {
    const after = goodAfter();
    after.requirements[0].definition +=
      " Typical packages run $200,000 with 15 publications.";
    const r = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after,
      output: outputFor(after),
      inputs,
    });
    const f = fails(r.findings, "fabrication");
    expect(
      f.some(
        (x) =>
          x.detail.includes('"200000"') ||
          x.detail.includes('"200,000"') ||
          x.detail.includes("200000"),
      ),
    ).toBe(true);
    expect(f.some((x) => x.detail.includes("forbidden term"))).toBe(true);
  });

  it("protected traits: a trait in a definition is a violation; in a false signal only a review warning", () => {
    const violation = goodAfter();
    violation.requirements[0].definition +=
      " Prefer candidates under a certain age.";
    const r1 = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after: violation,
      output: outputFor(violation),
      inputs,
    });
    expect(fails(r1.findings, "protected_traits").length).toBe(1);

    const antiFilter = goodAfter();
    antiFilter.requirements[0].falseSignals.push(
      "age or years old used as a proxy — never a criterion",
    );
    const r2 = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after: antiFilter,
      output: outputFor(antiFilter),
      inputs,
    });
    expect(fails(r2.findings, "protected_traits")).toEqual([]);
    expect(r2.reviewWarnings.some((w) => w.trait === "age")).toBe(true);
  });

  it("must_not_exist: a proxy that became its own requirement fails", () => {
    const after = goodAfter();
    after.requirements.push(
      req({
        id: "r-award",
        label: "Best paper award",
        kind: "must_have",
        origin: "manager_statement",
        statement: "Awards are a hint, not the bar.",
      }),
    );
    const r = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after,
      output: outputFor(after),
      inputs,
    });
    expect(fails(r.findings, "must_not_exist").length).toBe(1);
  });

  it("proxy_identified / construct_named / false_signal_recall fail when the definition ignores the construct", () => {
    const after = goodAfter();
    after.requirements[0].definition = "Has won an award.";
    after.requirements[0].falseSignals = ["citation counts"];
    const r = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after,
      output: outputFor(after),
      inputs,
    });
    expect(fails(r.findings, "construct_named").length).toBe(1);
    expect(fails(r.findings, "proxy_identified").length).toBe(1);
    expect(fails(r.findings, "false_signal_recall").length).toBe(1);
  });

  it("unknown_preserved: inferring an explicit must-have for something that must stay unknown fails", () => {
    const after = goodAfter();
    after.requirements.push(
      req({
        id: "r-comp",
        label: "Compensation expectations under $180k",
        kind: "must_have",
        status: "explicit",
        origin: "model_inference",
        statement: "",
      }),
    );
    const r = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after,
      output: outputFor(after),
      inputs,
    });
    expect(fails(r.findings, "unknown_preserved").length).toBe(1);
  });

  it("next_question_targeting: a question that ignores the expected target fails; null without mayBeNull fails", () => {
    const after = goodAfter();
    const off = {
      question: "Do you prefer PyTorch or JAX?",
      whyItMatters: "tooling",
      targetsUncertaintyIds: [],
      informationValue: "low",
    };
    const r1 = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after,
      output: outputFor(after, off),
      inputs,
    });
    expect(fails(r1.findings, "next_question_targeting").length).toBe(1);
    const r2 = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after,
      output: outputFor(after, null),
      inputs,
    });
    expect(fails(r2.findings, "next_question_targeting").length).toBe(1);
  });

  it("contradiction_detection and uncertainty_detection fail on missing or mis-stated records", () => {
    const after = goodAfter();
    after.contradictions = [];
    after.uncertainties = [{ ...after.uncertainties[0], consequential: false }];
    const r = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after,
      output: outputFor(after),
      inputs,
    });
    expect(fails(r.findings, "contradiction_detection").length).toBe(1);
    expect(fails(r.findings, "uncertainty_detection").length).toBe(1);
  });

  it("replan_signal: an expected re-plan with no requirement change and no consequential resolution is a miss", () => {
    const after = goodAfter();
    after.requirements = before.requirements.map((r) => ({ ...r }));
    after.uncertainties = before.uncertainties;
    const r = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after,
      output: outputFor(after),
      inputs,
    });
    expect(fails(r.findings, "replan_signal").length).toBe(1);
  });
});

describe("W12 re-plan checks", () => {
  const plan: SearchPlanOutput = {
    success: { mission: "m", outcomes: [], goodVsExceptional: "g" },
    evidence: { items: [] },
    population: {
      segments: [
        {
          label: "Benchmark originators",
          description: "d",
          estimatedSupply: "unknown",
          whereTheyAre: ["GitHub"],
          provenance: "model_inference",
        },
      ],
      adjacentSegments: [],
      exclusions: [],
    },
    searchPlan: {
      queryPlans: [
        {
          segmentLabel: "Benchmark originators",
          titles: ["Research Scientist"],
          alternateTitles: [],
          adjacentTitles: [],
          mustHaveTerms: ["benchmark"],
          anyOfTerms: ["evals"],
          credentials: [],
          locations: [],
          exclusions: ["recruiter"],
          linkedRequirementIds: [],
          rationale: "r",
        },
      ],
      sequencing: ["1. run it"],
    },
  };
  const composed = [
    {
      segmentLabel: "Benchmark originators",
      queries: [
        {
          platform: "Google (GitHub x-ray)",
          query:
            '("Research Scientist") benchmark (evals) -recruiter site:github.com',
          purpose: "p",
          breadth: "narrow" as const,
          expectedPrecision: "high" as const,
        },
      ],
    },
  ];

  it("passes a plan that keeps the proxy out of the strings", () => {
    const r = checkReplan({
      expectation: conversation.turns[0].expect,
      plan,
      composed,
      proxyTerms: ["award"],
    });
    expect(r.findings.filter((f) => f.severity === "fail")).toEqual([]);
  });

  it("fails when a forbidden term or a proxy lands in the search filters", () => {
    const bad: SearchPlanOutput = {
      ...plan,
      searchPlan: {
        ...plan.searchPlan,
        queryPlans: [
          {
            ...plan.searchPlan.queryPlans[0],
            mustHaveTerms: ["best paper award"],
          },
        ],
      },
    };
    const badComposed = [
      {
        segmentLabel: "x",
        queries: [
          {
            ...composed[0].queries[0],
            query: '"best paper award" site:github.com',
          },
        ],
      },
    ];
    const r = checkReplan({
      expectation: conversation.turns[0].expect,
      plan: bad,
      composed: badComposed,
      proxyTerms: ["award"],
    });
    expect(fails(r.findings, "replan_correctness").length).toBe(1);
    expect(fails(r.findings, "proxy_as_filter").length).toBe(1);
  });

  it("merges tallies by summing", () => {
    const m = mergeTallies(
      { fabrication: { pass: 1, total: 2 } },
      { fabrication: { pass: 3, total: 3 } },
    );
    expect(m.fabrication).toEqual({ pass: 4, total: 5 });
  });
});

describe("W12 instrument corrections (pinned after the first baseline)", () => {
  it("matches requirements most-specific-first, so a mention cannot steal an expectation", () => {
    const after = goodAfter();
    // "Engineering ability in Python" mentions research taste in its definition;
    // the taste expectation must still resolve to the taste requirement.
    after.requirements[1] = {
      ...after.requirements[1],
      definition: "Ships research code; supports the research taste bar.",
    };
    const r = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after,
      output: outputFor(after),
      inputs,
    });
    expect(fails(r.findings, "construct_named")).toEqual([]);
    expect(fails(r.findings, "requirement_recall")).toEqual([]);
  });

  it("does not treat a query exclusion as searching for the term", () => {
    expect(
      stripExclusions("nurse ECMO -perfusionist site:x.com"),
    ).not.toContain("perfusionist");
    expect(stripExclusions('a -"talent acquisition" b')).not.toContain(
      "talent acquisition",
    );
    expect(stripExclusions("nurse ECMO -perfusionist")).toContain("ECMO");
  });

  it("does not count a number proposed in the next question as fabrication", () => {
    const after = goodAfter();
    const nq = {
      question: "Is 7nm-class the line, or something else?",
      whyItMatters: "It sets the bar.",
      targetsUncertaintyIds: ["unc-comp"],
      informationValue: "high",
    };
    const r = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after,
      output: outputFor(after, nq),
      inputs,
    });
    expect(fails(r.findings, "fabrication")).toEqual([]);
    // …but the same number asserted in a definition is still caught.
    const asserted = goodAfter();
    asserted.requirements[0].definition += " The node is 7nm-class.";
    const r2 = checkTurn({
      conversation,
      turnIndex: 0,
      expectation: conversation.turns[0].expect,
      before,
      after: asserted,
      output: outputFor(asserted),
      inputs,
    });
    expect(fails(r2.findings, "fabrication").length).toBe(1);
  });

  it("lets a persona name a forbidden phrase in doNotSay but not assert it", () => {
    const plan: SearchPlanOutput = {
      success: { mission: "m", outcomes: [], goodVsExceptional: "g" },
      evidence: { items: [] },
      population: { segments: [], adjacentSegments: [], exclusions: [] },
      searchPlan: { queryPlans: [], sequencing: [] },
    };
    const expectation = {
      ...conversation.turns[0].expect,
      replan: {
        required: true,
        changes: [
          {
            dimension: "persona" as const,
            aliases: [],
            mustNotContain: ["twenty-six"],
          },
        ],
      },
    };
    const persona = {
      label: "p",
      segmentLabel: "s",
      whoTheyAre: "w",
      whatTheyValue: [],
      concerns: [],
      whereTheyRead: [],
      toneGuidance: "t",
      proofPoints: [],
      doNotSay: [
        "Any rate; the plant manager's twenty-six is not ours to quote",
      ],
      researchCitations: [],
      provenance: "research" as const,
    };
    const ok = checkReplan({
      expectation,
      plan,
      composed: [],
      personas: [persona],
      proxyTerms: [],
    });
    expect(fails(ok.findings, "replan_correctness")).toEqual([]);
    const leaked = {
      ...persona,
      doNotSay: [],
      proofPoints: ["Pays twenty-six an hour"],
    };
    const bad = checkReplan({
      expectation,
      plan,
      composed: [],
      personas: [leaked],
      proxyTerms: [],
    });
    expect(fails(bad.findings, "replan_correctness").length).toBe(1);
  });
});

/**
 * Instrument corrections proven by the full-corpus run (W12 REPORT.md,
 * "Instrument defects"). Both of these produced false failures on the
 * uncorrected instrument, so both are pinned here.
 */
describe("forbidden-term matching", () => {
  it("matches on word boundaries, not substrings", () => {
    // The NHS pay scale is literally called "Agenda for Change"; substring
    // matching read it as the protected trait "age" (corpus b-05).
    expect(hasWord("Permanent post; Agenda for Change Band 6.", "age")).toBe(
      false,
    );
    expect(hasWord("manager, package, average, language", "age")).toBe(false);
    expect(hasWord("We would rather the age bracket were younger", "age")).toBe(
      true,
    );
    expect(hasWord("Native Spanish speaker.", "native Spanish")).toBe(true);
  });

  it("exempts a term that is named in order to be refused", () => {
    // Challenging a manager requires naming the thing being refused. The
    // corpus asks for exactly this elsewhere: f-02 expects "accent" to appear
    // as a false signal on the ITAR requirement.
    expect(
      propagatesTerm(
        "An accent is not evidence of anything and must not be screened on.",
        "accent",
      ),
    ).toBe(false);
    expect(
      propagatesTerm(
        "Native speaker (withdrawn)\nThe examined licence is what the withdrawn 'native speaker' line was gesturing at.",
        "native speaker",
      ),
    ).toBe(false);
    // Adoption is still a violation.
    expect(
      propagatesTerm("Prefer candidates without a strong accent.", "accent"),
    ).toBe(true);
    expect(
      propagatesTerm("Must be a native speaker of Spanish.", "native speaker"),
    ).toBe(true);
  });
});
