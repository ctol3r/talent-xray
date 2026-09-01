import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getDashboardData } from "@/lib/services/search-projects";
import { Card, EmptyState, PageHeader, Tag } from "@/components/ui";

export default async function DashboardPage() {
  const data = await getDashboardData(getDb());
  const { followUpsDue, candidatesNeedingReview, openTasks } = data.today;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Active searches, what needs you today, and the next best action for each search."
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="Next best actions">
            {data.actionsByProject.length === 0 ? (
              <p className="text-[13px] text-ink-muted">
                Nothing urgent. All open searches are in a healthy state.
              </p>
            ) : (
              <div className="space-y-4">
                {data.actionsByProject.map((entry) => (
                  <div key={entry.projectId}>
                    <Link
                      href={`/searches/${entry.projectId}`}
                      className="text-[13px] font-medium text-accent hover:underline"
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
                              <span className="block text-[13px] font-medium">
                                {action.title}
                              </span>
                              <span className="block text-[12px] text-ink-muted">
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
          <Card title="Active searches">
            {data.activeSearches.length === 0 ? (
              <EmptyState title="No open searches">
                <Link
                  href="/searches/new"
                  className="rounded bg-accent px-3 py-1.5 text-[13px] font-medium text-canvas"
                >
                  Create your first search
                </Link>
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
                        <span className="block truncate text-[13.5px] font-medium">
                          {search.name}
                        </span>
                        <span className="block text-[12px] text-ink-muted">
                          {search.roleTitle}
                          {search.geography ? ` · ${search.geography}` : ""}
                        </span>
                      </span>
                      <Tag>{search.status}</Tag>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Today">
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Follow-ups due</span>
                <Tag tone={followUpsDue.length > 0 ? "bad" : "neutral"}>
                  {followUpsDue.length}
                </Tag>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Candidates awaiting review</span>
                <Tag tone={candidatesNeedingReview > 0 ? "warn" : "neutral"}>
                  {candidatesNeedingReview}
                </Tag>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Open tasks</span>
                <Tag>{openTasks.length}</Tag>
              </div>
            </div>
          </Card>
          {followUpsDue.length > 0 && (
            <Card title="Follow-ups due">
              <ul className="space-y-1.5">
                {followUpsDue.map(({ candidate, projectName }) => (
                  <li key={candidate.id}>
                    <Link
                      href={`/searches/${candidate.searchProjectId}/candidates/${candidate.id}`}
                      className="block rounded border border-edge bg-panel2/50 px-3 py-2 hover:border-edge2"
                    >
                      <span className="block text-[13px] font-medium">
                        {candidate.name}
                      </span>
                      <span className="block text-[12px] text-ink-muted">
                        {candidate.nextAction ?? "Follow up"} · {projectName}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card title="Open tasks">
            {openTasks.length === 0 ? (
              <p className="text-[13px] text-ink-muted">No open tasks.</p>
            ) : (
              <ul className="space-y-1 text-[13px]">
                {openTasks.slice(0, 8).map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{task.title}</span>
                    {task.dueAt && (
                      <span className="shrink-0 text-[11.5px] text-ink-faint">
                        {new Date(task.dueAt).toLocaleDateString()}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
