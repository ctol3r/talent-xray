/**
 * Profile connections (Wave H). Every candidate-bound address in the system
 * goes through `enforcePolicyForSave` and then `addProfileLink`, so there is
 * one place that answers: may this address be saved for this person at all,
 * and what may be claimed about it afterwards.
 *
 * Rules held here, not only in the UI:
 *  - Nothing fetches a page. An address is a string; the recruiter opens it.
 *  - An address the person asked us not to hold can never come back, by any
 *    path (paste, capture, import, Discover, a platform API).
 *  - A company page is not a profile link.
 *  - An off-family address is refused unless the search has turned that
 *    family on with a written reason, or the person supplied it themselves.
 *  - Two candidates sharing an address is a question for a human: the row is
 *    written and a review task opens. Nothing merges, ever (D-031, D-032).
 */
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type {
  ConfirmationChannel,
  ProfileLinkProvenance,
  SurfaceFamily,
  SuppressionReason,
} from "@/lib/core/enums";
import {
  jurisdictionSchema,
  profileLinkProvenanceSchema,
  suppressionReasonSchema,
  surfaceFamilySchema,
} from "@/lib/core/enums";
import type { Db } from "@/lib/db/client";
import {
  candidateSources,
  candidates,
  profileSuppressions,
  searchProjects,
  tasks,
} from "@/lib/db/schema";
import { isHttpUrl } from "@/lib/domain/discovery";
import { scanTextForProtectedTraits } from "@/lib/domain/fair-hiring";
import {
  findIdentityMatches,
  normUrl,
  type IdentityCandidate,
} from "@/lib/domain/identity";
import {
  day,
  linkTier,
  profileLinkLabel,
  type ProfileLinkRow,
} from "@/lib/domain/profile-links";
import {
  classifySurface,
  familyEnabled,
  matchableProfileUrls,
  modelVisibleUrls,
  FAMILY_WARNINGS,
  NOT_A_PERSON_MESSAGE,
  OPT_IN_FAMILIES,
  OPT_IN_REASON_MAX,
  OPT_IN_REASON_MIN,
  type SurfaceOptIns,
} from "@/lib/domain/surface-families";

/** The address is on a surface this search has not turned on. */
export class FamilyOffError extends Error {
  constructor(
    readonly family: SurfaceFamily,
    readonly warning: string,
  ) {
    super(warning);
    this.name = "FamilyOffError";
  }
}

/** The person asked not to be recorded at this address. */
export class SuppressedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuppressedUrlError";
  }
}

/** The address is a company page, not a person. */
export class NotAPersonError extends Error {
  constructor() {
    super(NOT_A_PERSON_MESSAGE);
    this.name = "NotAPersonError";
  }
}

/** Throws when this address is on the suppression list. Never writes. */
export function assertNotSuppressed(db: Db, url: string): void {
  const key = normUrl(url);
  const hit = db
    .select()
    .from(profileSuppressions)
    .where(eq(profileSuppressions.normalizedValue, key))
    .get();
  if (!hit) return;
  throw new SuppressedUrlError(
    `This person asked not to be recorded at this address on ${day(hit.recordedAt)} (${hit.reason.replace(/_/g, " ")}).`,
  );
}

function projectOptIns(db: Db, searchProjectId: string): SurfaceOptIns {
  const row = db
    .select({ optIns: searchProjects.surfaceOptIns })
    .from(searchProjects)
    .where(eq(searchProjects.id, searchProjectId))
    .get();
  return (row?.optIns ?? null) as SurfaceOptIns;
}

/**
 * The one guard. Called by every candidate-bound write path before it
 * inserts anything. Returns the family so the caller can record it; never
 * writes, so a refusal leaves no trace but the error.
 *
 * A `research_sources`-only save (a URL kept against the search, not against
 * a person) is NOT gated by family — only by suppression. Keeping a link to
 * read later is not the same act as attaching it to someone's record.
 */
export function enforcePolicyForSave(
  db: Db,
  input: {
    searchProjectId: string;
    url: string;
    provenance: ProfileLinkProvenance;
  },
): SurfaceFamily {
  assertNotSuppressed(db, input.url);
  const family = classifySurface(input.url);
  if (family === "not_a_person") throw new NotAPersonError();
  if (input.provenance === "candidate_provided") return family;
  if (!familyEnabled(family, projectOptIns(db, input.searchProjectId))) {
    throw new FamilyOffError(
      family,
      FAMILY_WARNINGS[family] ?? `This surface is off for this search.`,
    );
  }
  return family;
}

export interface ProfileLinkView extends ProfileLinkRow {
  id: string;
  family: SurfaceFamily;
  tier: ProfileLinkProvenance;
  badge: string;
  provenanceLine: string;
  subLines: string[];
  matchable: boolean;
  originUrl?: string;
}

