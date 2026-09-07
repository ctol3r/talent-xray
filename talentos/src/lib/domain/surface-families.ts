/**
 * Surface families (Wave H). What kind of page an address points at, computed
 * from the URL every time it is read and never stored — a corpus correction
 * must relabel every existing row at once.
 *
 * The table is the two live Talent X-Ray engines' own 102 URL patterns
 * (`docs/engines/*.txt`), grouped by what a regulator would say about looking
 * at them. Professional, scholarly/registry and review surfaces are on by
 * default. Contact-aggregator, broadcast, personal-life and document surfaces
 * are off until the recruiter turns them on for one search with a written
 * reason. A host outside the corpus is `unrecognised`: saveable as an address
 * (a developer's own domain and a faculty page are the most valuable links a
 * sourcer finds) but never an identity signal and never shown to a model.
 *
 * Nothing here reads a page. Classification is string work on the URL.
 */
import type { SurfaceFamily } from "@/lib/core/enums";
import { PRODUCT_NAME } from "@/lib/product";

export type { SurfaceFamily };

/** Human words for a family, used in badges and warnings. */
export const SURFACE_FAMILY_LABELS: Record<SurfaceFamily, string> = {
  professional: "Professional profile",
  scholarly_registry: "Scholarly / registry",
  review_site: "Directory / review site",
  contact_aggregator: "Contact-data vendor",
  mixed_broadcast: "Broadcast surface",
  personal_life: "Personal-life surface",
  document: "Document",
  not_a_person: "Company page",
  unrecognised: "Unrecognised surface",
};

/** Families a recruiter may save to without turning anything on. */
export const DEFAULT_ON_FAMILIES: SurfaceFamily[] = [
  "professional",
  "scholarly_registry",
  "review_site",
  "unrecognised",
];

/** Families that need a typed reason on the search project first. */
export const OPT_IN_FAMILIES: SurfaceFamily[] = [
  "contact_aggregator",
  "mixed_broadcast",
  "personal_life",
  "document",
];

/**
 * Families whose URLs may reach `findIdentityMatches`. A shared Facebook page
 * or a contact-vendor page must never bind two candidate records together.
 * `unrecognised` is excluded: an unknown host is often a shared platform.
 */
export const MATCHABLE_FAMILIES: SurfaceFamily[] = [
  "professional",
  "scholarly_registry",
  "review_site",
  "mixed_broadcast",
];

/** Families whose bare URLs may appear in a model's context. Nothing else. */
export const MODEL_VISIBLE_FAMILIES: SurfaceFamily[] = [
  "professional",
  "scholarly_registry",
];

interface Rule {
  /** Exact hostname, or a suffix when `suffix` is true (the corpus `*.` form). */
  host: string;
  suffix?: boolean;
  /** Path must start with one of these, when given. */
  paths?: string[];
  family: SurfaceFamily;
}

/**
 * Ordered; the first match wins, so a host's path-specific rules come first.
 * Every entry traces to a pattern in `docs/engines/*.txt` unless marked.
 */
