/**
 * How a job is named and shown.
 *
 * Two decisions, and both are about a recruiter with fifteen open jobs.
 *
 * A job carries its own title, typed by you, rather than being generated
 * from company and role — because "Founding Recruiter" at two companies is
 * two jobs, and "Senior Engineer (Payments, the one Priya asked for)" is a
 * title only a person can write. That title must be unique in the workspace,
 * because a list with two identically named rows is a list you cannot use;
 * `[[a title]]` in a note would be ambiguous, and the recall menu would show
 * two rows nobody can tell apart.
 *
 * It is then always shown with its location. Location is what separates two
 * jobs faster than anything else on the record, which is why it earns the
 * second line rather than the industry or the seniority.
 */

export interface JobLike {
  name: string;
  geography?: string | null;
  companyName?: string | null;
  roleTitle?: string;
}

/** Comparison form: case, spacing and punctuation are not meaningful. */
export function jobTitleKey(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[‐-―]/gu, "-")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function sameJobTitle(a: string, b: string): boolean {
  return jobTitleKey(a) === jobTitleKey(b);
}

/** The second line: where the job is, or an honest gap. */
export function jobLocation(job: JobLike): string {
  const place = job.geography?.trim();
  return place && place.length > 0 ? place : "Location not set";
}

/** One line, for a list or a menu row. */
export function jobLabel(job: JobLike): string {
  return `${job.name.trim()} · ${jobLocation(job)}`;
}

/**
 * The message shown when a title is taken. Names the other job, because
 * "already exists" without saying which one is a puzzle rather than an error.
 */
export function duplicateJobTitleMessage(taken: string): string {
  return `A job called "${taken}" already exists. Titles have to be unique so a list of jobs is readable and [[a title]] in a note points at one job. Add what makes this one different — the team, the location, or who asked for it.`;
}
