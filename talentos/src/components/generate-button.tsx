"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions/helpers";
import type { GenerateSummary } from "@/lib/actions/generate";

/**
 * Triggers a generation server action, renders pending/success/error states
 * honestly — including "provider not configured" and fair-hiring review
 * warnings on the output.
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
        className={`rounded px-3 py-1.5 text-[13px] font-medium ${
          regenerate
            ? "border border-edge2 text-ink-muted hover:bg-panel2"
            : "bg-accent text-canvas hover:opacity-90"
        } disabled:opacity-50`}
      >
        {pending ? "Generating…" : label}
      </button>
      {result && !result.ok && (
        <p className="max-w-md rounded border border-bad/40 bg-bad-soft px-3 py-2 text-right text-[12px] text-bad">
          {result.kind === "provider" ? "Model provider not configured: " : ""}
          {result.error}
        </p>
      )}
      {result?.ok && result.data.warnings.length > 0 && (
        <p className="max-w-md rounded border border-warn/40 bg-warn-soft px-3 py-2 text-right text-[12px] text-warn">
          Review required — generated content references:{" "}
          {result.data.warnings.map((w) => w.trait).join(", ")}. Edit before
          using.
        </p>
      )}
      {result?.ok && result.data.note && (
        <p className="text-[12px] text-ink-muted">{result.data.note}</p>
      )}
    </div>
  );
}
