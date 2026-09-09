import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getDashboardData } from "@/lib/services/search-projects";
import { dailyWorkspace, todayKey } from "@/lib/services/daily";
import { listTasks } from "@/lib/services/workflow";
import { listPages } from "@/lib/services/pages";
import { deskElapsed } from "@/lib/services/milestones";
import { QuickNote } from "@/components/quick-note";
import { TaskForm } from "@/components/task-controls";
import { TaskList } from "@/components/task-list";
import { OpenAsPane } from "@/components/open-as-pane";
import { Card, EmptyState, PageHeader, Tag } from "@/components/ui";
import { JOB_STATUSES, labelFor } from "@/lib/domain/job-fields";
import { EMPTY_STATES } from "@/lib/domain/voice";
import { WINDOW_DAYS, sayDays } from "../../../artifact-src/core/milestones";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const db = getDb();
  const data = await getDashboardData(db);
  const { followUpsDue, candidatesNeedingReview, openTasks } = data.today;
  // The two things a recruiter reaches for first thing: what they wrote, and
  // what they owe. Both are here rather than a click away, because a note you
  // have to navigate to is a note you write on the days you would have anyway.
  const day = todayKey();
  const today = dailyWorkspace(db, day);
  const tasks = await listTasks(db);
  const pages = listPages(db);
  // Same scope as everything else on this page: every job in the workspace,
  // because nothing here is filtered. Passed in rather than assumed, so a
  // filter added later narrows the medians with the rest of the page instead
  // of quietly leaving them answering about the whole desk.
  const elapsed = await deskElapsed(db, data.allJobIds);

  return (
    <div>
      <PageHeader
        title="🏠 Dashboard"
        description="What you wrote, what you owe, and the next best action for each job."
        actions={<OpenAsPane target="dashboard" />}
      />
      {/*
        Above everything and across the whole width. A note in a column beside
        five other cards is a note you scroll past; the first thing the day
        asks is what you are writing down.
      */}
      <Card
        className="mb-4"
        title={
          <span className="flex items-baseline justify-between gap-2">
            <span>📝 {today.title}</span>
            <Link href="/notes" className="text-[12px] font-normal text-accent">
              all notes →
            </Link>
          </span>
        }
      >
        <QuickNote day={day} initial={today.note} pages={pages} />
      </Card>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="🎯 Next best actions">
            {data.actionsByProject.length === 0 ? (
              <p className="text-[14px] text-ink-muted">
                Nothing urgent. All open searches are in a healthy state.
              </p>
            ) : (
              <div className="space-y-4">
                {data.actionsByProject.map((entry) => (
                  <div key={entry.projectId}>
                    <Link
                      href={`/searches/${entry.projectId}`}
                      className="text-[14px] font-medium text-accent hover:underline"
                    >
                      {entry.projectName}
                    </Link>
                    <ul className="mt-1.5 space-y-1.5">
                      {entry.actions.map((action) => (
                        <li key={action.id}>
                          <Link
                            href={action.href}
                            className="flex items-start gap-2 rounded border border-edge bg-panel2/50 px-3 py-2 hover:border-edge2"
                          >
                            <Tag
                              tone={
                                action.priority === 1
                                  ? "bad"
                                  : action.priority === 2
                                    ? "warn"
                                    : "neutral"
                              }
                            >
                              P{action.priority}
                            </Tag>
                            <span className="min-w-0">
                              <span className="block text-[14px] font-medium">
                                {action.title}
                              </span>
                              <span className="block text-[13px] text-ink-muted">
                                {action.detail}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
          <Card title="💼 Open jobs">
            {data.activeSearches.length === 0 ? (
              // "No open jobs" is now two different facts: a desk that has
              // not started, and a desk that has finished everything. Telling
              // them apart matters — the second one has all its work still on
              // file, and saying "create your first search" to somebody with
              // twelve closed jobs reads as if the software lost them.
              <EmptyState
                title={
                  data.closedSearches > 0
                    ? EMPTY_STATES.allJobsClosed.title
                    : EMPTY_STATES.noSearches.title
                }
                detail={
                  data.closedSearches > 0
                    ? EMPTY_STATES.allJobsClosed.detail
                    : EMPTY_STATES.noSearches.detail
                }
              >
                <Link
                  href="/searches/new"
                  className="rounded bg-accent px-3 py-1.5 text-[14px] font-medium text-canvas"
                >
                  {data.closedSearches > 0 ? "Start another" : "Start a job"}
                </Link>
                {data.closedSearches > 0 && (
                  <Link
                    href="/searches"
                    className="rounded border border-edge2 px-3 py-1.5 text-[14px] text-ink-muted hover:bg-panel2"
                  >
                    {data.closedSearches} on file →
                  </Link>
                )}
              </EmptyState>
            ) : (
              <ul className="divide-y divide-edge">
                {data.activeSearches.map((search) => (
                  <li key={search.id}>
                    <Link
                      href={`/searches/${search.id}`}
                      className="flex items-center justify-between gap-4 py-2.5 hover:bg-panel2/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[14.5px] font-medium">
                          {search.name}
                        </span>
                        <span className="block text-[13px] text-ink-muted">
                          {search.roleTitle}
                          {search.geography ? ` · ${search.geography}` : ""}
                        </span>
                      </span>
                      <Tag>{labelFor(JOB_STATUSES, search.status)}</Tag>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="📅 Today">
            <div className="space-y-3 text-[14px]">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Follow-ups due</span>
                <Tag tone={followUpsDue.length > 0 ? "bad" : "neutral"}>
                  {followUpsDue.length}
                </Tag>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">
                  Candidates awaiting review
                </span>
                <Tag tone={candidatesNeedingReview > 0 ? "warn" : "neutral"}>
                  {candidatesNeedingReview}
                </Tag>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Open tasks</span>
                <Tag>{openTasks.length}</Tag>
              </div>
              {/*
                The three elapsed-day medians, in the same card as the counts
                rather than a section of their own — they answer the same
                question the counts do, which is how the desk is running, and a
                second panel would imply a second subject.

                Every one is measured between two recorded events. Where there
                are fewer than three finished intervals in the window the count
                is shown and the median is not: a median of one job is that
                job, and printing it to a decimal place would dress it up as a
                measurement.
              */}
              <div className="space-y-2 border-t border-edge pt-3">
                <p className="text-[12.5px] text-ink-faint">
                  Median elapsed days, last {WINDOW_DAYS} days, across all{" "}
                  {elapsed.jobsInScope}{" "}
                  {elapsed.jobsInScope === 1 ? "job" : "jobs"}. Measured between
                  recorded events, never estimated.
                </p>
                {elapsed.readings.map((reading) => (
                  <div
                    key={reading.id}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="text-[13.5px] text-ink-muted">
                      {reading.label}
                    </span>
                    {reading.enough ? (
                      <span className="shrink-0 text-[13.5px] whitespace-nowrap">
                        <span className="font-medium text-ink">
                          {sayDays(reading.days!)}
                        </span>
                        <span className="ml-1.5 text-ink-faint">
                          n={reading.n}
                        </span>
                      </span>
                    ) : (
                      <span className="shrink-0 text-right text-[12.5px] text-ink-faint">
                        not enough closed searches yet
                        <span className="ml-1.5">n={reading.n}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>
          {followUpsDue.length > 0 && (
            <Card title="⏰ Follow-ups due">
              <ul className="space-y-1.5">
                {followUpsDue.map(({ candidate, projectName }) => (
                  <li key={candidate.id}>
                    <Link
                      href={`/searches/${candidate.searchProjectId}/candidates/${candidate.id}`}
                      className="block rounded border border-edge bg-panel2/50 px-3 py-2 hover:border-edge2"
                    >
                      <span className="block text-[14px] font-medium">
                        {candidate.name}
                      </span>
                      <span className="block text-[13px] text-ink-muted">
                        {candidate.nextAction ?? "Follow up"} · {projectName}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title={`✅ Tasks (${tasks.open} open)`}>
            <TaskForm />
            <div className="mt-3">
              <TaskList
                olderDone={tasks.olderDone}
                tasks={tasks.rows.map((task) => ({
                  id: task.id,
                  title: task.title,
                  dueAt: task.dueAt,
                  searchProjectId: task.searchProjectId,
                  done: task.status === "done",
                }))}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