/**
 * Every address held for this candidate, labelled. A registry-match row whose
 * match was later cleared is demoted here rather than keeping a badge that
 * names a registry the app no longer holds a record from.
 */
export function listProfileLinks(
  db: Db,
  candidateId: string,
  opts: { hasRegistryMatch?: boolean } = {},
): ProfileLinkView[] {
  const rows = db
    .select()
    .from(candidateSources)
    .where(eq(candidateSources.candidateId, candidateId))
    .all();
  const byId = new Map(rows.map((r) => [r.id, r.url]));
  return rows.map((row) => {
    const family = classifySurface(row.url);
    const raw: ProfileLinkRow = { ...row };
    if (linkTier(raw) === "registry_match" && opts.hasRegistryMatch === false) {
      raw.provenance = "recruiter_added";
      raw.sourceType = null;
      raw.addedVia = "manual";
    }
    const { badge, provenanceLine, subLines } = profileLinkLabel(raw, family);
    return {
      ...row,
      family,
      tier: linkTier(raw),
      badge,
      provenanceLine,
      subLines,
      matchable: matchableProfileUrls([row.url]).length === 1,
      ...(row.originSourceId
        ? { originUrl: byId.get(row.originSourceId) }
        : {}),
    };
  });
}

export const addProfileLinkInput = z.object({
  candidateId: z.string().min(1),
  url: z
    .string()
    .max(2048)
    .refine(isHttpUrl, "Use a complete http(s) address."),
  label: z.string().max(120).optional(),
  whyNote: z.string().max(200).optional(),
  addedVia: z.string().min(1).default("manual"),
  provenance: profileLinkProvenanceSchema.default("recruiter_added"),
  assertedBy: z.string().max(200).optional(),
  assertedAt: z.string().optional(),
  retrievedAt: z.string().optional(),
  confirmedAt: z.string().optional(),
  originSourceId: z.string().optional(),
  sourceType: z.string().max(60).optional(),
});

export interface AddProfileLinkResult {
  sourceId: string;
  family: SurfaceFamily;
  tier: ProfileLinkProvenance;
  duplicate: boolean;
  /** Other candidates in the same search holding a matchable address in common. */
  conflicts: { candidateId: string; name: string; reason: string }[];
}

/**
 * Save one address against one candidate. The only writer of
 * `candidate_sources` rows outside the Wave D import commit.
 *
 * A duplicate on the SAME candidate is a no-op. A duplicate on ANOTHER
 * candidate is written anyway and opens a review task: refusing it would make
 * the task unreachable and would invert Wave D's rule that a lookalike is
 * flagged for a human, never blocked.
 */
export function addProfileLink(
  db: Db,
  raw: z.input<typeof addProfileLinkInput>,
): AddProfileLinkResult {
  const input = addProfileLinkInput.parse(raw);
  const candidate = db
    .select()
    .from(candidates)
    .where(eq(candidates.id, input.candidateId))
    .get();
  if (!candidate) throw new Error("Candidate not found.");

  for (const text of [input.label, input.whyNote]) {
    if (!text) continue;
    const hits = scanTextForProtectedTraits(text);
    if (hits.length > 0) {
      throw new Error(
        `That note mentions ${hits.map((h) => h.trait).join(", ")}, which a hiring record must not weigh. Write what the evidence is instead.`,
      );
    }
  }

  const family = enforcePolicyForSave(db, {
    searchProjectId: candidate.searchProjectId,
    url: input.url,
    provenance: input.provenance,
  });

  const key = normUrl(input.url);
  const mine = db
    .select()
    .from(candidateSources)
    .where(eq(candidateSources.candidateId, input.candidateId))
    .all();
  const existing = mine.find((row) => normUrl(row.url) === key);
  if (existing) {
    return {
      sourceId: existing.id,
      family,
      tier: linkTier(existing),
      duplicate: true,
      conflicts: [],
    };
  }

  const [inserted] = db
    .insert(candidateSources)
    .values({
      candidateId: input.candidateId,
      url: input.url,
      label: input.label ?? null,
      whyNote: input.whyNote ?? null,
      addedVia: input.addedVia,
      provenance: input.provenance,
      assertedBy: input.assertedBy ?? null,
      assertedAt: input.assertedAt ?? null,
      retrievedAt: input.retrievedAt ?? null,
      confirmedAt: input.confirmedAt ?? null,
      originSourceId: input.originSourceId ?? null,
      sourceType: input.sourceType ?? null,
    })
    .returning()
    .all();

  const conflicts = openIdentityReviews(db, {
    candidate,
    url: input.url,
    family,
  });

  return {
    sourceId: inserted.id,
    family,
    tier: input.provenance,
    duplicate: false,
    conflicts,
  };
}

