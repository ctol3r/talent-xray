import { getDb } from "@/lib/db/client";
import { discoveryStatus, listSavedSources } from "@/lib/services/discovery";
import { listQueries } from "@/lib/services/workflow";
import { DiscoveryPanel } from "@/components/discovery-panel";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Discover" };

export default async function DiscoverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const status = discoveryStatus();
  const [queries, saved] = await Promise.all([
    listQueries(db, id),
    listSavedSources(db, id),
  ]);

  return (
    <div>
      <PageHeader
        title="Discover"
        description="Run your composed strings against the two live people-only search engines (profiles, portfolios, CVs, registries, rosters — no company marketing, no job ads). Result pages are never fetched or scraped; links open on the source site, and nothing persists unless you save a specific result."
      />
      {!status.configured ? (
        <EmptyState
          title="Search engine not configured"
          detail="Set TALENTOS_GOOGLE_CSE_KEY (your own Google Custom Search JSON API key) in .env, then restart. The engine IDs default to the live Talent X-Ray people-only engines; discovery is separate from general research (D-010)."
        />
      ) : (
        <DiscoveryPanel
          projectId={id}
          queries={queries.map((q) => ({
            id: q.id,
            platform: q.platform,
            breadth: q.breadth,
            query: q.query,
          }))}
        />
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
