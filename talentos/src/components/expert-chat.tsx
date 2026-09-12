"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  EXPERTS,
  expertById,
  routeQuestion,
} from "../../artifact-src/core/experts";
import { classifyIntent } from "@/lib/sourcing/intent";
import { searchHref, sourcingHref } from "@/lib/domain/command-intents";
import type { AskThread } from "@/lib/services/expert";
import {
  askExpertAction,
  clearChatAction,
  collectAnswersAction,
  retryThreadAction,
} from "@/lib/actions/expert";
import { inputClass } from "./forms";

/**
 * The conversation with the talent expert.
 *
 * One person to talk to, with a small team behind them: the question goes to
 * whichever specialist it is about and the reply says which, and why. The
 * routing is arithmetic — it shows the words that decided it, so a wrong
 * route is a visible wrong route you can correct by naming a specialist
 * yourself rather than by rephrasing until the machine agrees.
 *
 * Every ask is a thread with a state on it, and the thread appears the
 * instant you press Ask. Two things this fixes, both of which were real.
 *
 * The input used to be able to swallow a question. The textarea is controlled
 * by React state, so anything typed into it before the page finished
 * hydrating existed only in the DOM — hydration's first render reset the
 * value to empty and the question was gone, with no error and nothing
 * recorded. The next press of Ask read empty state and returned silently.
 * That is what "it did nothing" was. The submit now reads the form's own
 * value rather than the state, the state adopts whatever was typed early, and
 * an empty ask says so instead of returning.
 *
 * And a waiting question used to be a dead end. With no model key an ask
 * becomes a file a Claude session fulfils, and collecting the answer meant
 * typing the identical question again. It does not any more: the thread holds
 * the id of the request it is waiting on, and the answer is picked up from
 * that file — by the page when it loads, and by a poll while you sit here.
 */

const STATE_LABEL: Record<AskThread["state"], string> = {
  queued: "Queued",
  answering: "Being answered",
  answered: "Answered",
  failed: "Failed",
};

const STATE_CLASS: Record<AskThread["state"], string> = {
  queued: "border-warn/40 bg-warn-soft text-warn",
  answering: "border-accent/40 bg-accent-soft text-accent",
  answered: "border-edge2 bg-panel2 text-ink-muted",
  failed: "border-bad/40 bg-bad-soft text-bad",
};

/** How often an open thread checks whether its answer has landed. */
const POLL_MS = 4000;

function StateChip({ state }: { state: AskThread["state"] }) {
  return (
    <span
      data-testid="thread-state"
      className={`rounded border px-1.5 py-0.5 text-[11.5px] ${STATE_CLASS[state]}`}
    >
      {STATE_LABEL[state]}
    </span>
  );
}

function Waiting({ thread }: { thread: AskThread }) {
  const expert = expertById(thread.expert);
  return (
    <div className="rounded border border-warn/40 bg-warn-soft px-3 py-2 text-[13px]">
      <p className="text-warn">
        <span aria-hidden className="mr-1.5">
          {expert.mark}
        </span>
        {thread.state === "answering"
          ? `${expert.name} has this — a Claude session picked it up.`
          : `${expert.name} is waiting on a Claude session — there is no model key in this install, so the question is a file somebody answers.`}
      </p>
      {thread.request && (
        <p className="mt-1 font-mono text-[12px] break-all text-ink-muted">
          {thread.request.requestPath}
        </p>
      )}
      <p className="mt-1 text-[12.5px] text-ink-muted">
        Hand that file to a Claude session, or{" "}
        <Link href="/outbox" className="text-accent underline-offset-2">
          paste the answer into the outbox
        </Link>
        . The answer lands here on its own — this question stays where it is and
        nobody has to ask it twice.
      </p>
    </div>
  );
}

function Failed({
  thread,
  onRetry,
  busy,
}: {
  thread: AskThread;
  onRetry: () => void;
  busy: boolean;
}) {
  const expert = expertById(thread.expert);
  return (
    <div className="rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[13px]">
      <p className="text-bad">
        <span aria-hidden className="mr-1.5">
          {expert.mark}
        </span>
        {expert.name} could not answer this.
      </p>
      <p className="mt-1 text-[12.5px] break-words text-ink-muted">
        {thread.failure?.message ?? "No reason was recorded."}
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={busy}
        data-testid="thread-retry"
        className="mt-1.5 rounded border border-edge2 px-2 py-0.5 text-[12.5px] text-ink-muted hover:bg-panel2 hover:text-ink disabled:opacity-50"
      >
        {busy ? "Asking…" : "Ask it again"}
      </button>
    </div>
  );
}

