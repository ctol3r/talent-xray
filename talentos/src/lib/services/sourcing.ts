/**
 * The sourcing engine, wired to the workspace.
 *
 * Turns everyone the workspace holds into the claim-shaped evidence the ranker
 * scores, then answers a query in the sourcing language over them. Nothing
 * here fetches anything: every claim is read from a record a human already
 * saved, imported or wrote.
 */
import type { Db } from "@/lib/db/client";
import {
  candidateSourceEvidence,
  candidates,
  searchProjects,
} from "@/lib/db/schema";
import {
  candidateProfilePayloadSchema,
  emptyCandidateProfile,
} from "@/lib/core/payloads";
import {
  nameInitialsKey,
  normalizeCapability,
  normalizeLocation,
  normalizeOrganization,
} from "@/lib/sourcing/normalize";
import {
  clusterProfiles,
  decideFor,
  explainMatch,
  mergeThresholdFor,
  nameFrequency,
  scoreMatch,
  type IdentityCluster,
  type MergeDecision,
  type PersonProfile,
  type Sighting,
} from "@/lib/sourcing/resolve";
import { resolveAlias } from "@/lib/sourcing/ontology";
import type { Claim, SourcedPerson } from "@/lib/sourcing/evidence";
import { parseQuery, type SourcingBrief } from "@/lib/sourcing/query-language";
import { rankPeople, type RankResult } from "@/lib/sourcing/rank";
import {
  buildPlan,
  type PlanEnvironment,
  type SourcingPlan,
} from "@/lib/sourcing/plan";
import {
  structuredSources,
  toOpenIndexSpec,
} from "@/lib/sourcing/structured-sources";
import { availableConnectors } from "@/lib/sourcing/connectors";
import { searchOpenIndex } from "@/lib/research/open-index";
import { peopleFromDiscovery } from "@/lib/sourcing/from-open-index";

/** Where a claim came from when it is the recruiter's own record, not a page. */
const WORKSPACE_SOURCE = "https://talentos.local/workspace";

function claimId(parts: (string | number)[]): string {
  return parts.join(":");
}

/**
 * A capability claim's `normalized` field carries the ontology key when the
 * term resolves, and the normalised surface form when it does not — the
 * ranker reads both, and storing the key is what lets a multi-word capability
 * match at all.
 */
function capabilityKey(term: string): string {
  const key = resolveAlias(term);
  if (key) return key;
  const normalized = normalizeCapability(term);
  // "C++" normalises to the single character "c". Storing that as a capability
  // key lets it match anything, so a skill that survives normalisation only as
  // initials keeps its own spelling and can only ever match itself.
  const degenerate =
    !normalized || normalized.split(" ").every((token) => token.length < 2);
  return degenerate ? term.trim().toLowerCase() : normalized;
}

const CONTACT_PROVENANCE_LABELS: Record<string, string> = {
  typed_by_recruiter: "typed by the recruiter",
  given_by_person: "given by the person",
  from_a_public_page: "from a public page",
  generated_unverified: "generated — unverified",
};

function contactProvenanceLabel(provenance: string): string {
  return CONTACT_PROVENANCE_LABELS[provenance] ?? "contact record";
}

