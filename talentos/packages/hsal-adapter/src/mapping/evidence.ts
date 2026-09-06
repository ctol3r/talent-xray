import type { CreateEvidenceRequest, Evidence } from "@hsal/sdk";
import {
  candidateEvidenceId,
  candidateObservationRef,
  decisionCaseIdFor,
  experimentEvidenceId,
  hmFeedbackEvidenceId,
  hmFeedbackRef,
  hmReasonEvidenceId,
} from "../refs";
import type {
  CandidateSearchEvidence,
  ExperimentResult,
  HSALEvidenceView,
  HiringManagerFeedback,
  TalentOSEvidenceSourceType,
} from "../types";

export const SOURCE_KINDS = {
  pipeline: "talentos_pipeline",
  candidate: "talentos_candidate",
  hmFeedback: "talentos_hm_feedback",
  market: "talentos_market",
  experiment: "experiment",
  manual: "manual",
} as const;

/** One HSAL Evidence per materially distinct candidate observation. */
export function candidateEvidenceRequests(
  input: CandidateSearchEvidence,
): CreateEvidenceRequest[] {
  return input.observations.map((obs, index) => ({
    id: candidateEvidenceId(input.searchProjectId, input.candidateId, index),
    decisionCaseId: decisionCaseIdFor(input.searchProjectId),
    content: `[${input.candidateId}] ${obs.type.replace(/_/g, " ")}${obs.criterionId ? ` (${obs.criterionId})` : ""}: ${obs.statement}`,
    sourceType: "observation",
    sourceKind: SOURCE_KINDS.candidate,
    sourceRef: candidateObservationRef({
      candidateId: input.candidateId,
      index,
      type: obs.type,
      ...(obs.criterionId ? { criterionId: obs.criterionId } : {}),
    }),
    observedAt: new Date(obs.observedAt).toISOString(),
    epistemicStatus: "observed",
    propose: false,
  }));
}

/**
 * HM feedback is evidence that the HM said X — observed behaviour of the
 * hiring manager, not truth about candidate quality. One record per feedback
 * plus one per structured reason.
 */
export function hmFeedbackEvidenceRequests(
  feedback: HiringManagerFeedback,
): CreateEvidenceRequest[] {
  const who = feedback.candidateId ? ` on ${feedback.candidateId}` : "";
  const out: CreateEvidenceRequest[] = [
    {
      id: hmFeedbackEvidenceId(feedback.id),
      decisionCaseId: decisionCaseIdFor(feedback.searchProjectId),
      content: `HM said${who}${feedback.disposition ? ` [${feedback.disposition}]` : ""}: "${feedback.feedback}"`,
      sourceType: "user_statement",
      sourceKind: SOURCE_KINDS.hmFeedback,
      sourceRef: hmFeedbackRef(
        feedback.id,
        feedback.candidateId,
        feedback.disposition,
      ),
      observedAt: new Date(feedback.createdAt).toISOString(),
      epistemicStatus: "observed",
      propose: false,
    },
  ];
  for (const [index, reason] of (feedback.structuredReasons ?? []).entries()) {
    out.push({
      id: hmReasonEvidenceId(feedback.id, index),
      decisionCaseId: decisionCaseIdFor(feedback.searchProjectId),
      content: `HM reason${who} [${reason.category}${reason.criterionId ? ` / ${reason.criterionId}` : ""}]: ${reason.statement}`,
      sourceType: "user_statement",
      sourceKind: SOURCE_KINDS.hmFeedback,
      sourceRef: hmFeedbackRef(
        feedback.id,
        feedback.candidateId,
        feedback.disposition,
        reason.criterionId,
      ),
      observedAt: new Date(feedback.createdAt).toISOString(),
      epistemicStatus: "observed",
      propose: false,
    });
  }
  return out;
}

export function experimentEvidenceRequests(
  result: ExperimentResult,
): CreateEvidenceRequest[] {
  return result.observations.map((statement, index) => ({
    id: experimentEvidenceId(result.id, index),
    decisionCaseId: decisionCaseIdFor(result.searchProjectId),
    content: `[${result.interventionId}] ${statement}`,
    sourceType: "observation",
    sourceKind: SOURCE_KINDS.experiment,
    sourceRef: `talentos:experiment:${result.id}:${result.interventionId}:${index + 1}`,
    observedAt: new Date(result.observedAt).toISOString(),
    epistemicStatus: "observed",
    propose: false,
  }));
}

const KIND_TO_TYPE: Record<string, TalentOSEvidenceSourceType> = {
  talentos_pipeline: "talentos_pipeline",
  talentos_candidate: "talentos_candidate",
  talentos_hm_feedback: "talentos_hm_feedback",
  talentos_market: "talentos_market",
  experiment: "experiment",
};

/** Domain-facing projection of an HSAL Evidence record. */
export function toEvidenceView(e: Evidence): HSALEvidenceView {
  return {
    id: e.id,
    decisionCaseId: e.decisionCaseId ?? "",
    content: e.content,
    sourceType: KIND_TO_TYPE[e.sourceKind ?? ""] ?? "manual",
    sourceRef: e.sourceRef ?? "",
    epistemicStatus: e.epistemicStatus,
    observedAt: e.observedAt ?? e.capturedAt,
    createdAt: e.capturedAt,
  };
}
