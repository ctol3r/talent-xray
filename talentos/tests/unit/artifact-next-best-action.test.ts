/**
 * The single next best action (spec §5). It is derived from the same
 * states the rail shows, in a fixed precedence: a failure outranks a
 * safety flag outranks a blocked person outranks new work. It never acts —
 * it returns a step the human clicks.
 */
import { describe, expect, it } from "vitest";
import {
  nextBestAction,
  type NbaInput,
} from "../../artifact-src/core/next-best-action";
import {
  MODULE_KEYS,
  type ModuleKey,
  type ModuleState,
  type ModuleStateName,
} from "../../artifact-src/core/dependencies";
import { MODULES } from "../../artifact-src/core/dependencies";
import { ACTION_TYPES } from "../../artifact-src/core/envelope";
import type { ActionItem } from "../../artifact-src/core/envelope";

const states = (
  base: ModuleStateName,
  over: Partial<Record<ModuleKey, ModuleStateName>> = {},
): Record<ModuleKey, ModuleState> =>
  Object.fromEntries(
    MODULE_KEYS.map((k) => [
      k,
      {
        key: k,
        label: MODULES[k].label,
        state: over[k] ?? base,
        reason: `${MODULES[k].label} is ${over[k] ?? base}`,
        currentVersion: "v1",
      } satisfies ModuleState,
    ]),
  ) as Record<ModuleKey, ModuleState>;

const input = (over: Partial<NbaInput> = {}): NbaInput => ({
  hasSearch: true,
  states: states("current"),
  researchStatus: "current",
  acknowledgedNoResearch: false,
  candidateCount: 2,
  candidatesWithoutEvidence: 0,
  actions: [],
  unansweredIntake: 0,
  nextQuestion: null,
  pipelineEvents: 1,
  goldenRun: true,
  aiAvailable: true,
  ...over,
});

const action = (over: Partial<ActionItem> = {}): ActionItem => ({
  id: "a1",
  title: "Confirm the pay band with the hiring manager",
  description: "",
  owner: "recruiter",
  status: "open",
  sourceOutputId: "env-1",
  ...over,
});

describe("precedence", () => {
  it("with no search, the brief is the only thing to do", () => {
    const nba = nextBestAction(input({ hasSearch: false }));
    expect(nba.step.actionType).toBe("edit_context");
  });

  it("a failure outranks everything else", () => {
    const nba = nextBestAction(
      input({
        states: states("not_started", {
          channels: "failed",
          hiring_need: "not_started",
        }),
        actions: [
          action({ status: "blocked", blockingReason: "waiting on the HM" }),
        ],
      }),
    );
    expect(nba.step.actionType).toBe("regenerate_module");
    expect(nba.step.targetId).toBe("channels");
    expect(nba.urgency).toBe("attention");
  });

  it("a safety flag outranks progress", () => {
    const nba = nextBestAction(
      input({
        states: states("not_started", { success_profile: "needs_review" }),
      }),
    );
    expect(nba.step.targetId).toBe("success_profile");
    expect(nba.step.title).toContain("Review");
  });

  it("a blocked action is a person waiting, and outranks new generation", () => {
    const nba = nextBestAction(
      input({
        states: states("not_started"),
        actions: [
          action({
            status: "blocked",
            blockingReason: "The HM is on leave until Monday.",
          }),
        ],
      }),
    );
    expect(nba.step.actionType).toBe("open_action");
    expect(nba.why).toContain("on leave");
    expect(nba.urgency).toBe("blocked");
  });
});

