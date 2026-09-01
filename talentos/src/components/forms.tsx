"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions/helpers";

/** Small shared building blocks for the recruiter-input forms. */

export function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const submit = (fn: () => Promise<ActionResult<unknown>>, after?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (result.ok) {
        router.refresh();
        after?.();
      } else {
        setError(result.error);
      }
    });
  return { pending, error, submit };
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-[12.5px] text-ink-muted">{children}</span>;
}

export const inputClass =
  "w-full rounded border border-edge bg-panel px-3 py-2 text-[13px] outline-none placeholder:text-ink-faint focus:border-accent";

export const buttonClass =
  "rounded bg-accent px-3 py-1.5 text-[13px] font-medium text-canvas hover:opacity-90 disabled:opacity-50";

export const subtleButtonClass =
  "rounded border border-edge2 px-3 py-1.5 text-[13px] text-ink-muted hover:bg-panel2 disabled:opacity-50";

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
      {error}
    </p>
  );
}
