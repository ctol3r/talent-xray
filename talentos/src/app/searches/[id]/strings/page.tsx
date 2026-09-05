import { getDb } from "@/lib/db/client";
import { listQueries } from "@/lib/services/workflow";
import { generateSearchStringsAction } from "@/lib/actions/generate";
import { GenerateButton } from "@/components/generate-button";
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
  const queries = await listQueries(getDb(), id);
  const byPlatform = new Map<string, typeof queries>();
  for (const query of queries) {
    const list = byPlatform.get(query.platform) ?? [];
    list.push(query);
    byPlatform.set(query.platform, list);
  }

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
          {[...byPlatform.entries()].map(([platform, platformQueries]) => (
            <Card key={platform} title={platform}>
              <ul className="space-y-2.5">
                {platformQueries.map((query) => (
                  <li
                    key={query.id}
                    className="rounded border border-edge bg-panel2/50 px-3 py-2"
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Tag tone={BREADTH_TONE[query.breadth] ?? "neutral"}>
                        {query.breadth}
                      </Tag>
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
                  </li>
                ))}
              </ul>
            </Card>
          ))}
          <AddQueryForm searchProjectId={id} />
        </div>
      )}
    </div>
  );
}
