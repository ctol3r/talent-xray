import { describe, expect, it } from "vitest";
import {
  computeNextBestActions,
  type ProjectSnapshot,
} from "@/lib/domain/next-best-action";

function snapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    projectId: "p1",
    hasJobDescription: true,
    hasRoleIntelligence: true,
    unresolvedQuestionCount: 0,
    hasIntake: true,
    unansweredIntakeCount: 0,
    intakeComplete: true,
    hasSuccessProfile: true,
    hasStrategy: true,
    channelCount: 5,
    queryCount: 8,
    candidateCount: 10,
    candidatesNeedingReview: 0,
    followUpsDueCount: 0,
    outreachSent: 0,
    outreachReplied: 0,
    stalledCandidateCount: 0,
    stalledThresholdDays: 7,
    openTaskCount: 0,
    ...overrides,
  };
}

describe("computeNextBestActions", () => {
  it("tells a brand-new search to add the JD first", () => {
    const actions = computeNextBestActions(
      snapshot({
        hasJobDescription: false,
        hasRoleIntelligence: false,
        hasIntake: false,
        hasSuccessProfile: false,
        hasStrategy: false,
        channelCount: 0,
        queryCount: 0,
        candidateCount: 0,
        intakeComplete: false,
      }),
    );
    expect(actions[0].id).toBe("add_jd");
    expect(actions[0].priority).toBe(1);
  });

  it("walks the setup chain in order: role intel → intake → profile → strategy", () => {
    const ids = computeNextBestActions(
      snapshot({
        hasRoleIntelligence: false,
        hasIntake: false,
        intakeComplete: false,
        hasSuccessProfile: false,
        hasStrategy: false,
      }),
    ).map((a) => a.id);
    expect(ids).toContain("run_role_intel");
    expect(ids).not.toContain("generate_intake"); // gated on role intel
  });

  it("surfaces due follow-ups as priority 1", () => {
    const actions = computeNextBestActions(snapshot({ followUpsDueCount: 4 }));
    const followUp = actions.find((a) => a.id === "follow_ups");
    expect(followUp?.priority).toBe(1);
    expect(followUp?.title).toBe("4 follow-ups due");
  });

  it("flags low response rate only with enough volume", () => {
    const lowVolume = computeNextBestActions(
      snapshot({ outreachSent: 5, outreachReplied: 0 }),
    );
    expect(lowVolume.some((a) => a.id === "diagnose_response")).toBe(false);
    const highVolume = computeNextBestActions(
      snapshot({ outreachSent: 30, outreachReplied: 1 }),
    );
    expect(highVolume.some((a) => a.id === "diagnose_response")).toBe(true);
  });

  it("returns an empty list when the search is fully healthy", () => {
    expect(computeNextBestActions(snapshot())).toEqual([]);
  });

  it("sorts by priority", () => {
    const actions = computeNextBestActions(
      snapshot({
        stalledCandidateCount: 2,
        followUpsDueCount: 1,
        candidatesNeedingReview: 3,
      }),
    );
    const priorities = actions.map((a) => a.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
  });
});
