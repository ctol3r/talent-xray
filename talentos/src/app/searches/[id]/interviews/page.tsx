import { getDb } from "@/lib/db/client";
import { getInterviewPlan } from "@/lib/services/artifacts";
import { listCandidates } from "@/lib/services/candidates";
import { listScorecards } from "@/lib/services/workflow";
import { generateInterviewPlanAction } from "@/lib/actions/generate";
import { RUBRIC_LABELS } from "@/lib/core/enums";
import { ArtifactMeta } from "@/components/artifact-meta";
import { GenerateButton } from "@/components/generate-button";
import { ScorecardForm } from "@/components/scorecard-form";
import { StringList } from "@/components/traced-list";
import { Card, EmptyState, PageHeader, Tag } from "@/components/ui";

export const metadata = { title: "Interviews" };

export default async function InterviewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [plan, cards, candidates] = await Promise.all([
    getInterviewPlan(db, id),
    listScorecards(db, id),
    listCandidates(db, id),
  ]);
  const payload = plan?.payload;
  const candidateNames = new Map(candidates.map((c) => [c.id, c.name]));

  return (
    <div>
      <PageHeader
        title="Interview Architecture"
        description="Stage design adapted to this profession, with anti-duplication notes — plus structured scorecards where every rating requires written evidence."
        actions={
          <GenerateButton
            action={generateInterviewPlanAction}
            input={{ searchProjectId: id }}
            label={payload ? "Regenerate plan" : "Design interview plan"}
            regenerate={Boolean(payload)}
          />
        }
      />
      <div className="space-y-4">
        {!payload ? (
          <EmptyState
            title="No interview plan yet"
            detail="Design the stage architecture from the success profile — a machinist process and an executive process should look nothing alike."
          />
        ) : (
          <>
            <ArtifactMeta
              meta={plan?.meta ?? null}
              kind="interview_plan"
              ownerId={id}
              payload={payload}
            />
            <div className="space-y-3">
              {payload.stages.map((stage, index) => (
                <Card key={stage.id} title={`${index + 1}. ${stage.name}`}>
                  <p className="text-[13px] text-ink-muted">{stage.purpose}</p>
                  {stage.interviewer && (
                    <p className="mt-1 text-[12.5px] text-ink-faint">
                      Interviewer: {stage.interviewer}
                    </p>
                  )}
                  <div className="mt-3 space-y-3">
                    <StringList
                      title="Competencies (assessed here, nowhere else)"
                      items={stage.competencies}
                    />
                    <StringList
                      title="Questions / exercises"
                      items={stage.questions}
                    />
                    <StringList
                      title="Evidence sought"
                      items={stage.evidenceSought}
                    />
                  </div>
                  {stage.rubricNotes && (
                    <p className="mt-2 text-[12.5px] text-ink-muted">
                      Rubric: {stage.rubricNotes}
                    </p>
                  )}
                  {stage.doNotDuplicate && (
                    <p className="mt-1 text-[12.5px] text-warn">
                      Do not re-cover: {stage.doNotDuplicate}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}

        <Card title="Scorecards">
          <div className="mb-3">
            <ScorecardForm
              searchProjectId={id}
              candidates={candidates.map((c) => ({ id: c.id, name: c.name }))}
              stageNames={
                payload?.stages.map((s) => s.name) ?? ["Recruiter Screen"]
              }
            />
          </div>
          {cards.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              No interview evidence recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {cards.map((card) => (
                <details
                  key={card.id}
                  className="rounded border border-edge bg-panel2/50 px-3 py-2"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-2">
                    <span className="text-[13px] font-medium">
                      {candidateNames.get(card.candidateId) ?? "Candidate"} ·{" "}
                      {card.stageName}
                      {card.interviewer ? ` · ${card.interviewer}` : ""}
                    </span>
                    <Tag tone={card.status === "submitted" ? "ok" : "warn"}>
                      {card.status}
                    </Tag>
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {card.entries.map((entry) => (
                      <li
                        key={entry.id}
                        className="rounded border border-edge bg-canvas p-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-medium">
                            {entry.competency}
                          </span>
                          <Tag
                            tone={
                              entry.rating === "exceptional_evidence" ||
                              entry.rating === "strong_evidence"
                                ? "ok"
                                : entry.rating === "meets_requirement"
                                  ? "accent"
                                  : entry.rating === "below_requirement"
                                    ? "bad"
                                    : "neutral"
                            }
                          >
                            {RUBRIC_LABELS[entry.rating]}
                          </Tag>
                        </div>
                        <p className="mt-1 text-[12.5px]">
                          <span className="text-ink-faint">Observation: </span>
                          {entry.observation}
                        </p>
                        <p className="text-[12.5px]">
                          <span className="text-ink-faint">
                            Interpretation:{" "}
                          </span>
                          {entry.interpretation}
                        </p>
                        <p className="text-[12.5px]">
                          <span className="text-ink-faint">Evidence: </span>
                          {entry.evidenceText}
                        </p>
                      </li>
                    ))}
                  </ul>
                  {card.overallNote && (
                    <p className="mt-2 text-[12.5px] text-ink-muted">
                      {card.overallNote}
                    </p>
                  )}
                </details>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
