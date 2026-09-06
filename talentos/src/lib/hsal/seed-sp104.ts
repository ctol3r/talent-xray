/**
 * Seeds the SP104 demo search into the workstation database. Idempotent: keyed
 * on the fixed project id "SP104". Does not touch HSAL.
 */
import { eq } from "drizzle-orm";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/domain/pipeline";
import type { Db } from "@/lib/db/client";
import {
  candidates,
  hiringManagers,
  pipelineSnapshots,
  pipelineStages,
  searchProjects,
  successProfiles,
} from "@/lib/db/schema";
import {
  candidateProfilePayloadSchema,
  successProfilePayloadSchema,
  type SuccessProfilePayload,
} from "@/lib/core/payloads";
import type { SuccessProfile } from "@talentos/hsal-adapter";
import { SP104_ID, sp104 } from "../../../fixtures/sp104";

export function successProfileToPayload(
  profile: SuccessProfile,
  previous?: SuccessProfilePayload,
): SuccessProfilePayload {
  const traced = (items: SuccessProfile["mustHave"]) =>
    items.map((c) => ({
      id: c.id,
      text: c.label,
      provenance: "hiring_manager" as const,
      ...(c.rationale ? { note: c.rationale } : {}),
    }));
  return successProfilePayloadSchema.parse({
    mission:
      previous?.mission ??
      "Own the reliability and scale of Axiom Compute's distributed scheduling and storage layer.",
    outcomes: previous?.outcomes ?? [],
    responsibilities: previous?.responsibilities ?? [],
    mustHave: traced(profile.mustHave),
    preferred: traced(profile.preferred),
    trainable: traced(profile.transferable),
    evidenceSignals: previous?.evidenceSignals ?? [],
    negativeSignals: previous?.negativeSignals ?? [],
    adjacentBackgrounds: previous?.adjacentBackgrounds ?? [],
    exemplarPeople: [],
    exemplarCompanies: previous?.exemplarCompanies ?? [],
    targetIndustries: previous?.targetIndustries ?? [],
    targetCompanies: previous?.targetCompanies ?? [],
    alternateTitles: previous?.alternateTitles ?? [],
    targetGeographies: previous?.targetGeographies ?? [
      { text: "Bay Area", provenance: "hiring_manager" as const },
    ],
    compensationNote: previous?.compensationNote ?? "Budget $200K–$240K base.",
    candidateMotivators: previous?.candidateMotivators ?? [],
    sellingPoints: previous?.sellingPoints ?? [],
    risks: previous?.risks ?? [],
    unresolvedQuestions: previous?.unresolvedQuestions ?? [],
  });
}

const SEED_CANDIDATES: {
  id: string;
  name: string;
  title: string;
  company: string;
  skills: string[];
  hm?: {
    at: string;
    decision: "advance" | "hold" | "pass";
    evidenceNote: string;
  };
}[] = [
  {
    id: "C31",
    name: "Candidate C31",
    title: "Senior Software Engineer",
    company: "Meridian Cloud",
    skills: ["Rust", "distributed systems", "large-scale infrastructure"],
    hm: {
      at: "2026-08-12T16:00:00.000Z",
      decision: "pass",
      evidenceNote:
        "Strong systems background, but we really need someone who has been writing Go recently.",
    },
  },
  {
    id: "C44",
    name: "Candidate C44",
    title: "Principal Engineer",
    company: "Latticework",
    skills: ["C++", "architecture ownership", "infrastructure"],
    hm: {
      at: "2026-08-14T16:00:00.000Z",
      decision: "pass",
      evidenceNote:
        "Interesting background, but I don't see the Staff title we asked for.",
    },
  },
  {
    id: "C52",
    name: "Candidate C52",
    title: "Senior Engineer",
    company: "Northwind Data",
    skills: ["Java", "distributed storage"],
    hm: {
      at: "2026-08-18T16:00:00.000Z",
      decision: "pass",
      evidenceNote:
        "Strong candidate, but I want someone who already operates formally at Staff.",
    },
  },
  {
    id: "C54",
    name: "Candidate C54",
    title: "Staff Engineer",
    company: "Orbital Systems",
    skills: ["Go", "Kubernetes"],
  },
  {
    id: "C61",
    name: "Candidate C61",
    title: "Staff Engineer",
    company: "Helix Compute",
    skills: ["Go", "distributed systems"],
    hm: {
      at: "2026-08-22T16:00:00.000Z",
      decision: "advance",
      evidenceNote: "This is much closer to what I'm looking for.",
    },
  },
  {
    id: "C73",
    name: "Candidate C73",
    title: "Senior Engineer",
    company: "Quanta Infra",
    skills: ["Rust", "distributed systems"],
    hm: {
      at: "2026-08-25T16:00:00.000Z",
      decision: "pass",
      evidenceNote: "I'd prefer someone who has already held Staff.",
    },
  },
];

export async function seedSp104(db: Db): Promise<{ seeded: boolean }> {
  const [existing] = await db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.id, SP104_ID));
  if (existing) return { seeded: false };
  const p = sp104.searchProject;
  await db.insert(searchProjects).values({
    id: SP104_ID,
    name: `${p.companyName} — ${p.roleTitle}`,
    companyName: p.companyName,
    roleTitle: p.roleTitle,
    geography: "Bay Area",
    workArrangement: "onsite",
    industry: "AI infrastructure",
    seniority: "Staff",
    compensationNote: "Budget $200K–$240K base.",
    businessObjective:
      "Scale the distributed scheduling and storage layer ahead of the next capacity expansion.",
    status: "open",
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  });
  await db
    .insert(pipelineStages)
    .values(
      DEFAULT_PIPELINE_STAGES.map((s) => ({ ...s, searchProjectId: SP104_ID })),
    );
  await db.insert(hiringManagers).values({
    searchProjectId: SP104_ID,
    name: "Dana Whitfield",
    title: "Director of Infrastructure",
    styleNotes: "Decisive; anchors on stack and title.",
  });
  await db.insert(successProfiles).values({
    searchProjectId: SP104_ID,
    payload: successProfileToPayload(p.successProfile),
  });
  for (const c of SEED_CANDIDATES) {
    await db.insert(candidates).values({
      id: c.id,
      searchProjectId: SP104_ID,
      name: c.name,
      currentTitle: c.title,
      currentCompany: c.company,
      geography: "Bay Area",
      stage:
        c.hm?.decision === "advance"
          ? "interviewing"
          : c.hm
            ? "hm_review"
            : "recruiter_screen",
      disposition:
        c.id === "C54"
          ? "withdrawn"
          : c.hm?.decision === "pass"
            ? "not_selected"
            : "active",
      hmFeedback: c.hm ? [c.hm] : [],
      profile: candidateProfilePayloadSchema.parse({
        experience: [{ title: c.title, company: c.company }],
        education: [],
        publications: [],
        projects: [],
        skills: c.skills,
        licenses: [],
        certifications: [],
        motivations: [],
        concerns: [],
      }),
    });
  }
  await db
    .insert(pipelineSnapshots)
    .values({ ...sp104.pipelineW6, createdAt: sp104.pipelineW6.observedAt });
  return { seeded: true };
}
