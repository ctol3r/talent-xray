import { getDb } from "@/lib/db/client";
import { globalGraphView } from "@/lib/services/global-graph";
import { listSearchProjects } from "@/lib/services/search-projects";
import { GlobalGraph } from "@/components/global-graph";

export const dynamic = "force-dynamic";
export const metadata = { title: "Whole graph" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const view = await globalGraphView();
  const jobs = await listSearchProjects(getDb());
  // `focus` is how the graph pane follows you: the pane reloads this page with
  // whatever the page you are standing on is about, and the picture centres
  // there instead of on whichever record happens to be first.
  const { focus } = await searchParams;
  return (
    <GlobalGraph view={view} jobCount={jobs.length} focus={focus ?? null} />
  );
}