describe("working the phases in order", () => {
  it("starts at the canonical need", () => {
    const nba = nextBestAction(input({ states: states("not_started") }));
    expect(nba.step.actionType).toBe("generate_module");
    expect(nba.step.targetId).toBe("hiring_need");
    expect(nba.phase).toBe("define");
  });

  it("moves to the next gap once the earlier ones exist", () => {
    const nba = nextBestAction(
      input({
        states: states("not_started", {
          hiring_need: "current",
          intake: "current",
          success_profile: "current",
        }),
      }),
    );
    expect(nba.step.targetId).toBe("market_intelligence");
    expect(nba.phase).toBe("research");
  });

  it("refuses to walk past the research gate without saying so", () => {
    const nba = nextBestAction(
      input({
        researchStatus: "blocked",
        states: states("not_started", {
          hiring_need: "current",
          intake: "current",
          success_profile: "current",
        }),
      }),
    );
    expect(nba.step.actionType).toBe("add_source");
    expect(nba.urgency).toBe("blocked");
    expect(nba.why).toContain("model-knowledge label");
  });

  it("lets an acknowledged search generate on model knowledge", () => {
    const nba = nextBestAction(
      input({
        researchStatus: "blocked",
        acknowledgedNoResearch: true,
        states: states("not_started", {
          hiring_need: "current",
          intake: "current",
          success_profile: "current",
        }),
      }),
    );
    expect(nba.step.actionType).toBe("generate_module");
    expect(nba.step.targetId).toBe("market_intelligence");
  });

  it("never suggests a generation when AI is unavailable in this view", () => {
    const nba = nextBestAction(
      input({ aiAvailable: false, states: states("not_started") }),
    );
    expect(nba.step.actionType).not.toBe("generate_module");
    expect(nba.why).toContain("still work");
  });
});

describe("after the plan exists", () => {
  it("asks the hiring manager the loop's own question", () => {
    const nba = nextBestAction(
      input({
        nextQuestion:
          "How many years of ECMO experience is genuinely required?",
      }),
    );
    expect(nba.step.actionType).toBe("record_statement");
    expect(nba.step.title).toContain("ECMO");
  });

  it("regenerates a stale module before starting anything new", () => {
    const nba = nextBestAction(
      input({ states: states("current", { channels: "stale" }) }),
    );
    expect(nba.step.actionType).toBe("regenerate_module");
    expect(nba.step.targetId).toBe("channels");
  });

  it("refreshes ageing research", () => {
    const nba = nextBestAction(input({ researchStatus: "aging" }));
    expect(nba.step.actionType).toBe("refresh_research");
  });

  it("offers a source for anything generated on model knowledge only", () => {
    const nba = nextBestAction(
      input({ states: states("current", { market_intelligence: "blocked" }) }),
    );
    expect(nba.step.actionType).toBe("add_source");
    expect(nba.why).toContain("model knowledge only");
  });

  it("chases outstanding intake answers", () => {
    const nba = nextBestAction(input({ unansweredIntake: 3 }));
    expect(nba.step.actionType).toBe("answer_question");
    expect(nba.step.title).toContain("3");
  });

  it("reviews candidates that have no evidence yet", () => {
    const nba = nextBestAction(input({ candidatesWithoutEvidence: 2 }));
    expect(nba.step.actionType).toBe("review_candidate");
  });

  it("asks for pipeline events before offering any measurement", () => {
    const nba = nextBestAction(input({ pipelineEvents: 0 }));
    expect(nba.step.targetId).toBe("pipeline");
    expect(nba.why).toContain("no seeded history");
  });

  it("works the queue, then suggests the defect checks, then rests", () => {
    expect(nextBestAction(input({ actions: [action()] })).step.actionType).toBe(
      "open_action",
    );
    expect(nextBestAction(input({ goldenRun: false })).step.actionType).toBe(
      "run_golden",
    );
    const done = nextBestAction(input());
    expect(done.urgency).toBe("done");
    expect(done.why).toContain("queue is clear");
  });
});

describe("what it will never do", () => {
  it("only ever returns an action type the router knows", () => {
    const cases: NbaInput[] = [
      input({ hasSearch: false }),
      input({ states: states("not_started") }),
      input({ states: states("current", { channels: "failed" }) }),
      input({ researchStatus: "blocked", states: states("not_started") }),
      input({ nextQuestion: "q" }),
      input({ candidatesWithoutEvidence: 1 }),
      input({ actions: [action({ status: "blocked" })] }),
      input(),
    ];
    for (const c of cases) {
      const { step } = nextBestAction(c);
      expect(Object.keys(ACTION_TYPES)).toContain(step.actionType);
      expect(step.title.length).toBeGreaterThan(8);
    }
  });

  it("never proposes sending outreach, advancing a stage or approving anything", () => {
    const banned = [
      "send_outreach",
      "advance_stage",
      "approve_pivot",
      "record_decision",
      "external_communication",
    ];
    const cases = [
      input(),
      input({ candidateCount: 10, candidatesWithoutEvidence: 0 }),
      input({ states: states("current"), goldenRun: true }),
    ];
    for (const c of cases) {
      expect(banned).not.toContain(nextBestAction(c).step.actionType);
    }
  });
});
