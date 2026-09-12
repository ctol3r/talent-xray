import Link from "next/link";
import { getDb } from "@/lib/db/client";
import {
  buildProjectSnapshot,
  getNextBestActions,
} from "@/lib/services/search-projects";
import { getRoleIntelligence } from "@/lib/services/artifacts";
import { Card, KeyValue, PageHeader, Tag } from "@/components/ui";
import { getSearchProject } from "@/lib/services/search-projects";
import { listPages } from "@/lib/services/pages";
import { jobLocation } from "@/lib/domain/job-label";
import {
  EMPLOYMENT_TYPES,
  FTE_OPTIONS,
  INDUSTRIES,
  JOB_PRIORITIES,
  SENIORITY_LEVELS,
  SPONSORSHIP_OPTIONS,
  WORK_ARRANGEMENTS,
  labelFor,
  salaryLine,
  startDateLine,
} from "@/lib/domain/job-fields";
import { SearchNotesForm } from "@/components/search-notes-form";
import { OpenAsPane } from "@/components/open-as-pane";
import { JobStatus } from "@/components/job-status";
import { CompanyMark } from "@/components/company-mark";
import { companySites } from "@/lib/services/companies";
import { faviconsOn } from "@/lib/domain/settings-flags";
import { ActivityBar } from "@/components/activity-bar";
import { jobActivity } from "@/lib/services/job-activity";
import { readHillFor } from "@/lib/services/hill";
import { HillChartView } from "@/components/hill-chart";
import { todayKey } from "@/lib/services/daily";
import { notFound } from "next/navigation";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const hill = readHillFor(db, id);
  const sites = companySites(db);
  const favicons = faviconsOn();
  const project = await getSearchProject(db, id);
  if (!project) notFound();
  const [actions, snapshot, intel] = await Promise.all([
    getNextBestActions(db, id),
    buildProjectSnapshot(db, id),
    getRoleIntelligence(db, id),
  ]);

  const healthItems: { label: string; done: boolean; href: string }[] = [
    {
      label: "Job description",
      done: snapshot.hasJobDescription,
      href: "role",
    },
    {
      label: "Role intelligence",
      done: snapshot.hasRoleIntelligence,
      href: "role",
    },
    { label: "HM intake", done: snapshot.intakeComplete, href: "intake" },
    {
      label: "Success profile",
      done: snapshot.hasSuccessProfile,
      href: "profile",
    },
    {
      label: "Sourcing strategy",
      done: snapshot.hasStrategy,
      href: "strategy",
    },
    {
      label: "Channels mapped",
      done: snapshot.channelCount > 0,
      href: "sources",
    },
    { label: "Search strings", done: snapshot.queryCount > 0, href: "strings" },
    {
      label: "Candidates",
      done: snapshot.candidateCount > 0,
      href: "candidates",
    },
  ];

  return (
    <div>
      <PageHeader
        title="📋 Overview"
        description={project.businessObjective ?? undefined}
        actions={
          <>
            <JobStatus projectId={id} status={project.status} />
            <OpenAsPane target={`job:${id}`} />
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card title="🎯 What should I do next?">
            {actions.length === 0 ? (
              <p className="text-[14px] text-ink-muted">
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
            )}
          </Card>
          {intel && (
            <Card title="💡 Role hypothesis">
              <p className="text-[14.5px] leading-6 text-ink">
                {intel.payload.roleHypothesis}
              </p>
              <Link
                href={`/searches/${id}/role`}
                className="mt-2 inline-block text-[13.5px] text-accent hover:underline"
              >
                Review role intelligence →
              </Link>
            </Card>
          )}
          {/* Where the work stands, before the facts about the job. A job page
              that opens on its fields tells you what the job is; this tells you
              what is still unknown about filling it, which is the question
              somebody opening it actually has. */}
          <Card
            title={
              <span className="flex items-baseline justify-between gap-2">
                <span>⛰️ Where this stands</span>
                <Link
                  href={`/searches/${id}/hill`}
                  className="text-[12px] font-normal text-accent hover:underline"
                >
                  the whole hill →
                </Link>
              </span>
            }
          >
            <HillChartView
              jobId={id}
              chart={hill.chart}
              readings={hill.readings}
              says={hill.says}
            />
          </Card>
          <Card title="📈 Activity">
            <ActivityBar activity={jobActivity(db, id, todayKey())} />
          </Card>
          <Card title="📇 Job facts">
            <div className="space-y-1.5">
              <KeyValue
                label="Company"
                value={
                  project.companyName ? (
                    <span className="flex items-center gap-1.5">
                      <CompanyMark
                        name={project.companyName}
                        url={sites.get(
                          project.companyName.trim().toLowerCase(),
                        )}
                        favicons={favicons}
                        size={16}
                      />
                      {project.companyName}
                    </span>
                  ) : null
                }
              />
              <KeyValue label="Role" value={project.roleTitle} />
              <KeyValue label="Location" value={jobLocation(project)} />
              <KeyValue label="Country" value={project.country} />
              <KeyValue
                label="Industry"
                value={labelFor(INDUSTRIES, project.industry)}
              />
              <KeyValue
                label="Seniority"
                value={labelFor(SENIORITY_LEVELS, project.seniority)}
              />
              <KeyValue
                label="Employment type"
                value={labelFor(EMPLOYMENT_TYPES, project.employmentType)}
              />
              <KeyValue
                label="FTE"
                value={labelFor(FTE_OPTIONS, project.fte)}
              />
              <KeyValue
                label="Work arrangement"
                value={labelFor(WORK_ARRANGEMENTS, project.workArrangement)}
              />
              <KeyValue
                label="Sponsorship"
                value={labelFor(SPONSORSHIP_OPTIONS, project.sponsorship)}
              />
              <KeyValue label="Salary" value={salaryLine(project)} />
              <KeyValue label="Package" value={project.compensationNote} />
              <KeyValue
                label="Priority"
                value={labelFor(JOB_PRIORITIES, project.priority)}
              />
              <KeyValue
                label="Openings"
                value={project.openings ? String(project.openings) : null}
              />
              {/*
                Always rendered, even with no date. An omitted row is how the
                fortnight assumption stayed invisible: nothing on screen to
                question, and every pace reading on the job quietly resting on
                it.
              */}
              <KeyValue
                label="Target start"
                value={
                  <span
                    className={
                      startDateLine(project).assumed ? "text-warn" : undefined
                    }
                  >
                    {startDateLine(project).text}
                  </span>
                }
              />
            </div>
          </Card>
          <Card title="🗒️ Notes and tags">
            <SearchNotesForm
              projectId={id}
              notes={project.recruiterNotes}
              tags={listPages(db).map((page) => ({
                slug: page.slug,
                display: page.display,
                count: page.count,
                kind: page.kind,
                hint: page.hint,
              }))}
            />
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="🛠️ Job setup">
            <ul className="space-y-1.5">
              {healthItems.map((item) => (
                <li key={item.label}>
                  <Link
                    href={`/searches/${id}/${item.href}`}
                    className="flex items-center justify-between rounded px-2 py-1 text-[14px] hover:bg-panel2/60"
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
          <Card title="🪜 Pipeline">
            <div className="space-y-2 text-[14px]">
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
