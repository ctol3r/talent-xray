/**
 * Entity resolution: many sightings, one person.
 *
 * The same engineer appears on a team page, a conference programme, a paper
 * and a code host under four spellings. Resolution decides which of those are
 * the same human — and, critically, records WHY, so a recruiter can challenge
 * a merge instead of trusting it.
 *
 * Conservative by design. A wrongly merged profile is worse than two
 * duplicates: it invents a career that nobody had.
 *
 * Ported from Hu (`app/resolve/resolver.py`), including the two defects that
 * port found the hard way — corroboration read off a label prefix let a name
 * corroborate itself, and Jaccard alone made "Edinburgh Robotics Group" and
 * "University of Edinburgh" look unrelated.
 */
import {
  canonicalizeUrl,
  emailDomain,
  jaccard,
  nameInitialsKey,
  nameSimilarity,
  nameTokens,
  normalizeCapability,
  normalizeName,
  normalizeOrganization,
  tokenSet,
  FREE_EMAIL_DOMAINS,
} from "@/lib/sourcing/normalize";

/** Identifiers issued to one human by an authority. Settles identity alone. */
export const AUTHORITATIVE_IDENTITIES = new Set(["orcid", "author_id"]);
/** Strong, but an account can be shared or role-based, so they need company. */
export const STRONG_IDENTITIES = new Set([
  ...AUTHORITATIVE_IDENTITIES,
  "github",
  "professional_email",
]);

/**
 * Words that appear in organisation names everywhere and so distinguish
 * nobody. A token outside this set — "Edinburgh", "Wayline", "Meridian" — is
 * distinctive enough that two organisations sharing it are probably related.
 */
export const GENERIC_ORG_TOKENS = new Set([
  "university",
  "universite",
  "universidad",
  "college",
  "school",
  "institute",
  "institution",
  "academy",
  "department",
  "dept",
  "faculty",
  "centre",
  "center",
  "laboratory",
  "laboratories",
  "lab",
  "labs",
  "group",
  "team",
  "division",
  "unit",
  "office",
  "programme",
  "program",
  "project",
  "company",
  "corporation",
  "corp",
  "inc",
  "incorporated",
  "ltd",
  "limited",
  "llc",
  "llp",
  "plc",
  "gmbh",
  "ag",
  "sa",
  "bv",
  "ab",
  "as",
  "nv",
  "oy",
  "holdings",
  "partners",
  "associates",
  "consulting",
  "consultancy",
  "services",
  "solutions",
  "systems",
  "technologies",
  "technology",
  "tech",
  "global",
  "international",
  "national",
  "research",
  "sciences",
  "science",
  "the",
  "of",
  "and",
  "for",
  "at",
  "in",
  "trust",
  "foundation",
  "society",
  "association",
  "council",
  "board",
  "network",
  "hospital",
  "clinic",
  "health",
  "healthcare",
  "medical",
  "state",
  "public",
  "royal",
]);

/** Above this, merge. Below `REVIEW_THRESHOLD`, treat as a new person. */
export const MERGE_THRESHOLD = 0.72;
/** Between the two, a human decides. */
export const REVIEW_THRESHOLD = 0.55;

export interface IdentityRef {
  type: string;
  value: string;
}

export interface Sighting {
  name: string;
  organizations: string[];
  identities: IdentityRef[];
  capabilities: string[];
  locations: string[];
  /** URLs the sighting's evidence points at. */
  artifactSources: string[];
  /**
   * Other people named alongside this one on the same paper, patent or page.
   * Name-independent identity evidence: two sightings of "S. Chen" writing with
   * the same three collaborators are one S. Chen, whatever the spelling.
   */
  coauthors?: string[];
}

export interface PersonProfile extends Sighting {
  id: string;
}

export interface MatchSignal {
  label: string;
  weight: number;
  /** True only for name-INDEPENDENT evidence. A name can never corroborate itself. */
  corroborates: boolean;
}

export interface MatchScore {
  personId: string;
  score: number;
  signals: MatchSignal[];
}

export type MergeDecision = "merge" | "review" | "new";

function distinctiveTokens(organizations: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const org of organizations) {
    for (const token of normalizeOrganization(org).split(" ")) {
      if (token && token.length > 2 && !GENERIC_ORG_TOKENS.has(token))
        out.add(token);
    }
  }
  return out;
}

function normalizedOrgs(values: string[]): Set<string> {
  const out = new Set<string>();
  for (const v of values) {
    const norm = normalizeOrganization(v);
    if (norm) out.add(norm);
  }
  return out;
}

function identityKeys(refs: IdentityRef[]): Set<string> {
  return new Set(refs.map((i) => `${i.type}|${i.value.toLowerCase().trim()}`));
}

