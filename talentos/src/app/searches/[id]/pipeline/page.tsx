import { getDb } from "@/lib/db/client";
import { getPipelineStages, listCandidates } from "@/lib/services/candidates";
import { PipelineBoard } from "@/components/pipeline-board";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [stages, candidates] = await Promise.all([
    getPipelineStages(db, id),
    listCandidates(db, id),
  ]);

  return (
    <div>
      <PageHeader
        title="Pipeline"
        description="Every stage move is logged as an event — the substrate for funnel analytics and diagnosis. Later columns appear once they hold candidates."
      />
      {candidates.length === 0 ? (
        <EmptyState
          title="Pipeline is empty"
          detail="Add candidates in the Candidates module; they enter at 'Identified'."
        />
      ) : (
        <PipelineBoard
          projectId={id}
          stages={stages.map((s) => ({
            key: s.key,
            label: s.label,
            position: s.position,
          }))}
          candidates={candidates.map((c) => ({
            id: c.id,
            name: c.name,
            currentTitle: c.currentTitle,
            currentCompany: c.currentCompany,
            stage: c.stage,
            nextAction: c.nextAction,
            nextActionDue: c.nextActionDue,
            updatedAt: c.updatedAt,
          }))}
        />
      )}
    </div>
  );
}
