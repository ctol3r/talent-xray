/**
 * Generation orchestrators: assemble context → runAiTask → persist the
 * result as an editable draft with meta/provenance. One function per
 * generative capability; all writes happen here, not in the AI layer.
 */
import { desc, eq } from "drizzle-orm";
import type { QuerySuggestion } from "@/lib/core/payloads";
import { composeQueries } from "@/lib/domain/search-strings";
import type { Db } from "@/lib/db/client";
import {
  candidateEvidence,
  candidateSources,
  candidates,
  closePlans,
  intakeSessions,
  interviewPlans,
  marketResearch,
  onboardingPlans,
  outreachMessages,
  outreachSequences,
  roleIntelligence,
  screenGuides,
  searchLearnings,
  searchQueries,
  sourceChannels,
  sourcingStrategies,
  successProfiles,
} from "@/lib/db/schema";
import { loadProjectContext } from "@/lib/ai/context";
import { runAiTask } from "@/lib/ai/run";
import { channelsTask } from "@/lib/ai/tasks/channels";
import { closePlanTask } from "@/lib/ai/tasks/close-plan";
import { evidenceAlignmentTask } from "@/lib/ai/tasks/evidence-alignment";
import { intakeTask } from "@/lib/ai/tasks/intake";
import { interviewPlanTask } from "@/lib/ai/tasks/interview-plan";
import { learningsSynthesisTask } from "@/lib/ai/tasks/learnings-synthesis";
import { marketIntelligenceTask } from "@/lib/ai/tasks/market-intelligence";
import { onboardingPlanTask } from "@/lib/ai/tasks/onboarding-plan";
import { outreachTask } from "@/lib/ai/tasks/outreach";
import { recruiterScreenTask } from "@/lib/ai/tasks/recruiter-screen";
import { roleIntelligenceTask } from "@/lib/ai/tasks/role-intelligence";
import { sourcingStrategyTask } from "@/lib/ai/tasks/sourcing-strategy";
import { stringExpansionTask } from "@/lib/ai/tasks/string-expansion";
import { successProfileTask } from "@/lib/ai/tasks/success-profile";

async function requireCandidate(db: Db, candidateId: string) {
  const [candidate] = await db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId));
  if (!candidate) throw new Error(`Candidate ${candidateId} not found`);
  return candidate;
}

export async function generateRoleIntelligence(db: Db, projectId: string) {
  const ctx = await loadProjectContext(db, projectId);
  const { output, meta, warnings } = await runAiTask(
    roleIntelligenceTask,
    ctx,
    {
      db,
      searchProjectId: projectId,
    },
  );
  await db
    .insert(roleIntelligence)
    .values({ searchProjectId: projectId, payload: output, meta })
    .onConflictDoUpdate({
      target: roleIntelligence.searchProjectId,
      set: { payload: output, meta, updatedAt: new Date().toISOString() },
    });
  return { output, meta, warnings };
}

export async function generateIntake(db: Db, projectId: string) {
  const ctx = await loadProjectContext(db, projectId);
  const { output, meta, warnings } = await runAiTask(intakeTask, ctx, {
    db,
    searchProjectId: projectId,
  });
  const [session] = await db
    .insert(intakeSessions)
    .values({ searchProjectId: projectId, payload: output, meta })
    .returning();
  return { session, warnings };
}

export async function generateSuccessProfile(db: Db, projectId: string) {
  const ctx = await loadProjectContext(db, projectId);
  const { output, meta, warnings } = await runAiTask(successProfileTask, ctx, {
    db,
    searchProjectId: projectId,
  });
  await db
    .insert(successProfiles)
    .values({ searchProjectId: projectId, payload: output, meta })
    .onConflictDoUpdate({
      target: successProfiles.searchProjectId,
      set: { payload: output, meta, updatedAt: new Date().toISOString() },
    });
  return { output, meta, warnings };
}

export async function generateMarketIntelligence(db: Db, projectId: string) {
  const ctx = await loadProjectContext(db, projectId);
  const { output, meta, warnings } = await runAiTask(
    marketIntelligenceTask,
    ctx,
    { db, searchProjectId: projectId },
  );
  await db
    .insert(marketResearch)
    .values({ searchProjectId: projectId, payload: output, meta })
    .onConflictDoUpdate({
      target: marketResearch.searchProjectId,
      set: { payload: output, meta, updatedAt: new Date().toISOString() },
    });
  return { output, meta, warnings };
}

