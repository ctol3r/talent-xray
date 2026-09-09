/**
 * Tags proposed from a role's requirements, and the same tags proposed again
 * when a person is assessed against those requirements.
 *
 * The graph's definition of a link is one word written on both a job and a
 * person. Almost none form, and the reason is not that the graph is wrong —
 * it is that nothing ever asks. A person gets words offered from their
 * evidence (`suggestTagsFromEvidence`); a job gets offered nothing at all, so
 * the two ends have never had a word in common to meet on.
 *
 * This module is the missing prompt on both ends. It is deliberately NOT a
 * second tagger: it reads the same 408-capability ontology and 390-place
 * gazetteer that already read a person's evidence, so a word proposed on the
 * job is a word that can be proposed on a person, by construction rather than
 * by coincidence.
 *
 * ── Why the vocabulary is coarse on purpose ────────────────────────────────
 *
 * The obvious design is to name each requirement: turn "Has configured an ATS
 * from empty" into `#configured-an-ats`. That was tried against the 50
 * requirement items in the workspace and it is wrong. Extracting a phrase per
 * requirement produced 50 distinct phrases from 50 requirements — not one
 * recurred — so it would have added 50 nodes and 50 edges to the graph and
 * exactly zero connections between two records. A tag written once connects
 * nothing; it is a label, which is the thing the graph already has too much
 * of.
 *
 * So a requirement only yields a tag when it names something the shared
 * vocabulary already knows. `talent-sourcing` on three jobs and five people is
 * worth more than fifty unique phrases, because a tag's whole job is to be
 * written twice. Requirements the vocabulary cannot name yield nothing here
 * and are left to the recruiter to name, where the recall menu offers the
 * words the workspace already uses.
 *
 * Nothing is stored and nothing is written. Every function is pure, so this
 * bundles into the browser-only artifact unchanged, and a proposal becomes
 * real only when someone confirms it — at which point it is a word in a
 * sentence, deletable like any other word.
 */
import { tagIsAllowed, tagSlug } from "@/lib/core/tags";
import type { EvidenceStatus } from "@/lib/core/enums";
import {
  conceptLabel,
  matchCapabilities,
  matchEnvironments,
  matchLocations,
} from "@/lib/sourcing/ontology";

/** Which of role intelligence's three lists a requirement came from. */
export type RequirementWeight = "hard" | "preference" | "signal";

export type RequirementTagKind = "capability" | "place" | "environment";

/** One requirement, as role intelligence states it. */
export interface RequirementItem {
  text: string;
  weight: RequirementWeight;
}

/** Where a proposed word was read from, in the requirement's own words. */
export interface RequirementSource {
  requirement: string;
  weight: RequirementWeight;
  /** The phrase in the requirement that matched, so the offer can say why. */
  matched: string;
}

export interface RequirementTagProposal {
  slug: string;
  display: string;
  kind: RequirementTagKind;
  /** Every requirement that produced this word. Never empty. */
  from: RequirementSource[];
}

const WEIGHT_ORDER: Record<RequirementWeight, number> = {
  hard: 0,
  preference: 1,
  signal: 2,
};

/**
 * Read the shared vocabulary out of one piece of text.
 *
 * Capabilities, environments and places, in that order, each carrying the
 * surface that matched so a proposal can show the words it recognised rather
 * than assert a category.
 */
function conceptsIn(
  text: string,
): { display: string; kind: RequirementTagKind; matched: string }[] {
  const out: { display: string; kind: RequirementTagKind; matched: string }[] =
    [];
  for (const [key, surfaces] of Object.entries(matchCapabilities(text))) {
    out.push({
      display: conceptLabel(key),
      kind: "capability",
      matched: surfaces[0] ?? conceptLabel(key),
    });
  }
  for (const [key, surfaces] of Object.entries(matchEnvironments(text))) {
    out.push({
      display: conceptLabel(key),
      kind: "environment",
      matched: surfaces[0] ?? conceptLabel(key),
    });
  }
  for (const place of matchLocations(text)) {
    out.push({ display: place.label, kind: "place", matched: place.label });
  }
  return out;
}

