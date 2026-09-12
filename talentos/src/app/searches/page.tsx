import { Fragment } from "react";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { listSearchProjects } from "@/lib/services/search-projects";
import { companySites } from "@/lib/services/companies";
import { CompanyMark } from "@/components/company-mark";
import { faviconsOn } from "@/lib/domain/settings-flags";
import { deskMovement } from "@/lib/services/job-movement";
import { MovementCurve } from "@/components/movement-curve";
import { Card, EmptyState, PageHeader, Tag } from "@/components/ui";
import { EMPTY_STATES } from "@/lib/domain/voice";
import { jobLocation } from "@/lib/domain/job-label";
import { JOB_STATUSES, labelFor } from "@/lib/domain/job-fields";
import { ActivityBar } from "@/components/activity-bar";
import { jobActivity } from "@/lib/services/job-activity";
import { todayKey } from "@/lib/services/daily";
import { PreviewLink } from "@/components/page-preview";
import { GroupHeading, GroupSortBar } from "@/components/group-sort-bar";
import { arrange } from "../../../artifact-src/core/facets";
import { JOB_FACETS, jobSorts, facetById, sortById } from "@/lib/domain/facets";

export const metadata = { title: "Jobs" };

export default async function SearchesPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; sort?: string }>;
}) {
  const db = getDb();
  const today = todayKey();
  const { group, sort } = await searchParams;
  const searches = await listSearchProjects(db);
  const urls = companySites(db);
  const favicons = faviconsOn();
  // Open jobs only: a closed job has stopped moving by definition, and leaving
  // them in would pile every finished search onto the quiet end and make the
  // shape a picture of history rather than of this week.
  const open = searches.filter((job) => job.status === "open");
  const movement = deskMovement(db, open);
  const byJob = new Map(movement.readings.map((r) => [r.jobId, r]));

  const now = new Date().toISOString();
  const sorts = jobSorts(now);
  const facet = facetById(JOB_FACETS, group);
  const order = sortById(sorts, sort);
  const arranged = arrange(searches, facet, order);
  const COLUMNS = 5;

  return (
    <div>
      <PageHeader
        title="💼 Jobs"
        description="One job, one workspace, intake to onboarding. Titles are unique, so a job you refer to in a note points at exactly one of these."
        actions={
          <Link
            href="/searches/new"
            className="rounded bg-accent px-3 py-1.5 text-[14px] font-medium text-canvas hover:opacity-90"
          >
            New job
          </Link>
        }
      />
      {/* Nothing open means nothing is moving, and a curve drawn over zero
          jobs is a shape with no reading. The table below still lists the
          closed ones, which is where somebody in this state is going. */}
      {open.length > 0 && (
        <div className="mb-4 flex justify-stretch sm:justify-end">
          <MovementCurve
            says={movement.says}
            median={movement.median}
            unclocked={movement.unclocked}
            ticks={open.map((job) => ({
              jobId: job.id,
              name: job.name,
              value: byJob.get(job.id)?.value ?? 0,
              says: byJob.get(job.id)?.says ?? "",
              clock: byJob.get(job.id)?.clock.says ?? "",
              unclocked: byJob.get(job.id)?.clock.agreedDays === null,
            }))}
          />
        </div>
      )}
      {searches.length === 0 ? (
        // A table with headings and no rows says "you have no jobs" in the
        // least useful way available: it looks like a page that failed to
        // load, and it offers nothing to press. The grouping controls above
        // it are worse — they are twenty ways to slice nothing.
        <Card>
          <EmptyState
            title={EMPTY_STATES.noSearches.title}
            detail={EMPTY_STATES.noSearches.detail}
          >
            <Link
              href="/searches/new"
              className="rounded bg-accent px-3 py-1.5 text-[14px] font-medium text-canvas hover:opacity-90"
            >
              Start a job
            </Link>
          </EmptyState>
        </Card>
      ) : (
        <Card>
          <GroupSortBar
            facets={JOB_FACETS.map((f) => ({
              id: f.id,
              label: f.label,
              icon: f.icon,
            }))}
            sorts={sorts.map((s) => ({
              id: s.id,
              label: s.label,
              icon: s.icon,
            }))}
            group={facet?.id ?? null}
            sort={order.id}
            noun="jobs"
            total={searches.length}
            groups={arranged.groups.length}
            overlapping={arranged.overlapping}
            notSet={arranged.notSet}
          />
          <div className="-mx-1 overflow-x-auto px-1 sm:overflow-x-visible">
            <table className="w-full min-w-[34rem] text-left text-[14px]">
              <thead>
                <tr className="border-b border-edge text-[12.5px] tracking-wider text-ink-faint uppercase [&>th]:sticky [&>th]:z-10 [&>th]:max-sm:static [&>th]:bg-panel [&>th]:top-[var(--sticky-title)]">
                  <th className="pb-2 font-medium">Title</th>
                  <th className="pb-2 font-medium">Location</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Activity</th>
                  <th className="pb-2 font-medium">Status</th>
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
                    {bucket.rows.map((search) => (
                      <tr key={search.id} className="hover:bg-panel2/40">
                        <td className="py-2.5 pr-4">
                          <PreviewLink
                            target={`job:${search.id}`}
                            href={`/searches/${search.id}`}
                            className="font-medium text-accent hover:underline"
                          >
                            {search.name}
                          </PreviewLink>
                          {search.companyName && (
                            <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-muted">
                              <CompanyMark
                                name={search.companyName}
                                url={urls.get(
                                  search.companyName.trim().toLowerCase(),
                                )}
                                favicons={favicons}
                                size={14}
                              />
                              {search.companyName}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-ink-muted">
                          {jobLocation(search)}
                        </td>
                        <td className="py-2.5 pr-4">{search.roleTitle}</td>
                        <td className="py-2.5 pr-4">
                          <ActivityBar
                            activity={jobActivity(db, search.id, today)}
                            compact
                          />
                        </td>
                        <td className="py-2.5">
                          <Tag
                            tone={
                              search.status === "open"
                                ? "ok"
                                : search.status === "on_hold"
                                  ? "warn"
                                  : "neutral"
                            }
                          >
                            {labelFor(JOB_STATUSES, search.status)}
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