const RULES: Rule[] = [
  // ── company pages: not a person ──
  {
    host: "linkedin.com",
    suffix: true,
    paths: ["/company"],
    family: "not_a_person",
  },
  {
    host: "apollo.io",
    suffix: true,
    paths: ["/companies"],
    family: "not_a_person",
  },

  // ── documents ──
  { host: "drive.google.com", family: "document" },
  { host: "docs.google.com", family: "document" },
  { host: "scribd.com", suffix: true, family: "document" },
  { host: "slideshare.net", suffix: true, family: "document" },
  { host: "speakerdeck.com", suffix: true, family: "document" },

  // ── scholarly, credential and regulatory registries ──
  { host: "patents.google.com", family: "scholarly_registry" },
  { host: "scholar.google.com", family: "scholarly_registry" },
  { host: "orcid.org", suffix: true, family: "scholarly_registry" },
  { host: "researchgate.net", suffix: true, family: "scholarly_registry" },
  { host: "semanticscholar.org", suffix: true, family: "scholarly_registry" },
  { host: "pubmed.ncbi.nlm.nih.gov", family: "scholarly_registry" },
  { host: "europepmc.org", suffix: true, family: "scholarly_registry" },
  { host: "webofscience.com", suffix: true, family: "scholarly_registry" },
  { host: "loop.frontiersin.org", family: "scholarly_registry" },
  { host: "arxiv.org", suffix: true, family: "scholarly_registry" },
  { host: "dblp.org", suffix: true, family: "scholarly_registry" },
  { host: "papers.ssrn.com", family: "scholarly_registry" },
  { host: "clinicaltrials.gov", suffix: true, family: "scholarly_registry" },
  { host: "reporter.nih.gov", family: "scholarly_registry" },
  { host: "scopus.com", suffix: true, family: "scholarly_registry" },
  { host: "ieeexplore.ieee.org", family: "scholarly_registry" },
  { host: "osti.gov", suffix: true, family: "scholarly_registry" },
  { host: "academia.edu", suffix: true, family: "scholarly_registry" },
  { host: "npiregistry.cms.hhs.gov", family: "scholarly_registry" },
  { host: "npidb.org", suffix: true, family: "scholarly_registry" },
  { host: "npino.com", suffix: true, family: "scholarly_registry" },
  { host: "data.cms.gov", family: "scholarly_registry" },
  { host: "adviserinfo.sec.gov", family: "scholarly_registry" },
  { host: "brokercheck.finra.org", family: "scholarly_registry" },
  { host: "opencorporates.com", suffix: true, family: "scholarly_registry" },

  // ── directories whose pages carry third-party opinion ──
  { host: "psychologytoday.com", suffix: true, family: "review_site" },
  { host: "superlawyers.com", suffix: true, family: "review_site" },
  { host: "lawyers.findlaw.com", family: "review_site" },
  { host: "martindale.com", suffix: true, family: "review_site" },
  { host: "avvo.com", suffix: true, family: "review_site" },
  { host: "ratemds.com", suffix: true, family: "review_site" },
  { host: "docspot.com", suffix: true, family: "review_site" },
  { host: "castleconnolly.com", suffix: true, family: "review_site" },
  { host: "zocdoc.com", suffix: true, family: "review_site" },
  { host: "doctor.webmd.com", family: "review_site" },
  { host: "vitals.com", suffix: true, family: "review_site" },
  { host: "healthgrades.com", suffix: true, family: "review_site" },

  // ── third-party contact-data vendors ──
  { host: "zoominfo.com", suffix: true, family: "contact_aggregator" },
  { host: "rocketreach.co", suffix: true, family: "contact_aggregator" },
  { host: "signalhire.com", suffix: true, family: "contact_aggregator" },
  { host: "lusha.com", suffix: true, family: "contact_aggregator" },
  { host: "leadiq.com", suffix: true, family: "contact_aggregator" },
  { host: "apollo.io", suffix: true, family: "contact_aggregator" },
  { host: "pitchbook.com", suffix: true, family: "contact_aggregator" },

  // ── part work, part life: public writing and speaking ──
  { host: "x.com", suffix: true, family: "mixed_broadcast" },
  { host: "twitter.com", suffix: true, family: "mixed_broadcast" },
  { host: "bsky.app", suffix: true, family: "mixed_broadcast" },
  { host: "mastodon.social", family: "mixed_broadcast" },
  { host: "youtube.com", suffix: true, family: "mixed_broadcast" },
  { host: "medium.com", suffix: true, family: "mixed_broadcast" },
  { host: "substack.com", suffix: true, family: "mixed_broadcast" },

  // ── where people talk to friends and family ──
  { host: "facebook.com", suffix: true, family: "personal_life" },
  { host: "instagram.com", suffix: true, family: "personal_life" },
  { host: "threads.com", suffix: true, family: "personal_life" },
  { host: "threads.net", suffix: true, family: "personal_life" },
  { host: "tiktok.com", suffix: true, family: "personal_life" },
  { host: "reddit.com", suffix: true, family: "personal_life" },
  { host: "quora.com", suffix: true, family: "personal_life" },
  { host: "t.me", suffix: true, family: "personal_life" },

  // ── profiles people publish for work ──
  { host: "linkedin.com", suffix: true, family: "professional" },
  { host: "xing.com", suffix: true, family: "professional" },
  { host: "github.com", suffix: true, family: "professional" },
  { host: "gitlab.com", suffix: true, family: "professional" },
  { host: "bitbucket.org", suffix: true, family: "professional" },
  { host: "stackoverflow.com", family: "professional" },
  { host: "stackexchange.com", suffix: true, family: "professional" },
  { host: "kaggle.com", suffix: true, family: "professional" },
  { host: "huggingface.co", suffix: true, family: "professional" },
  { host: "pypi.org", family: "professional" },
  { host: "npmjs.com", suffix: true, family: "professional" },
  { host: "dev.to", suffix: true, family: "professional" },
  { host: "hashnode.com", suffix: true, family: "professional" },
  { host: "devpost.com", suffix: true, family: "professional" },
  { host: "codepen.io", suffix: true, family: "professional" },
  { host: "figma.com", suffix: true, family: "professional" },
  { host: "artstation.com", suffix: true, family: "professional" },
  { host: "dribbble.com", suffix: true, family: "professional" },
  { host: "behance.net", suffix: true, family: "professional" },
  { host: "toptal.com", suffix: true, family: "professional" },
  { host: "upwork.com", suffix: true, family: "professional" },
  { host: "contra.com", suffix: true, family: "professional" },
  { host: "producthunt.com", suffix: true, family: "professional" },
  { host: "theorg.com", suffix: true, family: "professional" },
  { host: "crunchbase.com", suffix: true, family: "professional" },
  { host: "angel.co", suffix: true, family: "professional" },
  { host: "wellfound.com", suffix: true, family: "professional" },
  { host: "polywork.com", suffix: true, family: "professional" },
  { host: "read.cv", suffix: true, family: "professional" },
  { host: "about.me", suffix: true, family: "professional" },
  { host: "visualcv.com", suffix: true, family: "professional" },
  { host: "doximity.com", suffix: true, family: "professional" },
  { host: "muckrack.com", suffix: true, family: "professional" },
  { host: "sessionize.com", suffix: true, family: "professional" },
  { host: "meetup.com", suffix: true, family: "professional" },
  {
    host: "bloomberg.com",
    suffix: true,
    paths: ["/profile"],
    family: "professional",
  },
];

