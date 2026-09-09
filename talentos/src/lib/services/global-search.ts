/**
 * One search across everything the workspace holds.
 *
 * Same query language as sourcing, so `loc:london` narrows a job list the way
 * it narrows a shortlist, and a plain sentence still works. Anything the
 * language cannot honour is reported rather than dropped, and the reading of
 * the query is handed back so the caller can show what it searched for.
 */
import type { Db } from "@/lib/db/client";
import { candidates, searchProjects, tasks } from "@/lib/db/schema";
import { jobLocation } from "@/lib/domain/job-label";
import { tagHref, tagSlug } from "@/lib/core/tags";
import { listTags } from "./tags";
import { normalizeLocation, normalizeText } from "@/lib/sourcing/normalize";
import {
  describeBrief,
  keywords,
  negativeTerms,
  parseQuery,
  type SourcingBrief,
} from "@/lib/sourcing/query-language";

export type GlobalHitKind = "job" | "person" | "tag" | "task";

export interface GlobalHit {
  kind: GlobalHitKind;
  icon: string;
  title: string;
  detail: string;
  href: string;
  /** 0..1, from how much of the brief the row answers. */
  score: number;
  /** What matched, in the words of the record. */
  matched: string[];
}

export interface GlobalSearchResult {
  brief: SourcingBrief;
  reading: string[];
  hits: GlobalHit[];
  counts: Record<GlobalHitKind, number>;
  warnings: string[];
}

const KIND_ICON: Record<GlobalHitKind, string> = {
  job: "💼",
  person: "👤",
  tag: "🏷️",
  task: "✅",
};

interface Candidate {
  kind: GlobalHitKind;
  title: string;
  detail: string;
  href: string;
  /** Everything about the row that a query could match against. */
  haystack: string;
  location?: string | null;
  organization?: string | null;
}

/** Score one row against the brief. Returns null when nothing matched. */
function scoreRow(row: Candidate, brief: SourcingBrief): GlobalHit | null {
  const haystack = normalizeText(row.haystack);

  // A negated term excludes the row outright, wherever it appears.
  for (const term of negativeTerms(brief)) {
    if (haystack.includes(normalizeText(term.text))) return null;
  }

  const matched: string[] = [];
  const wants: boolean[] = [];

  const words = [
    ...keywords(brief),
    ...brief.skillTerms,
    ...brief.titles,
    ...brief.names,
  ];
  for (const word of words) {
    const hit = haystack.includes(normalizeText(word));
    wants.push(hit);
    if (hit) matched.push(word);
  }

  if (brief.orgs.length > 0) {
    const hit = brief.orgs.some((o) => haystack.includes(normalizeText(o)));
    wants.push(hit);
    if (hit && row.organization) matched.push(row.organization);
  }

  if (brief.locations.length > 0) {
    const place = normalizeLocation(row.location ?? "");
    const hit = brief.locations.some(
      (l) =>
        place === normalizeLocation(l) || haystack.includes(normalizeText(l)),
    );
    wants.push(hit);
    if (hit && row.location) matched.push(row.location);
  }

  if (wants.length === 0) return null;
  const score = wants.filter(Boolean).length / wants.length;
  if (score === 0) return null;

  return {
    kind: row.kind,
    icon: KIND_ICON[row.kind],
    title: row.title,
    detail: row.detail,
    href: row.href,
    score,
    matched: [...new Set(matched)].slice(0, 4),
  };
}

export function globalSearch(
  db: Db,
  query: string,
  limit = 40,
): GlobalSearchResult {
  const brief = parseQuery(query);
  const rows: Candidate[] = [];

  const projects = db.select().from(searchProjects).all();
  const projectName = new Map(projects.map((p) => [p.id, p.name]));

  for (const job of projects) {
    const place = jobLocation(job);
    rows.push({
      kind: "job",
      title: job.name,
      detail: [place, job.status].filter(Boolean).join(" · "),
      href: `/searches/${job.id}`,
      haystack: [
        job.name,
        place,
        job.status,
        job.industry,
        job.roleTitle,
        job.companyName,
      ]
        .filter(Boolean)
        .join(" "),
      location: place,
      organization: job.name,
    });
  }

  for (const person of db.select().from(candidates).all()) {
    rows.push({
      kind: "person",
      title: person.name,
      detail: [person.currentTitle, person.currentCompany, person.geography]
        .filter(Boolean)
        .join(" · "),
      href: `/searches/${person.searchProjectId}/candidates/${person.id}`,
      haystack: [
        person.name,
        person.currentTitle,
        person.currentCompany,
        person.geography,
        person.recruiterNotes,
        projectName.get(person.searchProjectId),
      ]
        .filter(Boolean)
        .join(" "),
      location: person.geography,
      organization: person.currentCompany,
    });
  }

  for (const tag of listTags(db)) {
    rows.push({
      kind: "tag",
      title: tag.display,
      detail: `${tag.count} mention${tag.count === 1 ? "" : "s"}`,
      href: tagHref(tag.slug),
      haystack: `${tag.display} ${tagSlug(tag.display)}`,
    });
  }

  for (const task of db.select().from(tasks).all()) {
    rows.push({
      kind: "task",
      title: task.title,
      detail: [task.status, projectName.get(task.searchProjectId ?? "")]
        .filter(Boolean)
        .join(" · "),
      href: "/tasks",
      haystack: [task.title, task.kind, task.status].filter(Boolean).join(" "),
    });
  }

  const hits = rows
    .map((row) => scoreRow(row, brief))
    .filter((h): h is GlobalHit => h !== null)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit);

  const counts: Record<GlobalHitKind, number> = {
    job: 0,
    person: 0,
    tag: 0,
    task: 0,
  };
  for (const hit of hits) counts[hit.kind] += 1;

  return {
    brief,
    reading: describeBrief(brief),
    hits,
    counts,
    warnings: brief.warnings,
  };
}
