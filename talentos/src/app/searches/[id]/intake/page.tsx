import { getDb } from "@/lib/db/client";
import { getLatestIntakeSession } from "@/lib/services/artifacts";
import { generateIntakeAction } from "@/lib/actions/generate";
import { ArtifactMeta } from "@/components/artifact-meta";
import { GenerateButton } from "@/components/generate-button";
import {
  CompleteIntakeButton,
  IntakeAnswer,
} from "@/components/intake-answer";
import { StringList } from "@/components/traced-list";
import { Card, EmptyState, PageHeader, Tag } from "@/components/ui";

export const metadata = { title: "HM Intake" };

export default async function IntakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getLatestIntakeSession(getDb(), id);
  const payload = session?.payload;
  const questions = payload?.categories.flatMap((c) => c.questions) ?? [];
  const answered = questions.filter((q) => q.answer?.trim()).length;

  return (
    <div>
      <PageHeader
        title="Hiring-Manager Intake"
        description="A role-specific intake interview — capture the hiring manager's answers inline, then confront the playback with 'What did I get wrong?'."
        actions={
          <GenerateButton
            action={generateIntakeAction}
            input={{ searchProjectId: id }}
            label={session ? "Regenerate intake" : "Generate intake"}
            regenerate={Boolean(session)}
          />
        }
      />
      {!session || !payload ? (
        <EmptyState
          title="No intake yet"
          detail="Generate a tailored intake interview from the role intelligence. Questions adapt to this profession — an ML-research intake and a physician intake share almost nothing."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Tag tone={session.status === "complete" ? "ok" : "warn"}>
                {session.status.replace("_", " ")}
              </Tag>
              <span className="text-[13px] text-ink-muted">
                {answered}/{questions.length} answered
              </span>
            </div>
            {session.status !== "complete" && (
              <CompleteIntakeButton
                sessionId={session.id}
                searchProjectId={id}
                disabled={answered === 0}
              />
            )}
          </div>
          <ArtifactMeta
            meta={session.meta}
            kind="intake"
            ownerId={id}
            payload={payload}
          />
          {payload.categories.map((category) => (
            <Card key={category.id} title={category.title}>
              <p className="mb-3 text-[12.5px] text-ink-muted italic">
                {category.rationale}
              </p>
              <div className="space-y-4">
                {category.questions.map((question) => (
                  <div key={question.id}>
                    <p className="text-[13.5px] font-medium">{question.question}</p>
                    <p className="mt-0.5 text-[12px] text-ink-faint">
                      Why it matters: {question.whyItMatters}
                    </p>
                    <IntakeAnswer
                      sessionId={session.id}
                      questionId={question.id ?? ""}
                      existingAnswer={question.answer}
                    />
                  </div>
                ))}
              </div>
            </Card>
          ))}
          {payload.playback && (
            <Card title="Recruiter playback — “Let me summarize the search as I now understand it.”">
              <div className="space-y-4">
                <p className="text-[13.5px]">{payload.playback.target}</p>
                <StringList title="Hard requirements" items={payload.playback.hardRequirements} />
                <StringList title="Flexible requirements" items={payload.playback.flexibleRequirements} />
                <div>
                  <h3 className="mb-1.5 text-[11.5px] font-semibold tracking-wider text-ink-faint uppercase">
                    Ideal phenotype
                  </h3>
                  <p className="text-[13px]">{payload.playback.idealPhenotype}</p>
                </div>
                <StringList title="Adjacent phenotypes" items={payload.playback.adjacentPhenotypes} />
                <StringList title="Disqualifiers" items={payload.playback.disqualifiers} />
                <StringList title="Unresolved questions" items={payload.playback.unresolvedQuestions} />
                <p className="rounded border border-accent/30 bg-accent-soft/50 px-3 py-2 text-[13px] font-medium text-accent">
                  Ask the hiring manager: “What did I get wrong?” — then edit
                  this playback and the requirements to match reality.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
