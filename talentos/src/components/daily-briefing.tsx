import Link from "next/link";
import { beliefPrompt, type DailyBriefing } from "@/lib/services/briefing";
import { Card } from "@/components/ui";
import { PreviewLink } from "./page-preview";
import { EMPTY_STATES } from "@/lib/domain/voice";

/**
 * The briefing on the daily page.
 *
 * Progress, then what is late, then what to do next — and every suggestion
 * carries the reason it is the next thing. That last part is the whole
 * point: a list of tasks tells you what to do today, and a list of tasks
 * that each explain themselves teaches you how to decide tomorrow.
 */
/** A reminder points at a person or a job; both preview. */
function hrefTarget(href: string): string {
  const person = href.match(/\/candidates\/([^/?#]+)/)?.[1];
  if (person) return `candidate:${person}`;
  const job = href.match(/\/searches\/([^/?#]+)/)?.[1];
  return job ? `job:${job}` : "tag:unknown";
}

export function DailyBriefingPanels({ briefing }: { briefing: DailyBriefing }) {
  const late = briefing.reminders.filter((item) => item.overdueDays > 0);

  return (
    <>
      <Card title="📈 Progress">
        <p className="text-[14px] text-ink">{briefing.summary}</p>
        {briefing.progress.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {briefing.progress.map((line) => (
              <li
                key={line.text}
                className="rounded border border-edge2 bg-panel2 px-2 py-0.5 text-[13px] text-ink-muted"
              >
                <span aria-hidden className="mr-1">
                  {line.icon}
                </span>
                {line.text}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={`🔔 Reminders (${briefing.reminders.length}${
          late.length > 0 ? `, ${late.length} late` : ""
        })`}
      >
        {briefing.reminders.length === 0 ? (
          <p className="text-[13.5px] text-ink-faint">
            {EMPTY_STATES.noReminders.detail}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {briefing.reminders.map((reminder) => (
              <li
                key={reminder.id}
                className={`rounded border px-2.5 py-1.5 ${
                  reminder.tone === "bad"
                    ? "border-bad/40 bg-bad-soft"
                    : reminder.tone === "warn"
                      ? "border-warn/40 bg-warn-soft"
                      : "border-edge bg-panel2"
                }`}
              >
                <PreviewLink
                  target={hrefTarget(reminder.href)}
                  href={reminder.href}
                  className="text-[13.5px] font-medium text-ink hover:underline"
                >
                  <span aria-hidden className="mr-1.5">
                    {reminder.icon}
                  </span>
                  {reminder.title}
                </PreviewLink>
                <p className="text-[12.5px] text-ink-muted">
                  {reminder.detail}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`🧭 What to do next (${briefing.suggestions.length})`}>
        {briefing.suggestions.length === 0 ? (
          <p className="text-[13.5px] text-ink-faint">
            Every open search is up to date. Worth using the time on the one you
            have been avoiding.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {briefing.suggestions.map((suggestion) => (
              <li
                key={`${suggestion.projectId}-${suggestion.id}`}
                className="border-l-2 border-edge2 pl-3"
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={`shrink-0 rounded px-1.5 text-[11px] ${
                      suggestion.priority === 1
                        ? "bg-bad-soft text-bad"
                        : suggestion.priority === 2
                          ? "bg-warn-soft text-warn"
                          : "bg-panel2 text-ink-faint"
                    }`}
                  >
                    {suggestion.priority === 1
                      ? "now"
                      : suggestion.priority === 2
                        ? "soon"
                        : "worth it"}
                  </span>
                  <PreviewLink
                    target={`job:${suggestion.projectId}`}
                    href={suggestion.href}
                    className="text-[14px] font-medium text-ink hover:underline"
                  >
                    {suggestion.title}
                  </PreviewLink>
                </div>
                <p className="mt-0.5 text-[12px] text-ink-faint">
                  {suggestion.projectName}
                </p>
                <p className="mt-0.5 text-[13px] text-ink-muted">
                  {suggestion.detail}
                </p>
                {suggestion.why && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[12.5px] text-accent">
                      Why this is the next thing
                    </summary>
                    <p className="mt-1 text-[13px] text-ink-muted">
                      {suggestion.why}
                    </p>
                    {suggestion.good && (
                      <p className="mt-1 text-[13px] text-ink-muted">
                        <span className="text-ink-faint">Done well: </span>
                        {suggestion.good}
                      </p>
                    )}
                  </details>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {briefing.beliefs.length > 0 && (
        <Card
          title={`🧠 Beliefs worth revisiting (${briefing.beliefs.length})`}
        >
          <p className="mb-2 text-[13px] text-ink-muted">
            Recorded on a job&rsquo;s Diagnosis page. The confidence is yours
            and only you can change it — this is a nudge, not a correction.
          </p>
          <ul className="space-y-2">
            {briefing.beliefs.map((belief) => (
              <li key={belief.id} className="border-l-2 border-edge2 pl-3">
                <Link
                  href={belief.href}
                  className="text-[13.5px] font-medium text-ink hover:underline"
                >
                  {belief.statement}
                </Link>
                <p className="text-[12px] text-ink-faint">
                  {belief.projectName}
                </p>
                <p className="mt-0.5 text-[13px] text-ink-muted">
                  {beliefPrompt(belief)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="💡 Worth knowing">
        <p className="text-[13.5px] text-ink-muted">{briefing.craftNote}</p>
      </Card>
    </>
  );
}