/**
 * Does another candidate in this search hold the same matchable address? The
 * matcher decides, on the filtered URL set; a shared personal-life or
 * contact-vendor page never binds two records.
 */
function openIdentityReviews(
  db: Db,
  args: {
    candidate: { id: string; name: string; searchProjectId: string };
    url: string;
    family: SurfaceFamily;
  },
): AddProfileLinkResult["conflicts"] {
  if (matchableProfileUrls([args.url]).length === 0) return [];
  const others = db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.searchProjectId, args.candidate.searchProjectId),
        ne(candidates.id, args.candidate.id),
      ),
    )
    .all();
  if (others.length === 0) return [];

  const urlsFor = (id: string) =>
    matchableProfileUrls(
      db
        .select({ url: candidateSources.url })
        .from(candidateSources)
        .where(eq(candidateSources.candidateId, id))
        .all()
        .map((r) => r.url),
    );

  const me: IdentityCandidate = {
    id: args.candidate.id,
    name: args.candidate.name,
    profileUrls: urlsFor(args.candidate.id),
  };
  const matches = findIdentityMatches(
    me,
    others.map((o) => ({
      id: o.id,
      name: o.name,
      currentCompany: o.currentCompany ?? undefined,
      geography: o.geography ?? undefined,
      profileUrls: urlsFor(o.id),
    })),
  ).filter((m) => m.strength === "same_urls");

  const conflicts: AddProfileLinkResult["conflicts"] = [];
  for (const match of matches) {
    const other = others.find((o) => o.id === match.otherId);
    if (!other) continue;
    conflicts.push({
      candidateId: other.id,
      name: other.name,
      reason: match.reason,
    });
    const title = `Identity review: "${args.candidate.name}" and "${other.name}" share an address — decide which record stays`;
    const open = db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.searchProjectId, args.candidate.searchProjectId),
          eq(tasks.kind, "identity_review"),
          eq(tasks.title, title),
        ),
      )
      .get();
    if (open) continue;
    db.insert(tasks)
      .values({
        searchProjectId: args.candidate.searchProjectId,
        candidateId: args.candidate.id,
        kind: "identity_review",
        title,
        status: "open",
      })
      .run();
  }
  return conflicts;
}

/**
 * Delete one address. Children that were read from it keep their own rows and
 * lose the pointer — the migration adds the column with no ON DELETE clause
 * (drizzle-kit cannot emit one on ALTER TABLE ADD COLUMN), so the nulling is
 * done here, explicitly, inside the transaction.
 */
export function removeProfileLink(
  db: Db,
  input: { candidateId: string; sourceId: string },
): void {
  db.transaction((tx) => {
    tx.update(candidateSources)
      .set({ originSourceId: null })
      .where(eq(candidateSources.originSourceId, input.sourceId))
      .run();
    tx.delete(candidateSources)
      .where(
        and(
          eq(candidateSources.id, input.sourceId),
          eq(candidateSources.candidateId, input.candidateId),
        ),
      )
      .run();
  });
}

/**
 * Move an address to another candidate, intact. The answer to a duplicate is
 * never a merge: it is deciding which record the address belongs to and
 * moving it with its provenance and dates, so the losing record can be
 * emptied and deleted without losing a link's history.
 */
export function moveProfileLink(
  db: Db,
  input: { sourceId: string; toCandidateId: string },
): void {
  const row = db
    .select()
    .from(candidateSources)
    .where(eq(candidateSources.id, input.sourceId))
    .get();
  if (!row) throw new Error("Address not found.");
  const target = db
    .select()
    .from(candidates)
    .where(eq(candidates.id, input.toCandidateId))
    .get();
  if (!target) throw new Error("Candidate not found.");
  const key = normUrl(row.url);
  const clash = db
    .select()
    .from(candidateSources)
    .where(eq(candidateSources.candidateId, input.toCandidateId))
    .all()
    .find((r) => normUrl(r.url) === key);
  if (clash) {
    removeProfileLink(db, {
      candidateId: row.candidateId,
      sourceId: row.id,
    });
    return;
  }
  db.update(candidateSources)
    .set({ candidateId: input.toCandidateId })
    .where(eq(candidateSources.id, input.sourceId))
    .run();
}

export const surfaceOptInInput = z.object({
  searchProjectId: z.string().min(1),
  family: surfaceFamilySchema.refine(
    (f) => OPT_IN_FAMILIES.includes(f),
    "That family is on by default; there is nothing to turn on.",
  ),
  reason: z.string().min(OPT_IN_REASON_MIN).max(OPT_IN_REASON_MAX),
});

