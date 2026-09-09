"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import type { StreamDay } from "@/lib/services/daily";
import { saveDailyNoteAction } from "@/lib/actions/daily";
import { Outliner } from "./outliner";
import { SaveNote, useAutosave } from "./forms";
import { PreviewLink } from "./page-preview";
import { type TagOption } from "./tag-textarea";
import { Squish, useReducedMotion } from "./squish";

/**
 * The days, as one scroll.
 *
 * A journal is a roll you unwind, not a page per day with arrows between them.
 * The day you want is nearly always a screen or two up, and clicking ← four
 * times to reach Thursday is four chances to lose your place — which is the
 * complaint this exists to answer.
 *
 * Three things make it a scroll rather than a list.
 *
 * **Every day is writable where it sits.** No opening, no navigating. The
 * autosave is per day and independent, so writing in Tuesday while Thursday is
 * still saving is not a conflict.
 *
 * **Empty days are here too.** They cost one line each and they are the thing
 * that makes a gap visible: a list of only the days somebody wrote on closes
 * the gap between last Tuesday and this one, and the gap is information.
 *
 * **The date stays with you.** Each day's heading sticks to the top of the
 * window while that day is under the cursor, so the answer to "which day am I
 * writing in" is always on screen — in a scroll of a hundred days that is the
 * whole difference between orientation and vertigo.
 */

/** How near the bottom before the next stretch is fetched. */
const REACH = 800;