export interface RequirementTagOptions {
  /** Slugs the job already carries, so nothing is offered twice. */
  already?: Iterable<string>;
  limit?: number;
}

/**
 * Propose tags for a job from the requirements role intelligence extracted.
 *
 * One word may come from several requirements; that is a signal it matters to
 * this role rather than a duplicate, so the sources are gathered under it and
 * the strongest requirement is listed first.
 */
export function tagsForRequirements(
  items: RequirementItem[],
  options: RequirementTagOptions = {},
): RequirementTagProposal[] {
  const already = new Set(options.already ?? []);
  const found = new Map<string, RequirementTagProposal>();

  for (const item of items) {
    const text = item.text?.trim();
    if (!text) continue;
    for (const concept of conceptsIn(text)) {
      const slug = tagSlug(concept.display);
      // The fair-hiring gate runs on the slug before anything is offered.
      if (!slug || !tagIsAllowed(slug) || already.has(slug)) continue;
      const entry = found.get(slug) ?? {
        slug,
        display: concept.display,
        kind: concept.kind,
        from: [],
      };
      if (!entry.from.some((source) => source.requirement === text)) {
        entry.from.push({
          requirement: text,
          weight: item.weight,
          matched: concept.matched,
        });
      }
      found.set(slug, entry);
    }
  }

  const out = [...found.values()];
  for (const proposal of out) {
    proposal.from.sort(
      (a, b) => WEIGHT_ORDER[a.weight] - WEIGHT_ORDER[b.weight],
    );
  }
  // A word several requirements ask for outranks one only a signal mentions.
  out.sort(
    (a, b) =>
      b.from.length - a.from.length ||
      WEIGHT_ORDER[a.from[0].weight] - WEIGHT_ORDER[b.from[0].weight] ||
      a.display.localeCompare(b.display),
  );
  return options.limit ? out.slice(0, options.limit) : out;
}

/**
 * Statuses that may put a word on a person.
 *
 * "missing" and "contradictory" are assessments that the evidence does NOT
 * support the criterion, and "unknown" is an assessment that nothing could be
 * read at all. Writing the word on the person in any of those three cases
 * would assert the opposite of what was found, so a tag is only ever offered
 * where evidence was actually seen — and "partial" is carried through to the
 * offer rather than smoothed away, because the recruiter is the one deciding
 * whether partial evidence deserves the word.
 */
const TAGGABLE: ReadonlySet<EvidenceStatus> = new Set<EvidenceStatus>([
  "strong",
  "partial",
]);

/** One assessed criterion, as evidence alignment states it. */
export interface AssessedCriterion {
  criterion: string;
  status: EvidenceStatus;
}

export interface AssessmentSource {
  criterion: string;
  status: EvidenceStatus;
  /** The job requirement this criterion was matched back to, when one fits. */
  requirement?: string;
}

export interface AssessmentTagProposal {
  slug: string;
  display: string;
  /** Every assessed criterion that supports this word. Never empty. */
  from: AssessmentSource[];
}

/** Content words, for comparing a restated criterion with a requirement. */
function contentWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9+#./\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3),
  );
}

/**
 * Which requirement is this criterion assessing?
 *
 * Evidence alignment restates a requirement in its own words, so the two
 * strings are never equal. Overlap of content words is enough to tell 21
 * requirements apart, and a floor keeps an unrelated criterion from being
 * forced onto the nearest one — no match is a fine answer here, because the
 * criterion's own words are read as well.
 */
