"use client";

import { useState } from "react";
import Link from "next/link";
import type { DailyWorkspace } from "@/lib/services/daily";
import { saveDailyNoteAction } from "@/lib/actions/daily";
import { type TagOption } from "./tag-textarea";
import { Outliner } from "./outliner";
import { SaveNote, useAutosave } from "./forms";
import { TagText } from "./tag-text";
import { PreviewLink } from "./page-preview";
import { OpenAsPane } from "./open-as-pane";
import { Card, PageHeader } from "@/components/ui";
import { EMPTY_STATES } from "@/lib/domain/voice";

/**
 * One day.
 *
 * The top half is yours to write. The bottom half is not written by anyone —
 * it is what the records say happened, read back out of the database, so a
 * day is never blank because nobody journalled. Type `[[` for any page, `@`
 * for a person, `jj` for a job.
 */
/** A day's event points at a job or a person; both have a preview card. */
function eventTarget(event: DailyWorkspace["events"][number]): string {
  const id = event.href.match(/\/candidates\/([^/?#]+)/)?.[1];
  if (id) return `candidate:${id}`;
  const job = event.href.match(/\/searches\/([^/?#]+)/)?.[1];
  return job ? `job:${job}` : `tag:${event.label}`;
}

export function DailyNote({
  workspace,
  pages,
  briefing,
}: {
  workspace: DailyWorkspace;
  pages: TagOption[];
  /** Progress, reminders and next steps, rendered on the server. */
  briefing?: React.ReactNode;
}) {
  const [text, setText] = useState(workspace.note);
  const { state, says, saveNow } = useAutosave(text, (value) =>
    saveDailyNoteAction({ day: workspace.day, text: value }),
  );
  /**
   * Which block the note is zoomed into.
   *
   * In component state rather than the URL: a day's note already owns the
   * address, and putting a block path in it would make the back button walk
   * out of the note one bullet at a time. The breadcrumb is how you climb out.
   */
  const [zoom, setZoom] = useState<{ id: string; mark: string } | null>(null);

  const active = new Set(workspace.activeDays);
  const [year, month] = workspace.month.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // Monday-first, the way a working week reads.
  const lead = (first.getUTCDay() + 6) % 7;

  return (
    <div>
      <PageHeader
        title={`📅 ${workspace.title}`}
        description="What you wrote, and what the records say happened. Bullets inside bullets, as deep as you like — click a bullet to zoom into it. Type [[ or # to make a page, @ for a person, jj for a job."
        actions={
          <div className="flex items-center gap-1">
            <OpenAsPane
              target={`calendar:${workspace.day}`}
              label="Open beside"
            />
            <Link
              href={`/daily/${workspace.previous}`}
              className="rounded border border-edge2 px-2 py-1 text-[13px] text-ink-muted hover:text-ink"
            >
              ←
            </Link>
            <Link
              href={`/daily/${workspace.next}`}
              className="rounded border border-edge2 px-2 py-1 text-[13px] text-ink-muted hover:text-ink"
            >
              →
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4">
          {briefing}
          <Card title="📝 Your note">
            <Outliner
              text={text}
              onChange={setText}
              options={pages}
              zoom={zoom}
              onZoom={setZoom}
              placeholder="What happened today. Tab to indent, Enter for the next line. [[ or # makes a page, @ finds a person, jj finds a job."
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={saveNow}
                disabled={state.kind === "saving"}
                className="rounded bg-accent px-3 py-1.5 text-[14px] font-medium text-canvas hover:opacity-90 disabled:opacity-50"
              >
                {state.kind === "saving" ? "Saving…" : "Save"}
              </button>
              <SaveNote state={state} says={says} />
            </div>
            {text.trim() && (
              <div className="mt-3 border-t border-edge pt-3">
                <p className="mb-1 text-[11px] uppercase tracking-wider text-ink-faint">
                  Preview
                </p>
                <TagText text={text} className="text-[14px] text-ink-muted" />
              </div>
            )}
          </Card>

          <Card title={`🕘 What happened (${workspace.events.length})`}>
            {workspace.events.length === 0 ? (
              <p className="text-[13.5px] text-ink-faint">
                {EMPTY_STATES.noEvents.detail}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {workspace.events.map((event, index) => (
                  <li
                    key={`${event.at}-${index}`}
                    className="flex items-start gap-2 border-l-2 border-edge2 pl-3"
                  >
                    <span aria-hidden className="mt-0.5">
                      {event.icon}
                    </span>
                    <div className="min-w-0">
                      <PreviewLink
                        target={eventTarget(event)}
                        href={event.href}
                        className="text-[14px] font-medium text-ink hover:underline"
                      >
                        {event.label}
                      </PreviewLink>
                      <p className="text-[12.5px] text-ink-muted">
                        {event.detail}
                      </p>
                      <p className="text-[11.5px] text-ink-faint">
                        {event.at.slice(11, 16)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card title={`🗓️ ${workspace.month}`}>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
              <span
                key={`${label}-${index}`}
                className="py-1 text-[11px] text-ink-faint"
              >
                {label}
              </span>
            ))}
            {Array.from({ length: lead }, (_, index) => (
              <span key={`lead-${index}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = `${workspace.month}-${String(index + 1).padStart(2, "0")}`;
              const isToday = day === workspace.day;
              const hasWork = active.has(day);
              return (
                <Link
                  key={day}
                  href={`/daily/${day}`}
                  className={`rounded py-1 text-[12.5px] ${
                    isToday
                      ? "bg-accent font-medium text-canvas"
                      : hasWork
                        ? "bg-panel2 text-ink"
                        : "text-ink-faint hover:bg-panel2"
                  }`}
                >
                  {index + 1}
                </Link>
              );
            })}
          </div>
          <p className="mt-2 text-[12px] text-ink-faint">
            A filled square is a day with something on it.
          </p>
        </Card>
      </div>
    </div>
  );
}
