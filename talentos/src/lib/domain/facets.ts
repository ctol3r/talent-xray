/**
 * Every attribute a job or a person can be read through.
 *
 * The mechanics are in `artifact-src/core/facets.ts` and know nothing about
 * either. This file is the list: one entry per attribute, next to the
 * vocabulary that defines it, so a new field on a job becomes one entry here
 * rather than a change to how grouping works.
 *
 * `tests/unit/facets.test.ts` checks this list against the columns on the
 * table. A column is either faceted or named in `NOT_FACETED` with the reason
 * — because "group by any attribute" quietly becomes "group by the nine I
 * remembered" the first time somebody adds a field, and a list that silently
 * lacks the attribute you are looking for is worse than one that never
 * offered grouping at all.
 *
 * Nothing here reads a person's characteristics. The job facets describe the
 * work and the employer's offer; the people facets describe where somebody is
 * in a process, what they have told us, and what a page said about their work.
 * See `fair-hiring.ts`.
 */
import {
  byDueDate,
  byRecency,
  byVocabulary,
  type FacetSpec,
  type SortSpec,
} from "../../../artifact-src/core/facets";
import { jobClock, timePressure } from "../../../artifact-src/core/clock";
import { tagsIn } from "@/lib/core/tags";
import {
  EMPLOYMENT_TYPES,
  FTE_OPTIONS,
  INDUSTRIES,
  JOB_PRIORITIES,
  JOB_STATUSES,
  SENIORITY_LEVELS,
  SPONSORSHIP_OPTIONS,
  WORK_ARRANGEMENTS,
  type Choice,
} from "./job-fields";
import { jobLocation } from "./job-label";

/**
 * A facet, plus the columns it reads.
 *
 * `covers` exists for the test: it is how a new column on the table is forced
 * to be either grouped by something or explicitly excluded with a reason. It
 * sits on the facet rather than in a second list because two lists that have to
 * agree are two lists that will not.
 */
interface Faceted<T> extends FacetSpec<T> {
  covers: readonly string[];
}

function values(choices: Choice[]): string[] {
  return choices.map((choice) => choice.value).filter(Boolean);
}

function labeller(choices: Choice[]): (value: string) => string {
  const byValue = new Map(
    choices.map((choice) => [choice.value, choice.label]),
  );
  return (value) => byValue.get(value) ?? value;
}

/** One or none, as a facet's value list. */
function one(value: string | null | undefined): string[] {
  const trimmed = (value ?? "").trim();
  return trimmed ? [trimmed] : [];
}

// ---------------------------------------------------------------------------
// jobs

