"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ResearchResult } from "@/lib/research/provider";
import {
  runDiscoveryAction,
  saveDiscoveryResultAction,
} from "@/lib/actions/discovery";
import { candidateNameFromTitle } from "@/lib/domain/discovery";

interface QueryOption {
  id: string;
  platform: string;
  breadth: string;
  query: string;
}

/**
 * Live people-search against the Talent X-Ray engines. Results are
 * transient — nothing persists unless the recruiter saves a specific
 * result. Links open externally; result pages are never fetched.
 */
export function DiscoveryPanel({
  projectId,
  queries,
}: {
  projectId: string;
  queries: QueryOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(queries[0]?.query ?? "");
  const [engine, setEngine] = useState<"core" | "reach">("core");
  const [results, setResults] = useState<ResearchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedUrls, setSavedUrls] = useState<Record<string, string>>({});

  const run = () =>
    startTransition(async () => {
      setError(null);
      setResults(null);
      const r = await runDiscoveryAction({
        searchProjectId: projectId,
        query,
        engine,
      });
      if (r.ok) setResults(r.data.results);
      else setError(r.error);
    });

  const save = (result: ResearchResult, candidateName?: string) =>
    startTransition(async () => {
      const r = await saveDiscoveryResultAction({
        searchProjectId: projectId,
        url: result.url,
        title: result.title,
        snippet: result.snippet,
        source: result.source,
        query: result.query,
        candidateName: candidateName || undefined,
      });
      if (r.ok) {
        setSavedUrls((prev) => ({
          ...prev,
          [result.url]: candidateName ? "saved + candidate" : "saved",
        }));
        router.refresh();
      } else {
        setError(r.error);
      }
    });

  return (
    <div className="space-y-4">
      <div className="rounded border border-edge bg-panel p-4">
        {queries.length > 0 && (
          <label className="mb-2 block text-[12px] text-ink-muted">
            Composed strings from the Search String Lab
            <select
              className="mt-1 w-full rounded border border-edge bg-canvas px-2 py-1.5 text-[12.5px]"
              onChange={(e) => {
                const chosen = queries.find((q) => q.id === e.target.value);
                if (chosen) setQuery(chosen.query);
              }}
            >
              {queries.map((q) => (
                <option key={q.id} value={q.id}>
                  [{q.platform} · {q.breadth}] {q.query.slice(0, 90)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-[12px] text-ink-muted">
          Query (editable — what you search is always visible)
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-edge bg-canvas px-2 py-1.5 font-mono text-[12px]"
          />
        </label>
        <div className="mt-3 flex items-center gap-3">
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value as "core" | "reach")}
            className="rounded border border-edge bg-canvas px-2 py-1.5 text-[12.5px]"
          >
            <option value="core">
              Core engine (profiles, portfolios, CVs)
            </option>
            <option value="reach">
              Verified &amp; Reach (registries, rosters, contact records)
            </option>
          </select>
          <button
            type="button"
            onClick={run}
            disabled={isPending || query.trim().length < 2}
            className="rounded bg-accent px-3 py-1.5 text-[13px] font-medium text-canvas hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Searching…" : "Run search"}
          </button>
          <span className="text-[11.5px] text-ink-faint">
            Results are transient — nothing is stored unless you save it.
          </span>
        </div>
        {error && (
          <p className="mt-3 rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[12px] text-bad">
            {error}
          </p>
        )}
      </div>

      {results && (
        <div className="space-y-2">
          <p className="text-[12px] text-ink-muted">
            {results.length} result{results.length === 1 ? "" : "s"} · engine:{" "}
            {engine}
          </p>
          {results.map((result) => (
            <ResultRow
              key={result.url}
              result={result}
              savedState={savedUrls[result.url]}
              onSave={save}
              disabled={isPending}
            />
          ))}
          {results.length === 0 && (
            <p className="text-[13px] text-ink-muted">
              No results — try the balanced or broad variant, or the other
              engine.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ResultRow({
  result,
  savedState,
  onSave,
  disabled,
}: {
  result: ResearchResult;
  savedState?: string;
  onSave: (result: ResearchResult, candidateName?: string) => void;
  disabled: boolean;
}) {
  const [asCandidate, setAsCandidate] = useState(false);
  const [name, setName] = useState(candidateNameFromTitle(result.title));

  return (
    <div className="rounded border border-edge bg-panel px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <a
            href={result.url}
            target="_blank"
            rel="noopener"
            className="text-[13.5px] font-medium text-accent hover:underline"
          >
            {result.title ?? result.url}
          </a>
          <p className="mt-0.5 break-all font-mono text-[11px] text-ink-faint">
            {result.url}
          </p>
          {result.snippet && (
            <p className="mt-1 text-[12.5px] text-ink-muted">
              {result.snippet}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {savedState ? (
            <span className="rounded border border-ok/40 bg-ok-soft px-2 py-0.5 text-[11px] text-ok">
              {savedState}
            </span>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSave(result)}
                disabled={disabled}
                className="rounded border border-edge2 px-2.5 py-1 text-[12px] text-ink-muted hover:bg-panel2 disabled:opacity-50"
              >
                Save URL
              </button>
              <button
                type="button"
                onClick={() => setAsCandidate((v) => !v)}
                className="rounded border border-edge2 px-2.5 py-1 text-[12px] text-ink-muted hover:bg-panel2"
              >
                Save as candidate…
              </button>
            </>
          )}
        </div>
      </div>
      {asCandidate && !savedState && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Candidate name"
            className="w-64 rounded border border-edge bg-canvas px-2 py-1 text-[12.5px]"
          />
          <button
            type="button"
            onClick={() => name.trim() && onSave(result, name.trim())}
            disabled={disabled || !name.trim()}
            className="rounded bg-accent px-2.5 py-1 text-[12px] font-medium text-canvas hover:opacity-90 disabled:opacity-50"
          >
            Create candidate
          </button>
        </div>
      )}
    </div>
  );
}
