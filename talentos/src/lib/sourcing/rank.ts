/**
 * Evidence ranking: score a person against a brief, and say why.
 *
 * Three rules govern everything here, all three learned the hard way in Hu:
 *
 *  1. Adjacency SUPPORTS a match, it never SUBSTITUTES for it. Someone with no
 *     direct evidence is capped well below anyone who has it, however many
 *     neighbouring capabilities they touch.
 *  2. Hiring for X is never evidence of doing X. Derived claims count as
 *     support, never as the thing itself.
 *  3. A wrong location costs; an unknown one does not. Someone whose base was
 *     never published still deserves to be seen.
 *
 * Ported from Hu (`app/rank/ranker.py`).
 */
import {
  jaccard,
  normalizeCapability,
  normalizeLocation,
  normalizeOrganization,
  normalizeText,
  tokenSet,
  urlDomain,
} from "@/lib/sourcing/normalize";
import {
  CAPABILITIES,
  isDirect,
  seniorityRank,
  type Expansion,
} from "@/lib/sourcing/ontology";
import {
  expandedSkills,
  negativeTerms,
  positiveTerms,
  windowContains,
  type SourcingBrief,
} from "@/lib/sourcing/query-language";
import { industryTerms } from "@/lib/sourcing/angles";
import type {
  Claim,
  EvidenceLink,
  SourcedPerson,
} from "@/lib/sourcing/evidence";

/**
 * What each dimension is worth. Capability and employment dominate because
 * they are what a hiring decision actually turns on.
 */
export const WEIGHTS: Readonly<Record<string, number>> = {
  capability: 0.34,
  employment: 0.22,
  seniority: 0.1,
  location: 0.1,
  keyword: 0.1,
  industry: 0.12,
  recency: 0.08,
  corroboration: 0.06,
};

/** An adjacent-only match tops out here: "works next to X" never outranks "does X". */
export const ADJACENT_ONLY_CEILING = 0.6;
/** What adjacency adds on top of real direct evidence. */
export const ADJACENT_BONUS = 0.35;

export interface RankedPerson {
  personId: string;
  name: string;
  title: string | null;
  organization: string | null;
  location: string | null;
  summary: string | null;
  /** 0..1. */
  score: number;
  components: Record<string, number>;
  /** Why this person is here, in the ontology's own words. */
  reasons: string[];
  /** What the brief asked for and the evidence does not answer. */
  gaps: string[];
  evidence: EvidenceLink[];
  contacts: {
    type: string;
    value: string;
    sourceUrl: string;
    confidence: number;
  }[];
  artifacts: {
    type: string;
    title: string;
    url: string;
    date: string | null;
  }[];
  /** Distinct domains the evidence came from. */
  sources: string[];
  lastSeen: string | null;
}

export interface RankResult {
  brief: SourcingBrief;
  people: RankedPerson[];
  poolSize: number;
  /** Why people were removed before scoring, by reason. */
  filteredOut: Record<string, number>;
}

function toLink(claim: Claim): EvidenceLink {
  return {
    anchor: claim.id,
    kind: claim.kind,
    claim: claim.claim,
    sourceUrl: claim.sourceUrl,
    sourceTitle: claim.sourceTitle ?? "",
    domain: urlDomain(claim.sourceUrl),
    quote: claim.quote ?? null,
    date: claim.date ?? null,
    confidence: claim.confidence,
    derived: claim.derived === true,
    satisfies: [],
    artifactType: claim.artifactType ?? null,
  };
}

/**
 * How much a claim's age should discount it.
 *
 * Three separate answers, and conflating them is the bug this exists to avoid:
 * fresh evidence counts fully; STALE evidence counts less but never nothing,
 * because an old CV is still evidence the person did the thing; and UNDATED
 * evidence is unknown, not zero — most team pages carry no date at all, and
 * scoring them as ancient would rank the whole open web below a dated CV.
 */
export const STALE_AFTER_DAYS = 540;
export const OLDEST_CREDIT = 0.45;
export const UNDATED_CREDIT = 0.85;

