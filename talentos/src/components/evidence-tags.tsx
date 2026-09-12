"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { tagHref } from "@/lib/core/tags";
import { keepCandidateTagAction } from "@/lib/actions/tags";
import type { SuggestedTag } from "@/lib/sourcing/auto-tags";

/**
 * Tags the evidence already says, offered before anybody asks.
 *
 * These are read deterministically from every claim held about the person — a
 * team page, a registry row, a paper, a saved address, an import — so they are
 * there the moment the evidence is, with no key and no waiting. Each one shows
 * the sentence and the source that produced it, because a tag you cannot
 * challenge is a tag you have to take on trust.
 *
 * Nothing is applied. Keeping one writes the word into the notes, where it can
 * be deleted like any other word — the word in the text is the tag.
 */
const KIND_ICON: Record<string, string> = {
  capability: "🧠",
  place: "📍",
  organisation: "🏢",
  evidence: "📎",
};

export function EvidenceTags({
  candidateId,
  suggestions,
}: {
  candidateId: string;
  suggestions: SuggestedTag[];
}) {
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const router = useRouter();

  if (suggestions.length === 0) {
    return (
      <p className="text-[13px] text-ink-muted">
        Nothing to read yet. Tags appear here as evidence arrives — a saved
        address, an imported record, a document you paste in.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[13px] text-ink-muted">
        Read from what is on file, not generated. Each word shows where it came
        from; keeping one writes it into the notes.
      </p>
      <ul className="space-y-1.5">
        {suggestions.map((tag) => (
          <li
            key={tag.slug}
            className="rounded border border-edge2 bg-panel2 p-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] text-ink">
                {KIND_ICON[tag.kind] ?? "🏷️"} {tag.display}
              </span>
              <span className="font-mono text-[11px] text-ink-muted">
                {tag.confidence.toFixed(2)}
              </span>
              <span className="text-[11px] text-ink-faint">
                {tag.evidence.length} source
                {tag.evidence.length === 1 ? "" : "s"}
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
                      const result = await keepCandidateTagAction({
                        candidateId,
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
              {tag.evidence.map((source, index) => (
                <li
                  key={`${source.sourceUrl}-${index}`}
                  className="text-[12px] text-ink-muted"
                >
                  “{source.quote}” — {source.surface}
                  {source.domain ? ` · ${source.domain}` : ""}
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
