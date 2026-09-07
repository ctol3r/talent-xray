import { getDb } from "@/lib/db/client";
import { discoveryStatus, listSavedSources } from "@/lib/services/discovery";
import { queryYieldForProject } from "@/lib/services/query-yield";
import { listQueries } from "@/lib/services/workflow";
import { DiscoveryPanel } from "@/components/discovery-panel";
import { ProjectYieldCard } from "@/components/query-qa";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Discover" };

export default async function DiscoverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const status = discoveryStatus();
  const [queries, saved, yieldByProject] = await Promise.all([
    listQueries(db, id),
    listSavedSources(db, id),
    queryYieldForProject(db, id),
  ]);

  return (
    <div>
      <PageHeader
        title="Discover"
        description="Open your composed strings on the two live people-only search engines (profiles, portfolios, CVs, registries, rosters — no company marketing, no job ads). The engine's own results page opens in a new tab; you read the count and choose which profile URLs to keep. Result pages are never fetched or scraped, and nothing persists unless you record it."
      />
      <DiscoveryPanel
        projectId={id}
        hosted={status.hosted}
        apiConfigured={status.configured}
        queries={queries.map((q) => {
          const y = yieldByProject.byQuery.get(q.id);
          return {
            id: q.id,
            platform: q.platform,
            breadth: q.breadth,
            query: q.query,
            yield: y ? { runs: y.runs, savedUrls: y.savedUrls } : undefined,
          };
        })}
      />

      {yieldByProject.totals.runs > 0 && (
        <div className="mt-6">
          <ProjectYieldCard
            totals={yieldByProject.totals}
            zeroYieldCount={yieldByProject.zeroYield.length}
          />
        </div>
      )}

      {saved.length > 0 && (
        <div className="mt-6">
          <Card title={`Saved results (${saved.length})`}>
            <ul className="space-y-2">
              {saved.map((source) => (
                <li key={source.id} className="text-[12.5px]">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener"
                    className="font-medium text-accent hover:underline"
                  >
                    {source.title ?? source.url}
                  </a>
                  <span className="ml-2 text-[11px] text-ink-faint">
                    {source.source} · saved from “{source.query?.slice(0, 60)}”
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
