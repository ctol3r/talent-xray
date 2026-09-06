"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { TraitScanHit } from "@/lib/domain/fair-hiring";
import type { TermDecision } from "@/lib/core/payloads";
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

function calibrationNote(decisions: TermDecision[]): string {
  const count = (action: TermDecision["action"]) =>
    decisions.filter((d) => d.action === action).length;
  const bits: string[] = [];
  const promoted = count("promoted_to_must_have");
  const added = count("added_any_of");
  const demoted = count("demoted_to_any_of");
  const removed = count("removed");
  const excluded = count("added_exclusion");
  const blocked = count("blocked");
  if (promoted)
    bits.push(`${promoted} term${promoted === 1 ? "" : "s"} promoted`);
  if (added) bits.push(`${added} added from accepted evidence`);
  if (demoted) bits.push(`${demoted} demoted`);
  if (removed) bits.push(`${removed} removed`);
  if (excluded) bits.push(`${excluded} excluded`);
  if (blocked) bits.push(`${blocked} blocked by the fair-hiring scan`);
  return bits.join(", ");
}

export async function generateSearchStringsAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const { added, warnings, qa, calibration } = await generateSearchStrings(
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
    const cal = calibrationNote(calibration.decisions);
    if (cal) extras.push(cal);
    return {
      warnings,
      note: [`${added} quer${added === 1 ? "y" : "ies"} added`, ...extras].join(
        ", ",
      ),
    };
  });
}

export async function composePlannedQueriesAction(
  input: unknown,
): Promise<ActionResult<GenerateSummary>> {
  return act(async () => {
    const { searchProjectId } = projectInput.parse(input);
    const { generatePlannedQueries } =
      await import("@/lib/services/intelligence");
    const result = await generatePlannedQueries(getDb(), searchProjectId);
    revalidateProject(searchProjectId);
    const parts = [
      `${result.added} quer${result.added === 1 ? "y" : "ies"} composed from ${result.segments} plan segment${result.segments === 1 ? "" : "s"}`,
    ];
    if (result.merged > 0) {
      parts.push(
        `${result.merged} existing row${result.merged === 1 ? "" : "s"} gained requirement links`,
      );
    }
    const cal = calibrationNote(result.decisions);
    if (cal) parts.push(cal);
    return { warnings: [], note: parts.join(", ") };
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
