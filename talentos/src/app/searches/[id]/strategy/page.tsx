import { getDb } from "@/lib/db/client";
import { getSourcingStrategy } from "@/lib/services/artifacts";
import { generateSourcingStrategyAction } from "@/lib/actions/generate";
import { ArtifactMeta } from "@/components/artifact-meta";
import { GenerateButton } from "@/components/generate-button";
import { StringList } from "@/components/traced-list";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Sourcing Strategy" };

export default async function StrategyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const strategy = await getSourcingStrategy(getDb(), id);
  const payload = strategy?.payload;

  return (
    <div>
      <PageHeader
        title="Sourcing Strategy"
        description="The search strategy brief: primary and secondary phenotypes, adjacent populations with rationale, and the title/company/geography targeting that drives channels and strings."
        actions={
          <GenerateButton
            action={generateSourcingStrategyAction}
            input={{ searchProjectId: id }}
            label={payload ? "Regenerate" : "Generate strategy"}
            regenerate={Boolean(payload)}
          />
        }
      />
      {!payload ? (
        <EmptyState
          title="No strategy yet"
          detail="Generate the strategy brief from the success profile and market assessment."
        />
      ) : (
        <div className="space-y-4">
          <Card title="Primary target profile">
            <ArtifactMeta
              meta={strategy?.meta ?? null}
              kind="sourcing_strategy"
              ownerId={id}
              payload={payload}
            />
            <p className="text-[13.5px] leading-6">{payload.primaryTargetProfile}</p>
          </Card>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Secondary profiles">
              <ul className="list-disc space-y-1 pl-5 text-[13px]">
                {payload.secondaryTargetProfiles.map((profile, i) => (
                  <li key={i}>{profile}</li>
                ))}
              </ul>
            </Card>
            <Card title="Adjacent possibilities">
              <ul className="space-y-2">
                {payload.adjacentPossibilities.map((adjacent) => (
                  <li
                    key={adjacent.id}
                    className="rounded border border-edge bg-panel2/50 px-3 py-2"
                  >
                    <p className="text-[13px] font-medium">{adjacent.text}</p>
                    <p className="text-[12.5px] text-ink-muted">{adjacent.rationale}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <Card title="Targeting">
            <div className="space-y-4">
              <StringList title="Target titles" items={payload.targetTitles} />
              <StringList title="Excluded titles" items={payload.excludedTitles} />
              <StringList title="Target companies" items={payload.targetCompanies} />
              <StringList title="Feeder companies" items={payload.feederCompanies} />
              <StringList title="Target industries" items={payload.targetIndustries} />
              <StringList title="Target geographies" items={payload.targetGeographies} />
            </div>
          </Card>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Why this strategy">
              <p className="text-[13px] leading-6 text-ink-muted">{payload.rationale}</p>
            </Card>
            <Card title="Where it could fail">
              <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-muted">
                {payload.risks.map((risk, i) => (
                  <li key={i}>{risk}</li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