export function scoreMatch(
  profile: PersonProfile,
  sighting: Sighting,
): MatchScore {
  const signals: MatchSignal[] = [];
  const add = (label: string, weight: number, corroborates = false) => {
    signals.push({ label, weight, corroborates });
  };

  // --- identity: the only single signal strong enough to carry a merge
  const incoming = identityKeys(sighting.identities);
  const held = identityKeys(profile.identities);
  const shared = [...incoming].filter((k) => held.has(k)).sort();

  const sharedStrong = shared.filter((k) =>
    STRONG_IDENTITIES.has(k.split("|")[0]),
  );
  for (const key of sharedStrong) {
    const [type, value] = key.split("|");
    // A registry identifier is issued to one human, so it settles identity on
    // its own. An account or mailbox can be shared, so it needs company.
    const weight = AUTHORITATIVE_IDENTITIES.has(type) ? 0.78 : 0.62;
    add(`shared ${type.replace(/_/g, " ")} ${value}`, weight, true);
  }

  // `name_variant` is a spelling of the name, not evidence about the human.
  // Scoring it would double-count the name block below, and treating it as
  // corroboration would let a name corroborate itself.
  const sharedWeak = shared.filter(
    (k) => !sharedStrong.includes(k) && k.split("|")[0] !== "name_variant",
  );
  for (const key of sharedWeak) {
    add(`shared ${key.split("|")[0].replace(/_/g, " ")}`, 0.12, true);
  }

  // --- name
  const profileName = normalizeName(profile.name);
  const incomingName = normalizeName(sighting.name);
  const similarity = nameSimilarity(profileName, incomingName);
  const identicalName = profileName === incomingName && profileName !== "";
  const hasStrongIdentity = sharedStrong.length > 0;

  if (identicalName) {
    add("identical name", 0.4);
  } else if (similarity >= 0.8) {
    add(`near-identical name (${similarity.toFixed(2)})`, 0.2);
  } else if (similarity >= 0.5) {
    add(`partial name overlap (${similarity.toFixed(2)})`, 0.08);
  } else if (hasStrongIdentity) {
    // Registry ids, code accounts and work addresses are assigned to a human,
    // not to a spelling. "A. Okonkwo" and "Amara Okonkwo" under one registry
    // id is the normal case, not a coincidence to be penalised.
    add(
      `names written differently (${similarity.toFixed(2)}), but a unique identifier is shared`,
      0,
    );
  } else {
    add(`names differ (${similarity.toFixed(2)})`, -0.35);
  }

  // A common surname alone must never be enough — unless a unique identifier
  // has already settled the question.
  const incomingTokens = new Set(nameTokens(sighting.name));
  const profileTokens = new Set(nameTokens(profile.name));
  const sharedTokens = [...incomingTokens].filter((t) => profileTokens.has(t));
  if (
    !hasStrongIdentity &&
    similarity < 0.8 &&
    sharedTokens.length === 1 &&
    incomingTokens.size > 1 &&
    profileTokens.size > 1
  ) {
    // Guarded on similarity because the two measures overlap: "S. Chen" and
    // "Sarah Chen" also share exactly one whole token, and charging them for it
    // would take back the credit `nameSimilarity` just gave for recognising an
    // initial. The penalty is for names that genuinely differ apart from a
    // common surname, which is what a low similarity already says.
    add("only one name token in common", -0.1);
  }

  // --- employment
  const incomingOrgs = normalizedOrgs(sighting.organizations);
  const profileOrgs = normalizedOrgs(profile.organizations);
  const sharedOrgs = [...incomingOrgs].filter((o) => profileOrgs.has(o)).sort();
  if (sharedOrgs.length > 0) {
    add(`shared organisation: ${sharedOrgs[0]}`, 0.22, true);
  } else if (incomingOrgs.size > 0 && profileOrgs.size > 0) {
    const overlap = jaccard(
      tokenSet([...incomingOrgs].join(" ")),
      tokenSet([...profileOrgs].join(" ")),
    );
    if (overlap >= 0.34) {
      add(`related organisations (${overlap.toFixed(2)})`, 0.1, true);
    } else {
      // Jaccard punishes organisations of unequal length: "Edinburgh Robotics
      // Group" and "University of Edinburgh" score 0.25 and look unrelated,
      // when the shared token is the whole point. A shared DISTINCTIVE token
      // is the signal; a shared "University" is not.
      const distinctive = [...distinctiveTokens(incomingOrgs)]
        .filter((t) => distinctiveTokens(profileOrgs).has(t))
        .sort();
      if (distinctive.length > 0) {
        add(`organisations share '${distinctive[0]}'`, 0.12, true);
      }
    }
  }

  // --- a shared work mail domain implies the same employer
  const incomingDomains = new Set(
    sighting.identities
      .filter((i) => i.type === "professional_email")
      .map((i) => emailDomain(i.value))
      .filter((d) => d && !FREE_EMAIL_DOMAINS.has(d)),
  );
  const profileDomains = new Set(
    profile.identities
      .filter((i) => i.type === "professional_email")
      .map((i) => emailDomain(i.value))
      .filter((d) => d && !FREE_EMAIL_DOMAINS.has(d)),
  );
  if ([...incomingDomains].some((d) => profileDomains.has(d))) {
    add("shared professional email domain", 0.16, true);
  }

  // --- capability is corroboration, never proof
  const incomingCaps = new Set(
    sighting.capabilities.map(normalizeCapability).filter(Boolean),
  );
  const profileCaps = new Set(
    profile.capabilities.map(normalizeCapability).filter(Boolean),
  );
  if (incomingCaps.size > 0 && profileCaps.size > 0) {
    const overlap = jaccard(incomingCaps, profileCaps);
    if (overlap > 0)
      add(
        `capability overlap (${overlap.toFixed(2)})`,
        Math.min(0.1, overlap * 0.2),
        true,
      );
  }

  // --- cross-linked sources: this sighting's evidence is a document the
  // person already points at, or vice versa. A personal site linking a paper,
  // and the paper naming the same person, is the ordinary way one human is
  // written up twice — and it is name-independent, so it can carry an
  // identical name over the line.
  const incomingSources = new Set(
    sighting.artifactSources.map(canonicalizeUrl).filter(Boolean),
  );
  const profileSources = new Set(
    profile.artifactSources.map(canonicalizeUrl).filter(Boolean),
  );
  const sharedSources = [...incomingSources]
    .filter((s) => profileSources.has(s))
    .sort();
  if (sharedSources.length > 0) {
    add(`evidence cross-links the same source: ${sharedSources[0]}`, 0.2, true);
  }

  // --- shared collaborators
  //
  // Two people do not accumulate the same collaborators by coincidence. One
  // shared name is weak — a common surname on a long author list — but three is
  // a working relationship, and none of it depends on how the person's own name
  // is spelled, which is exactly what an abbreviated byline needs.
  // Blocked on the initials key, not the full spelling: a byline is initialised
  // far more often than not, so comparing "Amara Okonkwo" to "A. Okonkwo" as
  // strings would find nothing and the whole signal would be dead on arrival.
  const incomingCoauthors = new Set(
    (sighting.coauthors ?? []).map(nameInitialsKey).filter(Boolean),
  );
  const profileCoauthors = new Set(
    (profile.coauthors ?? []).map(nameInitialsKey).filter(Boolean),
  );
  const sharedCoauthors = [...incomingCoauthors]
    .filter((c) => profileCoauthors.has(c))
    .sort();
  if (sharedCoauthors.length > 0) {
    add(
      sharedCoauthors.length === 1
        ? `one shared collaborator: ${sharedCoauthors[0]}`
        : `${sharedCoauthors.length} shared collaborators, including ${sharedCoauthors[0]}`,
      Math.min(0.42, 0.14 * sharedCoauthors.length),
      true,
    );
  }

  const incomingLocs = new Set(
    sighting.locations.map((l) => l.toLowerCase().trim()),
  );
  if (
    [...incomingLocs].some((l) =>
      profile.locations.map((p) => p.toLowerCase().trim()).includes(l),
    )
  ) {
    add("same professional location", 0.06);
  }

  // An identical full name is weak on its own — there are many J. Smiths — but
  // identical AND corroborated by independent professional evidence is the
  // ordinary case of one person written up twice.
  //
  // Corroboration is read off the structured flag, never off the label text.
  // Only name-independent evidence sets it: a shared employer, a shared strong
  // identity, overlapping capabilities. A shared name VARIANT is the name
  // again, and a shared city is not evidence at all — two strangers can both
  // be in London.
  const corroborated = signals.some((s) => s.corroborates && s.weight > 0);
  if (identicalName && corroborated) {
    add("identical name corroborated by independent evidence", 0.25);
  } else if (similarity >= 0.8 && corroborated) {
    // "Sarah Chen" and "S. Chen" are one name written two ways, not two names.
    // Corroboration is what turns either of them into an identity, so the same
    // rule applies at a smaller weight rather than not at all — otherwise an
    // initialised byline can never be resolved however much evidence surrounds it.
    add(
      "the same name written two ways, corroborated by independent evidence",
      0.15,
    );
  }

  return {
    personId: profile.id,
    score: signals.reduce((sum, s) => sum + s.weight, 0),
    signals,
  };
}

