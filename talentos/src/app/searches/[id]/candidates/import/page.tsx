import Link from "next/link";
import { ImportWizard } from "@/components/import-wizard";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Import candidates" };

export default async function ImportCandidatesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div>
      <PageHeader
        title="Import candidates"
        description="Bring a hireEZ, LinkedIn Recruiter, ATS or Heartbeat.ai export into this search. Rows become ordinary candidates with a visible source label; nothing is merged automatically and nothing from a file becomes CV text."
        actions={
          <Link
            href={`/searches/${id}/candidates`}
            className="rounded border border-edge2 px-3 py-1.5 text-[13px] text-ink-muted hover:bg-panel2"
          >
            Back to candidates
          </Link>
        }
      />
      <ImportWizard searchProjectId={id} />
    </div>
  );
}
