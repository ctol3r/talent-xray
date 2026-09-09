"use client";

import { usePanes } from "./sliding-panes";

/**
 * "Open beside" — the button that makes any section of the product a pane.
 *
 * Put it in a page header and that page can sit alongside whatever you are
 * doing: the calendar next to a job, the task list next to a person, a tag
 * next to all three. Panes were only ever pages before, which made the stack
 * a reading tool rather than a workspace.
 */
export function OpenAsPane({
  target,
  label = "Open beside",
}: {
  target: string;
  label?: string;
}) {
  const { open, panes } = usePanes();
  const already = panes.includes(target);
  return (
    <button
      type="button"
      onClick={() => open(target)}
      disabled={already}
      title="Opens in a pane beside your work; drag its spine to move it"
      className="rounded border border-edge2 px-2 py-1 text-[13px] text-ink-muted hover:bg-panel2 hover:text-ink disabled:opacity-40"
    >
      {already ? "Already beside ✓" : `⇥ ${label}`}
    </button>
  );
}
