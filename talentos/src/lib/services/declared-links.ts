/**
 * Reading the addresses a person listed on a profile they control (Wave H).
 *
 * The recruiter clicks once, for one person, on a platform account already
 * saved on that candidate. The app makes one structured API request, holds
 * the result in memory, and writes nothing until the recruiter keeps a
 * specific address.
 *
 * Three rules enforced here rather than in the card:
 *  - An address on a family this search has not turned on is never shown as
 *    a URL. The card is told how many there were and nothing else; showing a
 *    personal-life address while calling it hidden would be showing it.
 *  - `acceptDeclaredLink` re-parses the link through the schema and re-runs
 *    the guard, so a client cannot post a family past it.
 *  - Personal-life and document addresses can never be kept from a
 *    suggestion, whatever the opt-in says. Paste is the only path to those,
 *    because paste is a human typing an address they chose.
 */
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { SurfaceFamily } from "@/lib/core/enums";
import type { Db } from "@/lib/db/client";
import { candidateSources, candidates } from "@/lib/db/schema";
import { normUrl } from "@/lib/domain/identity";
import {
  classifySurface,
  familyEnabled,
  SURFACE_FAMILY_LABELS,
  type SurfaceOptIns,
} from "@/lib/domain/surface-families";
import {
  declaredLinkSchema,
  type DeclaredClient,
  type DeclaredLink,
  type DeclaredPlatform,
} from "@/lib/profiles/declared";
import {
  createGithubClient,
  githubLoginFromUrl,
  resolveGithubMode,
} from "@/lib/profiles/github";
import {
  createKeybaseClient,
  keybaseUsernameFromUrl,
  resolveKeybaseMode,
} from "@/lib/profiles/keybase";
import {
  createOrcidClient,
  orcidIdFromUrl,
  resolveOrcidMode,
} from "@/lib/profiles/orcid";
import {
  createWikidataClient,
  resolveWikidataMode,
  wikidataIdFromUrl,
} from "@/lib/profiles/wikidata";
import { addProfileLink } from "./profile-links";
import { searchProjects } from "@/lib/db/schema";

/**
 * Families a suggestion may never be kept from, whatever the opt-in says.
 * Paste is the only path to these, because paste is a human typing an
 * address they chose.
 *
 * `unrecognised` is deliberately NOT here: a personal domain or a lab page
 * the person listed on their own profile is the most valuable link this
 * feature can surface, and they published it themselves. It stays
 * unmatchable and invisible to models like every other unrecognised host.
 */
const NEVER_FROM_SUGGESTION: SurfaceFamily[] = [
  "personal_life",
  "document",
  "not_a_person",
];

export interface DeclaredAccount {
  sourceId: string;
  platform: DeclaredPlatform;
  account: string;
  url: string;
  configured: boolean;
  mode: string;
}

/** Which platform accounts on this candidate can be read, and whether they are enabled. */
export function declaredAccounts(
  db: Db,
  candidateId: string,
): DeclaredAccount[] {
  const rows = db
    .select()
    .from(candidateSources)
    .where(eq(candidateSources.candidateId, candidateId))
    .all();
  const modes: Record<DeclaredPlatform, string> = {
    github: resolveGithubMode(),
    keybase: resolveKeybaseMode(),
    orcid: resolveOrcidMode(),
    wikidata: resolveWikidataMode(),
  };
  const readers: {
    platform: DeclaredPlatform;
    accountFromUrl: (url: string) => string | null;
  }[] = [
    { platform: "github", accountFromUrl: githubLoginFromUrl },
    { platform: "keybase", accountFromUrl: keybaseUsernameFromUrl },
    { platform: "orcid", accountFromUrl: orcidIdFromUrl },
    { platform: "wikidata", accountFromUrl: wikidataIdFromUrl },
  ];
  const out: DeclaredAccount[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const reader of readers) {
      const account = reader.accountFromUrl(row.url);
      if (!account) continue;
      const key = `${reader.platform}:${account}`;
      if (seen.has(key)) break;
      seen.add(key);
      out.push({
        sourceId: row.id,
        platform: reader.platform,
        account,
        url: row.url,
        configured: modes[reader.platform] !== "off",
        mode: modes[reader.platform],
      });
      break;
    }
  }
  return out;
}

export interface DeclaredSuggestion {
  link: DeclaredLink;
  family: SurfaceFamily;
  familyLabel: string;
  /** False when this family may never be kept from a suggestion. */
  keepable: boolean;
  /** The candidate who already holds this address, when someone does. */
  alreadySavedOn?: string;
}

