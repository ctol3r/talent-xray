/**
 * Path B — optional AI enhancement. No default implementation: the SP104 demo
 * runs without an LLM. A provider may ADD models, CHALLENGE models (as
 * annotations), name assumptions and missing evidence. It cannot remove or
 * silently rewrite deterministic models, and it never touches beliefs.
 */
import type { Belief, State } from "@hsal/sdk";
import { z } from "zod";
import {
  diagnosisAssumptionSchema,
  diagnosisModelTypeSchema,
  diagnosisPredictionSchema,
  modelAssessmentSummarySchema,
  type HSALEvidenceView,
  type SearchDiagnosisModel,
} from "../types";

export const aiModelSuggestionSchema = z.object({
  /** Existing model id to annotate, or omit to propose a new model. */
  modelId: z.string().optional(),
  type: diagnosisModelTypeSchema.optional(),
  name: z.string().min(1).optional(),
  explanation: z.string().min(1).optional(),
  assumptions: z.array(diagnosisAssumptionSchema).default([]),
  predictions: z.array(diagnosisPredictionSchema).default([]),
  evidenceForIds: z.array(z.string()).default([]),
  evidenceAgainstIds: z.array(z.string()).default([]),
  assessment: modelAssessmentSummarySchema.optional(),
  challenge: z.string().optional(),
  missingEvidence: z.array(z.string()).default([]),
});
export type AIModelSuggestion = z.infer<typeof aiModelSuggestionSchema>;

export const aiDiagnosisOutputSchema = z.object({
  suggestions: z.array(aiModelSuggestionSchema),
});
export type AIDiagnosisOutput = z.infer<typeof aiDiagnosisOutputSchema>;

export interface DiagnosisReasoningInput {
  state: State;
  beliefs: Belief[];
  evidence: HSALEvidenceView[];
  deterministicCandidates: SearchDiagnosisModel[];
}

export interface DiagnosisReasoningProvider {
  readonly name: string;
  generateDiagnosisModels(input: DiagnosisReasoningInput): Promise<unknown>;
}

/**
 * Merge schema-validated AI output into the deterministic set. Invalid output
 * is rejected wholesale (returns the deterministic set untouched).
 */
export function mergeAIModels(
  searchProjectId: string,
  deterministic: SearchDiagnosisModel[],
  raw: unknown,
  knownEvidenceIds: ReadonlySet<string>,
): {
  models: SearchDiagnosisModel[];
  missingEvidence: string[];
  accepted: boolean;
} {
  const parsed = aiDiagnosisOutputSchema.safeParse(raw);
  if (!parsed.success)
    return { models: deterministic, missingEvidence: [], accepted: false };
  const byId = new Map(
    deterministic.map((m) => [
      m.id,
      {
        ...m,
        assumptions: [...m.assumptions],
        predictions: [...m.predictions],
        evidenceForIds: [...m.evidenceForIds],
        evidenceAgainstIds: [...m.evidenceAgainstIds],
      },
    ]),
  );
  const missing: string[] = [];
  let added = 0;
  const known = (ids: string[]) => ids.filter((id) => knownEvidenceIds.has(id));
  for (const s of parsed.data.suggestions) {
    missing.push(...s.missingEvidence);
    if (s.modelId && byId.has(s.modelId)) {
      const m = byId.get(s.modelId)!;
      m.assumptions.push(...s.assumptions);
      m.predictions.push(...s.predictions);
      m.evidenceForIds.push(
        ...known(s.evidenceForIds).filter(
          (id) => !m.evidenceForIds.includes(id),
        ),
      );
      m.evidenceAgainstIds.push(
        ...known(s.evidenceAgainstIds).filter(
          (id) => !m.evidenceAgainstIds.includes(id),
        ),
      );
      if (s.challenge)
        m.assumptions.push({
          statement: `AI challenge: ${s.challenge}`,
          sensitivity: "medium",
        });
      continue;
    }
    if (s.type && s.name && s.explanation) {
      added += 1;
      const id = `M-${searchProjectId}-AI-${added}`;
      byId.set(id, {
        id,
        decisionCaseId: `DC-${searchProjectId}`,
        type: s.type,
        name: s.name,
        explanation: s.explanation,
        assumptions: s.assumptions,
        predictions: s.predictions,
        evidenceForIds: known(s.evidenceForIds),
        evidenceAgainstIds: known(s.evidenceAgainstIds),
        ...(s.assessment ? { assessment: s.assessment } : {}),
        status: "candidate",
      });
    }
  }
  return {
    models: [...byId.values()],
    missingEvidence: missing,
    accepted: true,
  };
}
