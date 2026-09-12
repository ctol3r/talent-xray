"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DiscoveryResult } from "@/lib/research/discovery-provider";
import {
  runOpenIndexAction,
  saveDiscoveryResultAction,
} from "@/lib/actions/discovery";
import { Card } from "@/components/ui";
import { EMPTY_STATES } from "@/lib/domain/voice";

/**
 * The open index: people search over public, licensed APIs.
 *
 * Three things are on screen before anything is called, because rule 6 says
 * the user sees what was searched: the spec, where each field came from, and
 * the exact request URL each source will fetch. All of it is editable.
 *
 * Saving is per row and explicit, and goes through the same path a link-out
 * save uses, so an open-index row lands in the yield ledger labelled
 * unverified like every other search result.
 */

export interface SourceStatus {
  id: string;
  label: string;
  licence: string;
  population: string;
  active: boolean;
}

export interface OpenIndexSpecValue {
  terms: string[];
  organisations: string[];
  geography: string[];
  technologies: string[];
  name?: string;
  limit: number;
}

const FIELDS: {
  key: "terms" | "organisations" | "geography" | "technologies";
  label: string;
  hint: string;
}[] = [
  { key: "terms", label: "Terms", hint: "the subject of the work" },
  { key: "organisations", label: "Organisations", hint: "where they are" },
  { key: "geography", label: "Places", hint: "used where a source can filter" },
  {
    key: "technologies",
    label: "Languages",
    hint: "code hosts only; nothing implies these",
  },
];

const inputClass =
  "w-full rounded border border-edge2 bg-panel2 px-2 py-1.5 text-[13.5px] text-ink";

