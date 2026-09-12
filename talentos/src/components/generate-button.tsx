"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions/helpers";
import type { GenerateSummary } from "@/lib/actions/generate";

/**
 * Triggers a generation server action, renders pending/success/error states
 * honestly — including "provider not configured" and fair-hiring review
 * warnings on the output.
 *
 * One state is deliberately not red. When the model provider is a Claude
 * session, generation cannot finish inside the request: the app writes a
 * request file, and a session has to answer it. That is the design, not a
 * failure, so it renders as a waiting state naming the file to hand over.
 * Rendering it as an error taught the owner that whole features were broken
 * when they had simply never been answered.
 */
export function GenerateButton({
  action,
  input,
  label,
  regenerate = false,
}: {
  action: (input: unknown) => Promise<ActionResult<GenerateSummary>>;
  input: Record<string, unknown>;
  label: string;
  regenerate?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<GenerateSummary> | null>(
    null,
  );
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            const r = await action(input);
            setResult(r);
            if (r.ok) router.refresh();
          })
        }
        className={`rounded px-3 py-1.5 text-[14px] font-medium ${
          regenerate
            ? "border border-edge2 text-ink-muted hover:bg-panel2"
            : "bg-accent text-canvas hover:opacity-90"
        } disabled:opacity-50`}
      >
        {pending ? "Generating…" : label}
      </button>
      {result && !result.ok && result.kind === "pending" && result.handoff && (
        <HandoffWaiting handoff={result.handoff} />
      )}
      {result && !result.ok && result.kind !== "pending" && (
        <p className="max-w-md rounded border border-bad/40 bg-bad-soft px-3 py-2 text-right text-[13px] text-bad">
          {result.kind === "provider" ? "Model provider not configured: " : ""}
          {result.error}
        </p>
      )}
      {result?.ok && result.data.warnings.length > 0 && (
        <p className="max-w-md rounded border border-warn/40 bg-warn-soft px-3 py-2 text-right text-[13px] text-warn">
          Review required — generated content references:{" "}
          {result.data.warnings.map((w) => w.trait).join(", ")}. Edit before
          using.
        </p>
      )}
      {result?.ok && result.data.note && (
        <p className="text-[13px] text-ink-muted">{result.data.note}</p>
      )}
    </div>
  );
}

/**
 * The waiting state for a session handoff. It says what happened, names the
 * file, and offers the one line the owner needs to paste into a session. It
 * is styled as information, never as a failure.
 */
function HandoffWaiting({
  handoff,
}: {
  handoff: { requestPath: string; responsePath: string };
}) {
  const [copied, setCopied] = useState(false);
  const instruction = `Read ${handoff.requestPath}, answer it, and write the answer to ${handoff.responsePath}.`;
  return (
    <div className="max-w-md rounded border border-edge2 bg-panel2 px-3 py-2 text-left text-[13px] text-ink-muted">
      <p className="font-medium text-ink">Waiting for your Claude session.</p>
      <p className="mt-1">
        Nothing failed. This install has no model key, so the request was
        written to a file for a session to answer. Paste the line below into
        Claude Code, then press the button again.
      </p>
      <code className="mt-2 block break-all rounded bg-canvas px-2 py-1.5 text-[12px] text-ink">
        {instruction}
      </code>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(instruction).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="rounded border border-edge2 px-2 py-1 text-[12px] hover:bg-panel"
        >
          {copied ? "Copied" : "Copy instruction"}
        </button>
        <Link href="/outbox" className="text-[12px] text-accent">
          or paste the answer in the outbox
        </Link>
      </div>
    </div>
  );
}
