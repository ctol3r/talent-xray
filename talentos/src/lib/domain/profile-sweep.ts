/**
 * Per-candidate profile sweep (Wave H2). Given one person the recruiter is
 * already working on, compose the search strings that find their OTHER public
 * profiles, and open each on the engine's own hosted results page (D-034).
 *
 * This is the answer for the surfaces no API will ever open: clinical
 * directories, law and finance registries, speaker rosters, personal sites.
 * The app composes and opens; the recruiter judges and keeps.
 *
 * Every string obeys the composer's grammar — quoted phrases, parenthesised
 * OR groups, `-` exclusions, `site:` with a path — and the same 32-term
 * budget as the Search String Lab. A string is never emitted over budget:
 * exclusions are appended in a fixed order until the budget is reached and
 * the rest are reported, because Google silently drops everything past its
 * limit, including the site restriction (observed in the Wave P pilot, where
 * two 70-word strings differing only in their trailing `site:` clause
 * returned an identical count).
 *
 * No URL is generated here. A sweep produces search strings and nothing else.
 */
import type { SurfaceFamily } from "@/lib/core/enums";
import { normName } from "./identity";
import { countTerms, GOOGLE_TERM_BUDGET, qaQuery } from "./query-normalization";
import {
  classifySurface,
  familyEnabled,
  OPT_IN_FAMILIES,
  type SurfaceOptIns,
} from "./surface-families";

export const SWEEP_TEMPLATE_IDS = [
  "T1",
  "T1L",
  "T2",
  "T3",
  "T4",
  "T5",
] as const;
export type SweepTemplateId = (typeof SWEEP_TEMPLATE_IDS)[number];

export interface SweepQuery {
  key: SweepTemplateId;
  /** What this string is for, in the recruiter's language. */
  purpose: string;
  engine: "core" | "reach";
  query: string;
  terms: number;
  /** Exclusions that did not fit the budget; the policy still applies on save. */
  omittedExclusions: string[];
}

/**
 * Hosts excluded from a sweep because their family is off for this search.
 * Ordered by how much noise each removes, so the ones that matter survive a
 * tight budget: documents first (a shared file is never a profile), then
 * contact vendors, then private life, then broadcast timelines.
 */
const EXCLUSION_ORDER: { family: SurfaceFamily; hosts: string[] }[] = [
  {
    family: "document",
    hosts: [
      "scribd.com",
      "slideshare.net",
      "drive.google.com",
      "docs.google.com",
    ],
  },
  {
    family: "contact_aggregator",
    hosts: ["zoominfo.com", "rocketreach.co", "signalhire.com", "apollo.io"],
  },
  {
    family: "personal_life",
    hosts: ["facebook.com", "instagram.com", "tiktok.com", "reddit.com"],
  },
  { family: "mixed_broadcast", hosts: ["x.com", "twitter.com", "youtube.com"] },
];

/** The `-site:` terms this search should carry, in fixed order. */
export function familyExclusions(optIns: SurfaceOptIns): string[] {
  const out: string[] = [];
  for (const group of EXCLUSION_ORDER) {
    if (familyEnabled(group.family, optIns)) continue;
    for (const host of group.hosts) out.push(`-site:${host}`);
  }
  return out;
}

/** Append exclusions until the budget is reached; report what did not fit. */
function withinBudget(
  base: string,
  exclusions: string[],
): { query: string; terms: number; omittedExclusions: string[] } {
  let query = base;
  const omitted: string[] = [];
  for (const exclusion of exclusions) {
    const candidate = `${query} ${exclusion}`;
    if (countTerms(candidate) > GOOGLE_TERM_BUDGET) {
      omitted.push(exclusion);
      continue;
    }
    query = candidate;
  }
  return { query, terms: countTerms(query), omittedExclusions: omitted };
}

const quote = (value: string) => `"${value.trim()}"`;

/** An OR group, or a single term when there is only one. */
function anyOf(values: string[]): string {
  const cleaned = values.map((v) => v.trim()).filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0];
  return `(${cleaned.join(" OR ")})`;
}

/** City and state words worth searching on, from a free-text geography. */
export function geographyTerms(geography: string | null | undefined): string[] {
  if (!geography) return [];
  return geography
    .split(/[,/|]/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2)
    .slice(0, 2)
    .map((part) => (part.includes(" ") ? quote(part) : part));
}

/** Handles that are worth searching for as text; a common one is noise. */
const HANDLE_STOPLIST = new Set([
  "admin",
  "dev",
  "guest",
  "user",
  "test",
  "info",
  "hello",
  "me",
  "home",
  "profile",
  "public",
  "team",
  "work",
]);

/** Platforms whose path segment is a handle a person chose for themselves. */
const HANDLE_HOSTS: { host: string; segment: number }[] = [
  { host: "github.com", segment: 0 },
  { host: "gitlab.com", segment: 0 },
  { host: "kaggle.com", segment: 0 },
  { host: "huggingface.co", segment: 0 },
  { host: "dev.to", segment: 0 },
  { host: "hashnode.com", segment: 0 },
  { host: "codepen.io", segment: 0 },
  { host: "keybase.io", segment: 0 },
];

/**
 * Is this handle distinctive enough that searching for it finds this person
 * rather than a thousand others? A handle derivable from the name adds
 * nothing the name search already does.
 */
export function handleIsPivotable(handle: string, name: string): boolean {
  const h = handle.trim().toLowerCase();
  if (h.length < 6) return false;
  if (HANDLE_STOPLIST.has(h)) return false;
  const parts = normName(name).split(" ").filter(Boolean);
  if (parts.length === 0) return true;
  const first = parts[0];
  const last = parts[parts.length - 1];
  const derivable = new Set(
    [
      first,
      last,
      `${first}${last}`,
      `${first[0] ?? ""}${last}`,
      `${first}.${last}`,
      `${first}_${last}`,
      `${first}-${last}`,
      `${last}${first}`,
      `${last}${first[0] ?? ""}`,
    ].map((v) => v.replace(/[^a-z0-9]/g, "")),
  );
  return !derivable.has(h.replace(/[^a-z0-9]/g, ""));
}

