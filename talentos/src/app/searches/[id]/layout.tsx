import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getSearchProject } from "@/lib/services/search-projects";
import { Tag } from "@/components/ui";
import { WorkspaceNav } from "@/components/workspace-nav";

export default async function SearchWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getSearchProject(getDb(), id);
  if (!project) notFound();
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{project.name}</h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {project.roleTitle}
            {project.companyName ? ` · ${project.companyName}` : ""}
            {project.geography ? ` · ${project.geography}` : ""}
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
          {project.status}
        </Tag>
      </div>
      <WorkspaceNav projectId={project.id} />
      {children}
    </div>
  );
}
