import Link from "next/link";
import { FIELD_ALIASES } from "@/lib/sourcing/query-language";

/**
 * What sourcing understands, and how to say it.
 *
 * This page used to own a query box. It does not any more: the command menu
 * is the one place anything is typed, and it decides on the words alone
 * whether they are a jump, a filter, a brief or a question. A second box here
 * would be a second grammar to keep in step, and a recruiter who learned to
 * type a brief on this page would find nothing to type it into anywhere else.
 *
 * What stays is the part that was never the box: the filters, what each one
 * means, and four briefs worth stealing. They are links now rather than
 * things that fill a field, so reading one and running it is one gesture.
 */

const FIELD_HELP: { field: string; example: string; means: string }[] = [
  {
    field: "skill:",
    example: 'skill:"battery systems"',
    means: "a capability, expanded through the ontology",
  },
  { field: "title:", example: 'title:"head of"', means: "a job title held" },
  { field: "org:", example: "org:stripe", means: "an employer or institution" },
  {
    field: "loc:",
    example: 'loc:"united kingdom"',
    means: "a place — cities answer their countries",
  },
  { field: "seniority:", example: "seniority:director", means: "career scope" },
  {
    field: "industry:",
    example: "industry:healthcare",
    means: "adds that sector's vocabulary",
  },
  {
    field: "has:",
    example: "has:email",
    means: "must hold a contact route or artifact",
  },
  {
    field: "artifact:",
    example: "artifact:cv",
    means: "narrows to one kind of evidence",
  },
  { field: "filetype:", example: "filetype:pdf", means: "document format" },
  {
    field: "site:",
    example: "-site:linkedin.com",
    means: "restrict or exclude a domain",
  },
  {
    field: "after: / before:",
    example: "after:2y",
    means: "a time window; undated evidence is kept",
  },
  {
    field: '"…" and -',
    example: '"motion planning" -recruiter',
    means: "an exact phrase; an exclusion",
  },
  {
    field: "OR",
    example: "perception OR lidar",
    means: "alternatives, not a second requirement",
  },
];

const EXAMPLES = [
  'skill:robotics loc:"united kingdom" has:email',
  "Find technical recruiters who have recruited robotics engineers in the Bay Area",
  'skill:"battery systems" industry:automotive seniority:director',
  'title:"principal investigator" artifact:publication after:2022',
];

/** `/sourcing`, carrying a brief and whether the structured sources answer. */
function sourcingHref(query: string, live: boolean): string {
  const params = new URLSearchParams({ q: query });
  if (live) params.set("live", "1");
  return `/sourcing?${params.toString()}`;
}

export function SourcingLegend({
  query,
  live = false,
}: {
  /** The brief that produced what is on screen, if there is one. */
  query: string;
  live?: boolean;
}) {
  const fieldCount = new Set(Object.values(FIELD_ALIASES)).size;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
        {query && (
          <Link
            href={sourcingHref(query, !live)}
            data-testid="live-toggle"
            className={`rounded border px-2 py-0.5 ${
              live
                ? "border-accent/40 bg-accent-soft text-accent"
                : "border-edge2 hover:text-ink"
            }`}
          >
            🛰️ {live ? "asking" : "also ask"} the structured sources
          </Link>
        )}
        <Link href="/sourcing/review" className="hover:text-ink">
          ⚖️ Merges awaiting review
        </Link>
      </div>

      <details className="rounded border border-edge2 bg-panel2 p-3">
        <summary className="cursor-pointer text-[12px] text-ink-muted">
          {fieldCount} filters, and four briefs worth stealing
        </summary>
        <p className="mt-2 mb-2 text-[12px] text-ink-muted">
          Bare words are keywords, and prose works: a place or an occupation
          written in a sentence fills the same field the filter does. An unknown
          filter becomes a keyword rather than an error.
        </p>
        <ul className="mb-3 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <li key={example}>
              <Link
                href={sourcingHref(example, live)}
                title={example}
                className="block max-w-[22rem] truncate rounded border border-edge2 px-2 py-0.5 font-mono text-[12px] text-ink-muted hover:text-ink"
              >
                {example}
              </Link>
            </li>
          ))}
        </ul>
        <table className="w-full text-[12px]">
          <tbody>
            {FIELD_HELP.map((row) => (
              <tr key={row.field} className="align-top">
                <td className="w-28 py-0.5 pr-2 font-mono text-accent">
                  {row.field}
                </td>
                <td className="w-56 py-0.5 pr-2 font-mono text-ink-muted">
                  {row.example}
                </td>
                <td className="py-0.5 text-ink-muted">{row.means}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
