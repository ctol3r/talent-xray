"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { tagHref } from "@/lib/core/tags";
import {
  keepCandidateTagAction,
  suggestCandidateTagsAction,
  type TagSuggestion,
} from "@/lib/actions/tags";

/**
 * Tags read off a person's own material, offered one at a time.
 *
 * Nothing is applied automatically. Each suggestion shows the words from the
 * CV that support it, because the evidence is what the recruiter is actually
 * judging; the label is just the handle. Keeping one writes the word into the
 * notes, where it can be deleted like any other word.
 */
export function CandidateTagSuggestions({
  candidateId,
}: {
  candidateId: string;
}) {
  const [suggestions, setSuggestions] = useState<TagSuggestion[] | null>(null);
  const [notFound, setNotFound] = useState<string[]>([]);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setMessage(null);
              setWaiting(null);
              const result = await suggestCandidateTagsAction({ candidateId });
              if (result.ok) {
                setSuggestions(result.data.suggestions);
                setNotFound(result.data.notFound);
              } else if (result.kind === "pending" && result.handoff) {
                setWaiting(result.handoff.requestPath);
              } else {
                setMessage(result.error);
              }
            })
          }
          className="rounded border border-edge2 px-3 py-1.5 text-[14px] text-ink-muted hover:bg-panel2 disabled:opacity-50"
        >
          {pending ? "Reading the profile…" : "Suggest tags from the profile"}
        </button>
        <p className="text-[12.5px] text-ink-faint">
          Nothing is applied until you keep it.
        </p>
      </div>

      {waiting && (
        <div className="rounded border border-edge2 bg-panel2 px-3 py-2 text-[13px] text-ink-muted">
          <p className="font-medium text-ink">
            Waiting for your Claude session.
          </p>
          <p className="mt-1">
            Nothing failed. The request was written to a file for a session to
            answer, then press the button again.
          </p>
          <code className="mt-1.5 block break-all text-[12px] text-ink">
            {waiting}
          </code>
        </div>
      )}

      {message && (
        <p className="rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] text-bad">
          {message}
        </p>
      )}

      {suggestions?.length === 0 && (
        <p className="text-[13px] text-ink-faint">
          Nothing new to suggest from the material on file.
        </p>
      )}

      {suggestions && suggestions.length > 0 && (
        <ul className="space-y-1.5">
          {suggestions.map((suggestion) => {
            const done = kept.has(suggestion.slug);
            return (
              <li
                key={suggestion.slug}
                className="flex items-start justify-between gap-3 rounded border border-edge bg-panel2 px-2.5 py-1.5"
              >
                <div className="min-w-0">
                  <p className="text-[13.5px] text-ink">
                    {done ? (
                      <Link
                        href={tagHref(suggestion.slug)}
                        className="text-accent hover:underline"
                      >
                        {suggestion.tag}
                      </Link>
                    ) : (
                      suggestion.tag
                    )}
                    <span className="ml-2 text-[11px] uppercase tracking-wider text-ink-faint">
                      {suggestion.kind}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">
                    {suggestion.evidence}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={done || pending}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await keepCandidateTagAction({
                        candidateId,
                        slug: suggestion.slug,
                        display: suggestion.tag,
                      });
                      if (result.ok) {
                        setKept((current) =>
                          new Set(current).add(suggestion.slug),
                        );
                        router.refresh();
                      } else {
                        setMessage(result.error);
                      }
                    })
                  }
                  className="shrink-0 rounded border border-edge2 px-2 py-1 text-[12.5px] text-ink-muted hover:bg-panel disabled:opacity-50"
                >
                  {done ? "Kept" : "Keep"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {notFound.length > 0 && (
        <div className="rounded border border-warn/40 bg-warn-soft px-2.5 py-2">
          <p className="text-[12px] uppercase tracking-wider text-warn">
            Not evidenced by the material
          </p>
          <ul className="mt-1 space-y-0.5">
            {notFound.map((gap) => (
              <li key={gap} className="text-[13px] text-ink-muted">
                {gap}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
