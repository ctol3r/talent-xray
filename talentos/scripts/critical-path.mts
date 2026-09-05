/**
 * Headless critical-path check (`pnpm smoke`): drives the 20-step Phase-1
 * acceptance flow through the real services against a throwaway database
 * using the mock provider. The Playwright e2e covers the same flow through
 * the UI; this catches service-layer regressions in seconds.
 *
 * Usage: TALENTOS_MODEL_PROVIDER=mock TALENTOS_DATABASE_PATH=./data/smoke.db pnpm smoke
 */
import assert from "node:assert";
import { getDb } from "../src/lib/db/client";
import { computeFunnel } from "../src/lib/domain/analytics";
import {
  generateChannels,
  generateClosePlan,
  generateEvidenceAlignment,
  generateIntake,
  generateInterviewPlan,
  generateMarketIntelligence,
  generateOnboardingPlan,
  generateOutreach,
  generateRoleIntelligence,
  generateScreenGuide,
  generateSearchStrings,
  generateSourcingStrategy,
  generateSuccessProfile,
  synthesizeLearnings,
} from "../src/lib/services/generation";
import {
  getLatestIntakeSession,
  getRoleIntelligence,
  updateRoleIntelligencePayload,
} from "../src/lib/services/artifacts";
import {
  createCandidate,
  createCandidateInput,
  getPipelineEvents,
  getPipelineStages,
  moveCandidateStage,
} from "../src/lib/services/candidates";
import {
  addLearning,
  answerIntakeQuestion,
  completeIntake,
  listChannels,
  listQueries,
  saveScorecard,
  saveScorecardInput,
  upsertOffer,
} from "../src/lib/services/workflow";
import {
  buildProjectSnapshot,
  createSearchProject,
  getNextBestActions,
  saveJobDescription,
} from "../src/lib/services/search-projects";
import { GOLDEN_FIXTURES } from "../src/lib/db/seed";

if (process.env.TALENTOS_MODEL_PROVIDER !== "mock") {
  console.error("Refusing to run: set TALENTOS_MODEL_PROVIDER=mock");
  process.exit(1);
}

const db = getDb();
const cais = GOLDEN_FIXTURES[0];

// 1–2: create project, paste JD
const project = await createSearchProject(db, {
  name: `Smoke — ${cais.name}`,
  companyName: cais.company,
  roleTitle: cais.roleTitle,
  geography: cais.geography,
  country: cais.country,
  industry: cais.industry,
  seniority: cais.seniority,
  businessObjective: cais.businessObjective,
});
await saveJobDescription(db, {
  searchProjectId: project.id,
  rawText: cais.jd,
  source: "pasted",
});

// 3: role intelligence
await generateRoleIntelligence(db, project.id);
const intel = await getRoleIntelligence(db, project.id);
assert(intel, "role intelligence persisted");
assert(
  intel.payload.hardRequirements.length > 0,
  "hard requirements extracted",
);

// 4: recruiter edits a requirement
intel.payload.hardRequirements[0].text = "EDITED BY RECRUITER";
intel.payload.hardRequirements[0].provenance = "recruiter";
await updateRoleIntelligencePayload(db, project.id, intel.payload);

// 5–6: intake generate + answer + complete
await generateIntake(db, project.id);
const session = await getLatestIntakeSession(db, project.id);
assert(session, "intake session exists");
const firstQuestion = session.payload.categories[0].questions[0];
assert(firstQuestion.id, "intake questions carry ids");
await answerIntakeQuestion(db, {
  sessionId: session.id,
  questionId: firstQuestion.id,
  answer: "Capability-driven; blocked on empirical safety benchmarks.",
});
await completeIntake(db, session.id);

// 7–10: profile, strategy, channels, strings
await generateSuccessProfile(db, project.id);
await generateMarketIntelligence(db, project.id);
await generateSourcingStrategy(db, project.id);
const channelsResult = await generateChannels(db, project.id);
assert(channelsResult.added > 0, "channels added");
const stringsResult = await generateSearchStrings(db, project.id);
assert(stringsResult.added > 0, "queries added");
const queries = await listQueries(db, project.id);
assert(
  queries.some((q) => q.query.includes("site:")),
  "x-ray queries composed",
);

// 11–12: candidate + evidence
const candidate = await createCandidate(
  db,
  createCandidateInput.parse({
    searchProjectId: project.id,
    name: "Test Candidate",
    currentTitle: "Research Engineer",
    currentCompany: "Example Lab",
    resumeText:
      "Built distributed training infra; two first-author workshop papers.",
    profileUrls: ["https://example.com/profile"],
  }),
);
await generateEvidenceAlignment(db, candidate.id);

// 13: outreach
await generateOutreach(db, candidate.id);

// 14: pipeline movement
for (const stage of [
  "review",
  "contact_ready",
  "contacted",
  "responded",
  "recruiter_screen",
]) {
  await moveCandidateStage(db, { candidateId: candidate.id, toStage: stage });
}

// 15–16: screen guide + interview plan + scorecard
await generateScreenGuide(db, project.id);
await generateInterviewPlan(db, project.id);
await saveScorecard(
  db,
  saveScorecardInput.parse({
    searchProjectId: project.id,
    candidateId: candidate.id,
    stageName: "Recruiter Screen",
    status: "submitted",
    entries: [
      {
        competency: "Experimental execution",
        observation: "Described running ablations across 20 model variants.",
        interpretation: "Comfortable owning experiments end to end.",
        rating: "strong_evidence",
        evidenceText: "Ablation study story with concrete scale and tooling.",
      },
    ],
  }),
);

// 17–19: close plan, offer accepted, onboarding
await generateClosePlan(db, candidate.id);
await upsertOffer(db, {
  searchProjectId: project.id,
  candidateId: candidate.id,
  status: "extended",
});
await upsertOffer(db, {
  searchProjectId: project.id,
  candidateId: candidate.id,
  status: "accepted",
});
await generateOnboardingPlan(db, candidate.id, "2026-10-01");

// 20: analytics + learnings + next best actions
const [stages, events] = await Promise.all([
  getPipelineStages(db, project.id),
  getPipelineEvents(db, project.id),
]);
const funnel = computeFunnel(stages, events);
assert(
  funnel.find((f) => f.key === "offer_accepted")?.reached === 1,
  "funnel shows the accepted offer",
);
await addLearning(db, {
  searchProjectId: project.id,
  candidateId: candidate.id,
  kind: "why_offer_won",
  text: "Mission alignment plus fast process.",
  sampleSize: 1,
});
await synthesizeLearnings(db, project.id);
const snapshot = await buildProjectSnapshot(db, project.id);
assert(snapshot.candidateCount === 1, "snapshot sees the candidate");
await getNextBestActions(db, project.id);
const channels = await listChannels(db, project.id);
assert(
  channels.every((c) => c.certainty !== "verified"),
  "no unverified channel claims 'verified'",
);

console.log(
  "Critical path OK: 20 steps completed against",
  queries.length,
  "queries,",
  channels.length,
  "channels.",
);