/** Turn one off-by-default family on for one search, with a written reason. */
export function setSurfaceOptIn(
  db: Db,
  raw: z.input<typeof surfaceOptInInput>,
  now = new Date(),
): SurfaceOptIns {
  const input = surfaceOptInInput.parse(raw);
  const hits = scanTextForProtectedTraits(input.reason);
  if (hits.length > 0) {
    throw new Error(
      `That reason mentions ${hits.map((h) => h.trait).join(", ")}. A search may not be widened on those grounds.`,
    );
  }
  const current = projectOptIns(db, input.searchProjectId) ?? {};
  const next = {
    ...current,
    [input.family]: { reason: input.reason, at: now.toISOString() },
  };
  db.update(searchProjects)
    .set({ surfaceOptIns: next })
    .where(eq(searchProjects.id, input.searchProjectId))
    .run();
  return next;
}

export function clearSurfaceOptIn(
  db: Db,
  input: { searchProjectId: string; family: SurfaceFamily },
): SurfaceOptIns {
  const current = { ...(projectOptIns(db, input.searchProjectId) ?? {}) };
  delete current[input.family];
  db.update(searchProjects)
    .set({ surfaceOptIns: current })
    .where(eq(searchProjects.id, input.searchProjectId))
    .run();
  return current;
}

export const setJurisdictionInput = z.object({
  searchProjectId: z.string().min(1),
  jurisdiction: jurisdictionSchema.nullable(),
});

export function setJurisdiction(
  db: Db,
  raw: z.input<typeof setJurisdictionInput>,
): void {
  const input = setJurisdictionInput.parse(raw);
  db.update(searchProjects)
    .set({ jurisdiction: input.jurisdiction })
    .where(eq(searchProjects.id, input.searchProjectId))
    .run();
}

export const suppressUrlInput = z.object({
  url: z.string().min(4).max(2048),
  candidateId: z.string().optional(),
  reason: suppressionReasonSchema,
  note: z.string().max(200).optional(),
});

/**
 * Record that an address may never be saved again. The row outlives the
 * candidate: an objection must survive the deletion of the record it was
 * about, or the same address walks back in on the next import.
 */
export function suppressUrl(
  db: Db,
  raw: z.input<typeof suppressUrlInput>,
): void {
  const input = suppressUrlInput.parse(raw);
  const key = normUrl(input.url);
  const existing = db
    .select()
    .from(profileSuppressions)
    .where(eq(profileSuppressions.normalizedValue, key))
    .get();
  if (existing) return;
  db.insert(profileSuppressions)
    .values({
      kind: "url",
      normalizedValue: key,
      candidateId: input.candidateId ?? null,
      reason: input.reason as SuppressionReason,
      note: input.note ?? null,
    })
    .run();
}

/** Every candidate in every search holding this address. For a data request. */
export function findCandidatesByUrl(
  db: Db,
  url: string,
): { candidateId: string; name: string; searchProjectId: string }[] {
  const key = normUrl(url);
  return db
    .select({
      candidateId: candidateSources.candidateId,
      url: candidateSources.url,
      name: candidates.name,
      searchProjectId: candidates.searchProjectId,
    })
    .from(candidateSources)
    .innerJoin(candidates, eq(candidateSources.candidateId, candidates.id))
    .all()
    .filter((row) => normUrl(row.url) === key)
    .map(({ candidateId, name, searchProjectId }) => ({
      candidateId,
      name,
      searchProjectId,
    }));
}

/** The only URLs a model may see: bare addresses, two families. */
export function linksForModel(db: Db, candidateId: string): string[] {
  const urls = db
    .select({ url: candidateSources.url })
    .from(candidateSources)
    .where(eq(candidateSources.candidateId, candidateId))
    .all()
    .map((r) => r.url);
  return modelVisibleUrls(urls);
}

/** The URLs the identity matcher may see for this candidate. */
export function matchableProfileUrlsFor(db: Db, candidateId: string): string[] {
  return matchableProfileUrls(
    db
      .select({ url: candidateSources.url })
      .from(candidateSources)
      .where(eq(candidateSources.candidateId, candidateId))
      .all()
      .map((r) => r.url),
  );
}

/** Suppressions raised about a candidate, for the export bundle. */
export function suppressionsForCandidate(db: Db, candidateId: string) {
  return db
    .select()
    .from(profileSuppressions)
    .where(eq(profileSuppressions.candidateId, candidateId))
    .all();
}

/** Deleting a candidate keeps their objections, detached. */
export function detachSuppressions(db: Db, candidateId: string): void {
  db.update(profileSuppressions)
    .set({ candidateId: null })
    .where(eq(profileSuppressions.candidateId, candidateId))
    .run();
}

export type { ConfirmationChannel };
