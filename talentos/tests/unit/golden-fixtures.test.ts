/**
 * Golden-fixture structural test.
 *
 * What this proves: (a) every AI task's output contract (zod schema) is
 * satisfiable and its mock generator honors it for all six radically
 * different fixtures, and (b) the pipeline differentiates by role context —
 * intakes, channels, interview plans, and screens for an ML researcher, a
 * physician, an AE, a machinist, a CFO, and an ICU nurse must not collapse
 * into one generic template.
 *
 * What this deliberately does NOT prove: live model output quality. That
 * requires a real ANTHROPIC_API_KEY and human review — never faked here
 * (NO FAKE DATA rule).
 */
import { describe, expect, it } from "vitest";
import { GOLDEN_FIXTURES } from "@/lib/db/seed";
import type { ProjectContext } from "@/lib/ai/context";
import { channelsTask } from "@/lib/ai/tasks/channels";
import { intakeTask } from "@/lib/ai/tasks/intake";
import { interviewPlanTask } from "@/lib/ai/tasks/interview-plan";
import { marketIntelligenceTask } from "@/lib/ai/tasks/market-intelligence";
import { recruiterScreenTask } from "@/lib/ai/tasks/recruiter-screen";
import { roleIntelligenceTask } from "@/lib/ai/tasks/role-intelligence";
import { sourcingStrategyTask } from "@/lib/ai/tasks/sourcing-strategy";
import { stringExpansionTask } from "@/lib/ai/tasks/string-expansion";
import { successProfileTask } from "@/lib/ai/tasks/success-profile";

function contextFor(fixtureIndex: number): ProjectContext {
  const fixture = GOLDEN_FIXTURES[fixtureIndex];
  const now = new Date().toISOString();
  return {
    project: {
      id: `fixture-${fixtureIndex}`,
      name: fixture.name,
      companyId: null,
      companyName: fixture.company,
      roleTitle: fixture.roleTitle,
      geography: fixture.geography,
      country: fixture.country,
      region: null,
      workArrangement: null,
      employmentType: fixture.employmentType,
      industry: fixture.industry,
      seniority: fixture.seniority,
      compensationNote: null,
      businessObjective: fixture.businessObjective,
      status: "open",
      recruiterNotes: null,
      createdAt: now,
      updatedAt: now,
    },
    jdText: fixture.jd,
    hiringManagerNames: [],
    channelNames: [],
  };
}

const ALL = GOLDEN_FIXTURES.map((_, i) => contextFor(i));

describe("every task's mock output satisfies its schema for every fixture", () => {
  const tasks = [
    roleIntelligenceTask,
    intakeTask,
    successProfileTask,
    marketIntelligenceTask,
    sourcingStrategyTask,
    channelsTask,
    stringExpansionTask,
    recruiterScreenTask,
    interviewPlanTask,
  ];
  for (const task of tasks) {
    it(task.task, () => {
      for (const ctx of ALL) {
        expect(() => task.schema.parse(task.mock(ctx))).not.toThrow();
      }
    });
  }
});

describe("outputs differentiate across radically different roles", () => {
  const questionSets = ALL.map((ctx) =>
    intakeTask
      .mock(ctx)
      .categories.flatMap((category) =>
        category.questions.map((q) => q.question),
      ),
  );

  it("intake questions substantially differ between fixtures", () => {
    for (let a = 0; a < questionSets.length; a += 1) {
      for (let b = a + 1; b < questionSets.length; b += 1) {
        const setA = new Set(questionSets[a]);
        const overlap = questionSets[b].filter((q) => setA.has(q)).length;
        const overlapRatio =
          overlap / Math.min(questionSets[a].length, questionSets[b].length);
        expect(
          overlapRatio,
          `fixtures ${a} vs ${b} share too many intake questions`,
        ).toBeLessThan(0.5);
      }
    }
  });

  it("the CAIS intake reaches ML-research depth", () => {
    const cais = questionSets[0].join(" ");
    expect(cais).toMatch(/publication quality/i);
    expect(cais).toMatch(/Research Scientist vs Research Engineer/i);
    expect(cais).toMatch(/research taste/i);
  });

  it("the physician intake asks about licensure, not publications", () => {
    const physician = questionSets[1].join(" ");
    expect(physician).toMatch(/board/i);
    expect(physician).toMatch(/licens/i);
    expect(physician).not.toMatch(/NeurIPS/);
  });

  it("channels differ: registries for medicine, scholar graphs for research", () => {
    const caisChannels = channelsTask.mock(ALL[0]).channels.map((c) => c.name);
    const physicianChannels = channelsTask
      .mock(ALL[1])
      .channels.map((c) => c.name);
    expect(caisChannels.join(" ")).toMatch(/Scholar|arXiv/);
    expect(physicianChannels.join(" ")).toMatch(/NPI|medical board/i);
    expect(caisChannels).not.toEqual(physicianChannels);
  });

  it("interview processes differ per profession", () => {
    const machinist = interviewPlanTask.mock(ALL[3]).stages.map((s) => s.name);
    const cfo = interviewPlanTask.mock(ALL[4]).stages.map((s) => s.name);
    expect(machinist.join(" ")).toMatch(/Practical|Shop/i);
    expect(cfo.join(" ")).toMatch(/Board|Audit/i);
    expect(machinist).not.toEqual(cfo);
  });

  it("search-string vocabulary differs per fixture", () => {
    const cais = stringExpansionTask.mock(ALL[0]);
    const nurse = stringExpansionTask.mock(ALL[5]);
    expect(cais.titles).not.toEqual(nurse.titles);
    expect(cais.anyOf).not.toEqual(nurse.anyOf);
  });

  it("market claims never fabricate certainty", () => {
    for (const ctx of ALL) {
      const market = marketIntelligenceTask.mock(ctx);
      const claims = market.sections.flatMap((s) => s.claims);
      expect(claims.every((c) => c.certainty !== "verified")).toBe(true);
    }
  });
});