export function decide(score: number): MergeDecision {
  if (score >= MERGE_THRESHOLD) return "merge";
  if (score >= REVIEW_THRESHOLD) return "review";
  return "new";
}

export interface Resolution {
  decision: MergeDecision;
  best: MatchScore | null;
  /** Every candidate considered, best first — the audit trail for the merge. */
  considered: MatchScore[];
}

/** Score a sighting against every known person and say what to do. */
export function resolve(
  profiles: PersonProfile[],
  sighting: Sighting,
): Resolution {
  const considered = profiles
    .map((p) => scoreMatch(p, sighting))
    .sort((a, b) => b.score - a.score);
  const best = considered[0] ?? null;
  return {
    decision: best === null ? "new" : decide(best.score),
    best,
    considered: considered.slice(0, 5),
  };
}

/** Plain-English account of a resolution, for the review queue. */
export function explainMatch(match: MatchScore): string[] {
  return match.signals
    .slice()
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .map(
      (s) => `${s.label} (${s.weight >= 0 ? "+" : ""}${s.weight.toFixed(2)})`,
    );
}

// --------------------------------------------------------------------------
// how common the name is

/**
 * Commonness of each name in the population in front of us.
 *
 * "Michael Smith" and a rare name should not share a bar. Rather than ship a
 * name-frequency table — which would be wrong for most of the world and would
 * rot — commonness is read off the records themselves: if four already
 * abbreviate to "m smith", the fifth needs more than a name to join them. It is
 * self-correcting, needs no data anybody has to maintain, and is strictest
 * exactly where the risk actually is.
 */