export function freshness(
  date: string | null | undefined,
  now: string,
): number {
  if (!date) return UNDATED_CREDIT;
  const days = (Date.parse(now) - Date.parse(date)) / 86_400_000;
  if (!Number.isFinite(days)) return UNDATED_CREDIT;
  if (days <= STALE_AFTER_DAYS) return 1;
  // Linear from full credit at 18 months to the floor at 6 years, then flat.
  const over = (days - STALE_AFTER_DAYS) / (2190 - STALE_AFTER_DAYS);
  return Math.max(OLDEST_CREDIT, 1 - over * (1 - OLDEST_CREDIT));
}

/**
 * Match a stated capability to a wanted one when the exact key does not.
 *
 * Word-bounded in both directions and length-guarded, because the first version
 * tested plain substring containment and a claim that normalised to a single
 * character then matched every alias containing that letter: a candidate whose
 * stated skill was "C++" was credited with Employment Law, because "civil
 * litigation" contains a "c".
 *
 * Longest alias wins, the same discipline the alias index uses, so which
 * capability gets the credit is not an accident of iteration order.
 */
function fuzzyCapabilityKey(
  norm: string,
  aliasToKey: Map<string, string>,
): string | null {
  if (norm.length < 4 && !norm.includes(" ")) return null;
  const padded = ` ${norm} `;
  let best: string | null = null;
  let bestLength = 0;
  for (const [alias, candidateKey] of aliasToKey) {
    if (!alias || alias.length < 4) continue;
    const paddedAlias = ` ${alias} `;
    if (!padded.includes(paddedAlias) && !paddedAlias.includes(padded))
      continue;
    if (alias.length > bestLength) {
      best = candidateKey;
      bestLength = alias.length;
    }
  }
  return best;
}

function capabilityScore(
  brief: SourcingBrief,
  rows: Claim[],
  byId: Map<string, EvidenceLink>,
  now: string,
): { score: number; reasons: string[]; gaps: string[] } {
  const expansions = expandedSkills(brief);
  if (expansions.length === 0 && brief.skillTerms.length === 0) {
    return { score: 0, reasons: [], gaps: [] };
  }

  const wanted = new Map<string, Expansion>(expansions.map((e) => [e.key, e]));

  // A qualifier names the domain worked ON. It earns credit and never creates
  // a gap, so a recruiter is not marked down for not being a roboticist.
  const qualifiers = new Set(brief.qualifierSkills);
  for (const key of qualifiers) {
    if (!wanted.has(key)) {
      wanted.set(key, {
        key,
        label: CAPABILITIES[key]?.label ?? key,
        weight: 0.5,
        reason: "the domain this work is done in, not a capability required",
        origin: key,
      });
    }
  }

  // Evidence stores the ontology KEY ("technical_recruiting"); the ontology
  // lists ALIASES ("technical recruiting"). Mapping only the aliases matched
  // single-word capabilities by luck — key equals alias — and silently missed
  // every multi-word one, so Talent would report "no public evidence of
  // Machine Learning" beside the evidence for it.
  const aliasToKey = new Map<string, string>();
  for (const key of wanted.keys()) {
    aliasToKey.set(key, key);
    for (const alias of CAPABILITIES[key]?.aliases ?? [])
      aliasToKey.set(alias, key);
  }
  for (const term of brief.skillTerms) {
    const norm = normalizeCapability(term);
    if (!aliasToKey.has(norm)) aliasToKey.set(norm, term);
  }

  let directWeight = 0;
  let adjacentWeight = 0;
  const matchedKeys = new Set<string>();
  const reasons: string[] = [];

  for (const row of rows) {
    const norm = row.normalized || "";
    let key = aliasToKey.get(norm) ?? null;
    if (key === null) key = fuzzyCapabilityKey(norm, aliasToKey);
    if (key === null) continue;

    const expansion = wanted.get(key);
    let weight = expansion ? expansion.weight : 1;
    // Derived evidence is real evidence, but it is worth less.
    weight *= row.derived === true ? 0.6 : 1;
    // A capability in a keyword list counts for less than one with its own sentence.
    weight *= Math.min(1, (row.confidence || 0.5) / 0.6);
    // Stale evidence still counts, and undated evidence is unknown, not old.
    weight *= freshness(row.date, now);

    if (!matchedKeys.has(key)) {
      matchedKeys.add(key);
      const label = expansion ? expansion.label : key;
      if (qualifiers.has(key)) {
        adjacentWeight += weight;
        reasons.push(
          `${label} — the domain worked in, which the brief asked about`,
        );
      } else if (expansion !== undefined && !isDirect(expansion)) {
        adjacentWeight += weight;
        reasons.push(`${label} — adjacent capability: ${expansion.reason}`);
      } else if (row.derived === true) {
        adjacentWeight += weight;
        reasons.push(`${label} — indirect mention, not evidence of doing it`);
      } else {
        directWeight += weight;
        reasons.push(`evidenced capability: ${label}`);
      }
    }

    byId.get(row.id)?.satisfies.push(`skill:${key}`);
  }

  const directKeys = new Set(
    expansions
      .filter(isDirect)
      .map((e) => e.key)
      .filter((k) => !qualifiers.has(k)),
  );
  if (directKeys.size === 0)
    for (const v of aliasToKey.values()) directKeys.add(v);
  const denominator = directKeys.size || 1;

  const direct = Math.min(1, directWeight / denominator);
  const adjacent = Math.min(1, adjacentWeight / denominator);
  const score =
    directWeight <= 0
      ? Math.min(ADJACENT_ONLY_CEILING, adjacent * ADJACENT_ONLY_CEILING)
      : Math.min(1, direct + ADJACENT_BONUS * adjacent);

  const gaps: string[] = [];
  for (const key of directKeys) {
    if (!matchedKeys.has(key)) {
      gaps.push(`no public evidence of ${wanted.get(key)?.label ?? key}`);
    }
  }
  return { score, reasons, gaps };
}

