/**
 * Running the open index for a search.
 *
 * The spec is derived from the canonical intelligence this search already
 * holds, so the words that reach a public API are the words the recruiter
 * reviewed at intake — not a second opinion invented here. The spec is then
 * returned to the page with its provenance and the exact request URLs, and
 * the recruiter can edit any of it before anything is called.
 *
 * Nothing from a run is stored. Saving a row is the existing explicit act
 * (`saveDiscoveryResult`), so an open-index save lands in the same ledger,
 * with the same unverified label, as a link-out save.
 */
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { getSearchProject } from "./search-projects";
import { getIntelligence } from "./intelligence";
import {
  deriveOpenIndexSpec,
  specProvenance,
} from "@/lib/domain/open-index-spec";
import {
  activeOpenIndexSources,
  allOpenIndexSources,
  planOpenIndex,
  searchOpenIndex,
  type OpenIndexRun,
  type OpenIndexSpec,
} from "@/lib/research/open-index";

export const openIndexSpecInput = z.object({
  terms: z.array(z.string().max(80)).max(8).default([]),
  organisations: z.array(z.string().max(80)).max(4).default([]),
  geography: z.array(z.string().max(60)).max(4).default([]),
  technologies: z.array(z.string().max(40)).max(4).default([]),
  name: z.string().max(80).optional(),
  limit: z.number().int().min(1).max(25).default(10),
});

export const runOpenIndexInput = z.object({
  searchProjectId: z.string(),
  spec: openIndexSpecInput,
});

/** What the sources are, what they cover, and which are switched on. */
export function openIndexStatus() {
  const { sources, mock } = activeOpenIndexSources();
  const active = new Set(sources.map((source) => source.id));
  return {
    mock,
    configured: sources.length > 0,
    sources: allOpenIndexSources().map((source) => ({
      id: source.id,
      label: source.label,
      licence: source.licence,
      population: source.population,
      active: active.has(source.id),
    })),
  };
}

/** The spec this search implies, with where each part came from. */
export async function openIndexWorkspace(db: Db, searchProjectId: string) {
  const project = await getSearchProject(db, searchProjectId);
  if (!project) throw new Error("Search not found.");
  const intelligence = await getIntelligence(db, searchProjectId);
  const inputs = {
    project: {
      roleTitle: project.roleTitle,
      industry: project.industry,
      geography: project.geography,
    },
    intelligence: intelligence?.payload ?? null,
  };
  const spec = deriveOpenIndexSpec(inputs);
  return {
    spec,
    provenance: specProvenance(inputs),
    requests: planOpenIndex(spec),
    status: openIndexStatus(),
  };
}

/** Run it. Returns transient rows; writes nothing. */
export async function runOpenIndex(
  input: z.infer<typeof runOpenIndexInput>,
): Promise<OpenIndexRun> {
  const spec: OpenIndexSpec = {
    terms: input.spec.terms,
    organisations: input.spec.organisations,
    geography: input.spec.geography,
    technologies: input.spec.technologies,
    name: input.spec.name,
    limit: input.spec.limit,
  };
  return searchOpenIndex(spec);
}