/** The most distinctive handle among the addresses already kept, if any. */
export function handleFromLinks(
  links: { url: string }[],
  name: string,
): { handle: string; originHost: string } | null {
  for (const link of links) {
    let parsed: URL;
    try {
      parsed = new URL(link.url);
    } catch {
      continue;
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const match = HANDLE_HOSTS.find(
      (h) => host === h.host || host.endsWith(`.${h.host}`),
    );
    if (!match) continue;
    // A LinkedIn slug is assigned, not chosen, and is never a handle.
    const segments = parsed.pathname.split("/").filter(Boolean);
    const handle = segments[match.segment];
    if (!handle) continue;
    if (handleIsPivotable(handle, name)) {
      return { handle, originHost: host };
    }
  }
  return null;
}

/** Spellings of a handle a person might use elsewhere. Text, never a URL. */
export function handleSpellings(handle: string): string[] {
  const base = handle.trim();
  const out = new Set<string>([base]);
  if (base.includes("_")) out.add(base.replace(/_/g, "-"));
  if (base.includes("-")) out.add(base.replace(/-/g, "_"));
  const stripped = base.replace(/[-_.]/g, "");
  if (stripped.length >= 6) out.add(stripped);
  return [...out].slice(0, 3);
}

export interface SweepInput {
  name: string;
  employer?: string | null;
  geography?: string | null;
  /** Addresses already kept for this person, used to find a handle. */
  links?: { url: string }[];
  optIns: SurfaceOptIns;
}

/**
 * Registries and author records. One click covers the licensed professions
 * and the research ones, because a recruiter should not have to guess which
 * kind of person they are looking at before searching.
 */
const REGISTRY_SITES = [
  "site:doximity.com",
  "site:npiregistry.cms.hhs.gov",
  "site:healthgrades.com",
  "site:avvo.com",
  "site:martindale.com",
  "site:orcid.org",
  "site:researchgate.net",
  "site:semanticscholar.org",
];

const ROSTER_SITES = [
  "site:sessionize.com",
  "site:meetup.com",
  "site:muckrack.com",
];

const PROFILE_URL_MARKERS = ["orcid.org", "github.io", '"personal website"'];

/**
 * Compose the sweep for one person. Templates that cannot be built (no
 * employer, no distinctive handle) are omitted rather than emitted empty.
 */
export function buildProfileSweep(input: SweepInput): SweepQuery[] {
  const name = input.name.trim();
  if (name.length < 2) return [];
  const exclusions = familyExclusions(input.optIns);
  const quotedName = quote(name);
  const employer = input.employer?.trim();
  const employerGroup = employer
    ? anyOf([quote(employer), employer.split(/\s+/)[0]])
    : "";
  const geo = geographyTerms(input.geography);
  const geoGroup = geo.length > 0 ? anyOf(geo) : "";
  const out: SweepQuery[] = [];

  const add = (
    key: SweepTemplateId,
    purpose: string,
    engine: "core" | "reach",
    base: string,
    useExclusions = true,
  ) => {
    const trimmed = base.replace(/\s+/g, " ").trim();
    if (!trimmed) return;
    const fitted = withinBudget(trimmed, useExclusions ? exclusions : []);
    // A malformed string is a bug, not something to hand a recruiter.
    if (
      qaQuery(fitted.query, "Google (open web)").some(
        (w) => w.code !== "over_budget",
      )
    )
      return;
    out.push({ key, purpose, engine, ...fitted });
  };

  add(
    "T1",
    "Every people surface, by name and employer",
    "core",
    [quotedName, employerGroup, geoGroup].filter(Boolean).join(" "),
  );

  add(
    "T1L",
    "LinkedIn only",
    "core",
    [
      quotedName,
      employerGroup,
      "(site:linkedin.com/in OR site:linkedin.com/pub)",
    ]
      .filter(Boolean)
      .join(" "),
    false,
  );

  const handle = input.links ? handleFromLinks(input.links, name) : null;
  if (handle) {
    add(
      "T2",
      `The handle "${handle.handle}" as text, everywhere but where it was found`,
      "core",
      `${anyOf(handleSpellings(handle.handle).map(quote))} -site:${handle.originHost}`,
    );
  }

  add(
    "T3",
    "Registries and author records, by name and place",
    "reach",
    [quotedName, geoGroup, `(${REGISTRY_SITES.join(" OR ")})`]
      .filter(Boolean)
      .join(" "),
    false,
  );

  add(
    "T4",
    "Pages that print one of their other profile addresses",
    "core",
    [quotedName, employerGroup, anyOf(PROFILE_URL_MARKERS)]
      .filter(Boolean)
      .join(" "),
  );

  add(
    "T5",
    "Speaker rosters and bylines",
    "reach",
    [quotedName, employerGroup, `(${ROSTER_SITES.join(" OR ")})`]
      .filter(Boolean)
      .join(" "),
    false,
  );

  return out;
}

/** True when a string names a surface this search has turned off. */
export function sweepMentionsOffFamily(
  query: string,
  optIns: SurfaceOptIns,
): boolean {
  const sites = [...query.matchAll(/(?<!-)site:([^\s)]+)/g)].map((m) => m[1]);
  return sites.some((site) => {
    const family = classifySurface(`https://${site.replace(/^www\./, "")}/x`);
    return OPT_IN_FAMILIES.includes(family) && !familyEnabled(family, optIns);
  });
}
