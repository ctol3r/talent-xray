import Link from "next/link";
import { getDb } from "@/lib/db/client";
import {
  buildProjectSnapshot,
  getNextBestActions,
} from "@/lib/services/search-projects";
import { getRoleIntelligence } from "@/lib/services/artifacts";
import { Card, KeyValue, PageHeader, Tag } from "@/components/ui";
import { getSearchProject } from "@/lib/services/search-projects";
import { notFound } from "next/navigation";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const project = await getSearchProject(db, id);
  if (!project) notFound();
  const [actions, snapshot, intel] = await Promise.all([
    getNextBestActions(db, id),
    buildProjectSnapshot(db, id),
    getRoleIntelligence(db, id),
  ]);

  const healthItems: { label: string; done: boolean; href: string }[] = [
    { label: "Job description", done: snapshot.hasJobDescription, href: "role" },
    { label: "Role intelligence", done: snapshot.hasRoleIntelligence, href: "role" },
    { label: "HM intake", done: snapshot.intakeComplete, href: "intake" },
    { label: "Success profile", done: snapshot.hasSuccessProfile, href: "profile" },
    { label: "Sourcing strategy", done: snapshot.hasStrategy, href: "strategy" },
    { label: "Channels mapped", done: snapshot.channelCount > 0, href: "sources" },
    { label: "Search strings", done: snapshot.queryCount > 0, href: "strings" },
    { label: "Candidates", done: snapshot.candidateCount > 0, href: "candidates" },
  ];

  return (
    <div>
      <PageHeader
        title="Overview"
        description={project.businessObjective ?? undefined}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="What should I do next?">
            {actions.length === 0 ? (
              <p className="text-[13px] text-ink-muted">
                Nothing pending — this search is in a healthy state.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {actions.map((action) => (
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
                      <span>
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
            )}
          </Card>
          {intel && (
            <Card title="Role hypothesis">
              <p className="text-[13.5px] leading-6 text-ink">
                {intel.payload.roleHypothesis}
              </p>
              <Link
                href={`/searches/${id}/role`}
                className="mt-2 inline-block text-[12.5px] text-accent hover:underline"
              >
                Review role intelligence →
              </Link>
            </Card>
          )}
          <Card title="Search facts">
            <div className="space-y-1.5">
              <KeyValue label="Company" value={project.companyName} />
              <KeyValue label="Role" value={project.roleTitle} />
              <KeyValue label="Geography" value={project.geography} />
              <KeyValue label="Country" value={project.country} />
              <KeyValue label="Industry" value={project.industry} />
              <KeyValue label="Seniority" value={project.seniority} />
              <KeyValue label="Employment type" value={project.employmentType} />
              <KeyValue label="Work arrangement" value={project.workArrangement} />
              <KeyValue label="Compensation" value={project.compensationNote} />
              <KeyValue label="Recruiter notes" value={project.recruiterNotes} />
            </div>
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Search setup">
            <ul className="space-y-1.5">
              {healthItems.map((item) => (
                <li key={item.label}>
                  <Link
                    href={`/searches/${id}/${item.href}`}
                    className="flex items-center justify-between rounded px-2 py-1 text-[13px] hover:bg-panel2/60"
                  >
                    <span className={item.done ? "text-ink" : "text-ink-muted"}>
                      {item.label}
                    </span>
                    <Tag tone={item.done ? "ok" : "neutral"}>
                      {item.done ? "done" : "open"}
                    </Tag>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Pipeline">
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-ink-muted">Candidates</span>
                <span>{snapshot.candidateCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Awaiting review</span>
                <span>{snapshot.candidatesNeedingReview}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Follow-ups due</span>
                <span>{snapshot.followUpsDueCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Outreach sent / replied</span>
                <span>
                  {snapshot.outreachSent} / {snapshot.outreachReplied}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
