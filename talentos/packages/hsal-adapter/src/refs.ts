/**
 * Opaque reference codec. HSAL stores these strings verbatim in
 * `scopeRef` / `sourceRef`; only TalentOS interprets them.
 */
export const scopeRefForSearch = (searchProjectId: string) =>
  `talentos:search-project:${searchProjectId}`;
export const decisionCaseIdFor = (searchProjectId: string) =>
  `DC-${searchProjectId}`;
export const stateIdForSnapshot = (snapshotId: string) => `S-${snapshotId}`;
export const snapshotRef = (snapshotId: string) =>
  `talentos:pipeline-snapshot:${snapshotId}`;
export const candidateRef = (candidateId: string) =>
  `talentos:candidate:${candidateId}`;
export const modelIdFor = (searchProjectId: string, suffix: string) =>
  `M-${searchProjectId}-${suffix}`;
export const testIdFor = (searchProjectId: string, suffix: string) =>
  `TEST-${searchProjectId}-${suffix}`;
export const trajectoryIdFor = (interventionId: string) =>
  `TR-${interventionId}`;

export const candidateEvidenceId = (
  searchProjectId: string,
  candidateId: string,
  index: number,
) => `E-${searchProjectId}-${candidateId}-${index + 1}`;
export const hmFeedbackEvidenceId = (feedbackId: string) => `E-${feedbackId}`;
export const hmReasonEvidenceId = (feedbackId: string, index: number) =>
  `E-${feedbackId}-R${index + 1}`;
export const experimentEvidenceId = (resultId: string, index: number) =>
  `E-${resultId}-${index + 1}`;

export interface CandidateObservationRef {
  candidateId: string;
  index: number;
  type: string;
  criterionId?: string;
}

export function candidateObservationRef(r: CandidateObservationRef): string {
  return `talentos:candidate:${r.candidateId}:obs:${r.index + 1}:${r.type}${r.criterionId ? `:${r.criterionId}` : ""}`;
}

export function hmFeedbackRef(
  feedbackId: string,
  candidateId: string | undefined,
  disposition: string | undefined,
  criterionId?: string,
): string {
  return `talentos:hm-feedback:${feedbackId}:${candidateId ?? "-"}:${disposition ?? "-"}${criterionId ? `:${criterionId}` : ""}`;
}