export interface JobLike {
  id: string;
  name: string;
  roleTitle: string;
  companyName?: string | null;
  geography?: string | null;
  country?: string | null;
  region?: string | null;
  industry?: string | null;
  seniority?: string | null;
  priority?: string | null;
  status: string;
  fte?: string | null;
  employmentType?: string | null;
  workArrangement?: string | null;
  sponsorship?: string | null;
  jurisdiction?: string | null;
  openings?: number | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  targetStartDate?: string | null;
  startDateAgreement?: string | null;
  recruiterNotes?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

/**
 * Salary as a band rather than a number, because grouping by an exact figure
 * makes one group per job. The boundaries are round numbers in the job's own
 * currency and are not converted between currencies — a rate nobody recorded
 * is not a rate this product should invent, so the currency is shown with the
 * band and two currencies simply make two groups.
 */
export function salaryBand(job: JobLike): string[] {
  const top = job.salaryMax ?? job.salaryMin;
  if (typeof top !== "number" || !Number.isFinite(top) || top <= 0) return [];
  const currency = job.salaryCurrency ?? "";
  const edges = [50_000, 80_000, 120_000, 180_000, 250_000];
  const index = edges.findIndex((edge) => top < edge);
  const band =
    index === -1
      ? "250k and up"
      : index === 0
        ? "under 50k"
        : `${edges[index - 1] / 1000}k–${edges[index] / 1000}k`;
  return [currency ? `${band} ${currency.toUpperCase()}` : band];
}

export const JOB_FACETS: Faceted<JobLike>[] = [
  {
    id: "priority",
    label: "Priority",
    icon: "🔥",
    covers: ["priority"],
    valuesOf: (job) => one(job.priority),
    labelOf: labeller(JOB_PRIORITIES),
    order: values(JOB_PRIORITIES),
  },
  {
    id: "status",
    label: "Status",
    icon: "🚦",
    covers: ["status"],
    valuesOf: (job) => one(job.status),
    labelOf: labeller(JOB_STATUSES),
    order: values(JOB_STATUSES),
  },
  {
    id: "industry",
    label: "Industry",
    icon: "🏭",
    covers: ["industry"],
    valuesOf: (job) => one(job.industry),
    labelOf: labeller(INDUSTRIES),
    order: values(INDUSTRIES),
  },
  {
    id: "location",
    label: "Location",
    icon: "📍",
    covers: ["geography"],
    // The line the job page shows, so two jobs written up the same way group
    // together and the group header reads the way the row does.
    valuesOf: (job) => one(jobLocation(job)),
  },
  {
    id: "country",
    label: "Country",
    icon: "🌍",
    covers: ["country"],
    valuesOf: (job) => one(job.country),
  },
  {
    id: "region",
    label: "Region",
    icon: "🗺️",
    covers: ["region"],
    valuesOf: (job) => one(job.region),
  },
  {
    id: "role",
    label: "Role",
    icon: "🧰",
    covers: ["roleTitle"],
    valuesOf: (job) => one(job.roleTitle),
  },
  {
    id: "company",
    label: "Company",
    icon: "🏢",
    valuesOf: (job) => one(job.companyName),
    covers: ["companyName"],
  },
  {
    id: "seniority",
    label: "Seniority",
    icon: "📶",
    covers: ["seniority"],
    valuesOf: (job) => one(job.seniority),
    labelOf: labeller(SENIORITY_LEVELS),
    order: values(SENIORITY_LEVELS),
  },
  {
    id: "fte",
    label: "FTE",
    icon: "⏱️",
    covers: ["fte"],
    valuesOf: (job) => one(job.fte),
    labelOf: labeller(FTE_OPTIONS),
    order: values(FTE_OPTIONS),
  },
  {
    id: "employment",
    label: "Employment type",
    icon: "📄",
    covers: ["employmentType"],
    valuesOf: (job) => one(job.employmentType),
    labelOf: labeller(EMPLOYMENT_TYPES),
    order: values(EMPLOYMENT_TYPES),
  },
  {
    id: "arrangement",
    label: "Work arrangement",
    icon: "🏠",
    covers: ["workArrangement"],
    valuesOf: (job) => one(job.workArrangement),
    labelOf: labeller(WORK_ARRANGEMENTS),
    order: values(WORK_ARRANGEMENTS),
  },
  {
    id: "sponsorship",
    label: "Sponsorship",
    icon: "🛂",
    covers: ["sponsorship"],
    valuesOf: (job) => one(job.sponsorship),
    labelOf: labeller(SPONSORSHIP_OPTIONS),
    order: values(SPONSORSHIP_OPTIONS),
  },
  {
    id: "salary",
    label: "Salary band",
    icon: "💰",
    covers: ["salaryMin", "salaryMax", "salaryCurrency"],
    valuesOf: salaryBand,
  },
  {
    id: "openings",
    label: "Openings",
    icon: "🔢",
    covers: ["openings"],
    valuesOf: (job) =>
      typeof job.openings === "number" ? [String(job.openings)] : [],
  },
  {
    id: "jurisdiction",
    label: "Jurisdiction",
    icon: "⚖️",
    covers: ["jurisdiction"],
    valuesOf: (job) => one(job.jurisdiction),
  },
  {
    id: "start",
    label: "Target start",
    icon: "📆",
    covers: ["targetStartDate"],
    // By month: one group per exact date is one group per job.
    valuesOf: (job) => one(job.targetStartDate?.slice(0, 7)),
  },
  {
    /**
     * Which half of the desk is measured against a window somebody agreed, and
     * which half against a fortnight the product assumed.
     *
     * Worth a group of its own because it decides how much every pace reading
     * on those jobs is worth. "Not recorded" is kept apart from "no date
     * agreed": one is a job made before the question was asked, the other is
     * an answer, and only the second one is a conversation that has happened.
     */
    id: "clock",
    label: "Start date agreed",
    icon: "⏳",
    covers: ["startDateAgreement"],
    valuesOf: (job) =>
      one(
        job.targetStartDate?.trim()
          ? "Agreed"
          : job.startDateAgreement === "not_agreed"
            ? "No date agreed — assumed fortnight"
            : "Not recorded — assumed fortnight",
      ),
  },
  {
    id: "tags",
    label: "Tags",
    icon: "🏷️",
    covers: ["recruiterNotes"],
    // A job's tags are the words written in its notes — the same reading the
    // tag pages and the preview card already use. A job wearing three tags is
    // in three groups, which is what a tag is for.
    valuesOf: (job) =>
      tagsIn(job.recruiterNotes ?? "").map((tag) => tag.display),
  },
];

/**
 * Columns nothing groups by, and why. Checked by the test, so a new column
 * has to be dealt with rather than forgotten.
 */
export const JOB_NOT_FACETED: Record<string, string> = {
  id: "an identifier groups every row on its own",
  name: "the title is unique, so grouping by it is the list back again",
  companyId: "the company's name is the facet; the key is not for reading",
  compensationNote: "free text, and one group per job",
  salaryPeriod: "part of the band's meaning, not a question anybody asks alone",
  businessObjective: "free text, and one group per job",
  surfaceOptIns: "a setting, not an attribute of the work",
  createdAt: "a sort, not a group",
  updatedAt: "a sort, not a group",
};

/**
 * How far through its agreed window a job is: 0 with all of it ahead, 1 at the
 * agreed date, more past it.
 *
 * `now` is passed in rather than read here so a sort is deterministic for the
 * whole of one render, and so a test can say what day it is.
 */
export function jobPressure(job: JobLike, now: string): number {
  return timePressure(jobClock(job.createdAt ?? now, job.targetStartDate, now));
}

/**
 * The orders a list of jobs can be put in.
 *
 * A function of `now` rather than a constant, because two of these ask how far
 * through its agreed window a job is, and that is a different answer tomorrow.
 */
export function jobSorts(now: string): SortSpec<JobLike>[] {
  return [
    {
      id: "priority",
      label: "Priority",
      icon: "🔥",
      /**
       * The priority somebody set, and then — within it — how pressed the job
       * is against the date agreed at intake.
       *
       * Both halves are needed and neither replaces the other. The stated
       * priority is a human's explicit call and nothing here overrides it; the
       * agreed date is what makes two jobs at the same priority orderable at
       * all, because a critical role wanted in a fortnight and a critical role
       * wanted next year are not the same amount of critical today.
       */
      compare: (a, b) =>
        byVocabulary(values(JOB_PRIORITIES))(a.priority, b.priority) ||
        jobPressure(b, now) - jobPressure(a, now) ||
        byRecency(a.updatedAt, b.updatedAt),
    },
    {
      id: "pressure",
      label: "Against the agreed date",
      icon: "⏳",
      // Most pressed first, which is the order somebody with a full desk and
      // an hour to spend actually wants.
      compare: (a, b) => jobPressure(b, now) - jobPressure(a, now),
    },
    {
      id: "recent",
      label: "Recently changed",
      icon: "🕰️",
      compare: (a, b) => byRecency(a.updatedAt, b.updatedAt),
    },
    {
      id: "start",
      label: "Target start",
      icon: "📆",
      compare: (a, b) => byDueDate(a.targetStartDate, b.targetStartDate),
    },
    {
      id: "name",
      label: "Title",
      icon: "🔤",
      compare: (a, b) => a.name.localeCompare(b.name),
    },
  ];
}

// ---------------------------------------------------------------------------
// people

export interface PersonLike {
  id: string;
  name: string;
  searchProjectId: string;
  projectName?: string | null;
  /** The priority of the job they are being considered for. See the sort. */
  jobPriority?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  geography?: string | null;
  stage: string;
  disposition: string;
  nextAction?: string | null;
  nextActionDue?: string | null;
  recruiterNotes?: string | null;
  noticeResolution?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
}

function words(value: string): string {
  return value.replaceAll("_", " ");
}

export const PERSON_FACETS: Faceted<PersonLike>[] = [
  {
    id: "job",
    label: "Job",
    icon: "💼",
    covers: ["searchProjectId"],
    valuesOf: (person) => one(person.projectName),
  },
  {
    id: "priority",
    label: "Job priority",
    icon: "🔥",
    covers: [],
    // The job's, said as the job's. A person does not have a priority in this
    // product and inventing one per person would be a score nobody set.
    valuesOf: (person) => one(person.jobPriority),
    labelOf: labeller(JOB_PRIORITIES),
    order: values(JOB_PRIORITIES),
  },
  {
    id: "stage",
    label: "Stage",
    icon: "🪜",
    covers: ["stage"],
    valuesOf: (person) => one(person.stage),
    labelOf: words,
  },
  {
    id: "disposition",
    label: "Disposition",
    icon: "🎯",
    covers: ["disposition"],
    valuesOf: (person) => one(person.disposition),
    labelOf: words,
  },
  {
    id: "location",
    label: "Location",
    icon: "📍",
    valuesOf: (person) => one(person.geography),
    covers: ["geography"],
  },
  {
    id: "company",
    label: "Company",
    icon: "🏢",
    valuesOf: (person) => one(person.currentCompany),
    covers: ["currentCompany"],
  },
  {
    id: "title",
    label: "Title",
    icon: "🧰",
    valuesOf: (person) => one(person.currentTitle),
    covers: ["currentTitle"],
  },
  {
    id: "due",
    label: "Next action due",
    icon: "⏰",
    covers: ["nextActionDue"],
    valuesOf: (person) => one(person.nextActionDue?.slice(0, 10)),
  },
  {
    id: "notice",
    label: "Notice",
    icon: "📬",
    covers: ["noticeResolution"],
    valuesOf: (person) => one(person.noticeResolution),
    labelOf: words,
  },
  {
    id: "tags",
    label: "Tags",
    icon: "🏷️",
    covers: ["recruiterNotes"],
    valuesOf: (person) =>
      tagsIn(person.recruiterNotes ?? "").map((tag) => tag.display),
  },
];

export const PERSON_NOT_FACETED: Record<string, string> = {
  id: "an identifier groups every row on its own",
  name: "one group per person is the list back again",
  hmFeedback: "entries with their own evidence, read on the person's page",
  nextAction: "free text, and one group per person",
  resumeText: "a document, not an attribute",
  compensationNote: "free text, and one group per person",
  profile: "the payload the person's page reads; not one value to group on",
  noticeResolvedAt: "a date on the notice, which is itself the facet",
  noticeNote: "free text, and one group per person",
  createdAt: "a sort, not a group",
  updatedAt: "a sort, not a group",
};

export const PERSON_SORTS: SortSpec<PersonLike>[] = [
  {
    id: "priority",
    label: "Priority (the job's)",
    icon: "🔥",
    /**
     * A person has no priority of their own here, and a derived one would be a
     * score nobody set. What exists is the priority of the job they are being
     * considered for, and after that whether something is due — which is the
     * order somebody actually works a list in.
     */
    compare: (a, b) =>
      byVocabulary(values(JOB_PRIORITIES))(a.jobPriority, b.jobPriority) ||
      byDueDate(a.nextActionDue, b.nextActionDue) ||
      byRecency(a.updatedAt, b.updatedAt),
  },
  {
    id: "due",
    label: "Next action due",
    icon: "⏰",
    compare: (a, b) => byDueDate(a.nextActionDue, b.nextActionDue),
  },
  {
    id: "recent",
    label: "Recently changed",
    icon: "🕰️",
    compare: (a, b) => byRecency(a.updatedAt, b.updatedAt),
  },
  {
    id: "name",
    label: "Name",
    icon: "🔤",
    compare: (a, b) => a.name.localeCompare(b.name),
  },
];

export function facetById<T>(
  facets: FacetSpec<T>[],
  id: string | null | undefined,
): FacetSpec<T> | null {
  return facets.find((facet) => facet.id === id) ?? null;
}

export function sortById<T>(
  sorts: SortSpec<T>[],
  id: string | null | undefined,
): SortSpec<T> {
  // Priority is the default because it is the one order that answers "what
  // should I do next" rather than "what happened last".
  return sorts.find((sort) => sort.id === id) ?? sorts[0];
}