/** Everyone in the workspace, as claim-shaped evidence. */
export function workspacePeople(
  db: Db,
  searchProjectId?: string,
): SourcedPerson[] {
  const rows = db.select().from(candidates).all();
  const projects = new Map(
    db
      .select()
      .from(searchProjects)
      .all()
      .map((p) => [p.id, p]),
  );
  const evidenceRows = db.select().from(candidateSourceEvidence).all();
  const evidenceByCandidate = new Map<string, typeof evidenceRows>();
  for (const row of evidenceRows) {
    const list = evidenceByCandidate.get(row.candidateId) ?? [];
    list.push(row);
    evidenceByCandidate.set(row.candidateId, list);
  }

  const out: SourcedPerson[] = [];
  for (const row of rows) {
    if (searchProjectId && row.searchProjectId !== searchProjectId) continue;
    // Read through the schema, not straight off the row: a profile written
    // before contact details or publications existed has no such key, and
    // the parse is what applies those defaults. A record that predates a
    // field is not invalid.
    const parsed = candidateProfilePayloadSchema.safeParse(row.profile ?? {});
    const profile = parsed.success ? parsed.data : emptyCandidateProfile();
    const claims: Claim[] = [];

    if (row.currentTitle || row.currentCompany) {
      claims.push({
        id: claimId(["emp", row.id, "current"]),
        kind: "employment",
        claim: [row.currentTitle, row.currentCompany]
          .filter(Boolean)
          .join(" at "),
        normalized: normalizeOrganization(row.currentCompany ?? ""),
        sourceUrl: WORKSPACE_SOURCE,
        sourceTitle: projects.get(row.searchProjectId)?.name ?? "workspace",
        confidence: 0.9,
        title: row.currentTitle,
        organization: row.currentCompany,
      });
    }

    profile.experience.forEach((job, i) => {
      claims.push({
        id: claimId(["emp", row.id, i]),
        kind: "employment",
        claim: `${job.title} at ${job.company}`,
        normalized: normalizeOrganization(job.company),
        sourceUrl: WORKSPACE_SOURCE,
        sourceTitle: "work history",
        date: job.endYear
          ? `${job.endYear}-01-01`
          : job.startYear
            ? `${job.startYear}-01-01`
            : null,
        confidence: 0.85,
        title: job.title,
        organization: job.company,
      });
    });

    if (row.geography) {
      claims.push({
        id: claimId(["loc", row.id]),
        kind: "location",
        claim: row.geography,
        normalized: normalizeLocation(row.geography),
        sourceUrl: WORKSPACE_SOURCE,
        sourceTitle: "workspace",
        confidence: 0.8,
      });
    }

    for (const skill of profile.skills) {
      claims.push({
        id: claimId(["cap", row.id, skill]),
        kind: "capability",
        claim: skill,
        normalized: capabilityKey(skill),
        sourceUrl: WORKSPACE_SOURCE,
        sourceTitle: "stated skills",
        confidence: 0.7,
      });
    }
    for (const cert of [...profile.certifications, ...profile.licenses]) {
      claims.push({
        id: claimId(["cap", row.id, cert]),
        kind: "capability",
        claim: cert,
        normalized: capabilityKey(cert),
        sourceUrl: WORKSPACE_SOURCE,
        sourceTitle: "credentials",
        confidence: 0.85,
      });
    }

    profile.publications.forEach((pub, i) => {
      claims.push({
        id: claimId(["art", row.id, "pub", i]),
        kind: "artifact",
        claim: pub.title,
        normalized: pub.title.toLowerCase(),
        sourceUrl: pub.url ?? WORKSPACE_SOURCE,
        sourceTitle: pub.venue ?? "publication",
        date: pub.year ? `${pub.year}-01-01` : null,
        confidence: 0.9,
        artifactType: "publication",
      });
    });

    // Provenance rides along as the source title, so a pattern-generated
    // address is labelled unverified on every surface that renders it
    // (product rule 3) rather than only on the profile it was typed into.
    for (const email of profile.contact.emails) {
      claims.push({
        id: claimId(["contact", row.id, email.value]),
        kind: "contact",
        claim: email.value,
        normalized: email.value.toLowerCase(),
        sourceUrl: WORKSPACE_SOURCE,
        sourceTitle: contactProvenanceLabel(email.provenance),
        confidence: email.provenance === "generated_unverified" ? 0.3 : 0.8,
        contactType: "email",
      });
    }
    for (const phone of profile.contact.phones) {
      claims.push({
        id: claimId(["contact", row.id, phone.value]),
        kind: "contact",
        claim: phone.value,
        normalized: phone.value.toLowerCase(),
        sourceUrl: WORKSPACE_SOURCE,
        sourceTitle: contactProvenanceLabel(phone.provenance),
        confidence: phone.provenance === "generated_unverified" ? 0.3 : 0.8,
        contactType: "phone",
      });
    }

    // Saved addresses are where the corroboration count comes from: several
    // independent domains saying the same thing is the signal.
    for (const source of evidenceByCandidate.get(row.id) ?? []) {
      claims.push({
        id: claimId(["src", source.id]),
        kind: "identity",
        claim: source.title ?? source.sourceUrl,
        normalized: source.sourceUrl.toLowerCase(),
        sourceUrl: source.sourceUrl,
        sourceTitle: source.title ?? "",
        quote: source.snippet,
        date: source.retrievedAt.slice(0, 10),
        confidence:
          source.verificationStatus === "recruiter_verified" ? 0.9 : 0.5,
      });
    }

    out.push({
      id: row.id,
      name: row.name,
      title: row.currentTitle,
      organization: row.currentCompany,
      location: row.geography,
      summary: profile.summary ?? profile.headline ?? row.recruiterNotes,
      claims,
    });
  }
  return out;
}

