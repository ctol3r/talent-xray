"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions/helpers";

/** Small shared building blocks for the recruiter-input forms. */

export function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const submit = (
    fn: () => Promise<ActionResult<unknown>>,
    after?: () => void,
  ) =>
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
  return (
    <span className="mb-1 block text-[13.5px] text-ink-muted">{children}</span>
  );
}

export const inputClass =
  // At least 16px on a phone: iOS zooms the page whenever a focused field is
  // smaller, and with no maximum-scale — correctly — it stays zoomed after
  // the blur. 17px because the whole scale moved up a pixel; the rule is the
  // floor, not the number.
  "w-full rounded border border-edge bg-panel px-3 py-2 text-[17px] sm:text-[14px] placeholder:text-ink-faint focus:border-accent";

export const buttonClass =
  "rounded bg-accent px-3 py-1.5 text-[14px] font-medium text-canvas hover:opacity-90 disabled:opacity-50";

export const subtleButtonClass =
  "rounded border border-edge2 px-3 py-1.5 text-[14px] text-ink-muted hover:bg-panel2 disabled:opacity-50";

export function ErrorNote({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[13.5px] text-bad">
      {error}
    </p>
  );
}

// ---------------------------------------------------------------------------
// saving without being asked to

export type SaveState =
  | { kind: "clean"; at: string | null }
  | { kind: "dirty" }
  | { kind: "saving" }
  | { kind: "failed"; error: string };

/**
 * Keep a field saved without anybody pressing anything.
 *
 * Notes were the one place in this product where work could simply be lost:
 * you typed, you clicked a job in the sidebar, and the paragraph was gone
 * with no warning and nothing to undo. Every other surface writes on submit,
 * but a note has no submit — you stop typing because you are done thinking,
 * not because you have finished a form.
 *
 * So: a short pause after the last keystroke, then a save. Three details make
 * it trustworthy rather than merely automatic —
 *
 *  - **it says so.** An autosave nobody can see is indistinguishable from no
 *    save at all, so the state is rendered, with the time it last succeeded.
 *  - **it never overlaps.** A second save is queued behind the first rather
 *    than racing it, because two writes of the same key landing out of order
 *    would restore a paragraph the reader had just deleted.
 *  - **it holds the door.** While anything is unsaved the browser asks before
 *    closing the tab, and a pending edit is flushed on the way out, so
 *    navigating inside the app does not drop the last sentence either.
 *
 * The explicit Save button stays wherever it already was. It costs nothing,
 * and "did that save?" is a question people would rather answer by pressing
 * something than by trusting a subtitle.
 */
export function useAutosave(
  value: string,
  save: (value: string) => Promise<ActionResult<unknown>>,
  { delay = 1200 }: { delay?: number } = {},
): { state: SaveState; says: string; saveNow: () => void } {
  const [state, setState] = useState<SaveState>({ kind: "clean", at: null });
  // The last text a save was accepted for. Everything else is derived from
  // comparing the field against this, so "dirty" cannot drift out of step.
  const saved = useRef(value);
  const inFlight = useRef(false);
  const queued = useRef<string | null>(null);
  const live = useRef(value);
  const saveRef = useRef(save);
  // After every commit, so anything that fires later — a timer, a click, the
  // unmount flush — sees the field as it actually is rather than as it was
  // when the handler was created.
  useEffect(() => {
    live.current = value;
    saveRef.current = save;
  });

  const run = useCallback(async (text: string) => {
    // One save at a time, and whatever was typed while it was in the air goes
    // next. A loop rather than a second call, so two writes of the same key
    // can never be in flight together and land out of order — which would
    // restore a paragraph the reader had just deleted.
    if (inFlight.current) {
      queued.current = text;
      return;
    }
    inFlight.current = true;
    try {
      let next: string | null = text;
      while (next !== null) {
        const attempt: string = next;
        setState({ kind: "saving" });
        const result = await saveRef.current(attempt);
        if (result.ok) {
          saved.current = attempt;
          setState({
            kind: "clean",
            at: new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          });
        } else {
          setState({ kind: "failed", error: result.error });
        }
        const following = queued.current;
        queued.current = null;
        next =
          following !== null && following !== saved.current ? following : null;
      }
    } finally {
      inFlight.current = false;
    }
  }, []);

  const saveNow = useCallback(() => {
    if (live.current !== saved.current) void run(live.current);
  }, [run]);

  useEffect(() => {
    if (value === saved.current) return;
    setState((current) =>
      current.kind === "saving" ? current : { kind: "dirty" },
    );
    const timer = window.setTimeout(() => void run(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay, run]);

  // The tab, and the app's own navigation. The first gets a browser prompt;
  // the second gets a save fired on the way out, which usually lands.
  useEffect(() => {
    const ask = (event: BeforeUnloadEvent) => {
      if (live.current === saved.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", ask);
    return () => {
      window.removeEventListener("beforeunload", ask);
      if (live.current !== saved.current) void saveRef.current(live.current);
    };
  }, []);

  const says =
    state.kind === "saving"
      ? "Saving…"
      : state.kind === "failed"
        ? `Not saved — ${state.error}`
        : state.kind === "dirty"
          ? "Unsaved"
          : state.at
            ? `Saved ${state.at}`
            : "";

  return { state, says, saveNow };
}

/** The one-line status an autosaved field shows. Quiet until it is not. */
export function SaveNote({ state, says }: { state: SaveState; says: string }) {
  if (!says) return null;
  return (
    <span
      role="status"
      className={`text-[12px] ${
        state.kind === "failed"
          ? "text-bad"
          : state.kind === "clean"
            ? "text-ink-faint"
            : "text-ink-muted"
      }`}
    >
      {says}
    </span>
  );
}