export async function generateSourcingStrategy(db: Db, projectId: string) {
  const ctx = await loadProjectContext(db, projectId);
  const { output, meta, warnings } = await runAiTask(
    sourcingStrategyTask,
    ctx,
    {
      db,
      searchProjectId: projectId,
    },
  );
  await db
    .insert(sourcingStrategies)
    .values({ searchProjectId: projectId, payload: output, meta })
    .onConflictDoUpdate({
      target: sourcingStrategies.searchProjectId,
      set: { payload: output, meta, updatedAt: new Date().toISOString() },
    });
  return { output, meta, warnings };
}

/** Appends model-suggested channels, skipping names that already exist. */
export async function generateChannels(db: Db, projectId: string) {
  const ctx = await loadProjectContext(db, projectId);
  const { output, warnings } = await runAiTask(channelsTask, ctx, {
    db,
    searchProjectId: projectId,
  });
  const existing = new Set(
    (
      await db
        .select({ name: sourceChannels.name })
        .from(sourceChannels)
        .where(eq(sourceChannels.searchProjectId, projectId))
    ).map((c) => c.name.toLowerCase()),
  );
  const fresh = output.channels.filter(
    (c) => !existing.has(c.name.toLowerCase()),
  );
  if (fresh.length > 0) {
    await db.insert(sourceChannels).values(
      fresh.map((c) => ({
        searchProjectId: projectId,
        name: c.name,
        kind: c.kind,
        url: c.url,
        audience: c.audience,
        whyRelevant: c.whyRelevant,
        geography: c.geography,
        costModel: c.costModel,
        priority: c.priority,
        certainty: c.certainty,
        note: c.note,
      })),
    );
  }
  return {
    added: fresh.length,
    reasoningSummary: output.reasoningSummary,
    warnings,
  };
}

/**
 * Search String Lab: model expands vocabulary; the deterministic composer
 * builds the platform × breadth matrix; platform-specific extras appended.
 */
export async function generateSearchStrings(db: Db, projectId: string) {
  const ctx = await loadProjectContext(db, projectId);
  const { output, warnings } = await runAiTask(stringExpansionTask, ctx, {
    db,
    searchProjectId: projectId,
  });
  const composed = composeQueries({
    titles: output.titles,
    alternateTitles: output.alternateTitles,
    adjacentTitles: output.adjacentTitles,
    mustHave: output.mustHave,
    anyOf: output.anyOf,
    credentials: output.credentials,
    locations: output.locations,
    companies: output.companies,
    exclusions: output.exclusions,
  });
  const extras: QuerySuggestion[] = output.extraQueries;
  const existing = new Set(
    (
      await db
        .select({ query: searchQueries.query })
        .from(searchQueries)
        .where(eq(searchQueries.searchProjectId, projectId))
    ).map((q) => q.query),
  );
  const rows = [
    ...composed.map((q) => ({
      searchProjectId: projectId,
      platform: q.platform,
      query: q.query,
      purpose: q.purpose,
      breadth: q.breadth,
      expectedPrecision: q.expectedPrecision,
      targetPhenotype: q.targetPhenotype,
    })),
    ...extras.map((q) => ({
      searchProjectId: projectId,
      platform: q.platform,
      query: q.query,
      purpose: q.purpose,
      breadth: q.breadth,
      expectedPrecision: q.expectedPrecision,
      targetPhenotype: q.targetPhenotype,
    })),
  ].filter((row) => row.query.trim() !== "" && !existing.has(row.query));
  if (rows.length > 0) {
    await db.insert(searchQueries).values(rows);
  }
  return { added: rows.length, warnings };
}

export async function generateEvidenceAlignment(db: Db, candidateId: string) {
  const candidate = await requireCandidate(db, candidateId);
  const project = await loadProjectContext(db, candidate.searchProjectId);
  const sources = await db
    .select({ url: candidateSources.url })
    .from(candidateSources)
    .where(eq(candidateSources.candidateId, candidateId));
  const { output, meta, warnings } = await runAiTask(
    evidenceAlignmentTask,
    { project, candidate, sourceUrls: sources.map((s) => s.url) },
    { db, searchProjectId: candidate.searchProjectId, candidateId },
  );
  await db
    .insert(candidateEvidence)
    .values({
      candidateId,
      searchProjectId: candidate.searchProjectId,
      payload: output,
      meta,
    })
    .onConflictDoUpdate({
      target: candidateEvidence.candidateId,
      set: { payload: output, meta, updatedAt: new Date().toISOString() },
    });
  return { output, meta, warnings };
}