export function nameFrequency(names: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const name of names) {
    const key = nameInitialsKey(name);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** What a name has to clear before a merge, given how common it is here. */
export function mergeThresholdFor(
  name: string,
  frequency?: Map<string, number>,
): number {
  const bearers = frequency?.get(nameInitialsKey(name)) ?? 1;
  return MERGE_THRESHOLD + Math.min(0.16, 0.04 * Math.max(0, bearers - 1));
}

export function decideFor(
  score: number,
  name: string,
  frequency?: Map<string, number>,
): MergeDecision {
  if (score >= mergeThresholdFor(name, frequency)) return "merge";
  if (score >= REVIEW_THRESHOLD) return "review";
  return "new";
}

// --------------------------------------------------------------------------
// transitive closure

export interface IdentityCluster {
  /** Profile ids the evidence puts together. */
  members: string[];
  /** True when every pair inside was directly scored at merge strength. */
  direct: boolean;
  /**
   * Pairs the closure joined that were never directly scored above their bar.
   * A→B and B→C do not make A→C, so a cluster carrying any of these is held for
   * review rather than merged.
   */
  inferred: [string, string][];
  decision: MergeDecision;
}

/**
 * Group profiles that are the same person, following links transitively.
 *
 * Pairwise scoring never asks whether A and C are the same once it has already
 * put A with B and B with C, so two halves of one person stay apart forever on
 * a spelling neither half shares. Closing the graph fixes that — but closure
 * also compounds mistakes, so a cluster held together only by inference is
 * offered for review and never merged silently.
 */
export function clusterProfiles(
  profiles: PersonProfile[],
  frequency = nameFrequency(profiles.map((p) => p.name)),
): IdentityCluster[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const parent = profiles.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    let walk = i;
    while (parent[walk] !== root) {
      const next = parent[walk];
      parent[walk] = root;
      walk = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const pairScore = new Map<string, number>();
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  // Both names must clear their own bar: merging a rare name into a common one
  // is still merging into a common one.
  const barFor = (a: PersonProfile, b: PersonProfile) =>
    Math.max(
      mergeThresholdFor(a.name, frequency),
      mergeThresholdFor(b.name, frequency),
    );

  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = i + 1; j < profiles.length; j += 1) {
      const match = scoreMatch(profiles[i], profiles[j]);
      pairScore.set(pairKey(profiles[i].id, profiles[j].id), match.score);
      if (match.score >= barFor(profiles[i], profiles[j])) union(i, j);
    }
  }

  const groups = new Map<number, string[]>();
  for (let i = 0; i < profiles.length; i += 1) {
    const root = find(i);
    groups.set(root, [...(groups.get(root) ?? []), profiles[i].id]);
  }

  const clusters: IdentityCluster[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const inferred: [string, string][] = [];
    for (let i = 0; i < members.length; i += 1) {
      for (let j = i + 1; j < members.length; j += 1) {
        const left = byId.get(members[i]);
        const right = byId.get(members[j]);
        if (!left || !right) continue;
        const score = pairScore.get(pairKey(members[i], members[j])) ?? 0;
        if (score < barFor(left, right))
          inferred.push([members[i], members[j]]);
      }
    }
    clusters.push({
      members: [...members].sort(),
      direct: inferred.length === 0,
      inferred,
      decision: inferred.length === 0 ? "merge" : "review",
    });
  }
  return clusters.sort((a, b) => b.members.length - a.members.length);
}