function employmentScore(
  brief: SourcingBrief,
  rows: Claim[],
  byId: Map<string, EvidenceLink>,
): { score: number; reasons: string[]; gaps: string[] } {
  const reasons: string[] = [];
  const gaps: string[] = [];
  const wantedOrgs = new Set(
    brief.orgs.map(normalizeOrganization).filter(Boolean),
  );
  const wantedTitles = brief.titles.map(normalizeText).filter(Boolean);
  if (wantedOrgs.size === 0 && wantedTitles.length === 0) {
    return { score: 0, reasons, gaps };
  }

  let orgBest = 0;
  let titleBest = 0;
  for (const row of rows) {
    const org = normalizeOrganization(row.organization ?? "");
    const title = normalizeText(row.title ?? "");
    const link = byId.get(row.id);

    if (wantedOrgs.size > 0 && org) {
      if (wantedOrgs.has(org)) {
        orgBest = 1;
        reasons.push(`worked at ${row.organization}`);
        link?.satisfies.push(`org:${org}`);
      } else {
        const overlap = Math.max(
          ...[...wantedOrgs].map((w) => jaccard(tokenSet(org), tokenSet(w))),
        );
        if (overlap >= 0.5 && overlap > orgBest) {
          orgBest = overlap;
          reasons.push(`worked at ${row.organization} (related to the brief)`);
          link?.satisfies.push(`org:${org}`);
        }
      }
    }

    if (wantedTitles.length > 0 && title) {
      for (const wanted of wantedTitles) {
        if (title.includes(wanted) || wanted.includes(title)) {
          titleBest = 1;
          reasons.push(`held the title ${row.title}`);
          link?.satisfies.push(`title:${wanted}`);
        } else {
          const overlap = jaccard(tokenSet(title), tokenSet(wanted));
          if (overlap > titleBest) titleBest = overlap;
        }
      }
    }
  }

  if (wantedOrgs.size > 0 && orgBest === 0) {
    gaps.push(`no evidence of working at ${brief.orgs.join(" or ")}`);
  }
  if (wantedTitles.length > 0 && titleBest === 0) {
    gaps.push(`no evidence of the title ${brief.titles.join(" or ")}`);
  }

  const parts = [
    wantedOrgs.size > 0 ? orgBest : null,
    wantedTitles.length > 0 ? titleBest : null,
  ].filter((v): v is number => v !== null);
  const score =
    parts.length > 0 ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
  return { score, reasons, gaps };
}

