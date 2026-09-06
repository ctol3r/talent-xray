import { getDb } from "@/lib/db/client";
import { compensationWorkspace } from "@/lib/services/compensation";
import { CompensationWorkbench } from "@/components/compensation-workbench";
import { getMarketResearch } from "@/lib/services/artifacts";
import { generateMarketIntelligenceAction } from "@/lib/actions/generate";
import { ArtifactMeta } from "@/components/artifact-meta";
import { GenerateButton } from "@/components/generate-button";
import { StringList } from "@/components/traced-list";
import { Card, CertaintyBadge, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Market Intelligence" };

export default async function MarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const market = await getMarketResearch(getDb(), id);
  const payload = market?.payload;

  return (
    <div>
      <PageHeader
        title="Market Intelligence"
        description="How difficult is this search and why, and what recruiter-reviewed sources say about base pay. Every claim carries a certainty label and every pay figure is a provisional band from sources you checked — nothing is presented as fact unless it is. Research arrives through a keyless Codex/Claude request, never a model API key."
        actions={
          <GenerateButton
            action={generateMarketIntelligenceAction}
            input={{ searchProjectId: id }}
            label={payload ? "Regenerate" : "Assess the market"}
            regenerate={Boolean(payload)}
          />
        }
      />
      <div className="mb-6">
        <CompensationWorkbench
          projectId={id}
          workspace={compensationWorkspace(getDb(), id)}
        />
      </div>
      {!payload ? (
        <EmptyState
          title="No market assessment yet"
          detail="Generate a structured difficulty assessment with labeled certainty. 'Reliable exact data unavailable' is an honest answer here, not a failure."
        />
      ) : (
        <div className="space-y-4">
          <Card title="Search difficulty">
            <ArtifactMeta
              meta={market?.meta ?? null}
              kind="market_research"
              ownerId={id}
              payload={payload}
            />
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span
                    key={n}
                    className={`h-2.5 w-6 rounded-sm ${
                      n <= payload.difficulty.rating
                        ? payload.difficulty.rating >= 4
                          ? "bg-bad"
                          : payload.difficulty.rating >= 3
                            ? "bg-warn"
                            : "bg-ok"
                        : "bg-panel2"
                    }`}
                  />
                ))}
              </div>
              <span className="text-[13px] font-medium">
                {payload.difficulty.rating}/5
              </span>
            </div>
            <p className="mt-2 text-[13px] text-ink-muted">
              {payload.difficulty.rationale}
            </p>
          </Card>
          {payload.sections.map((section) => (
            <Card key={section.id} title={section.title}>
              <ul className="space-y-2">
                {section.claims.map((claim) => (
                  <li
                    key={claim.id}
                    className="flex items-start justify-between gap-3 rounded border border-edge bg-panel2/50 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px]">{claim.text}</p>
                      {claim.sourceUrl && (
                        <a
                          href={claim.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-accent hover:underline"
                        >
                          source
                        </a>
                      )}
                      {claim.note && (
                        <p className="text-[12px] text-ink-faint">
                          {claim.note}
                        </p>
                      )}
                    </div>
                    <span className="mt-0.5 shrink-0">
                      <CertaintyBadge certainty={claim.certainty} />
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          <Card title="Honesty ledger">
            <div className="space-y-4">
              <StringList title="Assumptions" items={payload.assumptions} />
              <StringList
                title="Missing information"
                items={payload.missingInformation}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
