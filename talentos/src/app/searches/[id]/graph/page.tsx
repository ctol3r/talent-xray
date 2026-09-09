import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { neo4jConfigured } from "@/lib/graph/driver";
import { knowledgeGraph } from "@/lib/services/knowledge-graph";
import { KnowledgeGraphWorkspace } from "@/components/knowledge-graph";
export const dynamic = "force-dynamic";
export const metadata = { title: "Knowledge graph" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div>
      {neo4jConfigured() && (
        <p className="mb-3 rounded border border-edge bg-panel2 px-3 py-2 text-[13.5px] text-ink-muted">
          This is one job&rsquo;s graph, rebuilt from its own records.{" "}
          <Link href="/graph" className="text-accent hover:underline">
            The whole graph
          </Link>{" "}
          holds every job at once, which is where a tag shared across jobs
          becomes a single link.
        </p>
      )}
      <KnowledgeGraphWorkspace graph={knowledgeGraph(getDb(), id)} />
    </div>
  );
}
