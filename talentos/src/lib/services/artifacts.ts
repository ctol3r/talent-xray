/**
 * Read + recruiter-edit access to the singleton generated artifacts.
 * Edits keep the existing generation meta (the audit trail of where the
 * draft came from) — the UI labels edited artifacts as recruiter-reviewed.
 */
import { desc, eq } from "drizzle-orm";
import type {
  ClosePlanPayload,
  EvidenceAlignmentPayload,
  IntakePayload,
  InterviewPlanPayload,
  MarketResearchPayload,
  OnboardingPlanPayload,
  RoleIntelligencePayload,
  ScreenGuidePayload,
  SourcingStrategyPayload,
  SuccessProfilePayload,
} from "@/lib/core/payloads";
import type { Db } from "@/lib/db/client";
import {
  candidateEvidence,
  closePlans,
  intakeSessions,
  interviewPlans,
  marketResearch,
  onboardingPlans,
  roleIntelligence,
  screenGuides,
  sourcingStrategies,
  successProfiles,
} from "@/lib/db/schema";

const touch = () => ({ updatedAt: new Date().toISOString() });

export async function getRoleIntelligence(db: Db, projectId: string) {
  const [row] = await db
    .select()
    .from(roleIntelligence)
    .where(eq(roleIntelligence.searchProjectId, projectId));
  return row;
}

export async function updateRoleIntelligencePayload(
  db: Db,
  projectId: string,
  payload: RoleIntelligencePayload,
) {
  await db
    .update(roleIntelligence)
    .set({ payload, ...touch() })
    .where(eq(roleIntelligence.searchProjectId, projectId));
}

export async function getLatestIntakeSession(db: Db, projectId: string) {
  const [row] = await db
    .select()
    .from(intakeSessions)
    .where(eq(intakeSessions.searchProjectId, projectId))
    .orderBy(desc(intakeSessions.createdAt))
    .limit(1);
  return row;
}

export async function updateIntakePayload(
  db: Db,
  sessionId: string,
  payload: IntakePayload,
  status?: "draft" | "in_progress" | "complete",
) {
  await db
    .update(intakeSessions)
    .set(status ? { payload, status, ...touch() } : { payload, ...touch() })
    .where(eq(intakeSessions.id, sessionId));
}

export async function getSuccessProfile(db: Db, projectId: string) {
  const [row] = await db
    .select()
    .from(successProfiles)
    .where(eq(successProfiles.searchProjectId, projectId));
  return row;
}

export async function updateSuccessProfilePayload(
  db: Db,
  projectId: string,
  payload: SuccessProfilePayload,
) {
  await db
    .update(successProfiles)
    .set({ payload, ...touch() })
    .where(eq(successProfiles.searchProjectId, projectId));
}

export async function getMarketResearch(db: Db, projectId: string) {
  const [row] = await db
    .select()
    .from(marketResearch)
    .where(eq(marketResearch.searchProjectId, projectId));
  return row;
}

export async function updateMarketResearchPayload(
  db: Db,
  projectId: string,
  payload: MarketResearchPayload,
) {
  await db
    .update(marketResearch)
    .set({ payload, ...touch() })
    .where(eq(marketResearch.searchProjectId, projectId));
}

export async function getSourcingStrategy(db: Db, projectId: string) {
  const [row] = await db
    .select()
    .from(sourcingStrategies)
    .where(eq(sourcingStrategies.searchProjectId, projectId));
  return row;
}

export async function updateSourcingStrategyPayload(
  db: Db,
  projectId: string,
  payload: SourcingStrategyPayload,
) {
  await db
    .update(sourcingStrategies)
    .set({ payload, ...touch() })
    .where(eq(sourcingStrategies.searchProjectId, projectId));
}

export async function getScreenGuide(db: Db, projectId: string) {
  const [row] = await db
    .select()
    .from(screenGuides)
    .where(eq(screenGuides.searchProjectId, projectId));
  return row;
}

export async function updateScreenGuidePayload(
  db: Db,
  projectId: string,
  payload: ScreenGuidePayload,
) {
  await db
    .update(screenGuides)
    .set({ payload, ...touch() })
    .where(eq(screenGuides.searchProjectId, projectId));
}

export async function getInterviewPlan(db: Db, projectId: string) {
  const [row] = await db
    .select()
    .from(interviewPlans)
    .where(eq(interviewPlans.searchProjectId, projectId));
  return row;
}

export async function updateInterviewPlanPayload(
  db: Db,
  projectId: string,
  payload: InterviewPlanPayload,
) {
  await db
    .update(interviewPlans)
    .set({ payload, ...touch() })
    .where(eq(interviewPlans.searchProjectId, projectId));
}

export async function getCandidateEvidence(db: Db, candidateId: string) {
  const [row] = await db
    .select()
    .from(candidateEvidence)
    .where(eq(candidateEvidence.candidateId, candidateId));
  return row;
}

export async function updateCandidateEvidencePayload(
  db: Db,
  candidateId: string,
  payload: EvidenceAlignmentPayload,
  recruiterOverride?: string,
) {
  await db
    .update(candidateEvidence)
    .set({ payload, recruiterOverride, ...touch() })
    .where(eq(candidateEvidence.candidateId, candidateId));
}

export async function getClosePlan(db: Db, candidateId: string) {
  const [row] = await db
    .select()
    .from(closePlans)
    .where(eq(closePlans.candidateId, candidateId));
  return row;
}

export async function updateClosePlanPayload(
  db: Db,
  candidateId: string,
  payload: ClosePlanPayload,
) {
  await db
    .update(closePlans)
    .set({ payload, ...touch() })
    .where(eq(closePlans.candidateId, candidateId));
}

export async function getOnboardingPlan(db: Db, candidateId: string) {
  const [row] = await db
    .select()
    .from(onboardingPlans)
    .where(eq(onboardingPlans.candidateId, candidateId));
  return row;
}

export async function updateOnboardingPlan(
  db: Db,
  candidateId: string,
  payload: OnboardingPlanPayload,
  options?: { startDate?: string; startConfirmed?: boolean },
) {
  await db
    .update(onboardingPlans)
    .set({ payload, ...options, ...touch() })
    .where(eq(onboardingPlans.candidateId, candidateId));
}
