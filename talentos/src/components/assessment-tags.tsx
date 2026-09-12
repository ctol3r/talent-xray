"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { tagHref } from "@/lib/core/tags";
import { keepCandidateTagAction } from "@/lib/actions/tags";
import type { AssessmentTagProposal } from "@/lib/sourcing/requirement-tags";

/**
 * The words this person's assessment supports, offered on the person.
 *
 * Every word here is one the job itself already carries, which is the whole
 * point: keeping one closes a job-to-person link rather than adding another
 * label. A word the job does not use is not offered, however well the
 * evidence supports it — that belongs to the person's own evidence tags.
 *
 * Only criteria where evidence was actually found appear. "Missing",
 * "contradictory" and "unknown" are assessments that the evidence does not
 * support the criterion, so putting the word on the person would say the
 * opposite of what was found. "Partial" is offered but says so.
 */
export function AssessmentTags({
  candidateId,
  proposals,
}: {
  candidateId: string;
  proposals: AssessmentTagProposal[];
}) {
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const router = useRouter();

  if (proposals.length === 0) {
    return (
      <p className="text-[13px] text-ink-muted">
        Nothing to offer yet. Words appear here once this job carries tags of
        its own and an alignment finds evidence for them — tag the role first,
        on its Role Intelligence page.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[13px] text-ink-muted">
        These words are already written on this job. Keeping one writes it on
        this person too, which is what makes the two connect.
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
                  tag.from[0].status === "strong"
                    ? "border-ok/40 bg-ok-soft text-ok"
                    : "border-edge2 bg-panel2 text-ink-muted"
                }`}
              >
                {tag.from[0].status} evidence
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
              {tag.from.slice(0, 3).map((source, index) => (
                <li
                  key={`${source.criterion}-${index}`}
                  className="text-[12px] text-ink-muted"
                >
                  “{source.criterion}”
                  {source.requirement ? (
                    <span className="text-ink-faint">
                      {" "}
                      — assessed against “{source.requirement}”
                    </span>
                  ) : null}
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