function Answer({ thread }: { thread: AskThread }) {
  const expert = expertById(thread.expert);
  const answer = thread.answer;
  if (!answer) return null;
  return (
    <div className="rounded border border-edge bg-panel2/50 px-3 py-2">
      <p className="mb-1 text-[12px] text-ink-faint">
        <span aria-hidden className="mr-1">
          {expert.mark}
        </span>
        <span className="text-ink-muted">{expert.name}</span> · {expert.does}
        {thread.because.length > 0 && (
          <span> · routed on “{thread.because.join("”, “")}”</span>
        )}
      </p>
      <p className="text-[14.5px] leading-6 whitespace-pre-wrap text-ink">
        {answer.text}
      </p>
      {answer.declined && (
        <p className="mt-1.5 text-[12.5px] text-warn">
          ⚠️ This needed something about a real person, company or number that
          the model cannot see. Nothing above is a fact about your records.
        </p>
      )}
      {answer.uncertain.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {answer.uncertain.map((doubt) => (
            <li key={doubt} className="text-[12.5px] text-ink-muted">
              ⚠️ not sure: {doubt}
            </li>
          ))}
        </ul>
      )}
      {answer.flagged.length > 0 && (
        <p className="mt-1.5 text-[12.5px] text-warn">
          ⚖️ Mentions {answer.flagged.join(", ")} — worth a look before you use
          it.
        </p>
      )}
    </div>
  );
}

function Thread({
  thread,
  onRetry,
  busy,
}: {
  thread: AskThread;
  onRetry: (id: string) => void;
  busy: boolean;
}) {
  const expert = expertById(thread.expert);
  return (
    <section
      data-testid="ask-thread"
      data-thread={thread.id}
      data-state={thread.state}
      className="space-y-1"
    >
      <div className="ml-6 rounded border border-accent/30 bg-accent-soft px-3 py-1.5">
        <p className="text-[14px] whitespace-pre-wrap text-ink">
          {thread.question}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-faint">
          <StateChip state={thread.state} />
          <span>
            <span aria-hidden className="mr-1">
              {expert.mark}
            </span>
            {expert.name}
          </span>
          {thread.because.length > 0 && (
            <span>· routed on “{thread.because.join("”, “")}”</span>
          )}
          {thread.request && (
            <span className="font-mono break-all">· {thread.request.id}</span>
          )}
        </p>
      </div>
      {thread.state === "answered" ? (
        <Answer thread={thread} />
      ) : thread.state === "failed" ? (
        <Failed
          thread={thread}
          busy={busy}
          onRetry={() => onRetry(thread.id)}
        />
      ) : (
        <Waiting thread={thread} />
      )}
    </section>
  );
}

/** Changes only when the server actually has something different to show. */
function signatureOf(threads: AskThread[]): string {
  return threads
    .map((thread) => `${thread.id}:${thread.state}:${thread.answer?.at ?? ""}`)
    .join("|");
}