export interface LiveSourceReport {
  source: string;
  label: string;
  count: number;
  error?: string;
}

export interface SourcingAnswer {
  brief: SourcingBrief;
  plan: SourcingPlan;
  ranked: RankResult;
  /** Where each ranked person lives, so a result can be opened. */
  hrefs: Record<string, string>;
  /** Per source: how many rows, or why none. Absent when nothing was called. */
  live?: LiveSourceReport[];
  /**
   * Rows a source returned whose title did not name a person. Reported rather
   * than dropped silently: a search that turns "Field Robotics Summit" into a
   * candidate has invented one, and you should be able to see it refusing to.
   */
  discarded?: { url: string; title: string; domain: string }[];
}

/** Answer a sourcing query over the workspace, and plan the fan-out beyond it. */
export function runSourcingQuery(
  db: Db,
  query: string,
  options: {
    env?: PlanEnvironment;
    limit?: number;
    searchProjectId?: string;
  } = {},
): SourcingAnswer {
  const brief = parseQuery(query);
  const people = workspacePeople(db, options.searchProjectId);
  const ranked = rankPeople(people, brief, { limit: options.limit ?? 25 });
  const env = options.env ?? { openIndex: process.env.TALENTOS_OPEN_INDEX };
  const plan = buildPlan(brief, env, {
    structured: structuredSources(brief, availableConnectors(env)),
  });

  const rows = db.select().from(candidates).all();
  const hrefs: Record<string, string> = {};
  for (const row of rows) {
    hrefs[row.id] = `/searches/${row.searchProjectId}/candidates/${row.id}`;
  }

  return { brief, plan, ranked, hrefs };
}

/**
 * Identity pairs the workspace cannot settle on its own.
 *
 * Two records that look like one person are held here rather than merged,
 * with the signals that got them close and the ones that held them back. A
 * wrongly merged profile invents a career nobody had, so the default is
 * always to keep them apart and ask.
 */
export interface ReviewPair {
  left: {
    id: string;
    name: string;
    title: string | null;
    organization: string | null;
    href: string;
  };
  right: {
    id: string;
    name: string;
    title: string | null;
    organization: string | null;
    href: string;
  };
  score: number;
  decision: MergeDecision;
  /** The bar this pair had to clear, which rises with how common the name is. */
  threshold: number;
  signals: string[];
}

function toSighting(person: SourcedPerson): Sighting {
  return {
    name: person.name,
    organizations: person.claims
      .filter((c) => c.kind === "employment" && c.organization)
      .map((c) => c.organization as string),
    identities: person.claims
      .filter((c) => c.kind === "identity")
      .map((c) => ({ type: "name_variant", value: c.normalized })),
    capabilities: person.claims
      .filter((c) => c.kind === "capability")
      .map((c) => c.claim),
    locations: person.claims
      .filter((c) => c.kind === "location")
      .map((c) => c.claim),
    artifactSources: person.claims
      .filter((c) => c.kind === "artifact" || c.kind === "identity")
      .map((c) => c.sourceUrl),
  };
}

