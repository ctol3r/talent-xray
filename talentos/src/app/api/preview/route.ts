import { NextResponse } from "next/server";
import { z } from "zod";
import { and, count, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  candidates,
  searchProjects,
  scorecards,
  pipelineEvents,
} from "@/lib/db/schema";
import { tagSlug, tagsIn } from "@/lib/core/tags";
import { resolvePage } from "@/lib/services/pages";
import { tagPage } from "@/lib/services/tags";
import { jobLocation } from "@/lib/domain/job-label";
import {
  labelFor,
  SENIORITY_LEVELS,
  salaryLine,
} from "@/lib/domain/job-fields";

/**
 * What a link is, without following it.
 *
 * A preview answers one question — is this worth opening — so it is small on
 * purpose: what the thing is, a line or two of substance, and how connected
 * it is. Anything longer is the page itself.
 *
 * Three kinds of target, because a link in this product is one of three
 * things: a page (a tag, or a name that turns out to be a record), a person,
 * or a job. The first version only handled the first, which meant two links
 * on a page of seventy-four previewed and the rest did nothing.
 */
const query = z.object({
  target: z
    .string()
    .min(3)
    .max(200)
    .regex(/^(tag|candidate|job):.+$/, "target must be kind:id"),
});

export interface PreviewPayload {
  target: string;
  title: string;
  kind: "tag" | "candidate" | "job";
  icon: string;
  subtitle?: string;
  href: string;
  /** Short facts, rendered as a list. */
  facts: string[];
  /** Longer lines: where a tag was written, or a person's notes. */
  lines: string[];
  /** Tags this thing carries, for the footer. */
  tags: string[];
}

function tagPreview(db: ReturnType<typeof getDb>, raw: string): PreviewPayload {
  const slug = tagSlug(raw) ?? raw;
  const record = resolvePage(db, slug);
  const page = tagPage(db, slug);
  return {
    target: `tag:${slug}`,
    title: record?.display ?? page.display,
    kind: record ? (record.kind === "candidate" ? "candidate" : "job") : "tag",
    icon: record ? (record.kind === "candidate" ? "👤" : "💼") : "🏷️",
    subtitle: `${page.mentions.length} mention${page.mentions.length === 1 ? "" : "s"}`,
    href: record?.href ?? `/tags/${encodeURIComponent(slug)}`,
    facts: [],
    lines: page.mentions
      .slice(0, 3)
      .map((mention) => `${mention.searchName} · ${mention.context}`),
    tags: page.related.slice(0, 6).map((entry) => entry.display),
  };
}

function candidatePreview(
  db: ReturnType<typeof getDb>,
  id: string,
): PreviewPayload | null {
  const person = db
    .select()
    .from(candidates)
    .where(eq(candidates.id, id))
    .get();
  if (!person) return null;
  const project = db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.id, person.searchProjectId))
    .get();
  const cards = db
    .select({ status: scorecards.status, total: count() })
    .from(scorecards)
    .where(
      and(
        eq(scorecards.candidateId, person.id),
        eq(scorecards.searchProjectId, person.searchProjectId),
      ),
    )
    .groupBy(scorecards.status)
    .all();
  const submitted =
    cards.find((card) => card.status === "submitted")?.total ?? 0;
  const draft = cards.find((card) => card.status === "draft")?.total ?? 0;
  const moves =
    db
      .select({ total: count() })
      .from(pipelineEvents)
      .where(
        and(
          eq(pipelineEvents.candidateId, person.id),
          eq(pipelineEvents.searchProjectId, person.searchProjectId),
          isNotNull(pipelineEvents.fromStage),
        ),
      )
      .get()?.total ?? 0;
  const facts = [
    person.currentTitle,
    person.currentCompany,
    person.geography,
    `Stage: ${person.stage}`,
    `Scorecards: ${submitted} submitted · ${draft} draft`,
    `Pipeline: ${moves} recorded moves`,
  ].filter((value): value is string => Boolean(value));
  return {
    target: `candidate:${id}`,
    title: person.name,
    kind: "candidate",
    icon: "👤",
    subtitle: project?.name,
    href: `/searches/${person.searchProjectId}/candidates/${person.id}`,
    facts,
    lines: [
      person.nextAction
        ? `Next: ${person.nextAction}${person.nextActionDue ? ` · due ${person.nextActionDue.slice(0, 10)}` : ""}`
        : "",
      (person.recruiterNotes ?? "").slice(0, 160),
    ].filter(Boolean),
    tags: tagsIn(person.recruiterNotes ?? "").map((tag) => tag.display),
  };
}

function jobPreview(
  db: ReturnType<typeof getDb>,
  id: string,
): PreviewPayload | null {
  const project = db
    .select()
    .from(searchProjects)
    .where(eq(searchProjects.id, id))
    .get();
  if (!project) return null;
  const people = db
    .select()
    .from(candidates)
    .where(eq(candidates.searchProjectId, id))
    .all();
  const facts = [
    project.roleTitle,
    jobLocation(project),
    labelFor(SENIORITY_LEVELS, project.seniority),
    salaryLine(project) ?? "",
    `${people.length} ${people.length === 1 ? "person" : "people"}`,
    `Status: ${project.status}`,
  ].filter((value) => value && value !== "Not decided yet");
  return {
    target: `job:${id}`,
    title: project.name,
    kind: "job",
    icon: "💼",
    subtitle: project.companyName ?? undefined,
    href: `/searches/${id}`,
    facts,
    lines: [(project.businessObjective ?? "").slice(0, 180)].filter(Boolean),
    tags: tagsIn(project.recruiterNotes ?? "").map((tag) => tag.display),
  };
}

export async function GET(request: Request) {
  const parsed = query.safeParse({
    target: new URL(request.url).searchParams.get("target") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "bad target" }, { status: 400 });
  }
  const [kind, ...rest] = parsed.data.target.split(":");
  const id = rest.join(":");
  const db = getDb();

  const payload =
    kind === "tag"
      ? tagPreview(db, id)
      : kind === "candidate"
        ? candidatePreview(db, id)
        : jobPreview(db, id);

  if (!payload) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