function locationScore(
  brief: SourcingBrief,
  rows: Claim[],
  byId: Map<string, EvidenceLink>,
): { score: number; reasons: string[]; gaps: string[]; contradicted: boolean } {
  if (brief.locations.length === 0) {
    return { score: 0, reasons: [], gaps: [], contradicted: false };
  }
  const wanted = new Set(brief.locations.map(normalizeLocation));
  let best = 0;
  const reasons: string[] = [];
  const stated: string[] = [];

  for (const row of rows) {
    const norm = row.normalized || "";
    const raw = normalizeText(row.claim);
    stated.push(row.claim);
    const link = byId.get(row.id);
    const hit = (score: number) => {
      best = Math.max(best, score);
      if (link && !link.satisfies.includes(`loc:${norm}`))
        link.satisfies.push(`loc:${norm}`);
    };

    if (wanted.has(norm)) {
      hit(1);
      reasons.push(`located in ${row.claim}`);
    } else if (
      [...wanted].some((w) => w && (raw.includes(w) || norm.includes(w)))
    ) {
      // "London, United Kingdom" answers loc:"united kingdom". Places nest,
      // and a city is not a different answer from its country.
      hit(0.95);
      reasons.push(`located in ${row.claim}`);
    } else if (
      [...wanted].some((w) => jaccard(tokenSet(norm), tokenSet(w)) >= 0.5)
    ) {
      hit(0.7);
    }
  }

  if (best > 0) return { score: best, reasons, gaps: [], contradicted: false };
  if (stated.length > 0) {
    return {
      score: 0,
      reasons: [],
      gaps: [`publicly based in ${stated[0]}, not ${brief.locations[0]}`],
      contradicted: true,
    };
  }
  return {
    score: 0,
    reasons: [],
    gaps: [`location not evidenced (${brief.locations.join(", ")})`],
    contradicted: false,
  };
}

function seniorityScore(
  brief: SourcingBrief,
  person: SourcedPerson,
  employment: Claim[],
): { score: number; reasons: string[]; gaps: string[] } {
  if (brief.seniority.length === 0) return { score: 0, reasons: [], gaps: [] };
  const wanted = Math.max(...brief.seniority.map((s) => seniorityRank(s)), 0);
  if (wanted === 0) return { score: 0, reasons: [], gaps: [] };

  const held = Math.max(
    seniorityRank(person.title),
    ...employment.map((e) => seniorityRank(e.title)),
    0,
  );
  if (held === 0) {
    return {
      score: 0,
      reasons: [],
      gaps: [`seniority not evidenced (${brief.seniority.join(", ")})`],
    };
  }
  if (held >= wanted) {
    return {
      score: 1,
      reasons: [`operates at or above ${brief.seniority[0]} level`],
      gaps: [],
    };
  }
  // One rung below is a stretch hire, not a miss.
  const score = Math.max(0, 1 - (wanted - held) * 0.35);
  return {
    score,
    reasons: [],
    gaps: score < 0.5 ? [`more junior than ${brief.seniority[0]}`] : [],
  };
}

function keywordScore(
  brief: SourcingBrief,
  blob: string,
): { score: number; reasons: string[] } {
  const terms = positiveTerms(brief);
  if (terms.length === 0) return { score: 0, reasons: [] };
  const haystack = normalizeText(blob);
  const reasons: string[] = [];
  let hits = 0;
  for (const term of terms) {
    if (haystack.includes(normalizeText(term.text))) {
      hits += 1;
      reasons.push(`mentions ${term.text}`);
    }
  }
  return { score: hits / terms.length, reasons: reasons.slice(0, 4) };
}

function industryScore(
  brief: SourcingBrief,
  blob: string,
): { score: number; reasons: string[]; gaps: string[] } {
  if (brief.industries.length === 0) return { score: 0, reasons: [], gaps: [] };
  const hints = industryTerms(brief);
  if (hints.length === 0) return { score: 0, reasons: [], gaps: [] };
  const haystack = normalizeText(blob);
  const found = hints.filter((h) => haystack.includes(normalizeText(h)));
  if (found.length === 0) {
    return {
      score: 0,
      reasons: [],
      gaps: [`no ${brief.industries[0]} vocabulary in the evidence`],
    };
  }
  return {
    score: Math.min(1, found.length / 3),
    reasons: [
      `${brief.industries[0]} vocabulary: ${found.slice(0, 3).join(", ")}`,
    ],
    gaps: [],
  };
}

