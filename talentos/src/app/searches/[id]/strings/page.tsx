import { getDb } from "@/lib/db/client";
import { listChannels, listQueries } from "@/lib/services/workflow";
import {
  queryYieldForProject,
  roleTitleYield,
} from "@/lib/services/query-yield";
import {
  channelCoverage,
  countTerms,
  platformsForChannels,
  qaQuery,
  termBudgetFor,
} from "@/lib/domain/query-normalization";
import { generateSearchStringsAction } from "@/lib/actions/generate";
import { GenerateButton } from "@/components/generate-button";
import {
  CoveragePanel,
  NormalizationNotes,
  PartTag,
  PrunedPlatformsNote,
  QaBadges,
  RoleYieldPanel,
  TermCountTag,
  YieldLine,
} from "@/components/query-qa";
import { AddQueryForm, QueryEditor } from "@/components/query-tools";
import { Card, EmptyState, PageHeader, Tag } from "@/components/ui";

export const metadata = { title: "Search String Lab" };

const BREADTH_TONE: Record<
  string,
  "accent" | "neutral" | "warn" | "ok" | "bad"
> = {
  narrow: "accent",
  balanced: "ok",
  broad: "warn",
  adjacent: "warn",
  experimental: "neutral",
};

export default async function StringsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [queries, channels, yieldByProject, roleYield] = await Promise.all([
    listQueries(db, id),
    listChannels(db, id),
    queryYieldForProject(db, id),
    roleTitleYield(db, id),
  ]);
  const byPlatform = new Map<string, typeof queries>();
  for (const query of queries) {
    const list = byPlatform.get(query.platform) ?? [];
    list.push(query);
    byPlatform.set(query.platform, list);
  }
  // Coverage and QA are recomputed at render, so recruiter edits are
  // checked without a write path and a warning never hides a string.
  const coverage = channelCoverage(channels, queries);
  const { pruned } = platformsForChannels(channels);

  return (
    <div>
      <PageHeader
        title="Search String Lab"
        description="Boolean and x-ray queries across platforms, in narrow/balanced/broad/adjacent variants. The model expands vocabulary; a deterministic composer builds the strings. Every query is visible, editable, and yours."
        actions={
          <GenerateButton
            action={generateSearchStringsAction}
            input={{ searchProjectId: id }}
            label={
              queries.length > 0 ? "Regenerate strings" : "Generate strings"
            }
            regenerate={queries.length > 0}
          />
        }
      />
      {queries.length === 0 ? (
        <EmptyState
          title="No search strings yet"
          detail="Generate the variant matrix from the sourcing strategy — or add queries manually."
        >
          <AddQueryForm searchProjectId={id} />
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <CoveragePanel coverage={coverage} />
          <RoleYieldPanel yield={roleYield} />
          {queries.length > 0 && <PrunedPlatformsNote pruned={pruned} />}
          {[...byPlatform.entries()].map(([platform, platformQueries]) => (
            <Card key={platform} title={platform}>
              <ul className="space-y-2.5">
                {platformQueries.map((query) => {
                  const warnings = qaQuery(query.query, query.platform);
                  return (
                    <li
                      key={query.id}
                      className="rounded border border-edge bg-panel2/50 px-3 py-2"
                    >
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        <Tag tone={BREADTH_TONE[query.breadth] ?? "neutral"}>
                          {query.breadth}
                        </Tag>
                        <TermCountTag
                          termCount={countTerms(query.query)}
                          budget={termBudgetFor(query.platform)}
                        />
                        <PartTag part={query.qaMeta?.part} />
                        <QaBadges warnings={warnings} />
                        {query.expectedPrecision && (
                          <span className="text-[11.5px] text-ink-faint">
                            precision: {query.expectedPrecision}
                          </span>
                        )}
                        {query.purpose && (
                          <span className="text-[11.5px] text-ink-faint">
                            {query.purpose}
                          </span>
                        )}
                        <YieldLine
                          yield={yieldByProject.byQuery.get(query.id)}
                        />
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <code className="min-w-0 flex-1 font-mono text-[12.5px] leading-5 break-words text-ink">
                          {query.query}
                        </code>
                        <QueryEditor
                          queryId={query.id}
                          searchProjectId={id}
                          platform={query.platform}
                          query={query.query}
                          purpose={query.purpose}
                          breadth={query.breadth}
                        />
                      </div>
                      <NormalizationNotes qa={query.qaMeta ?? null} />
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
          <AddQueryForm searchProjectId={id} />
        </div>
      )}
    </div>
  );
}
