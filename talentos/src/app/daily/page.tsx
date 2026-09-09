import { getDb } from "@/lib/db/client";
import { dayStream, todayKey } from "@/lib/services/daily";
import { listPages } from "@/lib/services/pages";
import { DailyScroll } from "@/components/daily-scroll";
import { OpenAsPane } from "@/components/open-as-pane";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Daily notes" };

/**
 * The journal, as one scroll.
 *
 * It used to redirect to today, which made the calendar a page per day with
 * arrows between them — and the day you want is nearly always a screen up
 * rather than four clicks away. Every day is here, newest first, writable
 * where it sits, unrolling as you go.
 */
export default async function Page() {
  const db = getDb();
  const today = todayKey();
  return (
    <div>
      <PageHeader
        title="📅 Daily notes"
        description="Every day, newest first, writable where it sits. Scroll back as far as you like — the date stays at the top of the window so you always know which day you are writing in."
        actions={<OpenAsPane target="calendar" />}
      />
      <DailyScroll
        first={dayStream(db, today)}
        today={today}
        pages={listPages(db).map((page) => ({
          slug: page.slug,
          display: page.display,
          count: page.count,
          kind: page.kind,
          hint: page.hint,
        }))}
      />
    </div>
  );
}
