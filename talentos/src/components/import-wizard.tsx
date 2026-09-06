"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { commitImportAction, previewImportAction } from "@/lib/actions/imports";
import {
  CANONICAL_FIELDS,
  IMPORT_SOURCES,
  type CanonicalField,
  type ImportSource,
} from "@/lib/imports/contracts";
import type { ImportPreview } from "@/lib/imports/preview";
import type { CommitResult } from "@/lib/services/imports";
import { buttonClass, inputClass, subtleButtonClass } from "./forms";
import { Card, Tag } from "./ui";

const SOURCE_LABELS: Record<ImportSource, string> = {
  hireez: "hireEZ",
  linkedin_recruiter: "LinkedIn Recruiter",
  generic_ats: "ATS export",
  heartbeat: "Heartbeat.ai",
};

type Preview = ImportPreview & { text: string; filename: string };

/**
 * Three steps: file + source → preview (dry run, nothing written) →
 * result. The server re-validates and re-scans every row on commit; this
 * component never decides safety on its own.
 */
export function ImportWizard({ searchProjectId }: { searchProjectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<ImportSource | "">("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [overrides, setOverrides] = useState<
    Record<string, CanonicalField | "drop">
  >({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [keepContact, setKeepContact] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);

  const runPreview = (form: FormData) =>
    startTransition(async () => {
      setError(null);
      const r = await previewImportAction(form);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPreview(r.data);
      setSource(r.data.source);
      setSelected(
        new Set(
          r.data.rows
            .filter((row) => row.decision !== "skip")
            .map((row) => row.index),
        ),
      );
    });

  const rePreview = (
    next: Record<string, CanonicalField | "drop">,
    nextSource?: ImportSource,
  ) => {
    if (!preview) return;
    const form = new FormData();
    form.set("searchProjectId", searchProjectId);
    form.set("text", preview.text);
    form.set("filename", preview.filename);
    form.set("source", nextSource ?? source);
    form.set("overrides", JSON.stringify(next));
    runPreview(form);
  };

  const commit = () =>
    startTransition(async () => {
      if (!preview || !source) return;
      setError(null);
      const rows = preview.rows
        .filter((r) => selected.has(r.index))
        .map((r) => r.row);
      const r = await commitImportAction({
        searchProjectId,
        source,
        filename: preview.filename,
        keepContactData: keepContact,
        rows,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setResult(r.data);
      router.refresh();
    });

  if (result) {
    return (
      <Card title="Import complete">
        <p className="text-[13px] text-ink">
          {result.created.length} candidate
          {result.created.length === 1 ? "" : "s"} created ·{" "}
          {result.flagged.length} flagged for identity review
          {result.contactEvidenceCount > 0 &&
            ` · ${result.contactEvidenceCount} vendor contact field${result.contactEvidenceCount === 1 ? "" : "s"} kept as unverified evidence`}
          .
        </p>
        <ul className="mt-2 space-y-1 text-[12.5px]">
          {result.created.map((c) => (
            <li key={c.id}>
              <Link
                href={`/searches/${searchProjectId}/candidates/${c.id}`}
                className="text-accent hover:underline"
              >
                {c.name}
              </Link>
              {result.flagged.some((f) => f.candidateId === c.id) && (
                <Tag tone="warn">identity review</Tag>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] text-ink-muted">
          Flagged rows were created as separate records — nothing was merged.
          Review them on the{" "}
          <Link href="/tasks" className="text-accent hover:underline">
            tasks page
          </Link>
          .
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!preview && (
        <Card title="1 · Choose an export">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              form.set("searchProjectId", searchProjectId);
              runPreview(form);
            }}
          >
            <label className="block text-[12.5px] text-ink-muted">
              File (.csv or .json, up to 5 MiB)
              <input
                name="file"
                type="file"
                accept=".csv,.json,text/csv,application/json"
                required
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-[12.5px] text-ink-muted">
              Source
              <select
                name="source"
                value={source}
                onChange={(e) => setSource(e.target.value as ImportSource | "")}
                className={`${inputClass} mt-1`}
              >
                <option value="">Detect from headers</option>
                {IMPORT_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-[11.5px] text-ink-faint">
              Nothing is written until you commit. Columns that carry protected
              characteristics are dropped before mapping. Vendor contact data is
              dropped unless you keep it, and is never marked verified.
            </p>
            {error && (
              <p className="rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[12px] text-bad">
                {error}
              </p>
            )}
            <button type="submit" disabled={pending} className={buttonClass}>
              {pending ? "Reading…" : "Preview import"}
            </button>
          </form>
        </Card>
      )}

      {preview && (
        <>
          <Card
            title={`2 · Preview — ${preview.sourceLabel} · ${preview.filename}`}
          >
            <p className="text-[12.5px] text-ink-muted">
              {preview.counts.total} row{preview.counts.total === 1 ? "" : "s"}{" "}
              · {preview.counts.create} to create · {preview.counts.flagged}{" "}
              flagged for identity review · {preview.counts.skip} skipped (same
              profile URL already saved).
            </p>
            {preview.droppedColumns.length > 0 && (
              <p className="mt-2 rounded border border-warn/40 bg-warn-soft px-3 py-2 text-[12px] text-warn">
                {preview.droppedColumns.length} column
                {preview.droppedColumns.length === 1 ? "" : "s"} dropped before
                mapping:{" "}
                {preview.droppedColumns.map((d) => d.header).join(", ")}.
              </p>
            )}
            {preview.parseWarnings.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-[12px] text-ink-muted">
                {preview.parseWarnings.slice(0, 8).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <p className="mb-1 text-[12px] text-ink-muted">Source</p>
              <select
                value={source}
                onChange={(e) => {
                  const next = e.target.value as ImportSource;
                  setSource(next);
                  rePreview(overrides, next);
                }}
                className={`${inputClass} max-w-xs`}
              >
                {IMPORT_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table
                className="w-full text-left text-[12px]"
                data-testid="mapping-table"
              >
                <thead>
                  <tr className="border-b border-edge text-[11px] tracking-wider text-ink-faint uppercase">
                    <th className="pb-1 pr-3 font-medium">Header</th>
                    <th className="pb-1 font-medium">Maps to</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(preview.mapping).map(([header, field]) => {
                    const dropped = preview.droppedColumns.some(
                      (d) => d.header === header,
                    );
                    return (
                      <tr key={header} className="border-b border-edge/60">
                        <td className="py-1 pr-3 font-mono text-ink">
                          {header}
                        </td>
                        <td className="py-1">
                          {dropped ? (
                            <Tag tone="bad">dropped (protected)</Tag>
                          ) : (
                            <select
                              value={field}
                              onChange={(e) => {
                                const next = {
                                  ...overrides,
                                  [header]: e.target.value as
                                    CanonicalField | "drop",
                                };
                                setOverrides(next);
                                rePreview(next);
                              }}
                              className="rounded border border-edge bg-canvas px-1.5 py-0.5 text-[12px]"
                            >
                              <option value="drop">ignore</option>
                              {CANONICAL_FIELDS.map((f) => (
                                <option key={f} value={f}>
                                  {f}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="3 · Rows">
            <ul className="space-y-1.5">
              {preview.rows.map((r) => (
                <li
                  key={r.index}
                  className="flex items-start gap-2 text-[12.5px]"
                >
                  <input
                    type="checkbox"
                    aria-label={`Import ${r.row.name}`}
                    checked={selected.has(r.index)}
                    onChange={(e) => {
                      const next = new Set(selected);
                      if (e.target.checked) next.add(r.index);
                      else next.delete(r.index);
                      setSelected(next);
                    }}
                  />
                  <div className="min-w-0">
                    <span className="text-ink">{r.row.name}</span>
                    <span className="ml-1 text-ink-muted">
                      {[
                        r.row.currentTitle,
                        r.row.currentCompany,
                        r.row.geography,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {r.decision === "skip" && (
                      <Tag tone="neutral">skip · same URL already saved</Tag>
                    )}
                    {r.decision === "create_flagged" && (
                      <Tag tone="warn">identity review</Tag>
                    )}
                    {[...r.matches, ...r.inFileMatches].slice(0, 2).map((m) => (
                      <span
                        key={`${m.otherId}-${m.strength}`}
                        className="block text-[11.5px] text-ink-faint"
                      >
                        {m.reason}
                      </span>
                    ))}
                    {preview.cellWarnings
                      .filter((w) => w.rowIndex === r.index)
                      .slice(0, 2)
                      .map((w) => (
                        <span
                          key={`${w.field}-${w.trait}`}
                          className="block text-[11.5px] text-warn"
                        >
                          Review: {w.field} mentions {w.trait}
                        </span>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
            {preview.contactColumnsPresent && (
              <label className="mt-3 flex items-start gap-2 text-[12.5px] text-ink-muted">
                <input
                  type="checkbox"
                  checked={keepContact}
                  onChange={(e) => setKeepContact(e.target.checked)}
                />
                <span>
                  Keep vendor email/phone fields as <strong>unverified</strong>{" "}
                  source evidence. Third-party contact data decays and is not
                  verified by the vendor; it is dropped unless you tick this.
                </span>
              </label>
            )}
            {error && (
              <p className="mt-3 rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[12px] text-bad">
                {error}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={commit}
                disabled={pending || selected.size === 0}
                className={buttonClass}
              >
                {pending
                  ? "Importing…"
                  : `Import ${selected.size} candidate${selected.size === 1 ? "" : "s"}`}
              </button>
              <button
                type="button"
                className={subtleButtonClass}
                onClick={() => {
                  setPreview(null);
                  setOverrides({});
                  setSelected(new Set());
                }}
              >
                Start over
              </button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
