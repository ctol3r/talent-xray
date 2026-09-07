"use client";

import { useState, useTransition } from "react";
import {
  findCandidatesByUrlAction,
  suppressUrlAction,
} from "@/lib/actions/profile-links";
import { buttonClass, inputClass, subtleButtonClass } from "./forms";
import { Card } from "./ui";

/**
 * Answering a person who asks what you hold about them (LEGAL.md §5).
 *
 * Search by an address, across every search, and either open the record or
 * record an objection. An objection blocks that address on every write path
 * for good, and survives the deletion of the record it was about.
 */
export function DataRequestCard() {
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [hits, setHits] = useState<
    { candidateId: string; name: string; searchProjectId: string }[] | null
  >(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const find = () =>
    startTransition(async () => {
      setError(null);
      setStatus(null);
      const r = await findCandidatesByUrlAction({ url });
      if (r.ok) setHits(r.data.hits);
      else setError(r.error);
    });

  const objection = () =>
    startTransition(async () => {
      setError(null);
      const r = await suppressUrlAction({
        url,
        reason: "objection",
        note: "Recorded from a data request.",
      });
      if (r.ok) {
        setStatus(
          "Objection recorded. This address can no longer be saved by paste, import, capture, sweep or a platform read, on any search.",
        );
        setHits(null);
      } else setError(r.error);
    });

  return (
    <Card title="Data requests">
      <p className="text-[13px] text-ink-muted">
        If someone asks what you hold about them, search by one of their
        addresses. You can open each record to export or delete it, and record
        an objection so the address is never saved again.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.linkedin.com/in/example"
          className={`${inputClass} max-w-md`}
        />
        <button
          type="button"
          onClick={find}
          disabled={pending || url.trim().length < 8}
          className={buttonClass}
        >
          Find
        </button>
        <button
          type="button"
          onClick={objection}
          disabled={pending || url.trim().length < 8}
          className={subtleButtonClass}
        >
          Record an objection
        </button>
      </div>

      {hits && hits.length === 0 && (
        <p className="mt-3 text-[12.5px] text-ink-muted">
          Nothing is held at that address.
        </p>
      )}
      {hits && hits.length > 0 && (
        <ul className="mt-3 space-y-1">
          {hits.map((hit) => (
            <li key={hit.candidateId} className="text-[12.5px]">
              <a
                href={`/searches/${hit.searchProjectId}/candidates/${hit.candidateId}`}
                className="text-accent hover:underline"
              >
                {hit.name}
              </a>
            </li>
          ))}
        </ul>
      )}
      {status && (
        <p className="mt-3 rounded border border-ok/40 bg-ok-soft px-3 py-2 text-[12px] text-ok">
          {status}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[12px] text-bad">
          {error}
        </p>
      )}
    </Card>
  );
}
