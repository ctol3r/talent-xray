/**
 * Best Next Test — candidate experiments and deterministic ranking.
 * The score provides deterministic prioritization; it is not a probability.
 */
import { modelIdFor, testIdFor } from "../refs";
import { MODEL_SUFFIX, SUPPORT_RANK } from "./rules";
import type {
  CandidateTest,
  Level,
  Reversibility,
  SearchDiagnosisModel,
  TestScore,
  TestScoreWeights,
} from "../types";

export const TEST_SCORE_WEIGHTS: TestScoreWeights = {
  informationGain: 0.35,
  discriminatoryPower: 0.3,
  reversibility: 0.15,
  cost: 0.1,
  executionTime: 0.1,
};

/** Normalization maps — configuration, not logic. */
export const LEVEL_VALUE: Record<Level, number> = {
  low: 0.25,
  medium: 0.6,
  high: 1,
};
export const REVERSIBILITY_VALUE: Record<Reversibility, number> = {
  easy: 1,
  moderate: 0.6,
  difficult: 0.3,
  irreversible: 0,
};
export const MAX_DURATION_DAYS = 30;

export function normalizeTest(
  test: CandidateTest,
  models: SearchDiagnosisModel[],
): TestScore {
  const top = [...models].sort(
    (a, b) =>
      SUPPORT_RANK[b.assessment?.support ?? "low"] -
      SUPPORT_RANK[a.assessment?.support ?? "low"],
  );
  const topIds = new Set(top.slice(0, 2).map((m) => m.id));
  // A test that separates the two leading explanations is worth more than one that only probes a weak model.
  const touchesLeaders = test.discriminatesBetweenModelIds.filter((id) =>
    topIds.has(id),
  ).length;
  const dpBase = LEVEL_VALUE[test.discriminatoryPower];
  const discriminatoryPower = Math.min(
    1,
    dpBase * (touchesLeaders >= 2 ? 1 : touchesLeaders === 1 ? 0.8 : 0.5),
  );
  return {
    informationGain: LEVEL_VALUE[test.expectedInformationGain],
    cost: LEVEL_VALUE[test.cost],
    reversibility: REVERSIBILITY_VALUE[test.reversibility],
    executionTime: Math.min(1, test.durationDays / MAX_DURATION_DAYS),
    discriminatoryPower,
  };
}

export function scoreTest(
  s: TestScore,
  w: TestScoreWeights = TEST_SCORE_WEIGHTS,
): number {
  return (
    s.informationGain * w.informationGain +
    s.discriminatoryPower * w.discriminatoryPower +
    s.reversibility * w.reversibility +
    (1 - s.cost) * w.cost +
    (1 - s.executionTime) * w.executionTime
  );
}

export interface RankedTest {
  test: CandidateTest;
  score: number;
  normalized: TestScore;
}

export function rankTests(
  tests: CandidateTest[],
  models: SearchDiagnosisModel[],
  weights: TestScoreWeights = TEST_SCORE_WEIGHTS,
): RankedTest[] {
  return tests
    .map((test) => {
      const normalized = normalizeTest(test, models);
      return {
        test,
        normalized,
        score: Number(scoreTest(normalized, weights).toFixed(4)),
      };
    })
    .sort((a, b) => b.score - a.score || a.test.id.localeCompare(b.test.id));
}