function hostMatches(hostname: string, rule: Rule): boolean {
  if (rule.suffix) {
    return hostname === rule.host || hostname.endsWith(`.${rule.host}`);
  }
  return hostname === rule.host;
}

/**
 * Which family an address belongs to. An unparseable or non-http URL is
 * `unrecognised`; callers validate the URL shape separately.
 */
export function classifySurface(url: string): SurfaceFamily {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return "unrecognised";
  }
  if (!/^https?:$/.test(parsed.protocol)) return "unrecognised";
  const hostname = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  for (const rule of RULES) {
    if (!hostMatches(hostname, rule)) continue;
    if (
      rule.paths &&
      !rule.paths.some((p) => path === p || path.startsWith(`${p}/`))
    )
      continue;
    return rule.family;
  }
  return "unrecognised";
}

export type SurfaceOptIns = Partial<
  Record<SurfaceFamily, { reason: string; at: string }>
> | null;

/** May this search save an address on this family right now? */
export function familyEnabled(
  family: SurfaceFamily,
  optIns: SurfaceOptIns,
): boolean {
  if (family === "not_a_person") return false;
  if (DEFAULT_ON_FAMILIES.includes(family)) return true;
  return Boolean(optIns?.[family]);
}

/**
 * Filter before the identity matcher. Wave D's port stays verbatim; what
 * changes is which URLs are allowed to reach it.
 */
