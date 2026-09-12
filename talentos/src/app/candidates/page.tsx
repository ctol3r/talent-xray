import { MARKS } from "../../../artifact-src/core/marks";
import { PreviewLink } from "@/components/page-preview";
import { OpenAsPane } from "@/components/open-as-pane";
import { getDb } from "@/lib/db/client";
import { listAllCandidates } from "@/lib/services/candidates";
import { companySites } from "@/lib/services/companies";
import { CompanyMark } from "@/components/company-mark";
import { faviconsOn } from "@/lib/domain/settings-flags";
import { Card, EmptyState, PageHeader, Tag } from "@/components/ui";
import { Fragment } from "react";
import { GroupHeading, GroupSortBar } from "@/components/group-sort-bar";
import { arrange } from "../../../artifact-src/core/facets";
import {
  PERSON_FACETS,
  PERSON_SORTS,
  facetById,
  sortById,
  type PersonLike,
} from "@/lib/domain/facets";

export const metadata = { title: "Candidates" };

export default async function AllCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; sort?: string }>;
}) {
  const { group, sort } = await searchParams;
  const db = getDb();
  const rows = await listAllCandidates(db);
  const urls = companySites(db);
  const favicons = faviconsOn();

  // One shape for the facets to read, so the grouping does not have to know
  // that a person's job lives on a different table from the person.
  const people: (PersonLike & { row: (typeof rows)[number] })[] = rows.map(
    (entry) => ({
      ...entry.candidate,
      projectName: entry.projectName,
      jobPriority: entry.jobPriority,
      row: entry,
    }),
  );
  const facet = facetById(PERSON_FACETS, group);
  const order = sortById(PERSON_SORTS, sort);
  const arranged = arrange(people, facet, order);
  const COLUMNS = 4;

  return (
    <div>
      <PageHeader
        title="👥 All people"
        actions={<OpenAsPane target="people" />}
        description="Every candidate across every search. Candidates are added inside a search — evidence alignment is always search-specific."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No candidates yet"
          detail="Open a search and add candidates from its Candidates module."
        />
      ) : (
        <Card>
          <GroupSortBar
            facets={PERSON_FACETS.map((f) => ({
              id: f.id,
              label: f.label,
              icon: f.icon,
            }))}
            sorts={PERSON_SORTS.map((s) => ({
              id: s.id,
              label: s.label,
              icon: s.icon,
            }))}
            group={facet?.id ?? null}
            sort={order.id}
            noun="people"
            total={people.length}
            groups={arranged.groups.length}
            overlapping={arranged.overlapping}
            notSet={arranged.notSet}
          />
          <div className="-mx-1 overflow-x-auto px-1 sm:overflow-x-visible">
            <table className="w-full min-w-[34rem] text-left text-[14px]">
              <thead>
                <tr className="border-b border-edge text-[12.5px] tracking-wider text-ink-faint uppercase [&>th]:sticky [&>th]:z-10 [&>th]:max-sm:static [&>th]:bg-panel [&>th]:top-[var(--sticky-title)]">
                  <th className="pb-2 font-medium">Candidate</th>
                  <th className="pb-2 font-medium">Search</th>
                  <th className="pb-2 font-medium">Stage</th>
                  <th className="pb-2 font-medium">Disposition</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {arranged.groups.map((bucket) => (
                  <Fragment key={bucket.key || "all"}>
                    {facet && (
                      <GroupHeading
                        icon={facet.icon}
                        label={bucket.label}
                        count={bucket.rows.length}
                        columns={COLUMNS}
                      />
                    )}
                    {bucket.rows.map(({ row: { candidate, projectName } }) => (
                      <tr key={candidate.id} className="hover:bg-panel2/40">
                        <td className="py-2.5 pr-4">
                          <PreviewLink
                            target={`candidate:${candidate.id}`}
                            href={`/searches/${candidate.searchProjectId}/candidates/${candidate.id}`}
                            className="font-medium text-accent hover:underline"
                          >
                            <span aria-hidden className="mr-1">
                              {MARKS.candidate}
                            </span>
                            {candidate.name}
                          </PreviewLink>
                          <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-muted">
                            {candidate.currentCompany && (
                              <CompanyMark
                                name={candidate.currentCompany}
                                url={urls.get(
                                  candidate.currentCompany.trim().toLowerCase(),
                                )}
                                favicons={favicons}
                                size={14}
                              />
                            )}
                            {[candidate.currentTitle, candidate.currentCompany]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-ink-muted">
                          {projectName}
                        </td>
                        <td className="py-2.5 pr-4">
                          <Tag>{candidate.stage.replaceAll("_", " ")}</Tag>
                        </td>
                        <td className="py-2.5">
                          <Tag
                            tone={
                              candidate.disposition === "hired"
                                ? "ok"
                                : candidate.disposition === "active"
                                  ? "neutral"
                                  : "warn"
                            }
                          >
                            {candidate.disposition.replaceAll("_", " ")}
                          </Tag>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
