import { getDb } from "@/lib/db/client";
import { listLearnings } from "@/lib/services/workflow";
import { synthesizeLearningsAction } from "@/lib/actions/generate";
import { GenerateButton } from "@/components/generate-button";
import { LearningForm } from "@/components/learning-form";
import { Card, PageHeader, ProvenanceBadge, Tag } from "@/components/ui";

export const metadata = { title: "Search Learnings" };

export default async function LearningsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const learnings = await listLearnings(getDb(), id);

  return (
    <div>
      <PageHeader
        title="Search Learnings"
        description="Capture why candidates responded, declined, failed, or accepted — then synthesize. Small samples are flagged, never generalized silently."
        actions={
          <GenerateButton
            action={synthesizeLearningsAction}
            input={{ searchProjectId: id }}
            label="Synthesize learnings"
            regenerate={learnings.length > 0}
          />
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card title="Recorded learnings">
            {learnings.length === 0 ? (
              <p className="text-[13px] text-ink-muted">
                Nothing recorded yet. Every candidate outcome is a data point —
                capture it while it&apos;s fresh.
              </p>
            ) : (
              <ul className="space-y-2">
                {learnings.map((learning) => (
                  <li
                    key={learning.id}
                    className="rounded border border-edge bg-panel2/50 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Tag>{learning.kind.replaceAll("_", " ")}</Tag>
                      <ProvenanceBadge source={learning.provenance} />
                      {learning.sampleSize !== null && (
                        <span className="text-[11.5px] text-ink-faint">
                          n={learning.sampleSize}
                        </span>
                      )}
                      {(learning.sampleSize ?? 0) < 5 && (
                        <Tag tone="warn">small sample</Tag>
                      )}
                    </div>
                    <p className="mt-1 text-[13px]">{learning.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <Card title="Record an outcome">
          <LearningForm searchProjectId={id} />
        </Card>
      </div>
    </div>
  );
}
