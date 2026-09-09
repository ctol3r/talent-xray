/**
 * The dossier: every claim made about a person, joined to the evidence for it.
 *
 * Built from what the ranker already worked out. `EvidenceLink.satisfies`
 * records which requirement each source answered while scoring, so the ribbon
 * is drawn from the same fact the score was computed from rather than from a
 * second, looser guess made for display. A claim with no evidence behind it
 * cannot be rendered here, which is the point.
 */
import { conceptLabel } from "@/lib/sourcing/ontology";
import type { EvidenceLink } from "@/lib/sourcing/evidence";
import type { RankedPerson } from "@/lib/sourcing/rank";

export interface DossierClaim {
  id: string;
  text: string;
  evidenceIds: string[];
  adjacent: boolean;
}

export interface DossierEvidence {
  id: string;
  label: string;
  detail: string;
  domain: string;
  url: string;
  quote: string | null;
  date: string | null;
}

const KIND_LABEL: Record<string, string> = {
  employment: "employment",
  capability: "capability",
  location: "location",
  identity: "address on file",
  contact: "contact route",
  artifact: "published work",
};

/** Turn a requirement key into the sentence a recruiter would say. */
export function requirementText(requirement: string): string {
  const [kind, ...rest] = requirement.split(":");
  const value = rest.join(":");
  switch (kind) {
    case "skill":
      return `does ${conceptLabel(value)}`;
    case "loc":
      return `is based in ${value}`;
    case "org":
      return `has worked at ${value}`;
    case "title":
      return `has held the title ${value}`;
    default:
      return requirement;
  }
}

export interface Dossier {
  claims: DossierClaim[];
  evidence: DossierEvidence[];
  /** Requirements the brief made that no source answers. */
  unevidenced: string[];
}

export function buildDossier(
  person: RankedPerson,
  adjacentKeys: Set<string> = new Set(),
): Dossier {
  const byRequirement = new Map<string, string[]>();
  for (const link of person.evidence) {
    for (const requirement of link.satisfies) {
      const list = byRequirement.get(requirement) ?? [];
      list.push(link.anchor);
      byRequirement.set(requirement, list);
    }
  }

  const claims: DossierClaim[] = [...byRequirement.entries()].map(
    ([requirement, ids]) => ({
      id: requirement,
      text: requirementText(requirement),
      evidenceIds: ids,
      adjacent:
        requirement.startsWith("skill:") &&
        adjacentKeys.has(requirement.slice(6)),
    }),
  );
  claims.sort(
    (a, b) =>
      Number(a.adjacent) - Number(b.adjacent) || a.text.localeCompare(b.text),
  );

  const cited = new Set(claims.flatMap((c) => c.evidenceIds));
  const evidence: DossierEvidence[] = person.evidence
    .filter((link) => cited.has(link.anchor))
    .map(toEvidence);

  return { claims, evidence, unevidenced: person.gaps };
}

function toEvidence(link: EvidenceLink): DossierEvidence {
  return {
    id: link.anchor,
    label: link.claim,
    detail: [KIND_LABEL[link.kind] ?? link.kind, link.sourceTitle]
      .filter(Boolean)
      .join(" · "),
    domain: link.domain,
    url: link.sourceUrl,
    quote: link.quote,
    date: link.date,
  };
}

/** Everything held about a person, whether or not this brief asked for it. */
export function allEvidence(person: RankedPerson): DossierEvidence[] {
  return person.evidence.map(toEvidence);
}
