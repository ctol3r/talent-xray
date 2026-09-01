import { getDb } from "@/lib/db/client";
import { getScreenGuide } from "@/lib/services/artifacts";
import { generateScreenGuideAction } from "@/lib/actions/generate";
import { ArtifactMeta } from "@/components/artifact-meta";
import { GenerateButton } from "@/components/generate-button";
import { StringList } from "@/components/traced-list";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Recruiter Screen" };

export default async function ScreenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guide = await getScreenGuide(getDb(), id);
  const payload = guide?.payload;

  return (
    <div>
      <PageHeader
        title="Recruiter Screen"
        description="A structured phone-screen guide from the success profile: every question says why it's asked and what strong vs weak answers sound like."
        actions={
          <GenerateButton
            action={generateScreenGuideAction}
            input={{ searchProjectId: id }}
            label={payload ? "Regenerate" : "Generate screen guide"}
            regenerate={Boolean(payload)}
          />
        }
      />
      {!payload ? (
        <EmptyState
          title="No screen guide yet"
          detail="Generate it once the success profile exists — the functional section adapts to this profession's real evidence bar."
        />
      ) : (
        <div className="space-y-4">
          <ArtifactMeta
            meta={guide?.meta ?? null}
            kind="screen_guide"
            ownerId={id}
            payload={payload}
          />
          {payload.sections.map((section) => (
            <Card key={section.id} title={section.title}>
              <div className="space-y-5">
                {section.questions.map((question) => (
                  <div key={question.id}>
                    <p className="text-[13.5px] font-medium">
                      {question.question}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-faint">
                      Why: {question.why}
                    </p>
                    <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <div className="rounded border border-ok/20 bg-ok-soft/40 p-2.5">
                        <h4 className="text-[11px] font-semibold tracking-wider text-ok uppercase">
                          Strong evidence sounds like
                        </h4>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12.5px]">
                          {question.strongEvidence.map((example, i) => (
                            <li key={i}>{example}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded border border-warn/20 bg-warn-soft/40 p-2.5">
                        <h4 className="text-[11px] font-semibold tracking-wider text-warn uppercase">
                          Weak / insufficient
                        </h4>
                        <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12.5px]">
                          {question.weakEvidence.map((example, i) => (
                            <li key={i}>{example}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    {question.redFlags.length > 0 && (
                      <p className="mt-2 text-[12.5px] text-bad">
                        Red flags: {question.redFlags.join("; ")}
                      </p>
                    )}
                    <div className="mt-2">
                      <StringList
                        title="Follow-up probes"
                        items={question.followUps}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