export function matchCriterionToRequirement(
  criterion: string,
  requirements: RequirementItem[],
): RequirementItem | null {
  const words = contentWords(criterion);
  if (words.size === 0) return null;
  let best: { item: RequirementItem; score: number } | null = null;
  for (const item of requirements) {
    const other = contentWords(item.text);
    if (other.size === 0) continue;
    let shared = 0;
    for (const word of words) if (other.has(word)) shared += 1;
    // Jaccard, so a long requirement cannot win on length alone.
    const score = shared / (words.size + other.size - shared);
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score >= 0.18 ? best.item : null;
}

/**
 * Propose, on a person, the words their assessment supports — drawn only from
 * the words the job itself carries.
 *
 * This is the half that makes the edge. A person tagged from their own
 * evidence gets whatever their evidence says, which may be a word no job in
 * the workspace uses; the result is a node hanging off one person. Here the
 * candidate words are intersected with `jobTags` — the words actually written
 * on the job — so anything offered is guaranteed to close a job-to-person
 * link the moment it is kept, rather than merely possibly closing one.
 *
 * Two routes to the same place, because a restatement can lose a word the
 * ontology needed: the criterion's own text is read, and the requirement it
 * was matched back to is read too. Both are filtered through `jobTags`.
 */
export function tagsForAssessment(
  assessed: AssessedCriterion[],
  jobTags: { slug: string; display: string }[],
  requirements: RequirementItem[] = [],
  options: { already?: Iterable<string>; limit?: number } = {},
): AssessmentTagProposal[] {
  const already = new Set(options.already ?? []);
  const offered = new Map(jobTags.map((tag) => [tag.slug, tag.display]));
  if (offered.size === 0) return [];
  const found = new Map<string, AssessmentTagProposal>();

  for (const item of assessed) {
    if (!TAGGABLE.has(item.status)) continue;
    const criterion = item.criterion?.trim();
    if (!criterion) continue;
    const requirement = matchCriterionToRequirement(criterion, requirements);
    const texts = [criterion, requirement?.text].filter(
      (text): text is string => Boolean(text),
    );

    const slugs = new Set<string>();
    for (const text of texts) {
      for (const concept of conceptsIn(text)) {
        const slug = tagSlug(concept.display);
        if (!slug || !tagIsAllowed(slug) || already.has(slug)) continue;
        // The whole point: only words the job itself carries.
        if (!offered.has(slug)) continue;
        slugs.add(slug);
      }
    }

    for (const slug of slugs) {
      const entry = found.get(slug) ?? {
        slug,
        display: offered.get(slug) as string,
        from: [],
      };
      if (!entry.from.some((source) => source.criterion === criterion)) {
        entry.from.push({
          criterion,
          status: item.status,
          ...(requirement ? { requirement: requirement.text } : {}),
        });
      }
      found.set(slug, entry);
    }
  }

  const out = [...found.values()];
  for (const proposal of out) {
    // Strong evidence leads; partial is never hidden behind it.
    proposal.from.sort((a, b) =>
      a.status === b.status ? 0 : a.status === "strong" ? -1 : 1,
    );
  }
  out.sort(
    (a, b) =>
      Number(b.from.some((s) => s.status === "strong")) -
        Number(a.from.some((s) => s.status === "strong")) ||
      b.from.length - a.from.length ||
      a.display.localeCompare(b.display),
  );
  return options.limit ? out.slice(0, options.limit) : out;
}

/**
 * Flatten role intelligence's three lists into one, keeping which list each
 * came from. Kept here so the job side and the person side cannot disagree
 * about what counts as a requirement.
 */
export function requirementsOf(payload: {
  hardRequirements?: { text: string }[];
  preferences?: { text: string }[];
  signals?: { text: string }[];
}): RequirementItem[] {
  return [
    ...(payload.hardRequirements ?? []).map((item) => ({
      text: item.text,
      weight: "hard" as const,
    })),
    ...(payload.preferences ?? []).map((item) => ({
      text: item.text,
      weight: "preference" as const,
    })),
    ...(payload.signals ?? []).map((item) => ({
      text: item.text,
      weight: "signal" as const,
    })),
  ];
}
