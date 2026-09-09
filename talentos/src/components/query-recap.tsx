"use client";

import { openCommandBar } from "./command-bar";

/**
 * What ran, on a page that no longer has a box to type in.
 *
 * `/search` and `/sourcing` are result views now: one input at the top of the
 * workspace composes every query, so a second input on the results page would
 * be a second place to learn and a second place for the two to disagree. What
 * a results page owes the reader instead is the string that produced it —
 * visible, and one keystroke from being changed.
 *
 * The button opens the command menu carrying this query, so editing a search
 * is editing, not retyping.
 */
export function QueryRecap({
  query,
  label,
}: {
  /** The string that produced what is on screen. */
  query: string;
  /** What this surface does with it, for the button's accessible name. */
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[12px] tracking-wider text-ink-faint uppercase">
        {label}
      </span>
      <code className="min-w-0 flex-1 truncate rounded bg-panel2 px-2 py-1 font-mono text-[13px] text-ink">
        {query}
      </code>
      <button
        type="button"
        onClick={() => openCommandBar(query)}
        className="rounded border border-edge2 px-2 py-1 text-[12.5px] text-ink-muted hover:bg-panel2 hover:text-ink"
      >
        Change it{" "}
        <kbd className="rounded border border-edge2 px-1 font-mono">/</kbd>
      </button>
    </div>
  );
}

/**
 * The way in when nothing has been searched yet.
 *
 * An empty result view with no way forward is a dead end; this is the one
 * button that is not a second query box.
 */
export function OpenTheMenu({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => openCommandBar()}
      className="rounded border border-accent/40 bg-accent-soft px-3 py-1.5 text-[14px] font-medium text-accent"
    >
      {children}
    </button>
  );
}
