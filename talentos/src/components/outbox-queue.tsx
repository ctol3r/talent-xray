"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OutboxRow } from "@/lib/services/outbox";
import {
  readOutboxRequestAction,
  submitOutboxResponseAction,
  type SubmitOutcome,
} from "@/lib/actions/outbox";
import { buttonClass, inputClass, subtleButtonClass } from "./forms";

/**
 * The queue, one row per request.
 *
 * Each row is the whole transaction: what was asked for, what it belongs to,
 * how long it has been sitting there, and the two controls that move it —
 * copy the request out, paste the answer back. There is no detail page,
 * because a request has exactly two things you can do with it and putting
 * them behind a click would only make the queue look tidier than it is.
 *
 * The paste field is closed until it is wanted. A textarea on every row turns
 * a list of five waiting requests into a page of five empty boxes, which
 * reads as work rather than as a queue.
 */
export function OutboxQueue({ rows }: { rows: OutboxRow[] }) {
  const waiting = rows.filter((row) => row.state === "waiting");
  const answered = rows.filter((row) => row.state === "answered");
  const [showAnswered, setShowAnswered] = useState(false);

  return (
    <div className="space-y-4">
      <div className="space-y-2" data-testid="outbox-waiting">
        {waiting.map((row) => (
          <Row key={row.id} row={row} />
        ))}
      </div>

      {answered.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowAnswered((open) => !open)}
            className="text-[13px] text-ink-faint hover:text-ink"
          >
            {showAnswered ? "▾" : "▸"} {answered.length} already answered
          </button>
          {showAnswered && (
            <div className="mt-2 space-y-2" data-testid="outbox-answered">
              {answered.map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Subject({ row }: { row: OutboxRow }) {
  if (row.subject.kind === "job") {
    return row.jobId ? (
      <Link href={`/searches/${row.jobId}`} className="text-accent">
        {row.subject.label}
      </Link>
    ) : (
      // The job's title was in the prompt but no job on file has it now. Said
      // rather than hidden: a request whose job was deleted is exactly the
      // kind of thing a queue should still show you.
      <span title="No job on file has this title now">{row.subject.label}</span>
    );
  }
  if (row.subject.kind === "conversation") {
    return (
      <span>
        <Link href="/" className="text-accent">
          the conversation
        </Link>
        {" — “"}
        {row.subject.label.slice(0, 90)}
        {row.subject.label.length > 90 ? "…" : ""}
        {"”"}
      </span>
    );
  }
  if (row.subject.kind === "query") {
    return <span>the query “{row.subject.label.slice(0, 90)}”</span>;
  }
  return (
    <span className="text-ink-faint">
      {row.subject.label ? row.subject.label.slice(0, 90) : "not stated"}
    </span>
  );
}

function Row({ row }: { row: OutboxRow }) {
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SubmitOutcome | null>(null);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const answered = row.state === "answered";

  return (
    <section
      data-testid="outbox-row"
      data-request={row.id}
      data-state={row.state}
      className="rounded-lg border border-edge bg-panel p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-[14px] text-ink">
          <span className="font-medium">{row.kind}</span>
          <span className="text-ink-muted"> for </span>
          <Subject row={row} />
        </p>
        <p className="text-[12.5px] text-ink-faint">
          {answered ? (
            <span className="text-ok">answered after {row.waited}</span>
          ) : (
            <span className="text-warn">waiting {row.waited}</span>
          )}
        </p>
      </div>

      <p className="mt-1 font-mono text-[11.5px] break-all text-ink-faint">
        {row.id}.request.json · {Math.max(1, Math.round(row.bytes / 1024))} KB ·
        written {new Date(row.writtenAt).toLocaleString()}
      </p>

      {!row.known && (
        <p className="mt-2 rounded border border-warn/40 bg-warn-soft px-2 py-1.5 text-[12.5px] text-warn">
          No schema is registered for {row.schemaName}, so a pasted answer
          cannot be checked before it is written. This one has to be answered by
          a session writing the file directly.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={copying}
          onClick={async () => {
            setError(null);
            setCopying(true);
            const result = await readOutboxRequestAction({ id: row.id });
            setCopying(false);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            try {
              await navigator.clipboard.writeText(result.data.payload);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            } catch {
              // Some browsers will not write to the clipboard from a handler
              // that has awaited. Rather than claim it worked, put the text
              // on screen, selected, to be copied by hand.
              setFallback(result.data.payload);
            }
          }}
          data-testid="outbox-copy"
          className={subtleButtonClass}
        >
          {copying ? "Reading…" : copied ? "Copied" : "Copy request"}
        </button>
        {!answered && row.known && (
          <button
            type="button"
            onClick={() => setOpen((was) => !was)}
            data-testid="outbox-paste-toggle"
            className={subtleButtonClass}
          >
            {open ? "Cancel" : "Paste the answer"}
          </button>
        )}
        {row.collectable && !answered && (
          <span className="text-[12.5px] text-ink-faint">
            Pasting here puts it straight into the conversation.
          </span>
        )}
      </div>

      {open && !answered && (
        <form
          className="mt-2 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            start(async () => {
              setError(null);
              const result = await submitOutboxResponseAction({
                id: row.id,
                response: pasted,
              });
              if (result.ok) {
                setDone(result.data);
                setOpen(false);
                setPasted("");
                router.refresh();
              } else {
                setError(result.error);
              }
            });
          }}
        >
          <textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            rows={6}
            spellCheck={false}
            data-testid="outbox-paste"
            placeholder={`The JSON answer to ${row.id}. It is checked against the ${row.schemaName} schema before anything is written.`}
            className={`${inputClass} resize-y font-mono text-[12.5px] sm:text-[12.5px]`}
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={pending || !pasted.trim()}
              data-testid="outbox-submit"
              className={buttonClass}
            >
              {pending ? "Checking…" : "Save the answer"}
            </button>
            <span className="text-[12.5px] text-ink-faint">
              Nothing is written unless it validates.
            </span>
          </div>
          {error && (
            <p
              data-testid="outbox-error"
              className="rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] text-bad"
            >
              {error}
            </p>
          )}
        </form>
      )}

      {fallback !== null && (
        <div className="mt-2">
          <p className="mb-1 text-[12.5px] text-ink-muted">
            The browser would not take it. Here it is to copy by hand.
          </p>
          <textarea
            readOnly
            rows={4}
            value={fallback}
            onFocus={(event) => event.currentTarget.select()}
            className={`${inputClass} resize-y font-mono text-[12px] sm:text-[12px]`}
          />
        </div>
      )}

      {done && (
        <p
          data-testid="outbox-done"
          className="mt-2 rounded border border-ok/40 bg-ok-soft px-3 py-2 text-[13px] text-ok"
        >
          {done.where}
        </p>
      )}
    </section>
  );
}