function DayEvents({ day }: { day: StreamDay }) {
  if (day.events.length === 0) return null;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-[12px] text-ink-faint">
        🕘 {day.events.length} thing{day.events.length === 1 ? "" : "s"}{" "}
        happened
      </summary>
      <ul className="mt-1.5 space-y-1">
        {day.events.map((event, index) => (
          <li
            key={`${event.at}-${index}`}
            className="flex items-start gap-2 border-l-2 border-edge2 pl-3"
          >
            <span aria-hidden className="mt-0.5">
              {event.icon}
            </span>
            <div className="min-w-0">
              <PreviewLink
                target={
                  event.href.match(/\/candidates\/([^/?#]+)/)
                    ? `candidate:${event.href.match(/\/candidates\/([^/?#]+)/)![1]}`
                    : event.href.match(/\/searches\/([^/?#]+)/)
                      ? `job:${event.href.match(/\/searches\/([^/?#]+)/)![1]}`
                      : `tag:${event.label}`
                }
                href={event.href}
                className="text-[13px] font-medium text-ink hover:underline"
              >
                {event.label}
              </PreviewLink>
              <p className="text-[12px] text-ink-muted">{event.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Day({
  day,
  pages,
  today,
}: {
  day: StreamDay;
  pages: TagOption[];
  today: string;
}) {
  const [text, setText] = useState(day.note);
  const [zoom, setZoom] = useState<{ id: string; mark: string } | null>(null);
  const { state, says } = useAutosave(text, (value) =>
    saveDailyNoteAction({ day: day.day, text: value }),
  );
  const isToday = day.day === today;

  return (
    <section
      data-day={day.day}
      className="border-b border-edge py-5 first:pt-0 last:border-b-0"
    >
      <header className="sticky top-[var(--sticky-title)] z-10 -mx-3 mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-panel/95 px-3 py-1.5 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <h2 className="text-[17px] font-semibold text-ink">
          <span aria-hidden className="mr-1.5">
            {isToday ? "📌" : "📅"}
          </span>
          {day.title}
        </h2>
        {isToday && (
          <span className="rounded bg-accent-soft px-1.5 py-px text-[11px] text-accent">
            today
          </span>
        )}
        <Link
          href={`/daily/${day.day}`}
          className="text-[12px] text-ink-faint hover:text-ink"
        >
          just this day →
        </Link>
        <span className="ml-auto">
          <SaveNote state={state} says={says} />
        </span>
      </header>

      {/*
        The note gets the room. This is the surface somebody is actually
        writing on, so it is set at reading size rather than at the workspace's
        density, and it is given height before anything is in it — a box that
        grows from one line makes you type into the bottom of the window.
      */}
      <div className="min-h-[9rem]">
        <Outliner
          text={text}
          onChange={setText}
          options={pages}
          zoom={zoom}
          onZoom={setZoom}
          placeholder="Write here. Tab indents · / for a to-do · [[page]] · @person · jj job"
        />
      </div>

      <DayEvents day={day} />
    </section>
  );
}

const FOCUS_KEY = "talentos.daily-focus";
const FOCUS_EVENT = "talentos:daily-focus";

/**
 * Read through the store rather than in an effect, so the first render already
 * knows and the scroll does not open squeezed and then jump to full length.
 * Cached because `useSyncExternalStore` compares snapshots by identity.
 */
let focusCache: { raw: string | null; value: boolean } | null = null;

function subscribeFocus(listener: () => void): () => void {
  window.addEventListener(FOCUS_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(FOCUS_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

function readFocus(): boolean {
  try {
    const raw = window.localStorage.getItem(FOCUS_KEY);
    if (!focusCache || focusCache.raw !== raw) {
      focusCache = { raw, value: raw !== "off" };
    }
    return focusCache.value;
  } catch {
    return true;
  }
}

function setFocus(on: boolean): void {
  try {
    window.localStorage.setItem(FOCUS_KEY, on ? "on" : "off");
  } catch {
    /* a browser that refuses storage still gets the scroll */
  }
  window.dispatchEvent(new Event(FOCUS_EVENT));
}

export function DailyScroll({
  first,
  pages,
  today,
}: {
  first: StreamDay[];
  pages: TagOption[];
  today: string;
}) {
  const [days, setDays] = useState(first);
  /**
   * Focus and context: everything away from the reading line squeezed, so the
   * shape of a month is on one screen and you steer by shape. A preference
   * because it is a strong effect and some people will want the plain scroll —
   * and it is forced off for anybody who has asked for less motion.
   */
  const focus = useSyncExternalStore(subscribeFocus, readFocus, () => true);
  const reduced = useReducedMotion();
  const squishing = focus && !reduced;
  const [reaching, setReaching] = useState(false);
  const [ended, setEnded] = useState(false);
  const foot = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const more = useCallback(async () => {
    if (busy.current || ended) return;
    const oldest = days.at(-1)?.day;
    if (!oldest) return;
    busy.current = true;
    setReaching(true);
    try {
      const response = await fetch(`/api/daily?before=${oldest}`);
      if (!response.ok) throw new Error("no more");
      const payload = (await response.json()) as { days: StreamDay[] };
      if (payload.days.length === 0) setEnded(true);
      else setDays((current) => [...current, ...payload.days]);
    } catch {
      // The scroll stops rather than showing an error at the bottom of a
      // journal. Everything already unwound is still there and still writable.
      setEnded(true);
    } finally {
      busy.current = false;
      setReaching(false);
    }
  }, [days, ended]);

  useEffect(() => {
    const mark = foot.current;
    if (!mark) return;
    const watcher = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void more();
      },
      { rootMargin: `${REACH}px` },
    );
    watcher.observe(mark);
    return () => watcher.disconnect();
  }, [more]);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          aria-pressed={squishing}
          disabled={reduced}
          title={
            reduced
              ? "Off because this browser asks for reduced motion."
              : "Squeeze the days away from where you are reading, so a month fits on one screen."
          }
          onClick={() => setFocus(!focus)}
          className={`rounded border px-2 py-1 text-[12px] ${
            squishing
              ? "border-accent/40 bg-accent-soft text-accent"
              : "border-edge2 text-ink-muted hover:bg-panel2"
          } disabled:opacity-40`}
        >
          🔭 {squishing ? "Squeezed" : "Full length"}
        </button>
      </div>
      {days.map((day) => (
        <Squish key={day.day} name={day.day} on={squishing}>
          <Day day={day} pages={pages} today={today} />
        </Squish>
      ))}
      <div ref={foot} className="py-6 text-center text-[12px] text-ink-faint">
        {ended
          ? "That is as far back as this goes."
          : reaching
            ? "Unrolling…"
            : "…"}
      </div>
    </div>
  );
}
