"use client";

import { useState } from "react";
import { economise } from "../../artifact-src/core/query-economy";
import { upsertQueryAction } from "@/lib/actions/workflow";
import { useAction, ErrorNote } from "./forms";

/**
 * What this string is spending, and what it could stop spending.
 *
 * Google ignores everything past the 32nd word of a query and says so in a
 * line above the results nobody reads — this product has watched it happen to
 * its own strings. So the offer is concrete: here is the same search, costing
 * fewer terms, and here is every change and why.
 *
 * Nothing is applied on its own. The composed query belongs to the reader
 * (product rule 6) and an economiser that quietly rewrote it would be exactly
 * the thing that rule forbids. It shows the diff and waits.
 */
export function QueryEconomy({
  queryId,
  searchProjectId,
  platform,
  breadth,
  purpose,
  query,
}: {
  queryId: string;
  searchProjectId: string;
  platform: string;
  breadth: string;
  purpose?: string | null;
  query: string;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, submit } = useAction();
  const better = economise(query);
  const saved = better.before - better.after;

  // Nothing to say. A string that is already tight should not carry a control
  // that does nothing when pressed.
  if (better.query === query) return null;

  return (
    <div className="mt-1.5">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="rounded border border-edge2 px-2 py-0.5 text-[12px] text-ink-muted hover:bg-panel2 hover:text-ink"
      >
        ✂️{" "}
        {saved > 0
          ? `${saved} term${saved === 1 ? "" : "s"} back`
          : "tighten this"}
      </button>

      {open && (
        <div className="mt-1.5 rounded border border-edge bg-panel px-3 py-2">
          <code className="block font-mono text-[13px] leading-5 break-words text-ink">
            {better.query}
          </code>
          <p className="mt-1 text-[11.5px] text-ink-faint">
            {better.before} → {better.after} of Google&apos;s 32 terms.
          </p>
          <ul className="mt-1.5 space-y-1">
            {better.savings.map((saving, index) => (
              <li
                key={`${saving.was}-${index}`}
                className="text-[12px] text-ink-muted"
              >
                {saving.why}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                submit(
                  () =>
                    upsertQueryAction({
                      id: queryId,
                      searchProjectId,
                      platform,
                      query: better.query,
                      purpose: purpose ?? undefined,
                      breadth,
                    }),
                  () => setOpen(false),
                )
              }
              className="rounded bg-accent px-2.5 py-1 text-[12px] font-medium text-canvas hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Use this"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[12px] text-ink-faint hover:text-ink"
            >
              Leave it
            </button>
          </div>
          <ErrorNote error={error} />
        </div>
      )}
    </div>
  );
}
