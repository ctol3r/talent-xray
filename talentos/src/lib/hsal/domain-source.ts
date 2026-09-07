/**
 * App-backed DomainSource. Real projects are read from the workstation
 * database; SP104 (the seeded demo search) additionally overlays the
 * structured candidate observations and HM feedback from fixtures/sp104 so
 * the diagnosis is deterministic.
 */
import { desc, eq } from "drizzle-orm";
import type {
  CandidateSearchEvidence,
  DomainSource,
  HiringManagerFeedback,
  PipelineSnapshot,
  SearchProject,
} from "@talentos/hsal-adapter";
import { pipelineSnapshotSchema } from "@talentos/hsal-adapter";
import type { Db } from "@/lib/db/client";
import {
  candidates,
  pipelineEvents,
  pipelineSnapshots,
  pipelineStages,
  searchProjects,
  successProfiles,
} from "@/lib/db/schema";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/domain/pipeline";
import {
  deriveCountsFromEvents,
  payloadToSuccessProfile,
  type DerivedCounts,
} from "./generic";
import { SP104_ID, sp104 } from "../../../fixtures/sp104";

export {
  inferCriterionCategory,
  payloadToSuccessProfile,
  tracedItemsToCriteria,
} from "./generic";

const STATUS_MAP: Record<string, SearchProject["status"]> = {
  open: "active",
  on_hold: "paused",
  closed: "closed",
};

export class AppDomainSource implements DomainSource {
  constructor(private readonly db: Db) {}

  async getSearchProject(id: string): Promise<SearchProject | undefined> {
    const [row] = await this.db
      .select()
      .from(searchProjects)
      .where(eq(searchProjects.id, id));
    if (!row) return undefined;
    const [sp] = await this.db
      .select()
      .from(successProfiles)
      .where(eq(successProfiles.searchProjectId, id));
    const successProfile = payloadToSuccessProfile(sp?.payload);
    const base: SearchProject = {
      id: row.id,
      companyName: row.companyName ?? row.name,
      roleTitle: row.roleTitle,
      status: STATUS_MAP[row.status] ?? "active",
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      successProfile,
      ...(row.geography
        ? {
            geography: {
              locations: [row.geography],
              remoteAllowed: row.workArrangement === "remote",
            },
          }
        : {}),
    };
    if (id === SP104_ID) {
      // Fixture supplies compensation/geography; the DB supplies the live success profile.
      return {
        ...sp104.searchProject,
        ...base,
        successProfile: sp?.payload
          ? successProfile
          : sp104.searchProject.successProfile,
      };
    }
    return base;
  }

  async getLatestSnapshot(id: string): Promise<PipelineSnapshot | undefined> {
    const [row] = await this.db
      .select()
      .from(pipelineSnapshots)
      .where(eq(pipelineSnapshots.searchProjectId, id))
      .orderBy(desc(pipelineSnapshots.observedAt))
      .limit(1);
    if (!row) return undefined;
    return pipelineSnapshotSchema.parse(row);
  }

  /**
   * Derive funnel counts for a period from the workstation's own pipeline
   * events (its ATS). Returns nothing when the project has no events, so the
   * recruiter is asked to enter counts rather than shown zeros as facts.
   */
  async deriveCounts(
    id: string,
    period: { start: string; end: string },
  ): Promise<DerivedCounts | undefined> {
    const stageRows = await this.db
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.searchProjectId, id));
    const stages = stageRows.length ? stageRows : DEFAULT_PIPELINE_STAGES;
    const events = await this.db
      .select()
      .from(pipelineEvents)
      .where(eq(pipelineEvents.searchProjectId, id));
    if (events.length === 0) return undefined;
    return deriveCountsFromEvents(stages, events, period);
  }

  async listSnapshots(id: string): Promise<PipelineSnapshot[]> {
    const rows = await this.db
      .select()
      .from(pipelineSnapshots)
      .where(eq(pipelineSnapshots.searchProjectId, id))
      .orderBy(pipelineSnapshots.observedAt);
    return rows.map((r) => pipelineSnapshotSchema.parse(r));
  }

  async getCandidateEvidence(id: string): Promise<CandidateSearchEvidence[]> {
    if (id === SP104_ID) return sp104.candidates;
    // Generic projects: HM decisions recorded on candidates become observations.
    const rows = await this.db
      .select()
      .from(candidates)
      .where(eq(candidates.searchProjectId, id));
    return rows
      .filter((c) => c.hmFeedback.length > 0)
      .map((c) => ({
        candidateId: c.id,
        searchProjectId: id,
        observations: c.hmFeedback.map((f) => ({
          type:
            f.decision === "advance"
              ? ("hm_advanced" as const)
              : f.decision === "pass"
                ? ("hm_rejected" as const)
                : ("other" as const),
          statement: f.evidenceNote,
          observedAt: f.at,
        })),
      }));
  }

  async getHMFeedback(id: string): Promise<HiringManagerFeedback[]> {
    if (id === SP104_ID) return sp104.hmFeedback;
    const rows = await this.db
      .select()
      .from(candidates)
      .where(eq(candidates.searchProjectId, id));
    const out: HiringManagerFeedback[] = [];
    for (const c of rows) {
      c.hmFeedback.forEach((f, i) => {
        out.push({
          id: `HMF-${c.id}-${i + 1}`,
          searchProjectId: id,
          candidateId: c.id,
          feedback: f.evidenceNote,
          disposition:
            f.decision === "advance"
              ? "advance"
              : f.decision === "pass"
                ? "reject"
                : "hold",
          createdAt: f.at,
        });
      });
    }
    return out;
  }
}
