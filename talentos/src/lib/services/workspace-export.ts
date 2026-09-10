/**
 * Reading the desk out of SQLite and into a bundle the portable build speaks.
 *
 * Scope is deliberately the two things that *are* the workspace: the jobs and
 * the people on them. Generated modules travel as an empty record, and that is
 * a decision rather than an omission — mapping role intelligence, success
 * profiles and the rest would mean restating a dozen payload shapes that
 * `src/lib/core/payloads.ts` already owns, and every one of them would be a
 * copy to keep in step. The portable build can generate them itself; on this
 * machine it is the shell that *can*, because its model arrives from the
 * viewer rather than from a CLI that is not logged in.
 *
 * One rule this path must not quietly escape. `profile_suppressions` holds
 * addresses a person objected to, and the comment on that table says it is
 * checked on every candidate-bound write path. Writing a file is such a path:
 * a suppressed address copied into a bundle is a suppressed address that
 * outlives the suppression. They are filtered here, by the same `normUrl` key
 * the suppression check itself uses, and the count of what was withheld is
 * returned so the export can say so out loud rather than silently shrinking.
 */
import { desc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { normUrl } from "@/lib/domain/identity";
import {
  candidateSources,
  candidates,
  jobDescriptions,
  profileSuppressions,
  searchProjects,
} from "@/lib/db/schema";
import {
  WORKSPACE_BUNDLE_KIND,
  WORKSPACE_BUNDLE_VERSION,
  type BundledCandidate,
  type BundledSearch,
  type WorkspaceBundle,
} from "@/lib/core/workspace-bundle";
import { STORE_VERSION } from "../../../artifact-src/core/store";
import type { SearchFacts } from "../../../artifact-src/core/search-context";

export interface ExportResult {
  bundle: WorkspaceBundle;
  /** Addresses left out because the person objected to them. */
  suppressedAddresses: number;
}

/** Undefined rather than "", so the store's normalizer supplies the default. */
function opt(value: string | null | undefined): string | undefined {
  return value === null || value === undefined || value === ""
    ? undefined
    : value;
}

export async function exportWorkspace(
  db: Db,
  now: string = new Date().toISOString(),
): Promise<ExportResult> {
  const projects = await db.select().from(searchProjects);
  const people = await db.select().from(candidates);
  const addresses = await db.select().from(candidateSources);
  const suppressed = await db
    .select({ value: profileSuppressions.normalizedValue })
    .from(profileSuppressions);

  const blocked = new Set(suppressed.map((row) => row.value));
  let suppressedAddresses = 0;

  const urlsByCandidate = new Map<string, string[]>();
  for (const row of addresses) {
    if (blocked.has(normUrl(row.url))) {
      suppressedAddresses += 1;
      continue;
    }
    const list = urlsByCandidate.get(row.candidateId) ?? [];
    list.push(row.url);
    urlsByCandidate.set(row.candidateId, list);
  }

  const peopleByProject = new Map<string, BundledCandidate[]>();
  for (const person of people) {
    const bundled: BundledCandidate = {
      id: person.id,
      name: person.name,
      currentTitle: opt(person.currentTitle),
      currentCompany: opt(person.currentCompany),
      geography: opt(person.geography),
      profileUrls: urlsByCandidate.get(person.id) ?? [],
      notes: opt(person.recruiterNotes),
      pastedText: opt(person.resumeText),
      createdAt: person.createdAt,
    };
    const list = peopleByProject.get(person.searchProjectId) ?? [];
    list.push(bundled);
    peopleByProject.set(person.searchProjectId, list);
  }

  const searches: Record<string, BundledSearch> = {};
  for (const project of projects) {
    // Newest first: a job re-pasted after a rewrite should travel as the text
    // the recruiter is actually working from.
    const jd = await db
      .select({ rawText: jobDescriptions.rawText })
      .from(jobDescriptions)
      .where(eq(jobDescriptions.searchProjectId, project.id))
      .orderBy(desc(jobDescriptions.createdAt))
      .limit(1);

    const facts: SearchFacts = {
      id: project.id,
      // Never the bundled demo. Without this an imported job could be taken
      // for the example search and cleared on a later boot.
      example: false,
      name: project.name,
      companyName: opt(project.companyName),
      roleTitle: project.roleTitle,
      geography: opt(project.geography),
      country: opt(project.country),
      industry: opt(project.industry),
      seniority: opt(project.seniority),
      employmentType: opt(project.employmentType),
      workplaceModel: opt(project.workArrangement),
      jurisdiction: opt(project.jurisdiction),
      compensationNote: opt(project.compensationNote),
      businessObjective: opt(project.businessObjective),
      recruiterNotes: opt(project.recruiterNotes),
      desiredStartDate: opt(project.targetStartDate),
      jd: opt(jd[0]?.rawText),
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };

    const candidateRecord: Record<string, BundledCandidate> = {};
    for (const person of peopleByProject.get(project.id) ?? []) {
      candidateRecord[person.id] = person;
    }

    searches[project.id] = {
      facts,
      candidates: candidateRecord,
      artifacts: {},
    };
  }

  return {
    bundle: {
      kind: WORKSPACE_BUNDLE_KIND,
      version: WORKSPACE_BUNDLE_VERSION,
      exportedAt: now,
      source: "talentos-app",
      storeVersion: STORE_VERSION,
      searches,
    },
    suppressedAddresses,
  };
}