function recencyScore(
  links: EvidenceLink[],
  now: string,
): { score: number; lastSeen: string | null } {
  const dates = links
    .map((l) => l.date)
    .filter((d): d is string => Boolean(d))
    .sort();
  if (dates.length === 0) return { score: 0.5, lastSeen: null };
  const lastSeen = dates[dates.length - 1];
  const days = (Date.parse(now) - Date.parse(lastSeen)) / 86_400_000;
  if (!Number.isFinite(days)) return { score: 0.5, lastSeen };
  // Undated evidence scores neutral; five-year-old evidence scores near zero.
  const score = Math.max(0, Math.min(1, 1 - days / 1825));
  return { score, lastSeen };
}

function passesHas(
  brief: SourcingBrief,
  person: SourcedPerson,
): { ok: boolean; reason: string } {
  for (const flag of brief.has) {
    const met = (() => {
      switch (flag) {
        case "email":
          return person.claims.some(
            (c) => c.kind === "contact" && c.contactType === "email",
          );
        case "phone":
          return person.claims.some(
            (c) => c.kind === "contact" && c.contactType === "phone",
          );
        case "contact":
          return person.claims.some((c) => c.kind === "contact");
        case "personal_domain":
          return person.claims.some(
            (c) => c.kind === "identity" && c.normalized.includes("."),
          );
        default:
          return (
            person.claims.some(
              (c) => c.kind === "artifact" && c.artifactType === flag,
            ) ||
            person.claims.some(
              (c) =>
                c.kind === "identity" && c.normalized.startsWith(`${flag}:`),
            )
          );
      }
    })();
    if (!met) return { ok: false, reason: `has:${flag}` };
  }
  return { ok: true, reason: "" };
}

export interface RankOptions {
  /** Injected so the ranker stays pure and testable. */
  now?: string;
  limit?: number;
  /** Free-text relevance from an upstream index, 0..12ish. */
  baseRelevance?: Map<string, number>;
  /**
   * Drop people whose evidence answers none of the brief's capabilities.
   * On by default, because a results list should not be padded with everyone
   * on file. Off when a person was opened deliberately: the floor is a
   * search-results concern, and a dossier the recruiter asked for should show
   * what is held rather than an empty page.
   */
  relevanceFloor?: boolean;
}

