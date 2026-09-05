"use client";

import { useState } from "react";
import { archiveQueryAction, upsertQueryAction } from "@/lib/actions/workflow";
import {
  ErrorNote,
  buttonClass,
  inputClass,
  subtleButtonClass,
  useAction,
} from "./forms";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="shrink-0 rounded border border-edge2 px-2 py-0.5 text-[11.5px] text-ink-muted hover:bg-panel2"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** Inline editor — the composed query is always visible and editable. */
export function QueryEditor({
  queryId,
  searchProjectId,
  platform,
  query,
  purpose,
  breadth,
}: {
  queryId: string;
  searchProjectId: string;
  platform: string;
  query: string;
  purpose?: string | null;
  breadth: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(query);
  const { pending, error, submit } = useAction();

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <CopyButton text={query} />
        <button
          type="button"
          className="rounded border border-edge2 px-2 py-0.5 text-[11.5px] text-ink-muted hover:bg-panel2"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <button
          type="button"
          disabled={pending}
          className="rounded border border-edge2 px-2 py-0.5 text-[11.5px] text-ink-faint hover:bg-panel2"
          onClick={() =>
            submit(() => archiveQueryAction({ queryId, searchProjectId }))
          }
        >
          Archive
        </button>
      </div>
    );
  }

  return (
    <form
      className="w-full space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(
          () =>
            upsertQueryAction({
              id: queryId,
              searchProjectId,
              platform,
              query: value,
              purpose: purpose ?? undefined,
              breadth,
            }),
          () => setEditing(false),
        );
      }}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        className={`${inputClass} resize-y font-mono text-[12px]`}
      />
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className={subtleButtonClass}
          onClick={() => {
            setValue(query);
            setEditing(false);
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function AddQueryForm({ searchProjectId }: { searchProjectId: string }) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("");
  const [query, setQuery] = useState("");
  const { pending, error, submit } = useAction();

  if (!open) {
    return (
      <button
        type="button"
        className={subtleButtonClass}
        onClick={() => setOpen(true)}
      >
        Add query manually
      </button>
    );
  }
  return (
    <form
      className="w-full max-w-2xl space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit(
          () =>
            upsertQueryAction({
              searchProjectId,
              platform,
              query,
              breadth: "balanced",
            }),
          () => {
            setPlatform("");
            setQuery("");
            setOpen(false);
          },
        );
      }}
    >
      <input
        value={platform}
        onChange={(e) => setPlatform(e.target.value)}
        placeholder="Platform (e.g. Google, LinkedIn, PubMed)"
        required
        className={inputClass}
      />
      <textarea
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="The query"
        rows={2}
        required
        className={`${inputClass} resize-y font-mono text-[12px]`}
      />
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Adding…" : "Add query"}
        </button>
        <button
          type="button"
          className={subtleButtonClass}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