export function OpenIndexPanel({
  projectId,
  initialSpec,
  provenance,
  status,
}: {
  projectId: string;
  initialSpec: OpenIndexSpecValue;
  provenance: Record<string, string>;
  status: { configured: boolean; mock: boolean; sources: SourceStatus[] };
}) {
  const [spec, setSpec] = useState<OpenIndexSpecValue>(initialSpec);
  const [results, setResults] = useState<DiscoveryResult[] | null>(null);
  const [reports, setReports] = useState<
    { source: string; label: string; count: number; error?: string }[]
  >([]);
  const [requests, setRequests] = useState<
    { source: string; url: string; purpose: string }[]
  >([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const active = status.sources.filter((source) => source.active);

  function setList(key: keyof OpenIndexSpecValue, raw: string) {
    setSpec((current) => ({
      ...current,
      [key]: raw
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    }));
  }

  return (
    <Card title="🗂️ Open index — people from public, licensed records">
      <p className="text-[13.5px] text-ink-muted">
        Structured public APIs, not a crawl: each one is an official endpoint
        whose licence permits this use. Nothing is stored until you keep a row.
      </p>

      {!status.configured ? (
        <p className="mt-3 rounded border border-warn/40 bg-warn-soft px-3 py-2 text-[13px] text-warn">
          No source is switched on. Set <code>TALENTOS_OPEN_INDEX</code> to a
          comma-separated list of{" "}
          {status.sources.map((source) => source.id).join(", ")} — each source
          carries its own licence question, so they are enabled one at a time.
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-1.5">
            {active.map((source) => (
              <li
                key={source.id}
                className="rounded border border-edge bg-panel2 px-2.5 py-1.5"
              >
                <p className="text-[13.5px] font-medium text-ink">
                  {source.label}
                </p>
                <p className="text-[12.5px] text-ink-muted">
                  {source.population}
                </p>
                <p className="mt-0.5 text-[12px] text-ink-faint">
                  {source.licence}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <label key={field.key} className="block">
                <span className="mb-0.5 block text-[12px] text-ink-muted">
                  {field.label}{" "}
                  <span className="text-ink-faint">— {field.hint}</span>
                </span>
                <input
                  value={spec[field.key].join(", ")}
                  onChange={(event) => setList(field.key, event.target.value)}
                  className={inputClass}
                  placeholder="comma separated"
                />
                <span className="mt-0.5 block text-[11.5px] text-ink-faint">
                  from: {provenance[field.key] ?? "you"}
                </span>
              </label>
            ))}
            <label className="block">
              <span className="mb-0.5 block text-[12px] text-ink-muted">
                A specific person (optional)
              </span>
              <input
                value={spec.name ?? ""}
                onChange={(event) =>
                  setSpec((c) => ({
                    ...c,
                    name: event.target.value || undefined,
                  }))
                }
                className={inputClass}
                placeholder="leave empty to sweep"
              />
            </label>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setMessage(null);
                  const result = await runOpenIndexAction({
                    searchProjectId: projectId,
                    spec,
                  });
                  if (result.ok) {
                    setResults(result.data.results);
                    setReports(result.data.reports);
                    setRequests(result.data.requests);
                  } else {
                    setMessage(result.error);
                  }
                })
              }
              className="rounded bg-accent px-3 py-1.5 text-[14px] font-medium text-canvas hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Searching…" : "Search the open index"}
            </button>
            {status.mock && (
              <span className="text-[12px] text-warn">mock mode</span>
            )}
          </div>

          {message && (
            <p className="mt-2 rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] text-bad">
              {message}
            </p>
          )}

          {requests.length > 0 && (
            <details className="mt-3 rounded border border-edge bg-panel2">
              <summary className="cursor-pointer px-2.5 py-1.5 text-[12.5px] text-ink-muted">
                What was asked ({requests.length} requests)
              </summary>
              <ul className="space-y-1 border-t border-edge px-2.5 py-2">
                {requests.map((request) => (
                  <li key={request.url}>
                    <p className="text-[12.5px] text-ink-muted">
                      {request.purpose}
                    </p>
                    <code className="block break-all text-[11.5px] text-ink-faint">
                      {request.url}
                    </code>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {reports.length > 0 && (
            <ul className="mt-2 space-y-1">
              {reports
                .filter((report) => report.error)
                .map((report) => (
                  <li
                    key={report.source}
                    className="rounded border border-warn/40 bg-warn-soft px-2.5 py-1.5 text-[12.5px] text-warn"
                  >
                    {report.label}: {report.error}
                  </li>
                ))}
            </ul>
          )}

          {results && results.length === 0 && (
            <p className="mt-3 text-[13px] text-ink-faint">
              {EMPTY_STATES.noOpenIndexResults.detail}
            </p>
          )}

          {results && results.length > 0 && (
            <ul className="mt-3 space-y-1.5" data-testid="open-index-results">
              {results.map((result) => (
                <li
                  key={`${result.engine}-${result.url}`}
                  className="flex items-start justify-between gap-3 rounded border border-edge bg-panel2 px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <a
                      href={result.url}
                      target="_blank"
                      rel="noopener"
                      className="text-[13.5px] font-medium text-accent hover:underline"
                    >
                      {result.title ?? result.url}
                    </a>
                    <p className="text-[12px] text-ink-faint">
                      {result.engine} · unverified
                    </p>
                    {result.snippet && (
                      <p className="mt-0.5 text-[12.5px] text-ink-muted">
                        {result.snippet}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={pending || saved.has(result.url)}
                    onClick={() =>
                      startTransition(async () => {
                        const outcome = await saveDiscoveryResultAction({
                          searchProjectId: projectId,
                          url: result.url,
                          title: result.title,
                          snippet: result.snippet,
                          provider: result.provider,
                          engine: result.engine,
                          query: result.query,
                          retrievedAt: result.retrievedAt,
                          providerRank: result.providerRank,
                          candidateName: result.title,
                        });
                        if (outcome.ok) {
                          setSaved((current) =>
                            new Set(current).add(result.url),
                          );
                          router.refresh();
                        } else {
                          setMessage(outcome.error);
                        }
                      })
                    }
                    className="shrink-0 rounded border border-edge2 px-2 py-1 text-[12.5px] text-ink-muted hover:bg-panel disabled:opacity-50"
                  >
                    {saved.has(result.url) ? "Kept" : "Keep"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