export interface DeclaredReadResult {
  platform: DeclaredPlatform;
  account: string;
  retrievedAt: string;
  suggestions: DeclaredSuggestion[];
  /** How many addresses were on off surfaces and are therefore not shown. */
  hiddenCount: number;
}

export const readDeclaredLinksInput = z.object({
  candidateId: z.string().min(1),
  sourceId: z.string().min(1),
});

/**
 * Read one person's declared links. Writes nothing. The client is injectable
 * so the tests never touch the network.
 */
export async function readDeclaredLinks(
  db: Db,
  raw: z.input<typeof readDeclaredLinksInput>,
  clients?: Partial<Record<DeclaredPlatform, DeclaredClient>>,
  now: () => string = () => new Date().toISOString(),
): Promise<DeclaredReadResult> {
  const input = readDeclaredLinksInput.parse(raw);
  const account = declaredAccounts(db, input.candidateId).find(
    (a) => a.sourceId === input.sourceId,
  );
  if (!account) {
    throw new Error(
      "That address is not a platform account this app can read links from.",
    );
  }
  const factories: Record<DeclaredPlatform, () => DeclaredClient> = {
    github: createGithubClient,
    keybase: createKeybaseClient,
    orcid: createOrcidClient,
    wikidata: createWikidataClient,
  };
  const client = clients?.[account.platform] ?? factories[account.platform]();
  const links = await client.read(account.account);
  const retrievedAt = now();

  const candidate = db
    .select()
    .from(candidates)
    .where(eq(candidates.id, input.candidateId))
    .get();
  if (!candidate) throw new Error("Candidate not found.");
  const project = db
    .select({ optIns: searchProjects.surfaceOptIns })
    .from(searchProjects)
    .where(eq(searchProjects.id, candidate.searchProjectId))
    .get();
  const optIns = (project?.optIns ?? null) as SurfaceOptIns;

  const held = db
    .select({
      url: candidateSources.url,
      candidateId: candidateSources.candidateId,
    })
    .from(candidateSources)
    .all();
  const holderByUrl = new Map<string, string>();
  for (const row of held) holderByUrl.set(normUrl(row.url), row.candidateId);
  const nameById = new Map(
    db
      .select({ id: candidates.id, name: candidates.name })
      .from(candidates)
      .all()
      .map((c) => [c.id, c.name]),
  );

  const suggestions: DeclaredSuggestion[] = [];
  let hiddenCount = 0;
  for (const link of links) {
    const family = classifySurface(link.url);
    const keepable =
      !NEVER_FROM_SUGGESTION.includes(family) && familyEnabled(family, optIns);
    if (!keepable) {
      hiddenCount += 1;
      continue;
    }
    const holder = holderByUrl.get(normUrl(link.url));
    suggestions.push({
      link,
      family,
      familyLabel: SURFACE_FAMILY_LABELS[family],
      keepable: true,
      ...(holder && holder !== input.candidateId
        ? { alreadySavedOn: nameById.get(holder) ?? "another candidate" }
        : {}),
    });
  }

  return {
    platform: account.platform,
    account: account.account,
    retrievedAt,
    suggestions,
    hiddenCount,
  };
}

export const acceptDeclaredLinkInput = z.object({
  candidateId: z.string().min(1),
  originSourceId: z.string().min(1),
  retrievedAt: z.string().min(4),
  link: declaredLinkSchema,
});

/**
 * Keep one suggested address. The schema and the guard run again on the
 * server: a client cannot hand back a link on a family that was hidden.
 */
export function acceptDeclaredLink(
  db: Db,
  raw: z.input<typeof acceptDeclaredLinkInput>,
) {
  const input = acceptDeclaredLinkInput.parse(raw);
  const family = classifySurface(input.link.url);
  if (NEVER_FROM_SUGGESTION.includes(family)) {
    throw new Error(
      `An address on a ${SURFACE_FAMILY_LABELS[family].toLowerCase()} can only be added by hand, never kept from a suggestion.`,
    );
  }
  return addProfileLink(db, {
    candidateId: input.candidateId,
    url: input.link.url,
    label: input.link.label,
    addedVia: `profile_api:${input.link.platform}`,
    provenance: input.link.reciprocal
      ? "platform_reciprocal"
      : "platform_declared",
    assertedBy: input.link.assertedBy,
    ...(input.link.assertedAt ? { assertedAt: input.link.assertedAt } : {}),
    retrievedAt: input.retrievedAt,
    originSourceId: input.originSourceId,
  });
}
