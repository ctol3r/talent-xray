import { getDb } from "@/lib/db/client";
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
  return <KnowledgeGraphWorkspace graph={knowledgeGraph(getDb(), id)} />;
}