export function rankPerson(
  person: SourcedPerson,
  brief: SourcingBrief,
  options: RankOptions = {},
): RankedPerson | null {
  const now = options.now ?? new Date().toISOString().slice(0, 10);

  const gate = passesHas(brief, person);
  if (!gate.ok) return null;

  if (brief.artifactTypes.length > 0) {
    const held = new Set(
      person.claims
        .filter((c) => c.kind === "artifact")
        .map((c) => c.artifactType ?? ""),
    );
    if (!brief.artifactTypes.some((t) => held.has(t))) return null;
  }

  if (brief.window.after !== null || brief.window.before !== null) {
    const dated = person.claims.filter((c) => c.date);
    if (
      dated.length > 0 &&
      !dated.some((c) => windowContains(brief.window, c.date))
    )
      return null;
  }

  const links = person.claims.map(toLink);
  const byId = new Map(person.claims.map((c, i) => [c.id, links[i]]));

  if (brief.includeSites.length > 0) {
    const domains = links.map((l) => l.domain);
    if (!brief.includeSites.some((s) => domains.some((d) => d.endsWith(s))))
      return null;
  }
  if (brief.excludeSites.length > 0) {
    const domains = links.map((l) => l.domain);
    if (brief.excludeSites.some((s) => domains.some((d) => d.endsWith(s))))
      return null;
  }

  const byKind = (kind: Claim["kind"]) =>
    person.claims.filter((c) => c.kind === kind);

  const cap = capabilityScore(brief, byKind("capability"), byId, now);
  // A brief that names capabilities is asking about those capabilities.
  // Somebody whose evidence touches none of them, directly or adjacently, is
  // not a weak result — they are not a result. Returning them pads the list
  // with everyone on file and buries the people who do answer.
  if (
    options.relevanceFloor !== false &&
    (brief.skills.length > 0 || brief.skillTerms.length > 0) &&
    cap.score <= 0
  ) {
    return null;
  }
  const emp = employmentScore(brief, byKind("employment"), byId);
  const loc = locationScore(brief, byKind("location"), byId);
  const sen = seniorityScore(brief, person, byKind("employment"));

  const blob = [
    person.name,
    person.title ?? "",
    person.organization ?? "",
    person.summary ?? "",
    links.map((l) => l.claim).join(" "),
    links.map((l) => l.quote ?? "").join(" "),
  ].join(" ");

  const kw = keywordScore(brief, blob);
  const ind = industryScore(brief, blob);
  const rec = recencyScore(links, now);

  // A negated term that appears anywhere is a hard exclusion.
  const haystack = normalizeText(blob);
  for (const term of negativeTerms(brief)) {
    if (haystack.includes(normalizeText(term.text))) return null;
  }

  const domains = new Set(links.map((l) => l.domain).filter(Boolean));
  const corroboration =
    domains.size > 0 ? Math.min(1, (domains.size - 1) / 3) : 0;

  const components: Record<string, number> = {
    capability: cap.score,
    employment: emp.score,
    seniority: sen.score,
    location: loc.score,
    keyword: kw.score,
    industry: ind.score,
    recency: rec.score,
    corroboration,
  };

  // Only score dimensions the brief actually asked about, then renormalise, so
  // a brief with no location filter is not penalised for having no location.
  const active: Record<string, boolean> = {
    capability: brief.skills.length > 0 || brief.skillTerms.length > 0,
    employment: brief.orgs.length > 0 || brief.titles.length > 0,
    seniority: brief.seniority.length > 0,
    location: brief.locations.length > 0,
    keyword: positiveTerms(brief).length > 0,
    industry: brief.industries.length > 0,
    recency: true,
    corroboration: true,
  };

  const totalWeight =
    Object.entries(active).reduce(
      (sum, [k, on]) => (on ? sum + WEIGHTS[k] : sum),
      0,
    ) || 1;
  let score =
    Object.entries(active).reduce(
      (sum, [k, on]) => (on ? sum + WEIGHTS[k] * components[k] : sum),
      0,
    ) / totalWeight;

  const base = options.baseRelevance?.get(person.id) ?? 0;
  score = 0.85 * score + 0.15 * Math.min(1, base / 12);

  if (loc.contradicted) {
    // Still shown — relocation and stale pages are both common — but never
    // ranked as though the brief's location requirement had been met.
    score *= 0.55;
  }

  const reasons = [
    ...cap.reasons,
    ...emp.reasons,
    ...loc.reasons,
    ...sen.reasons,
    ...kw.reasons,
    ...ind.reasons,
  ];
  const gaps = [
    ...cap.gaps,
    ...emp.gaps,
    ...loc.gaps,
    ...sen.gaps,
    ...ind.gaps,
  ];
  if (domains.size === 1) {
    gaps.push(
      "everything here comes from one domain — corroborate before outreach",
    );
  }

  return {
    personId: person.id,
    name: person.name,
    title: person.title ?? null,
    organization: person.organization ?? null,
    location: person.location ?? null,
    summary: person.summary ?? null,
    score,
    components,
    reasons: [...new Set(reasons)].slice(0, 10),
    gaps: [...new Set(gaps)].slice(0, 6),
    evidence: links,
    contacts: byKind("contact").map((c) => ({
      type: c.contactType ?? "other",
      value: c.claim,
      sourceUrl: c.sourceUrl,
      confidence: c.confidence,
    })),
    artifacts: byKind("artifact").map((c) => ({
      type: c.artifactType ?? "other",
      title: c.claim,
      url: c.sourceUrl,
      date: c.date ?? null,
    })),
    sources: [...domains].sort(),
    lastSeen: rec.lastSeen,
  };
}

export function rankPeople(
  people: SourcedPerson[],
  brief: SourcingBrief,
  options: RankOptions = {},
): RankResult {
  const filteredOut: Record<string, number> = {};
  const ranked: RankedPerson[] = [];
  for (const person of people) {
    const result = rankPerson(person, brief, options);
    if (result === null) {
      filteredOut.excluded = (filteredOut.excluded ?? 0) + 1;
      continue;
    }
    ranked.push(result);
  }
  // Ties are common and alphabetical order is meaningless, so break them on
  // what a recruiter would actually use to choose: how many independent domains
  // say it, then how much is known at all.
  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      b.sources.length - a.sources.length ||
      b.evidence.length - a.evidence.length ||
      a.name.localeCompare(b.name),
  );
  return {
    brief,
    people: options.limit ? ranked.slice(0, options.limit) : ranked,
    poolSize: people.length,
    filteredOut,
  };
}
