/**
 * The tag index: every place a tag was written, gathered.
 *
 * There is no tag table and no migration. A tag exists because some text
 * says it does, so this scans the free-text columns a recruiter actually
 * writes in and reads the references out. Delete the word and the reference
 * is gone; nothing can drift.
 *
 * The columns are named one by one on purpose. A tag index that swept every
 * text column would pull in generated content, imported vendor fields and
 * result snippets, and a page would fill with words nobody chose. These six
 * are the places a human writes prose:
 *
 *   search_projects.recruiter_notes, .business_objective   the job
 *   candidates.recruiter_notes                             the person
 *   search_learnings.text                                  what was learned
 *   candidate_sources.why_note                             why this is them
 *   source_channels.why_relevant, .note                    where to look
 *
 * That set is what makes a tag connect a job to a person: the same word
 * written on a search and on a candidate puts both on one page.
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { loadProjectContext } from "@/lib/ai/context";
import { runAiTask } from "@/lib/ai/run";
import { candidateTagsTask } from "@/lib/ai/tasks/candidate-tags";
import {
  candidateEvidence,
  candidates,
  candidateSources,
  roleIntelligence,
  searchLearnings,
  searchProjects,
  sourceChannels,
} from "@/lib/db/schema";
import { workspacePeople } from "./sourcing";
import {
  suggestTagsFromEvidence,
  type SuggestedTag,
} from "@/lib/sourcing/auto-tags";
import {
  requirementsOf,
  tagsForAssessment,
  tagsForRequirements,
  type AssessmentTagProposal,
  type RequirementTagProposal,
} from "@/lib/sourcing/requirement-tags";
import {
  tagIsAllowed,
  tagSlug,
  tagTitle,
  tagsIn,
  type TagSegment,
} from "@/lib/core/tags";

export type TagHolderKind =
  "search" | "candidate" | "learning" | "source" | "channel";

/** One place a tag was written. */
export interface TagMention {
  kind: TagHolderKind;
  /** The record the text belongs to. */
  id: string;
  /** What to call it in a list. */
  label: string;
  /** The search it sits under, so a tag page can group by search. */
  searchProjectId: string;
  searchName: string;
  href: string;
  /** Which column the tag was written in, in words. */
  field: string;
  /** The sentence around it, so a reference reads like a reference. */
  context: string;
}

export interface TagSummary {
  slug: string;
  display: string;
  count: number;
  kinds: TagHolderKind[];
  /** Distinct searches and people carrying it — the connection that matters. */
  searchCount: number;
  candidateCount: number;
}

/** Trim a long note down to the sentence the tag appears in. */
function contextFor(text: string, display: string): string {
  const at = text.toLowerCase().indexOf(display.toLowerCase());
  if (at < 0) return text.slice(0, 160).trim();
  const from = Math.max(0, at - 70);
  const to = Math.min(text.length, at + display.length + 90);
  return `${from > 0 ? "…" : ""}${text.slice(from, to).trim()}${to < text.length ? "…" : ""}`;
}

interface Scanned {
  slug: string;
  display: string;
  mention: TagMention;
}

/**
 * Read every mention in the database. One pass, five queries; the caller
 * groups. At this size that is cheaper and simpler than any cache, and it
 * cannot go stale.
 */
export function scanTagMentions(db: Db): Scanned[] {
  const projects = db.select().from(searchProjects).all();
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
  const out: Scanned[] = [];

  const add = (
    text: string | null,
    field: string,
    mention: Omit<TagMention, "field" | "context">,
  ) => {
    if (!text) return;
    for (const tag of tagsIn(text)) {
      out.push({
        slug: tag.slug,
        display: tag.display,
        mention: { ...mention, field, context: contextFor(text, tag.display) },
      });
    }
  };

  for (const project of projects) {
    const base = {
      kind: "search" as const,
      id: project.id,
      label: project.name,
      searchProjectId: project.id,
      searchName: project.name,
      href: `/searches/${project.id}`,
    };
    add(project.recruiterNotes, "notes", base);
    add(project.businessObjective, "business objective", base);
  }

  for (const person of db.select().from(candidates).all()) {
    add(person.recruiterNotes, "notes", {
      kind: "candidate",
      id: person.id,
      label: person.name,
      searchProjectId: person.searchProjectId,
      searchName: projectName.get(person.searchProjectId) ?? "",
      href: `/searches/${person.searchProjectId}/candidates/${person.id}`,
    });
  }

  for (const learning of db.select().from(searchLearnings).all()) {
    add(learning.text, "learning", {
      kind: "learning",
      id: learning.id,
      label: learning.text.slice(0, 60),
      searchProjectId: learning.searchProjectId,
      searchName: projectName.get(learning.searchProjectId) ?? "",
      href: `/searches/${learning.searchProjectId}/learnings`,
    });
  }

  const people = new Map(
    db
      .select()
      .from(candidates)
      .all()
      .map((person) => [person.id, person]),
  );
  for (const source of db.select().from(candidateSources).all()) {
    const person = people.get(source.candidateId);
    if (!person) continue;
    add(source.whyNote, "why this is them", {
      kind: "source",
      id: source.id,
      label: source.url,
      searchProjectId: person.searchProjectId,
      searchName: projectName.get(person.searchProjectId) ?? "",
      href: `/searches/${person.searchProjectId}/candidates/${person.id}`,
    });
  }

  for (const channel of db.select().from(sourceChannels).all()) {
    const base = {
      kind: "channel" as const,
      id: channel.id,
      label: channel.name,
      searchProjectId: channel.searchProjectId,
      searchName: projectName.get(channel.searchProjectId) ?? "",
      href: `/searches/${channel.searchProjectId}/sources`,
    };
    add(channel.whyRelevant, "why relevant", base);
    add(channel.note, "note", base);
  }

  return out;
}

