import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { dailyWorkspace, todayKey } from "@/lib/services/daily";
import { listPages } from "@/lib/services/pages";
import { collectAnswers } from "@/lib/services/expert";
import { QuickNote } from "@/components/quick-note";
import { ExpertChat } from "@/components/expert-chat";
import { OpenAsPane } from "@/components/open-as-pane";
import { Card, PageHeader } from "@/components/ui";
import { EXPERTS } from "../../artifact-src/core/experts";

export const metadata = { title: "Home" };

/**
 * Home: what you are writing, and who you are asking.
 *
 * It used to be the dashboard — counts, next-best-actions, a list of open
 * jobs — and all of that is still one click away at `/dashboard`. But a
 * dashboard is a report on work already recorded, and the first two things a
 * recruiter does in a morning are write something down and ask somebody a
 * question. So those are the two halves of the front page, side by side,
 * and the reporting is where reports belong.
 *
 * The note is today's note — the same one the daily page and every pane hold,
 * not a second scratchpad. The chat is one conversation with a small team,
 * routed by what you ask.
 */
export default async function HomePage() {
  const db = getDb();
  const day = todayKey();
  const today = dailyWorkspace(db, day);
  const pages = listPages(db);
  /**
   * Pick up anything a Claude session answered while this page was closed.
   * A load is the cheapest possible poll and it is the reason a hard refresh
   * shows the answer rather than the wait it was showing before.
   */
  const { threads } = collectAnswers(db);

  return (
    <div>
      <PageHeader
        title="🏠 Home"
        description="What you are writing, and who you are asking. The counts and the next best action for each job are on the dashboard."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded border border-edge2 px-2 py-1 text-[13px] text-ink-muted hover:bg-panel2 hover:text-ink"
            >
              📊 Dashboard
            </Link>
            <OpenAsPane target="home" />
          </div>
        }
      />

      {/* The note is wider than the conversation: one is where the work is
          written down and the other is where a question is asked. */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card
          title={
            <span className="flex items-baseline justify-between gap-2">
              <span>📝 {today.title}</span>
              <Link
                href={`/daily/${day}`}
                className="text-[12px] font-normal text-accent"
              >
                the whole day →
              </Link>
            </span>
          }
        >
          <div className="min-h-[18rem]">
            <QuickNote day={day} initial={today.note} pages={pages} />
          </div>
        </Card>

        <Card
          title={
            <span className="flex items-baseline justify-between gap-2">
              <span>💬 Your talent expert</span>
              <span className="text-[12px] font-normal text-ink-faint">
                {EXPERTS.length} specialists
              </span>
            </span>
          }
        >
          <ExpertChat threads={threads} />
          {/* The team, named. A "team of agents" you cannot see the members of
              is a marketing sentence; this is the list, and each one is what
              the question gets routed to. */}
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-edge pt-2.5">
            {EXPERTS.map((expert) => (
              <span
                key={expert.id}
                title={expert.does}
                className="rounded border border-edge2 bg-panel2/60 px-1.5 py-0.5 text-[12px] text-ink-muted"
              >
                <span aria-hidden className="mr-1">
                  {expert.mark}
                </span>
                {expert.name}
              </span>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
