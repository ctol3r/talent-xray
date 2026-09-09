/**
 * Pages: the one list every recall menu reads from.
 *
 * A tag, a person and a job are all pages here, which is what lets `[[a
 * name]]` mean whichever of the three it turns out to be, and lets `@` and
 * `jj` be filters rather than separate syntaxes.
 *
 * Names are slugged the same way tags are, so writing `[[Christopher Toler]]`
 * in a note and opening the page for `christopher-toler` land in the same
 * place.
 */
import type { Db } from "@/lib/db/client";
import { candidates, searchProjects } from "@/lib/db/schema";
import { tagSlug } from "@/lib/core/tags";
import { jobLocation } from "@/lib/domain/job-label";
import { listTags } from "./tags";

export interface PageOption {
  slug: string;
  display: string;
  count: number;
  kind: "page" | "candidate" | "job";
  hint?: string;
  /** Where the record itself lives, when this page is a record. */
  href?: string;
}

/** Every page in the workspace: tags, then people, then jobs. */
export function listPages(db: Db): PageOption[] {
  const out: PageOption[] = listTags(db).map((tag) => ({
    slug: tag.slug,
    display: tag.display,
    count: tag.count,
    kind: "page" as const,
  }));

  const projects = db.select().from(searchProjects).all();
  const projectName = new Map(projects.map((row) => [row.id, row.name]));

  for (const person of db.select().from(candidates).all()) {
    const slug = tagSlug(person.name);
    if (!slug) continue;
    out.push({
      slug,
      display: person.name,
      count: 0,
      kind: "candidate",
      hint: projectName.get(person.searchProjectId)?.slice(0, 28),
      href: `/searches/${person.searchProjectId}/candidates/${person.id}`,
    });
  }

  for (const project of projects) {
    const slug = tagSlug(project.name);
    if (!slug) continue;
    out.push({
      slug,
      display: project.name,
      count: 0,
      kind: "job",
      hint: jobLocation(project),
      href: `/searches/${project.id}`,
    });
  }

  return out;
}

/**
 * What a page slug turns out to be. A written name that matches a record
 * resolves to it; anything else is a tag, which is why an unmatched
 * `[[phrase]]` is never an error — it is a page nobody has filled in yet.
 */
export function resolvePage(
  db: Db,
  slug: string,
): { kind: "candidate" | "job"; display: string; href: string } | null {
  for (const page of listPages(db)) {
    if (page.slug === slug && page.href && page.kind !== "page") {
      return { kind: page.kind, display: page.display, href: page.href };
    }
  }
  return null;
}
