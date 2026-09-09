import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { dailyWorkspace, dayKey } from "@/lib/services/daily";
import { listPages } from "@/lib/services/pages";
import { DailyNote } from "@/components/daily-note";
import { DailyBriefingPanels } from "@/components/daily-briefing";
import { dailyBriefing } from "@/lib/services/briefing";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const { day } = await params;
  return { title: `${day} · Daily notes` };
}

export default async function Page({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const { day } = await params;
  if (!dayKey.safeParse(day).success) notFound();
  const db = getDb();
  return (
    <DailyNote
      workspace={dailyWorkspace(db, day)}
      pages={listPages(db).map((page) => ({
        slug: page.slug,
        display: page.display,
        count: page.count,
        kind: page.kind,
        hint: page.hint,
      }))}
      briefing={<DailyBriefingPanels briefing={await dailyBriefing(db, day)} />}
    />
  );
}
