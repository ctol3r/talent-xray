import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getSearchProject } from "@/lib/services/search-projects";
import { Tag } from "@/components/ui";
import { WorkspaceNav } from "@/components/workspace-nav";
import { JOB_STATUSES, labelFor } from "@/lib/domain/job-fields";
import { CompanyMark } from "@/components/company-mark";
import { companySites } from "@/lib/services/companies";
import { faviconsOn } from "@/lib/domain/settings-flags";
import { readHillFor } from "@/lib/services/hill";
import {
  jobPhase,
  type JobPhaseReading,
} from "../../../../artifact-src/core/job-phase";

/**
 * The job's own name in the tab, and therefore in a pane's header.
 *
 * A module under a job overrides this with its own title, which is right —
 * "Hill" is what you are looking at. The overview had nothing, so it fell
 * back to the product name, and a pane labelled with the product tells you
 * nothing about which of six panes it is.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getSearchProject(getDb(), id);
  return { title: project?.name ?? "Job" };
}

export default async function SearchWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const project = await getSearchProject(db, id);
  if (!project) notFound();
  const sites = companySites(db);
  const favicons = faviconsOn();
  // The phase row reports rather than navigates, so it needs the hill read on
  // the server with the page. A chart that will not parse is a thing to fix on
  // the hill itself, not a reason the job's tabs stop rendering, so the row
  // simply goes quiet.
  let phase: JobPhaseReading | undefined;
  try {
    phase = jobPhase(readHillFor(db, project.id).readings);
  } catch {
    phase = undefined;
  }
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{project.name}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[14px] text-ink-muted">
            <span>{project.roleTitle}</span>
            {project.companyName && (
              <>
                <span aria-hidden>·</span>
                <CompanyMark
                  name={project.companyName}
                  url={sites.get(project.companyName.trim().toLowerCase())}
                  favicons={favicons}
                  size={16}
                />
                <span>{project.companyName}</span>
              </>
            )}
            {project.geography && (
              <>
                <span aria-hidden>·</span>
                <span>{project.geography}</span>
              </>
            )}
          </p>
        </div>
        <Tag
          tone={
            project.status === "open"
              ? "ok"
              : project.status === "on_hold"
                ? "warn"
                : "neutral"
          }
        >
          {labelFor(JOB_STATUSES, project.status)}
        </Tag>
      </div>
      <WorkspaceNav projectId={project.id} reading={phase} />
      {children}
    </div>
  );
}
