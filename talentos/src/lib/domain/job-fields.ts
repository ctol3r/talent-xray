/**
 * The fields that describe a job, and the choices for each.
 *
 * Dropdowns rather than free text, for three reasons that only show up later:
 * a job typed as "Permanent, full-time" and another as "perm FT" cannot be
 * filtered together; a model reading the record has to guess what the words
 * meant; and a recruiter filling in the fifth job of the day types less and
 * skips less. Every list ends with the option to say you do not know yet,
 * because a form that forces a guess collects guesses.
 *
 * Nothing here describes a person. These are attributes of the work and of
 * the employer's offer — what the job is, where it is, what it pays, what it
 * comes with. A field about the candidate would belong nowhere in this file
 * and mostly nowhere in this product (see `fair-hiring.ts`).
 */

export interface Choice {
  value: string;
  label: string;
  /** Shown under the label when the distinction is easy to get wrong. */
  hint?: string;
}

export const UNKNOWN: Choice = {
  value: "",
  label: "Not decided yet",
};

export const EMPLOYMENT_TYPES: Choice[] = [
  { value: "permanent", label: "Permanent" },
  {
    value: "fixed_term",
    label: "Fixed term",
    hint: "Employed, but with an end date",
  },
  {
    value: "contract",
    label: "Contract",
    hint: "Day rate, outside the payroll",
  },
  { value: "temporary", label: "Temporary" },
  { value: "internship", label: "Internship" },
  { value: "apprenticeship", label: "Apprenticeship" },
];

export const WORK_ARRANGEMENTS: Choice[] = [
  { value: "onsite", label: "On-site" },
  { value: "hybrid_1", label: "Hybrid — 1 day on-site" },
  { value: "hybrid_2", label: "Hybrid — 2 days on-site" },
  { value: "hybrid_3", label: "Hybrid — 3 days on-site" },
  { value: "hybrid_4", label: "Hybrid — 4 days on-site" },
  {
    value: "remote_local",
    label: "Remote, within commuting distance",
    hint: "Remote, but expected on-site sometimes",
  },
  { value: "remote_country", label: "Remote, anywhere in the country" },
  { value: "remote_global", label: "Remote, anywhere" },
];

/**
 * Full-time equivalent. Written as a number so two jobs can be compared and
 * a part-time role stops being a sentence buried in a note.
 */
export const FTE_OPTIONS: Choice[] = [
  { value: "1", label: "1.0 — full time" },
  { value: "0.9", label: "0.9 — nine-day fortnight" },
  { value: "0.8", label: "0.8 — four days" },
  { value: "0.75", label: "0.75" },
  { value: "0.6", label: "0.6 — three days" },
  { value: "0.5", label: "0.5 — half time" },
  { value: "0.4", label: "0.4 — two days" },
  { value: "0.2", label: "0.2 — one day" },
];