export async function generateOutreach(db: Db, candidateId: string) {
  const candidate = await requireCandidate(db, candidateId);
  const project = await loadProjectContext(db, candidate.searchProjectId);
  const [evidence] = await db
    .select()
    .from(candidateEvidence)
    .where(eq(candidateEvidence.candidateId, candidateId));
  const { output, meta, warnings } = await runAiTask(
    outreachTask,
    { project, candidate, evidence: evidence?.payload },
    { db, searchProjectId: candidate.searchProjectId, candidateId },
  );
  const [sequence] = await db
    .insert(outreachSequences)
    .values({
      candidateId,
      searchProjectId: candidate.searchProjectId,
      payload: output,
      meta,
    })
    .returning();
  // Draft tracking rows for the sendable steps.
  await db.insert(outreachMessages).values(
    output.steps.map((step) => ({
      candidateId,
      sequenceId: sequence.id,
      kind: step.kind,
      subject: step.subjectVariants[0],
      body: step.body,
    })),
  );
  return { sequence, warnings };
}

export async function generateScreenGuide(db: Db, projectId: string) {
  const ctx = await loadProjectContext(db, projectId);
  const { output, meta, warnings } = await runAiTask(recruiterScreenTask, ctx, {
    db,
    searchProjectId: projectId,
  });
  await db
    .insert(screenGuides)
    .values({ searchProjectId: projectId, payload: output, meta })
    .onConflictDoUpdate({
      target: screenGuides.searchProjectId,
      set: { payload: output, meta, updatedAt: new Date().toISOString() },
    });
  return { output, meta, warnings };
}

export async function generateInterviewPlan(db: Db, projectId: string) {
  const ctx = await loadProjectContext(db, projectId);
  const { output, meta, warnings } = await runAiTask(interviewPlanTask, ctx, {
    db,
    searchProjectId: projectId,
  });
  await db
    .insert(interviewPlans)
    .values({ searchProjectId: projectId, payload: output, meta })
    .onConflictDoUpdate({
      target: interviewPlans.searchProjectId,
      set: { payload: output, meta, updatedAt: new Date().toISOString() },
    });
  return { output, meta, warnings };
}

export async function generateClosePlan(db: Db, candidateId: string) {
  const candidate = await requireCandidate(db, candidateId);
  const project = await loadProjectContext(db, candidate.searchProjectId);
  const { output, meta, warnings } = await runAiTask(
    closePlanTask,
    { project, candidate },
    { db, searchProjectId: candidate.searchProjectId, candidateId },
  );
  await db
    .insert(closePlans)
    .values({
      candidateId,
      searchProjectId: candidate.searchProjectId,
      payload: output,
      meta,
    })
    .onConflictDoUpdate({
      target: closePlans.candidateId,
      set: { payload: output, meta, updatedAt: new Date().toISOString() },
    });
  return { output, meta, warnings };
}

export async function generateOnboardingPlan(
  db: Db,
  candidateId: string,
  startDate?: string,
) {
  const candidate = await requireCandidate(db, candidateId);
  const project = await loadProjectContext(db, candidate.searchProjectId);
  const { output, meta, warnings } = await runAiTask(
    onboardingPlanTask,
    { project, candidate, startDate },
    { db, searchProjectId: candidate.searchProjectId, candidateId },
  );
  await db
    .insert(onboardingPlans)
    .values({
      candidateId,
      searchProjectId: candidate.searchProjectId,
      payload: output,
      startDate,
      meta,
    })
    .onConflictDoUpdate({
      target: onboardingPlans.candidateId,
      set: {
        payload: output,
        startDate,
        meta,
        updatedAt: new Date().toISOString(),
      },
    });
  return { output, meta, warnings };
}

export async function synthesizeLearnings(db: Db, projectId: string) {
  const project = await loadProjectContext(db, projectId);
  const raw = await db
    .select()
    .from(searchLearnings)
    .where(eq(searchLearnings.searchProjectId, projectId))
    .orderBy(desc(searchLearnings.createdAt));
  const recruiterEntered = raw.filter(
    (l) => l.provenance !== "model_inference",
  );
  if (recruiterEntered.length === 0) {
    return { added: 0, summary: "No recorded outcomes to synthesize yet." };
  }
  const { output } = await runAiTask(
    learningsSynthesisTask,
    {
      project,
      rawLearnings: recruiterEntered.map((l) => ({
        kind: l.kind,
        text: l.text,
        sampleSize: l.sampleSize,
      })),
    },
    { db, searchProjectId: projectId },
  );
  if (output.learnings.length > 0) {
    await db.insert(searchLearnings).values(
      output.learnings.map((l) => ({
        searchProjectId: projectId,
        kind: l.kind,
        text: l.smallSampleWarning
          ? `${l.text} (small sample — treat as a hypothesis)`
          : l.text,
        sampleSize: l.sampleSize,
        provenance: "model_inference" as const,
      })),
    );
  }
  return { added: output.learnings.length, summary: output.summary };
}
