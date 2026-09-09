"use client";

import type React from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  activeTagTrigger,
  applyTagTrigger,
  bracketKey,
  tagIsAllowed,
  tagSlug,
  type RecallKind,
  type TagTrigger,
} from "@/lib/core/tags";
import {
  activeSlash,
  applySlash,
  matchCommands,
  type SlashCommand,
  type SlashTrigger,
} from "../../artifact-src/core/slash";
import { caretPoint, type CaretPoint } from "@/lib/core/caret";

/**
 * A textarea that knows about pages.
 *
 * Three ways to recall, and they differ only in what the menu offers:
 *
 *   #  or [[   every page — tags, people and jobs together
 *   @          people only
 *   jj         jobs only
 *
 * Everything comes back as `[[a page]]`, because in this system a person, a
 * job and a tag are all pages; the trigger is a filter, not a syntax. A tag
 * that is a single word keeps its hash, because that is how people write
 * tags. `@` writes nothing of itself, so an address typed as `a@b` can never
 * become a reference.
 *
 * A page that does not exist yet is offered as the last row, so writing a new
 * one is the same gesture as reusing an old one. That is the Roam property
 * worth keeping: there is no separate act of creating a page.
 */

export interface TagOption {
  slug: string;
  display: string;
  count: number;
  /** What this option is. Decides which triggers offer it. */
  kind?: RecallKind;
  /** Shown on the right of the row. */
  hint?: string;
}

const TRIGGER_LABEL: Record<RecallKind, string> = {
  page: "pages",
  candidate: "people",
  job: "jobs",
};

const TRIGGER_ICON: Record<RecallKind, string> = {
  page: "🏷️",
  candidate: "👤",
  job: "💼",
};

