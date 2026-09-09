"use client";

import { useEffect, useRef, useState } from "react";
import {
  addChildren,
  fingerprint,
  findBlock,
  indentBlock,
  insertAfter,
  outdentBlock,
  parseOutline,
  reanchor,
  removeBlock,
  renderOutline,
  setText,
  trailTo,
  type OutlineBlock,
} from "../../artifact-src/core/outline";
import { askAction } from "@/lib/actions/workflow";
import {
  applySlash,
  asTodo,
  blockText,
  readTodo,
  writeTodo,
  type SlashCommand,
  type SlashTrigger,
} from "../../artifact-src/core/slash";
import {
  createTaskForBlockAction,
  setTaskStatusAction,
} from "@/lib/actions/workflow";
import { TagText } from "./tag-text";
import { TagTextarea, type TagOption } from "./tag-textarea";

/**
 * A note as an outline, in the manner of Roam's.
 *
 * Bullets inside bullets, to whatever depth somebody types. Click a bullet to
 * zoom into it and the rest of the note goes away until you climb back out
 * through the breadcrumb; click the words to edit them, and the bullet turns
 * into an arrow while you are in there, so which block has the caret is
 * visible from across the room rather than only from the blinking line.
 *
 * The whole outline is one text field, still, which is what makes this need no
 * table and no import — see `artifact-src/core/outline.ts`. Every keystroke
 * that changes the shape goes through a pure function there and comes back as
 * new text, so the thing that gets saved is always exactly what is on screen.
 *
 * Zoom lives in the URL with the block's first words beside the path, because
 * a path alone points at the wrong block the moment a line is typed above it.
 */
const EMPTY_BLOCK: OutlineBlock = {
  id: "0",
  text: "",
  depth: 0,
  children: [],
};

