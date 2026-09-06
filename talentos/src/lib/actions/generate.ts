"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { TraitScanHit } from "@/lib/domain/fair-hiring";
import { getDb } from "@/lib/db/client";
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
} from "@/lib/services/generation";
import { getCandidate } from "@/lib/services/candidates";
import { act, type ActionResult } from "./helpers";

const projectInput = z.object({ searchProjectId: z.string() });
const candidateInput = z.object({ candidateId: z.string() });

export interface GenerateSummary {
  warnings: TraitScanHit[];
  note?: string;
}

function revalidateProject(projectId: string) {
  revalidatePath(`/searches/${projectId}`, "layout");
}

async function revalidateCandidateProject(candidateId: string) {
  const candidate = await getCandidate(getDb(), candidateId);
  if (candidate) revalidateProject(candidate.searchProjectId);
}

export async function generateRoleIntelligenceAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const { warnings } = await generateRoleIntelligence(
      getDb(),
      searchProjectId,
    );
    revalidateProject(searchProjectId);
    return { warnings };
  });
}

export async function generateIntakeAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const { warnings } = await generateIntake(getDb(), searchProjectId);
    revalidateProject(searchProjectId);
    return { warnings };
  });
}

export async function generateSuccessProfileAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const { warnings } = await generateSuccessProfile(getDb(), searchProjectId);
    revalidateProject(searchProjectId);
    return { warnings };
  });
}

export async function generateMarketIntelligenceAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const { warnings } = await generateMarketIntelligence(
      getDb(),
      searchProjectId,
    );
    revalidateProject(searchProjectId);
    return { warnings };
  });
}

export async function generateSourcingStrategyAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const { warnings } = await generateSourcingStrategy(
      getDb(),
      searchProjectId,
    );
    revalidateProject(searchProjectId);
    return { warnings };
  });
}

export async function generateChannelsAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const { added, warnings } = await generateChannels(
      getDb(),
      searchProjectId,
    );
    revalidateProject(searchProjectId);
    return {
      warnings,
      note: `${added} new channel${added === 1 ? "" : "s"} added`,
    };
  });
}

export async function generateSearchStringsAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const { added, warnings, qa } = await generateSearchStrings(
      getDb(),
      searchProjectId,
    );
    revalidateProject(searchProjectId);
    const extras: string[] = [];
    if (qa.pruned.length > 0) {
      extras.push(
        `${qa.pruned.length} surface${qa.pruned.length === 1 ? "" : "s"} pruned`,
      );
    }
    if (qa.droppedDuplicates > 0) {
      extras.push(
        `${qa.droppedDuplicates} duplicate${qa.droppedDuplicates === 1 ? "" : "s"} dropped`,
      );
    }
    if (qa.split > 0) extras.push(`${qa.split} split to fit the word budget`);
    return {
      warnings,
      note: [`${added} quer${added === 1 ? "y" : "ies"} added`, ...extras].join(
        ", ",
      ),
    };
  });
}

export async function generateScreenGuideAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const { warnings } = await generateScreenGuide(getDb(), searchProjectId);
    revalidateProject(searchProjectId);
    return { warnings };
  });
}

export async function generateInterviewPlanAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const { warnings } = await generateInterviewPlan(getDb(), searchProjectId);
    revalidateProject(searchProjectId);
    return { warnings };
  });
}

export async function generateEvidenceAlignmentAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { candidateId } = candidateInput.parse(input);
    const { warnings } = await generateEvidenceAlignment(getDb(), candidateId);
    await revalidateCandidateProject(candidateId);
    return { warnings };
  });
}

export async function generateOutreachAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { candidateId } = candidateInput.parse(input);
    const { warnings } = await generateOutreach(getDb(), candidateId);
    await revalidateCandidateProject(candidateId);
    return { warnings };
  });
}

export async function generateClosePlanAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { candidateId } = candidateInput.parse(input);
    const { warnings } = await generateClosePlan(getDb(), candidateId);
    await revalidateCandidateProject(candidateId);
    return { warnings };
  });
}

export async function generateOnboardingPlanAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const parsed = candidateInput
      .extend({ startDate: z.string().optional() })
      .parse(input);
    const { warnings } = await generateOnboardingPlan(
      getDb(),
      parsed.candidateId,
      parsed.startDate,
    );
    await revalidateCandidateProject(parsed.candidateId);
    return { warnings };
  });
}

export async function synthesizeLearningsAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const { added, summary } = await synthesizeLearnings(
      getDb(),
      searchProjectId,
    );
    revalidateProject(searchProjectId);
    return {
      warnings: [],
      note: `${added} learning${added === 1 ? "" : "s"} synthesized. ${summary}`,
    };
  });
}