export function TagTextarea({
  value,
  onChange,
  options,
  rows = 3,
  placeholder,
  className = "",
  name,
  id,
  autoFocus,
  onKeyDown,
  onBlur,
  slash = false,
  onSlashCommand,
  wrapperClassName = "",
  autoGrow = false,
}: {
  value: string;
  onChange: (next: string) => void;
  options: TagOption[];
  rows?: number;
  placeholder?: string;
  className?: string;
  name?: string;
  id?: string;
  autoFocus?: boolean;
  /**
   * Keys the recall menu did not take. Forwarded rather than handled here so
   * the outliner can own Enter and Tab without a second copy of the recall
   * menu existing to own them beside it — while the menu, when it is open,
   * still gets first refusal on the same keys.
   */
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onBlur?: () => void;
  /** Whether `/` opens the command menu. Off unless somebody can act on it. */
  slash?: boolean;
  /**
   * Classes for the wrapper rather than the field.
   *
   * The wrapper is what a flex row lays out, so a caller that wants the box
   * to fill its row has to say so here — `w-full` on the textarea inside a
   * wrapper that has shrunk to its content is a full-width box in a narrow
   * column, which is exactly how the outliner's blocks ended up half the
   * width of the same blocks when they were not being edited.
   */
  wrapperClassName?: string;
  /**
   * Grow to fit what is in it.
   *
   * A one-row box holding three wrapped lines is a box you edit through a
   * letterbox. Off by default because a form field with a fixed height is
   * usually deliberate; on wherever the text is the thing rather than a
   * field on a form.
   */
  autoGrow?: boolean;
  /**
   * A command the menu cannot carry out itself — one that has to make
   * something, or ask what day it is. Given the trigger so the caller can take
   * the `/query` back out of the text.
   */
  onSlashCommand?: (command: SlashCommand, trigger: SlashTrigger) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [trigger, setTrigger] = useState<TagTrigger | null>(null);
  const [caret, setCaret] = useState(0);
  const [index, setIndex] = useState(0);
  /**
   * The slash menu, held apart from the recall menu because they are different
   * questions — recall is "which page", this is "do what". The recall menu wins
   * when both could be open: `/` inside `[[` is somebody typing a path.
   */
  const [slashAt, setSlashAt] = useState<SlashTrigger | null>(null);
  const [slashPoint, setSlashPoint] = useState<CaretPoint | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  /**
   * The height the text needs, measured rather than guessed.
   *
   * `scrollHeight` on a box whose height is `auto` is exactly the content's
   * height, so the box is set to `auto`, read, and set to what it read. It has
   * to be a layout effect: doing it after paint shows the letterbox for a
   * frame every time a line wraps.
   */
  const [grown, setGrown] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (!autoGrow) return;
    const box = ref.current;
    if (!box) return;
    box.style.height = "auto";
    setGrown(box.scrollHeight);
  }, [autoGrow, value]);

  const matches = useMemo(() => {
    if (!trigger) return [];
    const query = trigger.query.trim().toLowerCase();
    const inScope = options.filter((option) => {
      if (trigger.kind === "page") return true;
      return (option.kind ?? "page") === trigger.kind;
    });
    const found = inScope
      .filter(
        (option) =>
          !query ||
          option.slug.includes(query) ||
          option.display.toLowerCase().includes(query),
      )
      .slice(0, 8);
    // A person or a job is a record; you do not invent one from a note. Only
    // the every-page trigger offers to create something new.
    if (trigger.kind !== "page") return found;
    const querySlug = query ? tagSlug(query) : null;
    // Offer the new tag too, unless it already matched — or unless the
    // fair-hiring rules exclude it, in which case there is nothing to offer
    // and the menu simply does not open.
    if (
      querySlug &&
      tagIsAllowed(querySlug) &&
      !found.some((option) => option.slug === querySlug)
    ) {
      found.push({ slug: querySlug, display: trigger.query.trim(), count: 0 });
    }
    return found;
  }, [trigger, options]);

  /**
   * Recompute what the caret is in the middle of typing. The highlighted row
   * resets here rather than in an effect, because this is the only place the
   * list of matches can change.
   */
  function sync(element: HTMLTextAreaElement) {
    const position = element.selectionStart ?? element.value.length;
    setCaret(position);
    const next = activeTagTrigger(element.value, position);
    setTrigger(next);
    if (next?.query !== trigger?.query || next?.kind !== trigger?.kind) {
      setIndex(0);
    }

    // Recall wins: a `/` inside `[[` is somebody typing a path, not asking for
    // a command menu.
    const command =
      slash && !next ? activeSlash(element.value, position) : null;
    setSlashAt(command);
    if (command) {
      // Measured at the caret rather than under the box, so the menu opens
      // where the eye already is.
      setSlashPoint(caretPoint(element, command.from));
      if (command.query !== slashAt?.query) setSlashIndex(0);
    }
  }

  function runCommand(command: SlashCommand) {
    if (!slashAt) return;
    const element = ref.current;
    if (command.types) {
      const next = applySlash(value, slashAt, command.types);
      if (element) {
        element.value = next.text;
        element.focus();
        element.setSelectionRange(next.caret, next.caret);
      }
      onChange(next.text);
      setSlashAt(null);
      // Straight into the recall menu the command asked for, so `/person`
      // lands you where `@` would have.
      if (element) sync(element);
      return;
    }
    onSlashCommand?.(command, slashAt);
    setSlashAt(null);
  }

  function choose(option: TagOption) {
    if (!trigger) return;
    const next = applyTagTrigger(value, trigger, caret, {
      slug: option.slug,
      display: option.display,
      kind: option.kind,
    });
    // Synchronous, for the same reason the bracket handler is: deferring the
    // caret to a frame means anything typed in the meantime lands at the old
    // position, which turns a fast "@name then keep typing" into nonsense.
    const element = ref.current;
    if (element) {
      element.value = next.text;
      element.focus();
      element.setSelectionRange(next.caret, next.caret);
    }
    onChange(next.text);
    setTrigger(null);
    setCaret(next.caret);
  }

  const open = trigger !== null && matches.length > 0;
  const commands = slashAt ? matchCommands(slashAt.query) : [];
  const commandsOpen = slashAt !== null && commands.length > 0;

  return (
    <div className={`relative ${wrapperClassName}`}>
      <textarea
        ref={ref}
        id={id}
        name={name}
        value={value}
        rows={rows}
        placeholder={placeholder}
        className={className}
        style={autoGrow ? { height: grown } : undefined}
        onChange={(event) => {
          onChange(event.target.value);
          sync(event.target);
        }}
        onClick={(event) => sync(event.currentTarget)}
        onKeyUp={(event) => {
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
            sync(event.currentTarget);
          }
        }}
        // Closed on blur with no delay: every row cancels the blur with
        // preventDefault on mousedown, so a click still lands, and a click
        // on anything else is not swallowed by a menu that is on its way out.
        autoFocus={autoFocus}
        onBlur={() => {
          setTrigger(null);
          setSlashAt(null);
          onBlur?.();
        }}
        onKeyDown={(event) => {
          // Brackets first, so "[[" closes itself whether or not the menu is
          // showing. This is what makes "[[" read as a command to make a
          // page rather than as two characters of punctuation.
          const element = event.currentTarget;
          const bracket = bracketKey(
            element.value,
            element.selectionStart ?? 0,
            event.key,
            element.selectionEnd ?? 0,
          );
          if (bracket) {
            event.preventDefault();
            // Synchronous on the element, not deferred to a re-render: a fast
            // typist (or a test typing character by character) gets the next
            // keystroke in before a frame, and the caret would land after the
            // closing brackets instead of between them.
            element.value = bracket.text;
            element.setSelectionRange(bracket.caret, bracket.caret);
            onChange(bracket.text);
            sync(element);
            return;
          }
          // The command menu first: it is the one that is open, and Enter in
          // it must not also make the next block.
          if (commandsOpen) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setSlashIndex((i) => Math.min(i + 1, commands.length - 1));
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setSlashIndex((i) => Math.max(i - 1, 0));
              return;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              event.preventDefault();
              runCommand(commands[slashIndex]);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setSlashAt(null);
              return;
            }
          }
          // The menu is closed, so whoever wrapped this gets the key.
          if (!open) {
            onKeyDown?.(event);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIndex((i) => Math.min(i + 1, matches.length - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setIndex((i) => Math.max(i - 1, 0));
          } else if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            choose(matches[index]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setTrigger(null);
          }
        }}
      />
      {commandsOpen && slashPoint && (
        <ul
          data-testid="slash-menu"
          // From the cursor, not from under the box: in a block that has
          // wrapped to four lines those are not the same place, and a menu you
          // have to look away to read is one you stop using.
          style={{
            left: slashPoint.x,
            top: slashPoint.y + slashPoint.lineHeight + 4,
          }}
          className="absolute z-40 w-72 overflow-hidden rounded border border-edge2 bg-panel shadow-2xl"
        >
          {commands.map((command, i) => (
            <li key={command.id}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setSlashIndex(i)}
                onClick={() => runCommand(command)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[13.5px] ${
                  i === slashIndex
                    ? "bg-accent-soft text-ink"
                    : "text-ink-muted"
                }`}
              >
                <span className="truncate">
                  <span aria-hidden className="mr-1.5">
                    {command.icon}
                  </span>
                  {command.label}
                </span>
                <span className="shrink-0 text-[11.5px] text-ink-faint">
                  {command.hint}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <ul
          data-testid="tag-suggestions"
          className="absolute z-30 mt-1 max-h-60 w-80 overflow-y-auto rounded border border-edge2 bg-panel shadow-2xl"
        >
          <li className="border-b border-edge px-3 py-1 text-[11px] uppercase tracking-wider text-ink-faint">
            <span aria-hidden className="mr-1">
              {TRIGGER_ICON[trigger.kind]}
            </span>
            {TRIGGER_LABEL[trigger.kind]}
          </li>
          {matches.map((option, i) => (
            <li key={option.slug}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setIndex(i)}
                onClick={() => choose(option)}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[13.5px] ${
                  i === index ? "bg-accent-soft text-ink" : "text-ink-muted"
                }`}
              >
                <span className="truncate">
                  <span aria-hidden className="mr-1.5">
                    {TRIGGER_ICON[option.kind ?? "page"]}
                  </span>
                  {option.display}
                </span>
                <span className="ml-3 shrink-0 text-[11px] text-ink-faint">
                  {option.hint ??
                    (option.count > 0 ? `${option.count} uses` : "new tag")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