export function Outliner({
  text,
  onChange,
  options,
  zoom,
  onZoom,
  placeholder = "Type. Tab to indent, Enter for the next line.",
}: {
  text: string;
  onChange: (next: string) => void;
  options: TagOption[];
  /** `path` and the words that were there when the link was made. */
  zoom?: { id: string; mark?: string } | null;
  onZoom?: (next: { id: string; mark: string } | null) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  // The note as it is right now, for the handful of things that finish after
  // a round trip. Reading `text` out of the closure would write back whatever
  // the note said when the click happened and lose anything typed since.
  const latest = useRef(text);
  useEffect(() => {
    latest.current = text;
  }, [text]);

  const blocks = parseOutline(text);
  const anchored = zoom ? reanchor(blocks, zoom.id, zoom.mark) : null;
  const root = anchored ? findBlock(blocks, anchored) : null;
  const trail = anchored ? trailTo(blocks, anchored) : [];
  const shown = root ? root.children : blocks;

  function write(next: OutlineBlock[], focus?: string | null) {
    onChange(renderOutline(next));
    if (focus !== undefined) setEditing(focus);
  }

  /**
   * A command the menu could not carry out itself.
   *
   * `/task` is the one that has somewhere to go: it makes a real row in
   * `tasks` and writes that row's id into the block, so the tick here and the
   * tick on the task list are the same fact rather than two that will
   * disagree.
   */
  async function command(
    cmd: SlashCommand,
    trigger: SlashTrigger,
    block: OutlineBlock,
  ) {
    const without = applySlash(block.text, trigger, "").text.trim();
    if (cmd.id === "date") {
      const today = new Date().toISOString().slice(0, 10);
      onChange(
        renderOutline(
          setText(
            blocks,
            block.id,
            applySlash(block.text, trigger, today).text,
          ),
        ),
      );
      return;
    }
    if (cmd.id === "ask") {
      const question = without;
      if (!question) return;
      // The question stays as it was typed; the answer arrives underneath it,
      // labelled. An answer that reads like your own writing is the one thing
      // a note must never contain.
      onChange(
        renderOutline(
          addChildren(setText(blocks, block.id, question), block.id, [
            "🤔 asking…",
          ]),
        ),
      );
      const asked = await askAction({ question });
      const lines = asked.ok
        ? [
            `🤔 ${asked.data.answer}`,
            ...asked.data.uncertain.map((doubt) => `⚠️ not sure: ${doubt}`),
            `— answered by a model, ${new Date().toISOString().slice(0, 10)}`,
          ]
        : asked.kind === "pending" && asked.handoff
          ? [
              "⏳ waiting on a Claude session to answer",
              `— it needs ${asked.handoff.requestPath}`,
            ]
          : [`⚠️ no answer: ${asked.error}`];
      onChange(
        renderOutline(
          addChildren(setText(blocks, block.id, question), block.id, lines),
        ),
      );
      setEditing(null);
      return;
    }
    if (cmd.id !== "task") return;

    // The words become the task's title. An empty block makes an empty task,
    // so it is left as a to-do with no row behind it until it has some words —
    // a task list full of blank rows is a task list nobody opens.
    if (!without) {
      onChange(renderOutline(setText(blocks, block.id, asTodo("", null))));
      return;
    }
    const made = await createTaskForBlockAction({ title: without });
    onChange(
      renderOutline(
        setText(
          blocks,
          block.id,
          asTodo(without, made.ok ? made.data.id : null),
        ),
      ),
    );
    // Out of the editor once it is made, so what you see is the to-do rather
    // than the row id behind it. The id is real text and the editor shows real
    // text — leaving you in there means leaving a uuid in the middle of your
    // sentence.
    setEditing(null);
  }

  /**
   * Tick or untick a to-do block, and the row it points at with it.
   *
   * The box moves first, because a checkbox that waits for a server before it
   * looks ticked feels broken. If the row refuses to move, the box goes back
   * and says why: the whole point of writing the task's id into the block is
   * that the note and the task list are one fact, and a tick that stuck here
   * while the row stayed open is precisely the disagreement the anchor exists
   * to prevent — the more so because you would not find out until tomorrow.
   */
  function tick(block: OutlineBlock, done: boolean) {
    const todo = readTodo(block.text);
    if (!todo) return;
    onChange(
      renderOutline(setText(blocks, block.id, writeTodo({ ...todo, done }))),
    );
    const taskId = todo.taskId;
    if (!taskId) return;
    setTrouble(null);
    void setTaskStatusAction({ taskId, done }).then((result) => {
      if (result.ok) return;
      // Put it back — but against the note as it stands now, and only if this
      // block is still the same to-do showing what we just set. Anything else
      // means the reader has moved on, and quietly rewriting their note to
      // undo a click they have forgotten is worse than the wrong box.
      const now = parseOutline(latest.current);
      const found = findBlock(now, block.id);
      const showing = found ? readTodo(found.text) : null;
      if (showing && showing.taskId === taskId && showing.done === done) {
        onChange(
          renderOutline(
            setText(now, block.id, writeTodo({ ...showing, done: !done })),
          ),
        );
      }
      setTrouble(
        `That to-do is still ${done ? "open" : "done"} on the task list — ${result.error}`,
      );
    });
  }

  function keys(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    block: OutlineBlock,
    atStart: boolean,
  ) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const edit = insertAfter(blocks, block.id);
      write(edit.blocks, edit.focus);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      const edit = event.shiftKey
        ? outdentBlock(blocks, block.id)
        : indentBlock(blocks, block.id);
      write(edit.blocks, edit.focus);
      return;
    }
    // Only an empty block, and only from the very start. Backspacing away a
    // block with words in it would lose them to one keystroke.
    if (event.key === "Backspace" && atStart && block.text === "") {
      event.preventDefault();
      const edit = removeBlock(blocks, block.id);
      write(edit.blocks, edit.focus);
    }
  }

  return (
    /*
      Notes are read, not scanned. The workspace's density is right for a
      table of forty jobs and wrong for the surface somebody is writing prose
      on, so the outline sets its own size and everything inside inherits it —
      which also means a caller that wants it larger says so once, on the
      container, rather than in four places.
    */
    <div data-testid="outliner" className="text-[15px] leading-7">
      {trouble && (
        <p
          role="status"
          className="mb-2 rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] text-bad"
        >
          {trouble}
        </p>
      )}
      {trail.length > 0 && (
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-[12.5px] text-ink-muted">
          <button
            type="button"
            onClick={() => onZoom?.(null)}
            className="rounded px-1 text-accent hover:underline"
          >
            ⌂ whole note
          </button>
          {trail.map((step, index) => (
            <span key={step.id} className="flex items-center gap-1">
              <span aria-hidden className="text-ink-faint">
                ›
              </span>
              {index === trail.length - 1 ? (
                <span className="text-ink">{blockText(step.text)}</span>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onZoom?.({ id: step.id, mark: fingerprint(step.text) })
                  }
                  className="rounded px-1 text-accent hover:underline"
                >
                  {blockText(step.text)}
                </button>
              )}
            </span>
          ))}
        </nav>
      )}

      {root && (
        // The zoomed block itself, as the title of what is under it.
        <h3 className="mb-2 text-[16px] font-medium text-ink">
          <TagText text={blockText(root.text)} />
        </h3>
      )}

      {shown.length === 0 ? (
        <button
          type="button"
          onClick={() => {
            if (blocks.length === 0) {
              // Nothing to insert after. One empty block, and the caret in it.
              onChange(renderOutline([EMPTY_BLOCK]));
              setEditing("0");
              return;
            }
            const edit = insertAfter(blocks, root ? root.id : "0");
            write(edit.blocks, edit.focus);
          }}
          className="text-[14px] text-ink-faint hover:text-ink"
        >
          {placeholder}
        </button>
      ) : (
        <Branch
          blocks={shown}
          editing={editing}
          options={options}
          onEdit={setEditing}
          onText={(id, next) =>
            onChange(renderOutline(setText(blocks, id, next)))
          }
          onKeys={keys}
          onCommand={command}
          onTick={tick}
          onZoom={(block) =>
            onZoom?.({ id: block.id, mark: fingerprint(block.text) })
          }
        />
      )}
    </div>
  );
}

