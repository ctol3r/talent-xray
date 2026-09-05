"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordHmFeedbackAction } from "@/lib/actions/guidance";

/**
 * Evidence-anchored HM feedback capture: a human decision plus the
 * evidence it rests on. Recording never moves the candidate's stage —
 * the recruiter does that deliberately.
 */
export function HmFeedbackForm({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [decision, setDecision] = useState<"advance" | "hold" | "pass">(
    "advance",
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await recordHmFeedbackAction({
        candidateId,
        decision,
        evidenceNote: note.trim(),
      });
      if (result.ok) {
        setNote("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {(["advance", "hold", "pass"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setDecision(option)}
            className={`rounded border px-2.5 py-1 text-[12px] ${
              decision === option
                ? "border-accent text-accent"
                : "border-edge2 text-ink-muted hover:bg-panel2"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="The evidence behind this decision (required) — e.g. “no first-author empirical work; both papers are survey co-authorships.”"
        className="w-full rounded border border-edge bg-canvas px-2 py-1.5 text-[12.5px]"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={isPending || note.trim().length < 5}
          className="rounded bg-accent px-3 py-1.5 text-[12.5px] font-medium text-canvas hover:opacity-90 disabled:opacity-50"
        >
          Record HM feedback
        </button>
        <span className="text-[11.5px] text-ink-faint">
          Recorded verbatim; never moves the stage by itself.
        </span>
      </div>
      {error && <p className="text-[12px] text-bad">{error}</p>}
    </div>
  );
}