export function matchableProfileUrls(urls: string[]): string[] {
  return urls.filter((url) =>
    MATCHABLE_FAMILIES.includes(classifySurface(url)),
  );
}

/** Filter before any model context. Bare URLs, two families, nothing else. */
export function modelVisibleUrls(urls: string[]): string[] {
  return urls.filter((url) =>
    MODEL_VISIBLE_FAMILIES.includes(classifySurface(url)),
  );
}

// ── Copy. Written around BLOCKED_FIELD_PATTERNS; a test asserts every
// constant here passes scanTextForProtectedTraits and never uses that word
// in its bare form (see profile-links.ts). ─────────────────────────────────────────────────────────────

export const PERSONAL_LIFE_WARNING = `Personal-life surface — off for this search. Pages like this are where people talk to friends and family, not to employers. UK, French, Italian and Dutch regulators say a recruiter should not look here even when the page is public: it is intrusive, it rarely says anything about the job, and it can show things a fair hiring process must never weigh. If a specific role needs it, turn this family on for this search only, write down the reason, and apply it to every candidate in the search. ${PRODUCT_NAME} will then keep the address you paste and nothing else — never the page, never a note about what was on it, never a suggestion drawn from it.`;

export const MIXED_BROADCAST_WARNING = `Broadcast surface — off for this search. Many people use X, Bluesky, Mastodon, YouTube, Medium and Substack for work, and their timelines are also personal. Turn this family on for this search only, with a reason, when public writing or speaking is part of the job. Links only; ${PRODUCT_NAME} never reads a timeline.`;

export const DOCUMENT_WARNING = `Document link — off for this search. A shared file may be a CV or anything at all, and nobody expects a recruiter to open it. Turn this family on for this search with a reason. ${PRODUCT_NAME} never opens the file.`;

export const CONTACT_AGGREGATOR_WARNING = `Contact-data vendor pages — off for this search. Their contents are third-party contact data of unknown provenance. ${PRODUCT_NAME} stores the address only, extracts nothing, and never uses it to identify anyone. Emails and phones you copy from such a page can be added as unverified evidence on the candidate.`;

export const FAMILY_WARNINGS: Partial<Record<SurfaceFamily, string>> = {
  personal_life: PERSONAL_LIFE_WARNING,
  mixed_broadcast: MIXED_BROADCAST_WARNING,
  document: DOCUMENT_WARNING,
  contact_aggregator: CONTACT_AGGREGATOR_WARNING,
};

export const NOT_A_PERSON_MESSAGE = `This is a company page, not a person. Save it as a research source instead.`;

/** Row notes shown beside an address once its family is on. */
export const FAMILY_NOTES: Partial<Record<SurfaceFamily, string>> = {
  contact_aggregator: `Contact-data vendor page · nothing extracted. Contact details there are the vendor's claims, not evidence here. This link never counts toward identity. Public profile URLs are not contact data; emails and phones are, and ${PRODUCT_NAME} does not enrich them.`,
  review_site: `Reviews are third-party opinion; nothing on the page can become evidence (D-023).`,
  unrecognised: `Not in the corpus; address only. Never matched, never shown to a model.`,
  document: `A shared file. ${PRODUCT_NAME} never opens it.`,
  personal_life: `Link only. Never matched, never shown to a model.`,
  mixed_broadcast: `Link only. ${PRODUCT_NAME} never reads a timeline.`,
};

/** Suffix appended to a badge when the family is not professional/scholarly. */
export const FAMILY_BADGE_SUFFIX: Partial<Record<SurfaceFamily, string>> = {
  review_site: "review site · reviews are opinion, not evidence",
  contact_aggregator: "third-party contact aggregator · nothing extracted",
  mixed_broadcast: "broadcast surface · link only",
  personal_life: "personal-life surface · link only · never matched",
  document: "document · link only · never matched",
  unrecognised: "unrecognised surface · link only · never matched",
};

export const OPT_IN_REASON_MIN = 20;
export const OPT_IN_REASON_MAX = 400;