function Branch({
  blocks,
  editing,
  options,
  onEdit,
  onText,
  onKeys,
  onCommand,
  onTick,
  onZoom,
}: {
  blocks: OutlineBlock[];
  editing: string | null;
  options: TagOption[];
  onEdit: (id: string | null) => void;
  onText: (id: string, next: string) => void;
  onKeys: (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    block: OutlineBlock,
    atStart: boolean,
  ) => void;
  onCommand: (
    command: SlashCommand,
    trigger: SlashTrigger,
    block: OutlineBlock,
  ) => void;
  onTick: (block: OutlineBlock, done: boolean) => void;
  onZoom: (block: OutlineBlock) => void;
}) {
  return (
    <ul className="space-y-0.5">
      {blocks.map((block) => {
        const open = editing === block.id;
        const todo = readTodo(block.text);
        return (
          <li key={block.id} data-block={block.id}>
            <div className="group flex items-start gap-1.5">
              <button
                type="button"
                aria-label={`Zoom into ${blockText(block.text) || "this block"}`}
                title="Zoom in"
                onClick={() => onZoom(block)}
                // Bigger: the bullet is the handle you click to zoom into a
                // block, and a 16px target with a 10px glyph in it is a
                // control you aim at rather than press.
                className="mt-[5px] flex size-6 shrink-0 items-center justify-center rounded-full text-[17px] leading-none text-ink-faint transition-colors group-hover:text-accent hover:bg-panel2"
              >
                {/*
                  Bullet at rest, arrow while the block has the caret. Both are
                  always in the DOM and cross-fade, because swapping the glyph
                  makes the row jump by a pixel and a list of forty rows twitches
                  every time you click one.
                */}
                <span className="relative block size-4">
                  <span
                    aria-hidden
                    data-glyph="bullet"
                    className={`absolute inset-0 flex items-center justify-center transition-all duration-150 ${
                      open ? "scale-50 opacity-0" : "scale-100 opacity-100"
                    }`}
                  >
                    •
                  </span>
                  <span
                    aria-hidden
                    data-glyph="arrow"
                    className={`absolute inset-0 flex items-center justify-center transition-all duration-150 ${
                      open
                        ? "rotate-0 scale-100 opacity-100"
                        : "-rotate-90 scale-50 opacity-0"
                    }`}
                  >
                    ▸
                  </span>
                </span>
              </button>

              {/*
                The box sits outside the editor, so a block that has just
                become a to-do shows one while you are still typing into it —
                the command should not make you click away to see that it
                worked.
              */}
              {todo && (
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={(event) => onTick(block, event.target.checked)}
                  aria-label={
                    todo.done
                      ? `Reopen "${todo.text}"`
                      : `Finish "${todo.text}"`
                  }
                  className="mt-[9px] size-4 shrink-0 accent-accent"
                />
              )}
              {open ? (
                <TagTextarea
                  value={block.text}
                  options={options}
                  rows={1}
                  autoFocus
                  slash
                  onSlashCommand={(cmd, trigger) =>
                    onCommand(cmd, trigger, block)
                  }
                  onChange={(next) => onText(block.id, next)}
                  onKeyDown={(event) => onKeys(event, block, atStartOf(event))}
                  onBlur={() => onEdit(null)}
                  autoGrow
                  // The wrapper is what the row lays out, so this is where
                  // "fill the line" has to be said. The box and the button
                  // below carry the same padding, border width and leading,
                  // so clicking into a block moves nothing.
                  wrapperClassName="min-w-0 flex-1"
                  className="w-full resize-none overflow-hidden rounded border border-edge2 bg-panel2 px-2 py-1 text-[length:inherit] leading-[inherit] text-ink"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onEdit(block.id)}
                  className={`min-w-0 flex-1 rounded border border-transparent px-2 py-1 text-left text-[length:inherit] leading-[inherit] hover:bg-panel2/60 ${
                    todo?.done ? "text-ink-faint line-through" : "text-ink"
                  }`}
                >
                  {blockText(block.text) ? (
                    <TagText text={blockText(block.text)} />
                  ) : (
                    <span className="text-ink-faint">empty</span>
                  )}
                </button>
              )}
            </div>

            {block.children.length > 0 && (
              // The line down the left, which is what makes depth readable at
              // a glance rather than countable by indentation.
              <div className="ml-[7px] border-l border-edge pl-3">
                <Branch
                  blocks={block.children}
                  editing={editing}
                  options={options}
                  onEdit={onEdit}
                  onText={onText}
                  onKeys={onKeys}
                  onCommand={onCommand}
                  onTick={onTick}
                  onZoom={onZoom}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function atStartOf(event: React.KeyboardEvent<HTMLTextAreaElement>): boolean {
  const element = event.currentTarget;
  return (
    (element.selectionStart ?? 0) === 0 && (element.selectionEnd ?? 0) === 0
  );
}
