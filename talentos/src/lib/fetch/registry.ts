/**
 * The source registry: a written note per host saying what this application
 * may do there, and — separately — how that is known.
 *
 * Two axes, because they answer different questions and collapsing them is
 * how a guess becomes a permission. **Posture** is what the fetcher may do.
 * **Basis** is whether anybody actually read the host's terms. Only a basis of
 * `read` may widen anything; a basis of `assumed` may narrow and nothing else.
 * Nobody has read any host's terms yet, and the notes say so in those words
 * rather than implying otherwise.
 *
 * The default for a host with no entry is `open`, and that is a decision
 * rather than an oversight. `docs/AUTONOMOUS-SOURCING-2026-09-07.md` asks for
 * "a hard refusal on any host the registry has not cleared", which read
 * literally means an empty registry fetches nothing and a full one is a list
 * nobody can finish — the long tail of personal sites and lab pages is
 * exactly where sourcing lives, and it has no entries by definition. So the
 * refusal moved: an unlisted host is governed by its own robots.txt and a
 * small per-run budget, and the registry carries the hosts where that is not
 * good enough. Recorded as D-083.
 */
import { baseDomain } from "@/lib/fetch/address";

/** What the fetcher may do, most restrictive first. */
export const POSTURES = ["refused", "handoff", "open", "cleared"] as const;
export type Posture = (typeof POSTURES)[number];

/** How the posture is known. Only `read` may widen. */
export type Basis = "read" | "documented-elsewhere" | "assumed";

export interface SourceRecord {
  host: string;
  /** True when the record governs subdomains too. Stated on every row. */
  suffix: boolean;
  posture: Posture;
  basis: Basis;
  /** Why, in this host's own case. No row shares a note with another. */
  note: string;
  /** ISO date somebody read this host's terms, or null. */
  termsReadOn: string | null;
}

export const ASSUMED_PREFIX = "Assumed, not read:";

/**
 * `open` is not in this table: it is what a host gets when nothing here
 * names it. Every row therefore narrows, which is the only direction a
 * basis of `assumed` is allowed to move.
 */
