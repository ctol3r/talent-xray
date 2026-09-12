import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { dailyWorkspace, dayTitle, todayKey } from "@/lib/services/daily";
import { listPages } from "@/lib/services/pages";
import { QuickNote } from "@/components/quick-note";
import { OpenAsPane } from "@/components/open-as-pane";
import { Card, PageHeader } from "@/components/ui";
import { settings } from "@/lib/db/schema";
import { blockText } from "../../../artifact-src/core/slash";
import { parseOutline } from "../../../artifact-src/core/outline";

export const metadata = { title: "Notes" };

/**
 * Notes, as a place rather than as a day.
 *
 * The daily page is a calendar: it opens on one date and shows what happened
 * on it. This is the other half — today's note first and everything you have
 * written under it, because "what did I write about that" is a different
 * question from "what happened on Tuesday" and the calendar answers only one
 * of them.
 */
export default async function NotesPage() {
  const db = getDb();
  const day = todayKey();
  const today = dailyWorkspace(db, day);
  const pages = listPages(db);

  // Every day that has a note, newest first, read straight out of the same
  // settings keys the notes are stored under.
  const written = db
    .select()
    .from(settings)
    .all()
    .flatMap((row) => {
      const match = /^daily:(\d{4}-\d{2}-\d{2})$/.exec(row.key);
      if (!match || match[1] === day) return [];
      const value = row.value as { text?: string } | null;
      const text = typeof value?.text === "string" ? value.text : "";
      if (!text.trim()) return [];
      return [{ day: match[1], blocks: parseOutline(text) }];
    })
    .sort((a, b) => b.day.localeCompare(a.day));

  return (
    <div>
      <PageHeader
        title="📝 Notes"
        description="Everything you have written down, newest first. Today's is at the top and is the same note the dashboard and the daily page hold — writing in any of them is one act."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/daily" className="text-[13px] text-accent">
              📅 by date
            </Link>
            <OpenAsPane target="notes" />
          </div>
        }
      />

      <Card className="mb-4" title={`✍️ ${today.title}`}>
        <QuickNote day={day} initial={today.note} pages={pages} />
      </Card>

      <Card title={`🗂️ Earlier (${written.length})`}>
        {written.length === 0 ? (
          <p className="text-[14px] text-ink-muted">
            Nothing else written yet. Anything you type above is here tomorrow.
          </p>
        ) : (
          <ul className="space-y-3">
            {written.slice(0, 40).map((entry) => (
              <li key={entry.day}>
                <Link
                  href={`/daily/${entry.day}`}
                  className="text-[13.5px] font-medium text-accent"
                >
                  {dayTitle(entry.day)}
                </Link>
                <ul className="mt-0.5 space-y-0.5">
                  {entry.blocks.slice(0, 4).map((block) => (
                    <li
                      key={block.id}
                      className="truncate text-[13.5px] text-ink-muted"
                    >
                      <span aria-hidden className="mr-1.5 text-ink-faint">
                        •
                      </span>
                      {blockText(block.text)}
                    </li>
                  ))}
                  {entry.blocks.length > 4 && (
                    <li className="text-[12.5px] text-ink-faint">
                      and {entry.blocks.length - 4} more
                    </li>
                  )}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
