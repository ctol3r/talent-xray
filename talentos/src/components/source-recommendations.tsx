"use client";
import { useState, useTransition } from "react";
import { PRODUCT_NAME } from "@/lib/product";
import { useRouter } from "next/navigation";
import {
  prepareSourceRecommendationsAction,
  previewSourceRecommendationsAction,
  saveSourceRecommendationsAction,
} from "@/lib/actions/source-recommendations";
import {
  sourcePurposeLabel,
  type SourceRecommendations,
  type SavedSourceRecommendation,
  type SourceRecommendation,
} from "@/lib/core/source-recommendations";
import { Card, Tag } from "./ui";
import { buttonClass, subtleButtonClass, inputClass, ErrorNote } from "./forms";

export function SourceEvidence({
  evidence,
}: {
  evidence: SourceRecommendation["evidence"];
}) {
  if (!evidence.length)
    return (
      <p className="text-[12px] text-warn">
        No supporting source evidence supplied. Check this venue before using
        it.
      </p>
    );
  return (
    <div className="mt-2 space-y-2">
      {evidence.map((source, index) => (
        <div key={index} className="border-l-2 border-edge2 pl-3 text-[12px]">
          <p>Supplied excerpt: “{source.excerpt}”</p>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-accent hover:underline"
          >
            Open evidence source
          </a>
          <p className="text-ink-muted">
            Reported check: {source.checkedOn ?? "not checked"} · Data as of:{" "}
            {source.dataAsOf ?? "unknown"}
          </p>
          <p className="text-ink-faint">{source.limitation}</p>
        </div>
      ))}
    </div>
  );
}
export function SavedSourceDetails({
  metadata,
  stale,
}: {
  metadata: SavedSourceRecommendation;
  stale: boolean;
}) {
  return (
    <div className="mt-2 space-y-1">
      <div className="flex flex-wrap gap-2">
        <Tag>{sourcePurposeLabel[metadata.purpose]}</Tag>
        {stale && <Tag tone="warn">Search context changed — reassess fit</Tag>}
      </div>
      <p className="text-[12px] text-ink-muted">{metadata.limitation}</p>
      <details className="text-[12px] text-ink-faint">
        <summary className="cursor-pointer">
          Evidence and import history
        </summary>
        <p className="mt-1">
          {metadata.author}. Saved{" "}
          {new Date(metadata.importedAt).toLocaleString()}.
        </p>
        <p>
          Dates and excerpts are supplied claims; {PRODUCT_NAME} has not
          independently checked the venue.
        </p>
        <p>{metadata.reasoningSummary}</p>
        <ul className="list-disc pl-4">
          {metadata.researchLimitations.map((limitation, index) => (
            <li key={index}>{limitation}</li>
          ))}
        </ul>
        <SourceEvidence evidence={metadata.evidence} />
      </details>
    </div>
  );
}
export function SourceRecommendationsWorkbench({
  searchProjectId,
}: {
  searchProjectId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [request, setRequest] = useState("");
  const [response, setResponse] = useState("");
  const [preview, setPreview] = useState<SourceRecommendations | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const router = useRouter();
  const run = (operation: () => Promise<void>) =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      try {
        await operation();
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Could not complete this action.",
        );
      }
    });
  return (
    <Card className="mb-6 space-y-3">
      <h2 className="text-base font-semibold">
        Recommend venues for this role
      </h2>
      <p className="text-[13px] text-ink-muted">
        Find places to source candidates and places to give the opportunity
        exposure. Use your Codex or Claude session for research, then review and
        save the suggestions you choose. No model API key is needed.
      </p>
      <p className="text-[12px] text-ink-faint">
        Recommendations are unverified and may be incomplete. {PRODUCT_NAME}{" "}
        does not scrape profiles, post the role, contact people, or purchase
        access.
      </p>
      <button
        type="button"
        className={buttonClass}
        disabled={pending}
        onClick={() =>
          run(async () => {
            const result =
              await prepareSourceRecommendationsAction(searchProjectId);
            if (!result.ok) throw new Error(result.error);
            setRequest(JSON.stringify(result.data, null, 2));
            setPreview(null);
            setSelected([]);
          })
        }
      >
        1. Prepare source research request
      </button>
      {request && (
        <div className="space-y-2">
          <label className="block text-[12px] text-ink-muted">
            Review what will be shared: role, JD, and search context. Copy this
            into the Codex or Claude session you choose.
            <textarea
              className={`${inputClass} mt-1 font-mono text-xs`}
              aria-label="Source research request"
              rows={8}
              value={request}
              readOnly
            />
          </label>
          <button
            type="button"
            className={subtleButtonClass}
            onClick={() =>
              run(async () => {
                await navigator.clipboard.writeText(request);
                setMessage(
                  "Request copied. Paste it into your Codex or Claude session and ask it to return the requested JSON.",
                );
              })
            }
          >
            Copy research request
          </button>
        </div>
      )}
      <details open={request ? true : undefined}>
        <summary className="cursor-pointer text-[13px] font-medium">
          2. Import a research response
        </summary>
        <label className="mt-2 block text-[12px] text-ink-muted">
          Paste the JSON response. Previewing does not save venues.
          <textarea
            className={`${inputClass} mt-1 font-mono text-xs`}
            aria-label="Source research response"
            rows={7}
            maxLength={400000}
            value={response}
            onChange={(event) => {
              setResponse(event.target.value);
              setPreview(null);
              setSelected([]);
            }}
          />
        </label>
        <button
          type="button"
          className={`${subtleButtonClass} mt-2`}
          disabled={pending || !response.trim()}
          onClick={() =>
            run(async () => {
              const result = await previewSourceRecommendationsAction({
                searchProjectId,
                response,
              });
              if (!result.ok) throw new Error(result.error);
              setPreview(result.data);
              setSelected([]);
            })
          }
        >
          Preview recommendations
        </button>
      </details>
      {preview && (
        <section
          aria-label="Source recommendation preview"
          className="space-y-3 border-t border-edge pt-3"
        >
          <h3 className="text-sm font-semibold">
            3. Review and choose venues to save
          </h3>
          <p className="text-[13px] text-ink-muted">
            {preview.reasoningSummary}
          </p>
          <ul className="list-disc pl-4 text-[12px] text-ink-faint">
            {preview.limitations.map((limitation, index) => (
              <li key={index}>{limitation}</li>
            ))}
          </ul>
          {preview.recommendations.length === 0 && (
            <p className="text-[13px] text-ink-muted">
              No recommendations returned. Review the limitations or provide
              more role context.
            </p>
          )}
          {preview.recommendations.map((recommendation) => (
            <div
              key={recommendation.id}
              className="rounded border border-edge p-3"
            >
              <label className="flex items-start gap-2 text-[13px] font-medium">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selected.includes(recommendation.id)}
                  onChange={(event) =>
                    setSelected(
                      event.target.checked
                        ? [...selected, recommendation.id]
                        : selected.filter((id) => id !== recommendation.id),
                    )
                  }
                />
                Save {recommendation.name}
              </label>
              <div className="my-2 flex flex-wrap gap-2">
                <Tag>{sourcePurposeLabel[recommendation.purpose]}</Tag>
                <Tag>{recommendation.priority} priority</Tag>
                <Tag>Reported cost: {recommendation.costModel}</Tag>
                <Tag tone="warn">Unverified suggestion</Tag>
              </div>
              <p className="text-[13px]">{recommendation.whyRelevant}</p>
              <p className="text-[12px] text-ink-muted">
                Audience: {recommendation.audience} · Geography:{" "}
                {recommendation.geography}
              </p>
              <a
                className="text-[12px] text-accent hover:underline"
                href={recommendation.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open venue
              </a>
              <p className="text-[12px] text-ink-faint">
                {recommendation.limitation}
              </p>
              <SourceEvidence evidence={recommendation.evidence} />
            </div>
          ))}
          <button
            type="button"
            className={buttonClass}
            disabled={pending || selected.length === 0}
            onClick={() =>
              run(async () => {
                const result = await saveSourceRecommendationsAction({
                  searchProjectId,
                  response,
                  selectedIds: selected,
                });
                if (!result.ok) throw new Error(result.error);
                setMessage(
                  `Saved ${result.data.added} selected venue${result.data.added === 1 ? "" : "s"} as suggested. ${result.data.skipped ? `${result.data.skipped} already saved; existing records were preserved.` : ""}`,
                );
                setPreview(null);
                setSelected([]);
                router.refresh();
              })
            }
          >
            Save {selected.length || "selected"} venue
            {selected.length === 1 ? "" : "s"}
          </button>
        </section>
      )}
      <div role="status" aria-live="polite">
        {message && <p className="text-[13px] text-accent">{message}</p>}
      </div>
      <div role="alert">
        <ErrorNote error={error} />
      </div>
    </Card>
  );
}
