"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions/helpers";
import {
  deriveSearchPlanAction,
  initializeHiringNeedAction,
  type PlanningOutcome,
} from "@/lib/actions/planning";

export function SearchPlanActions({
  searchProjectId,
  hasIntent,
  hasPlan,
}: {
  searchProjectId: string;
  hasIntent: boolean;
  hasPlan: boolean;
}) {
  const [busy, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult<PlanningOutcome> | null>(
    null,
  );
  const router = useRouter();
  const waiting =
    result?.ok && result.data.state === "pending" ? result.data : null;
  const label = hasIntent
    ? hasPlan
      ? "Regenerate search plan"
      : "Derive search plan"
    : "Derive hiring need";

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        className="rounded bg-accent px-3 py-1.5 text-[13px] font-medium text-canvas hover:opacity-90 disabled:opacity-50"
        onClick={() =>
          startTransition(async () => {
            setResult(null);
            try {
              const action = hasIntent
                ? deriveSearchPlanAction
                : initializeHiringNeedAction;
              const next = await action({ searchProjectId });
              setResult(next);
              if (next.ok && next.data.state === "ready") router.refresh();
            } catch {
              setResult({
                ok: false,
                kind: "error",
                error:
                  "Could not reach the app. Retry to check the saved state.",
              });
            }
          })
        }
      >
        {busy ? "Preparing draft…" : waiting ? "Check for response" : label}
      </button>
      <div aria-live="polite" className="text-[12px] text-ink-muted">
        {waiting && (
          <div className="space-y-2 rounded border border-warn/40 bg-warn-soft p-3">
            <p className="font-medium text-warn">Awaiting session response</p>
            <p>
              A request is ready for your Claude or Codex session. Ask it to
              read the request file and write the response to the specified
              path, then select Check for response. The draft has not been saved
              yet.
            </p>
            <details>
              <summary className="cursor-pointer">
                Session handoff files
              </summary>
              <p className="mt-2">
                Request:{" "}
                <code className="break-all">{waiting.requestPath}</code>
              </p>
              <p>
                Response:{" "}
                <code className="break-all">{waiting.responsePath}</code>
              </p>
            </details>
          </div>
        )}
        {result && !result.ok && (
          <p role="alert" className="text-bad">
            {result.error}
          </p>
        )}
        {result?.ok && result.data.state === "ready" && (
          <p>Draft saved. Review its assumptions before using it.</p>
        )}
        {result?.ok &&
          result.data.state === "ready" &&
          result.data.warnings.length > 0 && (
            <p className="mt-2 text-warn">
              Review required — generated content references:{" "}
              {result.data.warnings.map((warning) => warning.trait).join(", ")}.
              Edit before using.
            </p>
          )}
      </div>
    </div>
  );
}
