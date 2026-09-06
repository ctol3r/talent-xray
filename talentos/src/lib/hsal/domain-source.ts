/**
 * App-backed DomainSource. Real projects are read from the workstation
 * database; SP104 (the seeded demo search) additionally overlays the
 * structured candidate observations and HM feedback from fixtures/sp104 so
 * the diagnosis is deterministic.
 */
import { desc, eq } from "drizzle-orm";
import type {
  CandidateSearchEvidence,
  CriterionCategory,
  DomainSource,
  HiringManagerFeedback,
  PipelineSnapshot,
  SearchProject,
  SuccessCriterion,
  SuccessProfile,
} from "@talentos/hsal-adapter";
import { pipelineSnapshotSchema } from "@talentos/hsal-adapter";
import type { Db } from "@/lib/db/client";
import {
  candidates,
  pipelineSnapshots,
  searchProjects,
  successProfiles,
} from "@/lib/db/schema";
import type { SuccessProfilePayload, TracedItem } from "@/lib/core/payloads";
import { SP104_ID, sp104 } from "../../../fixtures/sp104";

const slug = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

export function inferCriterionCategory(label: string): CriterionCategory {
  const l = label.toLowerCase();
  if (/\btitle\b|\bstaff\b|\bprincipal\b|\bsenior\b/.test(l)) return "title";
  if (/\byears?\b|experience level|\bseniority\b/.test(l)) return "experience";
  if (
    /bay area|remote|on-?site|hybrid|located|relocat|\bnyc\b|\blondon\b/.test(l)
  )
    return "geography";
  if (/degree|\bphd\b|\bmsc?\b|\bbsc?\b|university/.test(l)) return "education";
  if (/industry|company experience|startup|enterprise|sector/.test(l))
    return "industry";
  return "skill";
}

export function tracedItemsToCriteria(items: TracedItem[]): SuccessCriterion[] {
  return items.map((item) => ({
    id: item.id ?? `CRIT-${slug(item.text)}`,
    label: item.text,
    category: inferCriterionCategory(item.text),
    ...(item.note ? { rationale: item.note } : {}),
  }));
}

export function payloadToSuccessProfile(
  payload: SuccessProfilePayload | undefined,
): SuccessProfile {
  if (!payload) return { mustHave: [], preferred: [], transferable: [] };
  return {
    mustHave: tracedItemsToCriteria(payload.mustHave),
    preferred: tracedItemsToCriteria(payload.preferred),
    transferable: tracedItemsToCriteria(payload.trainable),
  };
}

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
