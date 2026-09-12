import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { OpenTheMenu, QueryRecap } from "@/components/query-recap";
import { globalSearch } from "@/lib/services/global-search";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search" };

const KIND_LABEL: Record<string, string> = {
  job: "Jobs",
  person: "People",
  tag: "Tags",
  task: "Tasks",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const result = query ? globalSearch(getDb(), query) : null;

  const grouped = new Map<string, NonNullable<typeof result>["hits"]>();
  for (const hit of result?.hits ?? []) {
    grouped.set(hit.kind, [...(grouped.get(hit.kind) ?? []), hit]);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="🔍 Search"
        description="Everything at once — jobs, people, tags, tasks. The same query language sourcing uses, so a filter narrows a job list the way it narrows a shortlist, and a plain sentence still works. You type it in the command menu; this page is where the answer lands."
      />

      {query && (
        <Card>
          <QueryRecap query={query} label="narrowed by" />
          {result && result.reading.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5">
              {result.reading.map((row) => (
                <li key={row} className="text-[12px] text-ink-muted">
                  {row}
                </li>
              ))}
            </ul>
          )}
          {result && result.warnings.length > 0 && (
            <ul className="mt-1 space-y-0.5">
              {result.warnings.map((w) => (
                <li key={w} className="text-[12px] text-warn">
                  ⚠ {w}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {result === null ? (
        <EmptyState
          title="Nothing searched yet"
          detail="Open the command menu and type. Filters are optional and a sentence works as well as a query."
        >
          <OpenTheMenu>Open the command menu</OpenTheMenu>
        </EmptyState>
      ) : result.hits.length === 0 ? (
        <EmptyState
          title="Nothing in the workspace matches"
          detail="Try fewer words, or drop a filter — the reading above shows how the query was understood."
        />
      ) : (
        <div className="space-y-3">
          {[...grouped.entries()].map(([kind, hits]) => (
            <Card
              key={kind}
              title={`${hits[0].icon} ${KIND_LABEL[kind] ?? kind} (${hits.length})`}
            >
              <ul className="space-y-1.5">
                {hits.map((hit) => (
                  <li
                    key={`${hit.kind}-${hit.href}-${hit.title}`}
                    className="rounded border border-edge2 bg-panel2 p-2"
                  >
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-mono text-[12px] text-accent">
                        {hit.score.toFixed(2)}
                      </span>
                      <Link
                        href={hit.href}
                        className="text-[14px] font-medium text-ink hover:underline"
                      >
                        {hit.title}
                      </Link>
                      <span className="text-[12px] text-ink-muted">
                        {hit.detail}
                      </span>
                    </div>
                    {hit.matched.length > 0 && (
                      <p className="mt-0.5 text-[12px] text-ink-muted">
                        matched: {hit.matched.join(", ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