/** Every tag, most written first, for the index page and for recall. */
export function listTags(db: Db): TagSummary[] {
  const grouped = new Map<
    string,
    { display: string; mentions: TagMention[] }
  >();
  for (const { slug, display, mention } of scanTagMentions(db)) {
    const entry = grouped.get(slug);
    if (entry) entry.mentions.push(mention);
    else grouped.set(slug, { display, mentions: [mention] });
  }
  return [...grouped]
    .map(([slug, entry]) => ({
      slug,
      display: entry.display,
      count: entry.mentions.length,
      kinds: [...new Set(entry.mentions.map((m) => m.kind))],
      searchCount: new Set(
        entry.mentions.filter((m) => m.kind === "search").map((m) => m.id),
      ).size,
      candidateCount: new Set(
        entry.mentions.filter((m) => m.kind === "candidate").map((m) => m.id),
      ).size,
    }))
    .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug));
}

export interface TagPage {
  slug: string;
  display: string;
  mentions: TagMention[];
  /** Tags written alongside this one, and how often. The graph of words. */
  related: { slug: string; display: string; shared: number }[];
}

/** One tag's page: everything that carries it, and what it sits beside. */
export function tagPage(db: Db, slug: string): TagPage {
  const all = scanTagMentions(db);
  const mine = all.filter((entry) => entry.slug === slug);
  const holders = new Set(
    mine.map((entry) => `${entry.mention.kind}:${entry.mention.id}`),
  );

  const related = new Map<string, { display: string; shared: number }>();
  for (const entry of all) {
    if (entry.slug === slug) continue;
    if (!holders.has(`${entry.mention.kind}:${entry.mention.id}`)) continue;
    const found = related.get(entry.slug);
    if (found) found.shared += 1;
    else related.set(entry.slug, { display: entry.display, shared: 1 });
  }

  return {
    slug,
    display: mine[0]?.display ?? tagTitle(slug),
    mentions: mine.map((entry) => entry.mention),
    related: [...related]
      .map(([relatedSlug, value]) => ({ slug: relatedSlug, ...value }))
      .sort((a, b) => b.shared - a.shared || a.slug.localeCompare(b.slug))
      .slice(0, 24),
  };
}

/**
 * The tags on one record, for showing them beside the thing they describe.
 */
export function tagsForCandidate(db: Db, candidateId: string) {
  const person = db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .get();
  return person ? tagsIn(person.recruiterNotes ?? "") : [];
}

/**
 * Ask the model which tags this person's own material supports.
 *
 * Nothing is written. The suggestions come back with their evidence and the
 * recruiter keeps the ones they agree with, which appends the word to the
 * notes — the same place a hand-written tag lives, so an accepted suggestion
 * is indistinguishable from one somebody typed and just as easy to delete.
 * That is the answer to whether a derived tag can be removed by hand: it is
 * a word in a sentence, so of course it can.
 */
export async function suggestCandidateTags(db: Db, candidateId: string) {
  const person = db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .get();
  if (!person) throw new Error("Candidate not found.");
  const project = await loadProjectContext(db, person.searchProjectId);
  const already = new Set(
    tagsIn(person.recruiterNotes ?? "").map((t) => t.slug),
  );

  const { output, meta, warnings } = await runAiTask(
    candidateTagsTask,
    {
      project,
      candidate: {
        name: person.name,
        currentTitle: person.currentTitle,
        currentCompany: person.currentCompany,
        resumeText: person.resumeText,
        recruiterNotes: person.recruiterNotes,
      },
      existingTags: listTags(db)
        .slice(0, 120)
        .map((tag) => tag.display),
    },
    { db, searchProjectId: person.searchProjectId, candidateId },
  );

  // The fair-hiring gate runs on the slug, not on the model's word for it,
  // and a tag the person already carries is dropped rather than offered twice.
  const suggestions = output.tags.flatMap((suggestion) => {
    const slug = tagSlug(suggestion.tag);
    if (!slug || !tagIsAllowed(slug) || already.has(slug)) return [];
    return [{ ...suggestion, slug }];
  });

  return { suggestions, notFound: output.notFound ?? [], meta, warnings };
}