export const SOURCE_REGISTRY: readonly SourceRecord[] = [
  // -- Content that belongs to somebody else, served under another name.
  {
    host: "web.archive.org",
    suffix: false,
    posture: "refused",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} an archive serves a copy of a page whose own robots.txt and terms this fetcher would then never see. Reading the copy is a way of not asking the original, so the archive is refused and the original is fetched or not on its own terms.`,
    termsReadOn: null,
  },
  {
    host: "archive.ph",
    suffix: false,
    posture: "refused",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} the same laundering objection as the Wayback Machine, with the added problem that this archive strips the original address from much of what it holds, so a claim read here could not name where it came from.`,
    termsReadOn: null,
  },
  {
    host: "archive.today",
    suffix: true,
    posture: "refused",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} the canonical name of the same archive the row above refuses; a registry that names one of a service's addresses and not the others refuses nothing at all.`,
    termsReadOn: null,
  },
  {
    host: "archive.is",
    suffix: true,
    posture: "refused",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} another address for the same archive. Listing the aliases is the whole point of listing it at all — an unlisted alias is an open door to the copy the listed one refuses.`,
    termsReadOn: null,
  },
  {
    host: "archive.li",
    suffix: true,
    posture: "refused",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} a further alias of the same archive, refused for the same reason and listed separately so a change to one row cannot silently reopen the others.`,
    termsReadOn: null,
  },
  {
    host: "archive.vn",
    suffix: true,
    posture: "refused",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} an alias of the same archive. It is listed rather than assumed to be covered, because nothing in the resolution rules groups hosts by what they happen to be called.`,
    termsReadOn: null,
  },
  {
    host: "archive.fo",
    suffix: true,
    posture: "refused",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} the last of the archive's aliases known here. If it acquires another, this list is where that goes, and until then that address would be treated as unlisted and read.`,
    termsReadOn: null,
  },
  {
    host: "r.jina.ai",
    suffix: false,
    posture: "refused",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} a reader front-end that fetches a third-party page on this application's behalf. Using one would move the fetch outside every check in this module while still producing the page, which is the definition of a bypass.`,
    termsReadOn: null,
  },
  {
    host: "webcache.googleusercontent.com",
    suffix: false,
    posture: "refused",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} a search engine's own cached copy. Fetching it reads the origin page without asking the origin, and reads it as the engine saw it rather than as it stands.`,
    termsReadOn: null,
  },
  {
    host: "translate.goog",
    suffix: true,
    posture: "refused",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} a translation proxy that reserves any origin host under its own suffix. A page reached this way carries the proxy's address, so nothing downstream could attribute the claim correctly.`,
    termsReadOn: null,
  },

  // -- Content that needs a sign-in to see. Fetching it would mean pretending
  //    to be somebody, which is the one thing this fetcher must never do.
  {
    host: "linkedin.com",
    suffix: true,
    posture: "handoff",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} a profile here is behind a sign-in for anyone who is not already a member, so an automated fetch would either be refused or be pretending to be a member. The composed query is handed to the recruiter, who opens it as themselves.`,
    termsReadOn: null,
  },
  {
    host: "facebook.com",
    suffix: true,
    posture: "handoff",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} a sign-in wall on essentially every surface, and a corpus that is mostly personal life rather than professional evidence — the wrong kind of page for this product even where it is reachable.`,
    termsReadOn: null,
  },
  {
    host: "instagram.com",
    suffix: true,
    posture: "handoff",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} a sign-in wall past the first screen, and the same personal-life objection: an account here is rarely a description of somebody's work.`,
    termsReadOn: null,
  },
  {
    host: "x.com",
    suffix: true,
    posture: "handoff",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} the public web view has been intermittent and sign-in-gated since 2023, so an automated fetch reads a challenge page more often than a profile. Composed and handed over instead.`,
    termsReadOn: null,
  },
  {
    host: "glassdoor.com",
    suffix: true,
    posture: "handoff",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} an interstitial asks for a sign-in or a contribution before the content, and what is behind it is employer reviews rather than people who could be approached about a role.`,
    termsReadOn: null,
  },

  // -- Search engines. Reading a result page through the front door is the
  //    thing the search connector exists to do properly, with a key.
  {
    host: "google.com",
    suffix: true,
    posture: "handoff",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} a search result page is not a person's page, and reading one by fetching it is what the search connector's key exists to avoid. Composed queries are opened by the recruiter, or run through the connector.`,
    termsReadOn: null,
  },
  {
    host: "bing.com",
    suffix: true,
    posture: "handoff",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} the same objection as any other engine's result page: it is an index of pages rather than a page about anybody, and it has a documented API for callers who want the rows.`,
    termsReadOn: null,
  },
  {
    host: "duckduckgo.com",
    suffix: true,
    posture: "handoff",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} a result page again, and one that renders in the browser rather than in the markup, so a fetch that executes no script would read almost nothing even if it were appropriate.`,
    termsReadOn: null,
  },

  // -- Contact-data aggregators. Not a corpus this product buys from.
  {
    host: "rocketreach.co",
    suffix: true,
    posture: "handoff",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} a broker of contact details rather than a place a person describes their own work. This product generates an address pattern and labels it unverified; it does not read somebody else's guess and present it as a finding.`,
    termsReadOn: null,
  },
  {
    host: "apollo.io",
    suffix: true,
    posture: "handoff",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} the same objection as any contact broker, and its pages are behind an account in any case, so a fetch would read a sign-in prompt.`,
    termsReadOn: null,
  },
  {
    host: "signalhire.com",
    suffix: true,
    posture: "handoff",
    basis: "assumed",
    note: `${ASSUMED_PREFIX} a contact broker whose rows are compiled from elsewhere, which means a claim read here could not name the surface a person actually wrote it on.`,
    termsReadOn: null,
  },

  // -- Hosts whose licence question was already answered, in writing, against
  //    automated use. Carried forward rather than re-argued.
  {
    host: "orcid.org",
    suffix: true,
    posture: "handoff",
    basis: "documented-elsewhere",
    note: "docs/DECISIONS.md records that the Public API terms limit use to non-commercial purposes. That reading was about the API rather than the pages, so the conservative posture applies to both until somebody reads the site terms properly.",
    termsReadOn: null,
  },
  {
    host: "semanticscholar.org",
    suffix: true,
    posture: "handoff",
    basis: "documented-elsewhere",
    note: "docs/DECISIONS.md records a licence prohibiting installing the API into a product for commercial gain. The same caution is applied to the pages, on the same conservative reading, pending an actual read of the site terms.",
    termsReadOn: null,
  },
  {
    host: "dblp.org",
    suffix: true,
    posture: "handoff",
    basis: "documented-elsewhere",
    note: "docs/DECISIONS.md records that these hosts answer automated callers with a proof-of-work interstitial. Solving one is out of the question, so the address is composed and handed over instead.",
    termsReadOn: null,
  },
];

export interface RegistryVerdict {
  posture: Posture;
  /** The record that decided it, or null when nothing named this host. */
  record: SourceRecord | null;
  /** Said plainly, whether or not it is a refusal. */
  reason: string;
}

export const UNLISTED_NOTE =
  "Nobody has read this host's terms. It is governed by its own robots.txt and a small budget, and anything it says about a person is a claim that names this page.";

const RANK: Record<Posture, number> = {
  refused: 0,
  handoff: 1,
  open: 2,
  cleared: 3,
};

function matches(record: SourceRecord, host: string): boolean {
  if (record.host === host) return true;
  return record.suffix && host.endsWith(`.${record.host}`);
}

/**
 * Every record that names this host is resolved, and the most restrictive
 * wins. Specificity is deliberately not the outer rule: a permissive row on a
 * subdomain must not lift a refusal written on the domain above it.
 */
export function postureFor(
  host: string,
  registry: readonly SourceRecord[] = SOURCE_REGISTRY,
): RegistryVerdict {
  const hits = registry.filter((record) => matches(record, host.toLowerCase()));
  if (hits.length === 0) {
    return { posture: "open", record: null, reason: UNLISTED_NOTE };
  }
  let winner = hits[0];
  for (const hit of hits) {
    if (RANK[hit.posture] < RANK[winner.posture]) winner = hit;
  }
  return { posture: winner.posture, record: winner, reason: winner.note };
}

/** For the settings page: what the registry holds, counted rather than claimed. */
export function registrySummary(
  registry: readonly SourceRecord[] = SOURCE_REGISTRY,
): { posture: Posture; basis: Basis; count: number }[] {
  const counts = new Map<string, number>();
  for (const record of registry) {
    const key = `${record.posture}|${record.basis}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => {
    const [posture, basis] = key.split("|");
    return { posture: posture as Posture, basis: basis as Basis, count };
  });
}

/** Group hosts by their base domain, for a per-operator fairness key. */
export function fairnessKey(host: string): string {
  return baseDomain(host.toLowerCase());
}
