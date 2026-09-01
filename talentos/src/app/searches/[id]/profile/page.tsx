import { getDb } from "@/lib/db/client";
import { getSuccessProfile } from "@/lib/services/artifacts";
import { generateSuccessProfileAction } from "@/lib/actions/generate";
import { ArtifactMeta } from "@/components/artifact-meta";
import { GenerateButton } from "@/components/generate-button";
import { TracedList } from "@/components/traced-list";
import { Card, EmptyState, KeyValue, PageHeader } from "@/components/ui";

export const metadata = { title: "Success Profile" };

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getSuccessProfile(getDb(), id);
  const payload = profile?.payload;

  return (
    <div>
      <PageHeader
        title="Success Profile"
        description="The structured definition of who succeeds in this role — every criterion carries its provenance, and the hiring manager's answers outrank the JD."
        actions={
          <GenerateButton
            action={generateSuccessProfileAction}
            input={{ searchProjectId: id }}
            label={payload ? "Regenerate" : "Compile success profile"}
            regenerate={Boolean(payload)}
          />
        }
      />
      {!payload ? (
        <EmptyState
          title="No success profile yet"
          detail="Compile it from role intelligence and intake answers. The richer the intake, the less inference the profile needs."
        />
      ) : (
        <div className="space-y-4">
          <Card title="Mission">
            <ArtifactMeta
              meta={profile?.meta ?? null}
              kind="success_profile"
              ownerId={id}
              payload={payload}
            />
            <p className="text-[13.5px] leading-6">{payload.mission}</p>
            <div className="mt-3">
              <KeyValue label="Compensation" value={payload.compensationNote} />
            </div>
          </Card>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="The bar">
              <div className="space-y-4">
                <TracedList title="Must have" items={payload.mustHave} />
                <TracedList title="Preferred" items={payload.preferred} />
                <TracedList title="Trainable" items={payload.trainable} />
                <TracedList title="Outcomes" items={payload.outcomes} />
                <TracedList title="Responsibilities" items={payload.responsibilities} />
              </div>
            </Card>
            <Card title="Evidence model">
              <div className="space-y-4">
                <TracedList title="Evidence signals" items={payload.evidenceSignals} />
                <TracedList title="Negative signals" items={payload.negativeSignals} tone="warn" />
                <TracedList title="Adjacent backgrounds" items={payload.adjacentBackgrounds} />
                <TracedList title="Exemplar people" items={payload.exemplarPeople} />
                <TracedList title="Exemplar companies" items={payload.exemplarCompanies} />
              </div>
            </Card>
            <Card title="Targeting">
              <div className="space-y-4">
                <TracedList title="Alternate titles" items={payload.alternateTitles} />
                <TracedList title="Target industries" items={payload.targetIndustries} />
                <TracedList title="Target companies" items={payload.targetCompanies} />
                <TracedList title="Target geographies" items={payload.targetGeographies} />
              </div>
            </Card>
            <Card title="Closing inputs">
              <div className="space-y-4">
                <TracedList title="Candidate motivators" items={payload.candidateMotivators} />
                <TracedList title="Selling points" items={payload.sellingPoints} />
                <TracedList title="Risks" items={payload.risks} tone="warn" />
                <TracedList title="Unresolved questions" items={payload.unresolvedQuestions} tone="warn" />
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