/**
 * Keep a tag on a person by writing the word into their notes.
 *
 * Appended on its own line so the recruiter's prose is never rearranged, and
 * in bracket form whenever the tag has a space in it.
 */
export function appendTagToNotes(
  notes: string | null,
  tag: { slug: string; display: string },
): string {
  const label = tag.display.trim() || tag.slug;
  const written = /\s/u.test(label) ? `[[${label}]]` : `#${label}`;
  const current = (notes ?? "").trimEnd();
  if (tagsIn(current).some((existing) => existing.slug === tag.slug)) {
    return notes ?? "";
  }
  return current ? `${current}\n${written}` : written;
}

export type { TagSegment };

/**
 * Tags read straight off a person's evidence, with no model and no key.
 *
 * The model path (`suggestCandidateTags`) reads the CV and the recruiter's own
 * notes and needs a provider. This reads every claim held about the person —
 * a team page, a registry row, a paper, a saved address, an import — and needs
 * nothing. It is therefore the one that is actually ON, on every person, all
 * the time, which is the difference between a feature and an option.
 *
 * Nothing is applied. Each word is offered with the sentence and the source
 * that produced it, and keeping one writes it into the notes where it can be
 * deleted like any other word.
 */
export function readTagsFromEvidence(
  db: Db,
  candidateId: string,
  limit = 18,
): SuggestedTag[] {
  const person = workspacePeople(db).find((p) => p.id === candidateId);
  if (!person) return [];
  const record = db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .get();
  return suggestTagsFromEvidence(person, {
    already: tagsIn(record?.recruiterNotes ?? "").map((tag) => tag.slug),
    limit,
  });
}

/**
 * The words a job's requirements suggest, for offering on the job itself.
 *
 * Role intelligence already separates hard requirements from preferences and
 * signals; this reads all three through the shared vocabulary and drops
 * anything the job's prose already says, so the offer is only ever new words.
 *
 * Nothing is written. Keeping one appends it to the job's notes, which is the
 * column the tag index reads, so a kept word is indistinguishable from one
 * somebody typed.
 */
export function proposeJobTags(
  db: Db,
  searchProjectId: string,
  limit = 18,
): RequirementTagProposal[] {
  const row = db
    .select()
    .from(roleIntelligence)
    .where(eq(roleIntelligence.searchProjectId, searchProjectId))
    .get();
  if (!row) return [];
  const project = db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.id, searchProjectId))
    .get();
  // Both prose columns count as "already said", because both are indexed.
  const already = [
    ...tagsIn(project?.recruiterNotes ?? ""),
    ...tagsIn(project?.businessObjective ?? ""),
  ].map((tag) => tag.slug);
  return tagsForRequirements(requirementsOf(row.payload), { already, limit });
}

/** The tags a job's own prose carries right now, job-side and indexed. */
export function jobTags(
  db: Db,
  searchProjectId: string,
): { slug: string; display: string }[] {
  const project = db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.id, searchProjectId))
    .get();
  if (!project) return [];
  const seen = new Map<string, string>();
  for (const tag of [
    ...tagsIn(project.recruiterNotes ?? ""),
    ...tagsIn(project.businessObjective ?? ""),
  ]) {
    if (!seen.has(tag.slug)) seen.set(tag.slug, tag.display);
  }
  return [...seen].map(([slug, display]) => ({ slug, display }));
}

/**
 * The words a person's assessment supports, drawn only from what the job says.
 *
 * This is the half that closes the link. Offering a word the job does not
 * carry would make another node hanging off one person; intersecting with the
 * job's own tags means every word offered here becomes a job-to-person edge
 * the moment it is kept.
 *
 * Returns nothing when the job carries no tags yet — the job is tagged first,
 * which is the order the two prompts are meant to run in.
 */
export function proposeAssessmentTags(
  db: Db,
  candidateId: string,
  limit = 12,
): AssessmentTagProposal[] {
  const person = db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .get();
  if (!person) return [];
  const evidence = db
    .select()
    .from(candidateEvidence)
    .where(eq(candidateEvidence.candidateId, candidateId))
    .get();
  if (!evidence) return [];
  const role = db
    .select()
    .from(roleIntelligence)
    .where(eq(roleIntelligence.searchProjectId, person.searchProjectId))
    .get();
  return tagsForAssessment(
    evidence.payload.items.map((item) => ({
      criterion: item.criterion,
      status: item.status,
    })),
    jobTags(db, person.searchProjectId),
    role ? requirementsOf(role.payload) : [],
    {
      already: tagsIn(person.recruiterNotes ?? "").map((tag) => tag.slug),
      limit,
    },
  );
}
