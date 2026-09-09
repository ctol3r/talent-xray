import { notFound } from "next/navigation";
import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { noticeStatus } from "@/lib/domain/profile-links";
import { confirmationWorkspace } from "@/lib/services/profile-confirmations";
import { getSearchProject } from "@/lib/services/search-projects";
import { ConfirmationRequest } from "@/components/confirmation-request";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Ask the person" };

export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ id: string; candidateId: string }>;
}) {
  const { id, candidateId } = await params;
  const db = getDb();
  let workspace: ReturnType<typeof confirmationWorkspace>;
  try {
    workspace = confirmationWorkspace(db, candidateId);
  } catch {
    notFound();
  }
  if (workspace.candidate.searchProjectId !== id) notFound();
  const project = await getSearchProject(db, id);
  const notice = noticeStatus(
    workspace.candidate,
    project?.jurisdiction ?? null,
    new Date(),
  );

  return (
    <div>
      <PageHeader
        title={`❓ Ask ${workspace.candidate.name}`}
        description="One message that tells this person what you hold, asks which addresses are theirs, and carries the notice the law requires. You send it yourself; the app records what you say happened."
      />
      <p className="mb-4 text-[13.5px]">
        <Link
          href={`/searches/${id}/candidates/${candidateId}`}
          className="text-accent hover:underline"
        >
          ← Back to {workspace.candidate.name}
        </Link>
      </p>
      <ConfirmationRequest
        searchProjectId={id}
        candidateId={candidateId}
        candidateName={workspace.candidate.name}
        draft={{ subject: workspace.draft.subject, body: workspace.draft.body }}
        links={workspace.links}
        noticeText={notice.text}
      />
    </div>
  );
}