/** Candidate experiments derived from which explanations are in play. */
export function generateCandidateTests(
  searchProjectId: string,
  models: SearchDiagnosisModel[],
): CandidateTest[] {
  const id = (suffix: string) => testIdFor(searchProjectId, suffix);
  const mid = (k: keyof typeof MODEL_SUFFIX) =>
    modelIdFor(searchProjectId, MODEL_SUFFIX[k]);
  const support = (k: keyof typeof MODEL_SUFFIX): Level =>
    models.find((m) => m.id === mid(k))?.assessment?.support ?? "low";
  const tests: CandidateTest[] = [];

  if (
    SUPPORT_RANK[support("success_profile")] >= 1 ||
    SUPPORT_RANK[support("hiring_process")] >= 1
  ) {
    tests.push({
      id: id("BLIND"),
      title: "Blind Adjacent Profile Review",
      hypothesis:
        "Exact programming-language and current-title requirements are causing technically viable candidates to be rejected.",
      description:
        "Ask the HM to review 10 technically strong adjacent candidate profiles with programming language and current title hidden.",
      protocol: [
        "Select 10 adjacent candidates.",
        "Require strong distributed-systems evidence.",
        "Require meaningful technical ownership.",
        "Hide programming language and current title.",
        "Ask the HM: would you interview this candidate based on demonstrated scope and systems experience?",
        "Reveal hidden fields afterward.",
      ],
      actionType: "calibration_test",
      discriminatesBetweenModelIds: [
        mid("success_profile"),
        mid("talent_supply"),
        mid("hiring_process"),
      ],
      expectedInformationGain: "high",
      discriminatoryPower: "high",
      cost: "low",
      reversibility: "easy",
      durationDays: 1,
      durationEstimate: "< 1 day",
      rationale:
        "If the HM advances most blinded adjacent profiles, the profile (not the market) is the binding constraint; if not, supply scarcity is more likely. Nothing in the live search changes.",
      successConditions: [
        "≥ 5 of 10 advanced on demonstrated scope",
        "Advanced set spans multiple languages/titles",
      ],
      failureConditions: [
        "≤ 3 of 10 advanced",
        "Rejections cite scope or systems depth rather than language/title",
      ],
      affectedDimensions: ["rate.hmToOnsiteRate"],
      parameters: {
        sampleSize: 10,
        hiddenFields: ["programmingLanguage", "currentTitle"],
        adjacentLanguages: ["Rust", "C++", "Java"],
      },
    });
  }

  tests.push({
    id: id("OUTREACH-AB"),
    title: "Outreach Message A/B",
    hypothesis:
      "A message that leads with technical scope and the problem space will lift reply rate.",
    description:
      "Send two message variants to matched cohorts of 40 and compare reply and positive-reply rates.",
    protocol: [
      "Draft variant B emphasizing systems problems and ownership.",
      "Send A and B to matched cohorts.",
      "Compare reply rates after 14 days.",
    ],
    actionType: "outreach_test",
    discriminatesBetweenModelIds: [mid("outreach"), mid("talent_supply")],
    expectedInformationGain:
      SUPPORT_RANK[support("outreach")] >= 1 ? "medium" : "low",
    discriminatoryPower: "medium",
    cost: "low",
    reversibility: "easy",
    durationDays: 14,
    durationEstimate: "2 weeks",
    rationale:
      "Separates message quality from market thinness, but only informs the top of the funnel.",
    successConditions: ["Variant B reply rate ≥ A + 5 points"],
    failureConditions: ["No difference between variants"],
    affectedDimensions: ["rate.outreachReplyRate", "rate.positiveReplyRate"],
    parameters: { cohortSize: 40, variants: 2 },
  });

  tests.push({
    id: id("COMP-CHECK"),
    title: "Compensation Expectation Check",
    hypothesis: "The budget is below the market for this profile.",
    description:
      "Collect compensation expectations from the next 8 engaged candidates and benchmark against the range.",
    protocol: [
      "Ask expectations at recruiter screen.",
      "Compare with the approved range.",
      "Flag the share above budget.",
    ],
    actionType: "compensation_change",
    discriminatesBetweenModelIds: [mid("compensation")],
    expectedInformationGain:
      SUPPORT_RANK[support("compensation")] >= 1 ? "medium" : "low",
    discriminatoryPower: "medium",
    cost: "low",
    reversibility: "easy",
    durationDays: 10,
    durationEstimate: "1–2 weeks",
    rationale:
      "Cheap, but only informative if compensation is a live explanation.",
    successConditions: ["≥ 50% of expectations above the range max"],
    failureConditions: ["Most expectations inside the range"],
    affectedDimensions: ["count.offer"],
    parameters: { sampleSize: 8 },
  });

  tests.push({
    id: id("HM-RUBRIC"),
    title: "Structured HM Review Rubric",
    hypothesis:
      "HM rejections come from an informal, shifting bar rather than the profile itself.",
    description:
      "Introduce a written HM rubric aligned to the profile and apply it to the next 6 HM screens.",
    protocol: [
      "Draft rubric with the HM.",
      "Apply to next 6 HM screens.",
      "Compare HM → onsite conversion.",
    ],
    actionType: "process_change",
    discriminatesBetweenModelIds: [
      mid("hiring_process"),
      mid("success_profile"),
    ],
    expectedInformationGain: "medium",
    discriminatoryPower: "medium",
    cost: "medium",
    reversibility: "moderate",
    durationDays: 21,
    durationEstimate: "3 weeks",
    rationale:
      "Slower and entangled with the profile question; better run after the blind review.",
    successConditions: ["HM → onsite ≥ 50% under the rubric"],
    failureConditions: ["Rejections continue on the same proxy criteria"],
    affectedDimensions: ["rate.hmToOnsiteRate"],
    parameters: { screens: 6 },
  });

  tests.push({
    id: id("REMOTE-SPRINT"),
    title: "Remote-Expanded Sourcing Sprint",
    hypothesis: "Qualified supply exists outside the Bay Area.",
    description:
      "Run a two-week sourcing sprint on remote-eligible candidates meeting the current profile.",
    protocol: [
      "Source 60 remote candidates.",
      "Run standard outreach.",
      "Compare positive reply and screen rates.",
    ],
    actionType: "geography_change",
    discriminatesBetweenModelIds: [mid("talent_supply")],
    expectedInformationGain: "medium",
    discriminatoryPower: "low",
    cost: "medium",
    reversibility: "moderate",
    durationDays: 21,
    durationEstimate: "3 weeks",
    rationale:
      "Tests the market without touching the profile, but costs recruiter time and cannot separate profile from supply.",
    successConditions: ["Positive reply rate ≥ 12% in the remote cohort"],
    failureConditions: ["Remote cohort converts no better than Bay Area"],
    affectedDimensions: ["count.sourced", "rate.positiveReplyRate"],
    parameters: { cohortSize: 60 },
  });

  return tests;
}
