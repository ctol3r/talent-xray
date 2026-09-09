"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordLinkOutRunAction } from "@/lib/actions/discovery";
import { buildHostedSearchUrl, parseSaveLines } from "@/lib/domain/discovery";
import type { SweepQuery } from "@/lib/domain/profile-sweep";

/**
 * Search for one person's other profiles (Wave H2). Each template opens on
 * the engine's own hosted results page — the app never reads it — and one
 * form records what the recruiter saw and kept, for whichever template they
 * ran. The addresses land on this candidate through the same guard as a
 * paste, and the run lands in the yield ledger under its template.
 */
export function ProfileSweepPanel({
  searchProjectId,
  candidateId,
  candidateName,
  queries,
  hosted,
}: {
  searchProjectId: string;
  candidateId: string;
  candidateName: string;
  queries: SweepQuery[];
  hosted: { core: string; reach: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [ranTemplate, setRanTemplate] = useState<string>(
    queries[0]?.key ?? "T1",
  );
  const [count, setCount] = useState("");
  const [lines, setLines] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (queries.length === 0) return null;

  const textFor = (q: SweepQuery) => edited[q.key] ?? q.query;
  const ran = queries.find((q) => q.key === ranTemplate) ?? queries[0];

  const record = () =>
    startTransition(async () => {
      setError(null);
      setStatus(null);
      if (!/^\d+$/.test(count.trim())) {
        setError(
          "Enter the result count shown at the top of the engine page (0 if it shows none).",
        );
        return;
      }
      const { saves, rejected } = parseSaveLines(lines);
      if (rejected.length > 0) {
        setError(
          `Not a complete http(s) address — fix or remove: ${rejected.slice(0, 3).join(" · ")}`,
        );
        return;
      }
      const r = await recordLinkOutRunAction({
        searchProjectId,
        queryText: textFor(ran),
        engine: ran.engine,
        resultCount: Number(count.trim()),
        candidateId,
        sweepTemplate: ran.key,
        attachToCandidateId: candidateId,
        saves: saves.map((s) => ({ url: s.url })),
      });
      if (r.ok) {
        setStatus(
          `Run recorded · ${r.data.savedUrls} address${r.data.savedUrls === 1 ? "" : "es"} kept on ${candidateName}`,
        );
        setCount("");
        setLines("");
        router.refresh();
      } else setError(r.error);
    });

  return (
    <div className="mt-4 rounded border border-edge bg-canvas p-3">
      <p className="text-[13.5px] font-medium">Search for more profiles</p>
      <p className="mt-0.5 text-[12.5px] text-ink-faint">
        Each of these opens on the engine&apos;s own results page in a new tab.
        Open the addresses you find, judge them yourself, then paste the ones
        worth keeping below. Nothing is read or stored for you.
      </p>

      <ul className="mt-2 space-y-2">
        {queries.map((q) => {
          const text = textFor(q);
          const href = buildHostedSearchUrl(hosted[q.engine], text);
          return (
            <li key={q.key} className="rounded border border-edge px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">
                    {q.key} · {q.purpose}
                  </p>
                  <textarea
                    value={text}
                    onChange={(e) =>
                      setEdited((prev) => ({
                        ...prev,
                        [q.key]: e.target.value,
                      }))
                    }
                    rows={2}
                    className="mt-1 w-full rounded border border-edge bg-panel px-2 py-1 font-mono text-[12.5px]"
                  />
                  <p className="mt-0.5 text-[12px] text-ink-faint">
                    {q.terms}/32 terms ·{" "}
                    {q.engine === "reach" ? "Reach engine" : "Core engine"}
                    {q.omittedExclusions.length > 0 && (
                      <>
                        {" "}
                        · {q.omittedExclusions.length} exclusion
                        {q.omittedExclusions.length === 1 ? "" : "s"} left out
                        for the budget; the surface policy still applies when
                        you keep an address
                      </>
                    )}
                  </p>
                </div>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setRanTemplate(q.key)}
                  className="shrink-0 rounded bg-accent px-2.5 py-1 text-[13px] font-medium text-canvas hover:opacity-90"
                >
                  Open on engine ↗
                </a>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 rounded border border-edge2 px-3 py-2">
        <p className="text-[13px] font-medium">Record what you saw</p>
        <div className="mt-1.5 flex flex-wrap items-end gap-3">
          <label className="block text-[12.5px] text-ink-muted">
            Which search
            <select
              value={ranTemplate}
              onChange={(e) => setRanTemplate(e.target.value)}
              className="mt-1 block rounded border border-edge bg-panel px-2 py-1 text-[13px]"
            >
              {queries.map((q) => (
                <option key={q.key} value={q.key}>
                  {q.key} · {q.purpose}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12.5px] text-ink-muted">
            Result count shown
            <input
              type="text"
              inputMode="numeric"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              placeholder="e.g. 12"
              className="mt-1 block w-24 rounded border border-edge bg-panel px-2 py-1 text-[13px]"
            />
          </label>
        </div>
        <label className="mt-2 block text-[12.5px] text-ink-muted">
          Addresses to keep on {candidateName} — one per line
          <textarea
            value={lines}
            onChange={(e) => setLines(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-edge bg-panel px-2 py-1 font-mono text-[12.5px]"
          />
        </label>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={record}
            disabled={pending}
            className="rounded border border-edge2 px-2.5 py-1 text-[13px] text-ink-muted hover:bg-panel2 disabled:opacity-50"
          >
            Record run
          </button>
          {status && <span className="text-[12.5px] text-ok">{status}</span>}
        </div>
        {error && (
          <p className="mt-2 rounded border border-bad/40 bg-bad-soft px-2 py-1 text-[12.5px] text-bad">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
