/**
 * Find more people like this one.
 *
 * The single most valuable move in sourcing is "this person is right — get me
 * ten more". Answered from evidence rather than from a black-box embedding, so
 * every suggestion arrives with the reason it was suggested and a recruiter can
 * tell a real lookalike from a coincidence.
 *
 * Four independent signals, each of which a sourcer would recognise:
 *   capability   they do the same work
 *   colleague    they appear together on the same page or paper
 *   organisation they work, or worked, in the same place
 *   location     they are reachable in the same market
 *
 * Ported from Hu (`app/graph/similar.py`).
 */
import { canonicalizeUrl, jaccard } from "@/lib/sourcing/normalize";
import { conceptLabel } from "@/lib/sourcing/ontology";
import type { SourcedPerson } from "@/lib/sourcing/evidence";

export const SIMILARITY_WEIGHTS: Readonly<Record<string, number>> = {
  capability: 0.45,
  colleague: 0.25,
  organization: 0.2,
  location: 0.1,
};

export interface Neighbour {
  personId: string;
  name: string;
  title: string | null;
  organization: string | null;
  location: string | null;
  score: number;
  /** Why, in the recruiter's own vocabulary. */
  reasons: string[];
  sharedCapabilities: string[];
}

/** Capability → weight, discounting evidence that was only inferred. */
function capabilityWeights(person: SourcedPerson): Map<string, number> {
  const out = new Map<string, number>();
  for (const claim of person.claims) {
    if (claim.kind !== "capability" || !claim.normalized) continue;
    const weight =
      (claim.confidence || 0.5) * (claim.derived === true ? 0.5 : 1);
    out.set(claim.normalized, Math.max(out.get(claim.normalized) ?? 0, weight));
  }
  return out;
}

function organizationsOf(person: SourcedPerson): Set<string> {
  return new Set(
    person.claims
      .filter((c) => c.kind === "employment" && c.normalized)
      .map((c) => c.normalized),
  );
}

function locationsOf(person: SourcedPerson): Set<string> {
  return new Set(
    person.claims
      .filter((c) => c.kind === "location" && c.normalized)
      .map((c) => c.normalized),
  );
}

/**
 * The pages and documents a person is written up on. Two people named on one
 * page are colleagues in the sense that matters here: somebody put them
 * together, which is a stronger signal than sharing an employer's name.
 */
function sourcesOf(person: SourcedPerson): Set<string> {
  return new Set(
    person.claims
      .map((c) => canonicalizeUrl(c.sourceUrl))
      .filter((u) => u && !u.includes("talentos.local")),
  );
}

function weightedOverlap(
  a: Map<string, number>,
  b: Map<string, number>,
): {
  score: number;
  shared: string[];
} {
  if (a.size === 0 || b.size === 0) return { score: 0, shared: [] };
  let numerator = 0;
  const shared: string[] = [];
  for (const [key, weight] of a) {
    const other = b.get(key);
    if (other === undefined) continue;
    numerator += Math.min(weight, other);
    shared.push(key);
  }
  const denominator = Math.max(a.size, b.size);
  return { score: Math.min(1, numerator / denominator), shared };
}

/** People most like `seed`, best first, each carrying its reasons. */
export function findSimilar(
  seed: SourcedPerson,
  population: SourcedPerson[],
  limit = 10,
): Neighbour[] {
  const seedCaps = capabilityWeights(seed);
  const seedOrgs = organizationsOf(seed);
  const seedLocs = locationsOf(seed);
  const seedSources = sourcesOf(seed);

  const out: Neighbour[] = [];
  for (const other of population) {
    if (other.id === seed.id) continue;

    const caps = weightedOverlap(seedCaps, capabilityWeights(other));
    const orgs = organizationsOf(other);
    const locs = locationsOf(other);
    const sources = sourcesOf(other);

    const sharedOrgs = [...orgs].filter((o) => seedOrgs.has(o));
    const sharedLocs = [...locs].filter((l) => seedLocs.has(l));
    const sharedSources = [...sources].filter((s) => seedSources.has(s));

    const components: Record<string, number> = {
      capability: caps.score,
      colleague:
        sharedSources.length > 0 ? Math.min(1, sharedSources.length / 2) : 0,
      organization: sharedOrgs.length > 0 ? 1 : jaccard(orgs, seedOrgs),
      location: sharedLocs.length > 0 ? 1 : 0,
    };

    const score = Object.entries(SIMILARITY_WEIGHTS).reduce(
      (sum, [key, weight]) => sum + weight * components[key],
      0,
    );
    if (score <= 0) continue;

    const reasons: string[] = [];
    if (caps.shared.length > 0) {
      reasons.push(
        `does the same work: ${caps.shared.map(conceptLabel).slice(0, 3).join(", ")}`,
      );
    }
    if (sharedSources.length > 0) {
      reasons.push(`named on the same page as ${seed.name}`);
    }
    if (sharedOrgs.length > 0) {
      reasons.push(`worked at ${sharedOrgs[0]}`);
    }
    if (sharedLocs.length > 0) {
      reasons.push(`reachable in the same market (${sharedLocs[0]})`);
    }

    out.push({
      personId: other.id,
      name: other.name,
      title: other.title ?? null,
      organization: other.organization ?? null,
      location: other.location ?? null,
      score,
      reasons,
      sharedCapabilities: caps.shared,
    });
  }

  out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return out.slice(0, limit);
}