/** Every pair close enough to look like one person, but not close enough to merge. */
export function identityReviewQueue(db: Db): ReviewPair[] {
  const people = workspacePeople(db);
  const rows = db.select().from(candidates).all();
  const href = new Map(
    rows.map((r) => [
      r.id,
      `/searches/${r.searchProjectId}/candidates/${r.id}`,
    ]),
  );

  // Block on the initials key so this stays linear-ish rather than comparing
  // everyone with everyone: two records only become a pair when an abbreviated
  // spelling of their names already agrees.
  const frequency = nameFrequency(people.map((p) => p.name));

  const blocks = new Map<string, SourcedPerson[]>();
  for (const person of people) {
    const key = nameInitialsKey(person.name);
    if (!key) continue;
    const list = blocks.get(key) ?? [];
    list.push(person);
    blocks.set(key, list);
  }

  const out: ReviewPair[] = [];
  for (const group of blocks.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const left = group[i];
        const right = group[j];
        const match = scoreMatch(
          { id: left.id, ...toSighting(left) },
          toSighting(right),
        );
        // Both names must clear their own bar: merging a rare name into a
        // common one is still merging into a common one.
        const threshold = Math.max(
          mergeThresholdFor(left.name, frequency),
          mergeThresholdFor(right.name, frequency),
        );
        const outcome =
          match.score >= threshold
            ? ("merge" as const)
            : decideFor(match.score, right.name, frequency);
        if (outcome === "new") continue;
        out.push({
          left: {
            id: left.id,
            name: left.name,
            title: left.title ?? null,
            organization: left.organization ?? null,
            href: href.get(left.id) ?? "/candidates",
          },
          right: {
            id: right.id,
            name: right.name,
            title: right.title ?? null,
            organization: right.organization ?? null,
            href: href.get(right.id) ?? "/candidates",
          },
          score: match.score,
          decision: outcome,
          threshold,
          signals: explainMatch(match),
        });
      }
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

/**
 * Records the evidence links into one person only by going through a third.
 *
 * Pairwise scoring never asks whether A and C are the same once it has put A
 * with B and B with C, so one person can stay split forever on a spelling
 * neither half shares. These are the groups closure finds — and a group held
 * together only by inference is offered, never merged.
 */
export function identityClusters(db: Db): {
  cluster: IdentityCluster;
  people: { id: string; name: string; title: string | null; href: string }[];
}[] {
  const people = workspacePeople(db);
  const rows = db.select().from(candidates).all();
  const href = new Map(
    rows.map((r) => [
      r.id,
      `/searches/${r.searchProjectId}/candidates/${r.id}`,
    ]),
  );
  const byId = new Map(people.map((p) => [p.id, p]));

  const profiles: PersonProfile[] = people.map((p) => ({
    id: p.id,
    ...toSighting(p),
  }));
  return clusterProfiles(profiles).map((cluster) => ({
    cluster,
    people: cluster.members.map((id) => ({
      id,
      name: byId.get(id)?.name ?? id,
      title: byId.get(id)?.title ?? null,
      href: href.get(id) ?? "/candidates",
    })),
  }));
}

/**
 * The same query, but also asked of the structured public sources.
 *
 * Separate from `runSourcingQuery` because this one makes network calls, and a
 * call is only ever made because a recruiter pressed a button — not because a
 * page rendered. Everything found is ranked beside the workspace under exactly
 * the same rules, so an open-index row with a one-line description does not
 * outrank a person with a CV, and nothing is stored: the rows are handed to the
 * page and discarded (product rule 2).
 */
export async function runLiveSourcingQuery(
  db: Db,
  query: string,
  options: {
    env?: PlanEnvironment;
    limit?: number;
    searchProjectId?: string;
  } = {},
): Promise<SourcingAnswer> {
  const base = runSourcingQuery(db, query, options);
  const run = await searchOpenIndex(
    toOpenIndexSpec(base.brief, options.limit ?? 20),
  );
  const { people: found, discarded } = peopleFromDiscovery(run.results);

  const combined = [...workspacePeople(db, options.searchProjectId), ...found];
  const ranked = rankPeople(combined, base.brief, {
    limit: options.limit ?? 25,
  });

  const hrefs = { ...base.hrefs };
  for (const person of found)
    hrefs[person.id] = person.claims[0]?.sourceUrl ?? "#";

  return {
    ...base,
    ranked,
    hrefs,
    live: run.reports.map((r) => ({
      source: r.source,
      label: r.label,
      count: r.count,
      error: r.error,
    })),
    discarded,
  };
}
