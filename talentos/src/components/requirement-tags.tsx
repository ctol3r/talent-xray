"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { tagHref } from "@/lib/core/tags";
import { keepJobTagAction } from "@/lib/actions/tags";
import type { RequirementTagProposal } from "@/lib/sourcing/requirement-tags";

/**
 * The words this role's requirements ask for, offered on the job.
 *
 * A job has never been prompted for a tag, which is why the graph has almost
 * no job-to-person links: a person accumulates words from their evidence and
 * the job has none of them to meet on. This is that prompt.
 *
 * Only words the shared vocabulary already knows are offered. A phrase unique
 * to one requirement would be written once and connect nothing, so
 * requirements the vocabulary cannot name are left for you to name yourself —
 * typing `[[` in the notes offers the words the workspace already uses.
 */
const WEIGHT_TONE: Record<string, string> = {
  hard: "border-accent/40 bg-accent-soft text-accent",
  preference: "border-edge2 bg-panel2 text-ink-muted",
  signal: "border-edge2 bg-panel2 text-ink-faint",
};

export function RequirementTags({
  searchProjectId,
  proposals,
}: {
  searchProjectId: string;
  proposals: RequirementTagProposal[];
}) {
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const router = useRouter();

  if (proposals.length === 0) {
    return (
      <p className="text-[13px] text-ink-muted">
        No new words to offer. Either this role&apos;s requirements name nothing
        the shared vocabulary knows, or the job already says them. Write your
        own in the notes — typing <code>[[</code> offers the words the workspace
        already uses, which is what makes a tag connect.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[13px] text-ink-muted">
        Read from the requirements, not generated. Keeping one writes the word
        into this job&apos;s notes — where the same word on a person becomes a
        link between them.
      </p>
      <ul className="space-y-1.5">
        {proposals.map((tag) => (
          <li
            key={tag.slug}
            className="rounded border border-edge2 bg-panel2 p-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] text-ink">🏷️ {tag.display}</span>
              <span
                className={`rounded border px-1.5 py-0.5 text-[11px] ${
                  WEIGHT_TONE[tag.from[0].weight] ?? WEIGHT_TONE.signal
                }`}
              >
                {tag.from[0].weight}
              </span>
              <span className="text-[11px] text-ink-faint">
                {tag.from.length} requirement
                {tag.from.length === 1 ? "" : "s"}
              </span>
              {kept.has(tag.slug) ? (
                <Link
                  href={tagHref(tag.slug)}
                  className="ml-auto text-[12px] text-accent hover:underline"
                >
                  kept ✓
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await keepJobTagAction({
                        searchProjectId,
                        slug: tag.slug,
                        display: tag.display,
                      });
                      if (result.ok) {
                        setKept((current) => new Set(current).add(tag.slug));
                        router.refresh();
                      } else {
                        setFailed((current) => ({
                          ...current,
                          [tag.slug]: result.error,
                        }));
                      }
                    })
                  }
                  className="ml-auto rounded border border-accent/40 bg-accent-soft px-2 py-0.5 text-[12px] text-accent disabled:opacity-50"
                >
                  keep
                </button>
              )}
            </div>
            <ul className="mt-1 space-y-0.5">
              {tag.from.slice(0, 3).map((source, index) => (
                <li
                  key={`${source.requirement}-${index}`}
                  className="text-[12px] text-ink-muted"
                >
                  “{source.requirement}” — matched{" "}
                  <span className="font-mono text-[11px]">
                    {source.matched}
                  </span>
                </li>
              ))}
            </ul>
            {failed[tag.slug] && (
              <p className="mt-1 text-[12px] text-warn">{failed[tag.slug]}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
