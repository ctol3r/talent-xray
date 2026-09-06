/**
 * SP104 — deterministic seed data for the Axiom Compute distributed-systems
 * search. Validated against the adapter contracts at load time.
 */
import {
  candidateSearchEvidenceSchema,
  experimentResultSchema,
  hiringManagerFeedbackSchema,
  pipelineSnapshotSchema,
  recruiterBeliefInputSchema,
  searchLearningSchema,
  searchProjectSchema,
  successProfileSchema,
  type CandidateSearchEvidence,
  type DomainSource,
  type ExperimentResult,
  type HiringManagerFeedback,
  type PipelineSnapshot,
  type RecruiterBeliefInput,
  type SearchLearning,
  type SearchProject,
  type SuccessProfile,
} from "@talentos/hsal-adapter";
import { z } from "zod";
import searchProjectJson from "./search-project.json";
import successProfileAfterJson from "./success-profile-after.json";
import pipelineW6Json from "./pipeline-w6.json";
import pipelineW9Json from "./pipeline-w9.json";
import beliefJson from "./belief.json";
import candidatesJson from "./candidates.json";
import hmFeedbackJson from "./hm-feedback.json";
import experimentResultJson from "./experiment-result.json";
import revisionJson from "./revision.json";
import learningJson from "./learning.json";

export const SP104_ID = "SP104";
export const SP104_RECRUITER = "human:recruiter-sp104";

const revisionSchema = z.object({
  beliefId: z.string(),
  previousConfidence: z.number(),
  newConfidence: z.number(),
  reason: z.string(),
  actorId: z.string(),
  newBelief: recruiterBeliefInputSchema,
});

export const sp104 = {
  searchProject: searchProjectSchema.parse(searchProjectJson) as SearchProject,
  successProfileAfter: successProfileSchema.parse(
    successProfileAfterJson,
  ) as SuccessProfile,
  pipelineW6: pipelineSnapshotSchema.parse(pipelineW6Json) as PipelineSnapshot,
  pipelineW9: pipelineSnapshotSchema.parse(pipelineW9Json) as PipelineSnapshot,
  belief: recruiterBeliefInputSchema.parse(beliefJson) as RecruiterBeliefInput,
  candidates: z
    .array(candidateSearchEvidenceSchema)
    .parse(candidatesJson) as CandidateSearchEvidence[],
  hmFeedback: z
    .array(hiringManagerFeedbackSchema)
    .parse(hmFeedbackJson) as HiringManagerFeedback[],
  experimentResult: experimentResultSchema.parse(
    experimentResultJson,
  ) as ExperimentResult,
  revision: revisionSchema.parse(revisionJson),
  learning: (() => {
    const base = learningJson as Omit<
      SearchLearning,
      | "evidenceIds"
      | "originatingBeliefIds"
      | "originatingModelIds"
      | "createdAt"
    >;
    return base;
  })(),
} as const;

/** Full SearchLearning with HSAL references filled in by the demo/tests. */
export function sp104Learning(refs: {
  evidenceIds: string[];
  originatingBeliefIds: string[];
  originatingModelIds: string[];
  createdAt?: string;
}): SearchLearning {
  return searchLearningSchema.parse({
    ...sp104.learning,
    ...refs,
    createdAt: refs.createdAt ?? new Date().toISOString(),
  });
}

/**
 * Fixture-backed DomainSource. `snapshotPhase` selects which pipeline is
 * "latest": baseline (W6) or post-intervention (W9).
 */
export class Sp104FixtureSource implements DomainSource {
  snapshotPhase: "w6" | "w9" = "w6";
  profilePhase: "before" | "after" = "before";

  async getSearchProject(id: string): Promise<SearchProject | undefined> {
    if (id !== SP104_ID) return undefined;
    return this.profilePhase === "after"
      ? { ...sp104.searchProject, successProfile: sp104.successProfileAfter }
      : sp104.searchProject;
  }
  async getLatestSnapshot(id: string): Promise<PipelineSnapshot | undefined> {
    if (id !== SP104_ID) return undefined;
    return this.snapshotPhase === "w9" ? sp104.pipelineW9 : sp104.pipelineW6;
  }
  async getCandidateEvidence(id: string): Promise<CandidateSearchEvidence[]> {
    return id === SP104_ID ? sp104.candidates : [];
  }
  async getHMFeedback(id: string): Promise<HiringManagerFeedback[]> {
    return id === SP104_ID ? sp104.hmFeedback : [];
  }
}