export const SENIORITY_LEVELS: Choice[] = [
  { value: "intern", label: "Intern" },
  { value: "entry", label: "Entry" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
  { value: "staff", label: "Staff" },
  { value: "principal", label: "Principal" },
  { value: "lead", label: "Lead" },
  { value: "manager", label: "Manager" },
  { value: "director", label: "Director" },
  { value: "vp", label: "VP" },
  { value: "executive", label: "Executive" },
  {
    value: "founding",
    label: "Founding hire",
    hint: "First in the function, whatever the level",
  },
];

/**
 * Broad enough to filter on, narrow enough to pick from a list. A job whose
 * industry is not here belongs under the closest one; the specific words go
 * in the job description, which is where a model reads them anyway.
 */
export const INDUSTRIES: Choice[] = [
  { value: "software", label: "Software and internet" },
  { value: "ai_research", label: "AI research and safety" },
  { value: "fintech", label: "Financial services and fintech" },
  { value: "healthcare", label: "Healthcare delivery" },
  { value: "biotech", label: "Biotech and pharmaceuticals" },
  { value: "medical_devices", label: "Medical devices" },
  { value: "hardware", label: "Hardware and semiconductors" },
  { value: "manufacturing", label: "Manufacturing and industrials" },
  { value: "energy", label: "Energy and utilities" },
  { value: "climate", label: "Climate and sustainability" },
  { value: "aerospace", label: "Aerospace and defence" },
  { value: "automotive", label: "Automotive and mobility" },
  { value: "construction", label: "Construction and property" },
  { value: "retail", label: "Retail and consumer goods" },
  { value: "hospitality", label: "Hospitality and food" },
  { value: "logistics", label: "Logistics and supply chain" },
  { value: "telecoms", label: "Telecoms" },
  { value: "media", label: "Media and entertainment" },
  { value: "gaming", label: "Gaming" },
  { value: "education", label: "Education" },
  { value: "professional_services", label: "Professional services" },
  { value: "legal", label: "Legal" },
  { value: "public_sector", label: "Public sector" },
  { value: "nonprofit", label: "Non-profit and NGO" },
  { value: "agriculture", label: "Agriculture and food production" },
  { value: "other", label: "Something else" },
];

export const CURRENCIES: Choice[] = [
  { value: "USD", label: "USD $" },
  { value: "GBP", label: "GBP £" },
  { value: "EUR", label: "EUR €" },
  { value: "CAD", label: "CAD $" },
  { value: "AUD", label: "AUD $" },
  { value: "CHF", label: "CHF" },
  { value: "SEK", label: "SEK" },
  { value: "SGD", label: "SGD $" },
  { value: "INR", label: "INR ₹" },
  { value: "JPY", label: "JPY ¥" },
];

export const SALARY_PERIODS: Choice[] = [
  { value: "year", label: "per year" },
  { value: "day", label: "per day" },
  { value: "hour", label: "per hour" },
];

export const JOB_PRIORITIES: Choice[] = [
  {
    value: "critical",
    label: "Critical",
    hint: "Something is broken until this is filled",
  },
  { value: "high", label: "High" },
  { value: "normal", label: "Normal" },
  { value: "backburner", label: "Back burner" },
];

/**
 * Whether the employer will sponsor a work permit. An attribute of the offer,
 * not of any candidate — it belongs on the job because it changes which
 * markets the job can be sourced in at all, and not knowing it wastes weeks.
 */
export const SPONSORSHIP_OPTIONS: Choice[] = [
  { value: "yes", label: "Sponsorship available" },
  { value: "no", label: "No sponsorship" },
  { value: "case_by_case", label: "Case by case" },
];

/**
 * Whether the manager committed to a start date, asked as its own question.
 *
 * Two answers, and the second one is not a failure state. A search with no
 * agreed date is an ordinary thing; what is not ordinary is a product
 * measuring "stalled" against a fortnight it invented and never saying so.
 */
export const START_DATE_AGREEMENTS: Choice[] = [
  {
    value: "agreed",
    label: "Yes — a start date is agreed",
    hint: "Every pace measure on this job runs against that window.",
  },
  {
    value: "not_agreed",
    label: "No date agreed yet",
    hint: "Pace is measured against an assumed fortnight, and every page that does it says so.",
  },
];

export const JOB_STATUSES: Choice[] = [
  { value: "open", label: "Open" },
  { value: "on_hold", label: "On hold" },
  { value: "closed", label: "Closed" },
];

/** Label for a stored value, so a record never renders a raw enum. */
export function labelFor(choices: Choice[], value: string | null): string {
  if (!value) return UNKNOWN.label;
  return choices.find((choice) => choice.value === value)?.label ?? value;
}

export function isValidChoice(choices: Choice[], value: string): boolean {
  return value === "" || choices.some((choice) => choice.value === value);
}

/**
 * The pay range in one line, in whichever parts are known. A range with only
 * a floor still says something useful, so a missing half is not a blank.
 */
export function salaryLine(job: {
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
}): string | null {
  const { salaryMin: min, salaryMax: max } = job;
  if (min == null && max == null) return null;
  const currency = job.salaryCurrency ?? "";
  const period = labelFor(SALARY_PERIODS, job.salaryPeriod ?? "year");
  const money = (value: number) =>
    `${currency ? `${currency} ` : ""}${value.toLocaleString("en-US")}`;
  if (min != null && max != null) {
    return `${money(min)} – ${money(max)} ${period}`;
  }
  return min != null
    ? `From ${money(min)} ${period}`
    : `Up to ${money(max!)} ${period}`;
}

/**
 * The start-date row, which is never allowed to be blank.
 *
 * A missing date used to render as a missing row, and a missing row is the
 * most convincing way there is to hide an assumption: the reader sees nothing,
 * so there is nothing to doubt, while every pace reading on the job is being
 * measured against a fortnight nobody agreed to. So the row is always there,
 * and when there is no agreed date it says which of the two situations it is
 * and what is being assumed instead.
 *
 * The two are worth telling apart. "No date agreed" is an answer somebody gave
 * at intake; "not recorded" is a job made before the question was asked. Both
 * get the fortnight, only one of them is anybody's fault, and neither is
 * dressed up as an agreement.
 */
export function startDateLine(job: {
  targetStartDate?: string | null;
  startDateAgreement?: string | null;
}): { text: string; assumed: boolean } {
  const date = (job.targetStartDate ?? "").trim();
  if (date) return { text: date, assumed: false };
  return {
    text:
      job.startDateAgreement === "not_agreed"
        ? "No date agreed — pace measured on an assumed fortnight"
        : "Not recorded — pace measured on an assumed fortnight",
    assumed: true,
  };
}