export function ExpertChat({ threads }: { threads: AskThread[] }) {
  const [text, setText] = useState("");
  const [named, setNamed] = useState<string>("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  /**
   * What the last action returned, shown until the server re-render catches
   * up. This is what puts a thread on screen the moment Ask is pressed rather
   * than after a round trip.
   */
  const [local, setLocal] = useState<AskThread[] | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const signature = signatureOf(threads);
  useEffect(() => {
    setLocal(null);
  }, [signature]);

  const shown = local ?? threads;
  const open = shown.some(
    (thread) => thread.state === "queued" || thread.state === "answering",
  );

  /**
   * Adopt anything typed before this component was interactive.
   *
   * A controlled textarea whose state starts empty overwrites the DOM on its
   * first render, so a question typed during hydration is discarded without a
   * word. Reading the DOM once on mount is what keeps it.
   */
  useEffect(() => {
    const typed = box.current?.value ?? "";
    if (typed) setText((current) => (current ? current : typed));
  }, []);

  const preview = text.trim() ? routeQuestion(text) : null;
  const going = named ? expertById(named) : preview?.expert;
  /**
   * What this box thinks it has been handed.
   *
   * The same classifier the command menu uses, on the same words, so the two
   * inputs never disagree about what a string is. No records are passed: this
   * is a place to ask, not a place to jump, and pressing "/" is how you jump.
   *
   * Naming a specialist turns it off. That is an instruction, and an
   * instruction outranks a reading of the words.
   */
  const reading = named || !text.trim() ? null : classifyIntent(text).intent;
  const elsewhere = reading === "filter" || reading === "scour";
  const last = shown.at(-1);
  const suggestions =
    last?.state === "answered" ? (last.answer?.next ?? []) : [];

  const send = useCallback(
    (question: string) => {
      if (pending) return;
      const asked = question.trim();
      if (!asked) {
        // Never a silent return. A press that does nothing and says nothing is
        // indistinguishable from a broken button.
        setError("There is nothing in the box yet — type a question first.");
        return;
      }
      /**
       * A filter or a brief typed here is not a question.
       *
       * It goes where it was going to go anyway, rather than to a specialist
       * who would have to answer "that is a search, not a question". Nothing
       * is asked and nothing is spent.
       */
      if (!named) {
        const read = classifyIntent(asked).intent;
        if (read === "filter" || read === "scour") {
          setError(null);
          router.push(
            read === "filter" ? searchHref(asked) : sourcingHref(asked),
          );
          return;
        }
      }
      const expert = named ? expertById(named) : routeQuestion(asked).expert;
      const because = named ? [] : routeQuestion(asked).because;
      // The thread exists on screen before the round trip, so the input is
      // never cleared into nothing.
      setLocal([
        ...shown,
        {
          id: `optimistic-${asked.length}-${expert.id}`,
          askedAt: new Date().toISOString(),
          question: asked,
          expert: expert.id,
          because,
          state: "queued",
        },
      ]);
      start(async () => {
        setError(null);
        const result = await askExpertAction({
          question: asked,
          ...(named ? { expert: named } : {}),
        });
        if (result.ok) {
          setLocal(result.data.threads);
          setText("");
          if (box.current) box.current.value = "";
          router.refresh();
        } else {
          // The optimistic thread goes; the server has nothing matching it.
          setLocal(null);
          setError(result.error);
        }
      });
    },
    [named, pending, router, shown],
  );

  const retry = useCallback(
    (threadId: string) => {
      start(async () => {
        setError(null);
        const result = await retryThreadAction({ threadId });
        if (result.ok) {
          setLocal(result.data.threads);
          router.refresh();
        } else {
          setError(result.error);
        }
      });
    },
    [router],
  );

  /**
   * While something is open, look for its answer.
   *
   * This is the collection path and it asks the model nothing — it checks the
   * outbox for the file each open thread already knows the name of. It stops
   * when nothing is open and pauses when the tab is not being looked at,
   * because a background tab polling a filesystem forever is rude.
   */
  useEffect(() => {
    if (!open) return;
    let live = true;
    const tick = async () => {
      if (!live || document.visibilityState !== "visible") return;
      const result = await collectAnswersAction();
      if (!live || !result.ok) return;
      if (result.data.changed) {
        setLocal(result.data.threads);
        router.refresh();
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [open, router]);

  return (
    <div className="flex flex-col gap-3">
      {shown.length === 0 ? (
        <p className="text-[14px] text-ink-muted">
          Ask anything about the work — how to open an intake, why nobody is
          replying, what a counter-offer means here. The question goes to
          whichever specialist it is about; the answer says which, and says what
          it does not know.
        </p>
      ) : (
        <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
          {shown.map((thread) => (
            <Thread
              key={thread.id}
              thread={thread}
              onRetry={retry}
              busy={pending}
            />
          ))}
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={pending}
              onClick={() => send(suggestion)}
              className="rounded border border-edge2 px-2 py-0.5 text-[12.5px] text-ink-muted hover:bg-panel2 hover:text-ink disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form
        className="space-y-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          // The form's own value, not the state. Anything typed before this
          // component was interactive is in the DOM and nowhere else.
          const asked = String(
            new FormData(event.currentTarget).get("question") ?? "",
          );
          send(asked);
        }}
      >
        <textarea
          ref={box}
          name="question"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, because this is a conversation. A newline is still
            // one shift away, which is where everybody expects it.
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(event.currentTarget.value);
            }
          }}
          rows={2}
          placeholder="Ask the team. Enter sends, shift-enter is a new line."
          className={`${inputClass} resize-y`}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-accent px-3 py-1.5 text-[14px] font-medium text-canvas hover:opacity-90 disabled:opacity-50"
          >
            {pending
              ? "Asking…"
              : reading === "filter"
                ? "Narrow"
                : reading === "scour"
                  ? "Scour"
                  : "Ask"}
          </button>
          <label className="flex items-center gap-1.5 text-[12.5px] text-ink-faint">
            <span aria-hidden>{going ? going.mark : "🧠"}</span>
            <select
              aria-label="Which specialist answers"
              value={named}
              onChange={(event) => setNamed(event.target.value)}
              className="rounded border border-edge bg-panel px-1.5 py-0.5 text-[12.5px] text-ink-muted"
            >
              <option value="">
                {elsewhere
                  ? reading === "filter"
                    ? "Reads as a filter — goes to Search"
                    : "Reads as a brief — goes to Sourcing"
                  : preview
                    ? `Routing to ${preview.expert.name}`
                    : "Routed by what you ask"}
              </option>
              {EXPERTS.map((expert) => (
                <option key={expert.id} value={expert.id}>
                  {expert.mark} {expert.name}
                </option>
              ))}
            </select>
          </label>
          {shown.length > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await clearChatAction();
                  setLocal(null);
                  router.refresh();
                })
              }
              className="ml-auto text-[12.5px] text-ink-faint hover:text-ink disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </div>
        {error && (
          <p className="rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] text-bad">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
