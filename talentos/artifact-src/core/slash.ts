/**
 * The slash menu, and what a block looks like once it is a to-do.
 *
 * Typing `/` in a block opens a short list of things to do to that block. It
 * is the same idea as the `[[`, `@` and `jj` triggers already in the editor —
 * a character that means "I want something" rather than a character — and it
 * exists because those three are recall and this is action, and putting an
 * action behind a recall trigger is how a menu ends up with twenty rows in it.
 *
 * The first command is always the to-do, because that is the one that has
 * somewhere to go: a block turned into a task appears on the task list and on
 * the dashboard, and stops being a line in a note that nobody reads again.
 *
 * **A to-do block does not hold its own state.** It holds the id of a row in
 * `tasks`, written into the text as `^<id>`, and the tick is that row's. Two
 * copies of "is this done" would disagree the first time somebody ticked it on
 * the other page, and a to-do that disagrees with itself is worse than a plain
 * line of text.
 *
 * Nothing here imports anything, so the menu runs in the artifact.
 */

export interface SlashCommand {
  id: string;
  label: string;
  icon: string;
  /** What it does, in a few words, on the right of the row. */
  hint: string;
  /**
   * The text it types, for the ones that are only text. A command with none
   * needs the page to do something — `task` has to make a row first.
   */
  types?: string;
}

/**
 * The menu. Short on purpose: a slash menu that lists everything the software
 * can do is a second navigation, and you are in the middle of a sentence.
 *
 * The to-do is first because it is the one with somewhere to go. Asking is
 * second because it is the other one that does something rather than typing
 * something — and it lands as blocks under the question, labelled with what
 * answered it, because an answer you cannot tell from your own writing is the
 * one thing a note must never contain.
 */
export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    id: "task",
    label: "To-do",
    icon: "✅",
    hint: "tick it here or on the task list",
  },
  {
    id: "ask",
    label: "Ask AI",
    icon: "🤔",
    hint: "answers under this block, labelled",
  },
  {
    id: "page",
    label: "Page",
    icon: "🏷️",
    hint: "link a tag, person or job",
    types: "[[",
  },
  {
    id: "person",
    label: "Person",
    icon: "👤",
    hint: "someone on file",
    types: "@",
  },
  {
    id: "job",
    label: "Job",
    icon: "💼",
    hint: "one of your searches",
    types: "jj",
  },
  { id: "date", label: "Today", icon: "📅", hint: "write today's date" },
];

export interface SlashTrigger {
  /** Index of the `/`. */
  from: number;
  /** Index of the caret. */
  to: number;
  query: string;
}

/** Past this the `/` was punctuation and the menu should have given up. */
export const MAX_QUERY = 20;

/**
 * The `/` the caret is currently behind, if any.
 *
 * It has to open a word: a slash inside `https://` or `and/or` is punctuation,
 * and a menu that opens there is a menu that opens constantly.
 */
export function activeSlash(text: string, caret: number): SlashTrigger | null {
  const before = text.slice(0, caret);
  const from = before.lastIndexOf("/");
  if (from === -1) return null;

  const previous = from === 0 ? "" : before[from - 1];
  if (previous && !/\s/u.test(previous)) return null;

  const query = before.slice(from + 1);
  if (query.length > MAX_QUERY) return null;
  // A space ends it. The menu is for one word.
  if (/\s/u.test(query)) return null;

  return { from, to: caret, query };
}

export function matchCommands(query: string): SlashCommand[] {
  const wanted = query.trim().toLowerCase();
  if (!wanted) return [...SLASH_COMMANDS];
  const starts = SLASH_COMMANDS.filter(
    (command) =>
      command.id.startsWith(wanted) ||
      command.label.toLowerCase().startsWith(wanted),
  );
  const contains = SLASH_COMMANDS.filter(
    (command) =>
      !starts.includes(command) &&
      (command.id.includes(wanted) ||
        command.label.toLowerCase().includes(wanted) ||
        command.hint.toLowerCase().includes(wanted)),
  );
  return [...starts, ...contains];
}

/** Replace the `/query` with whatever the command types. */
export function applySlash(
  text: string,
  trigger: SlashTrigger,
  typed: string,
): { text: string; caret: number } {
  const next = text.slice(0, trigger.from) + typed + text.slice(trigger.to);
  return { text: next, caret: trigger.from + typed.length };
}

// ---------------------------------------------------------------------------
// a block that is a to-do

const TODO = /^\s*\[( |x|X)\]\s?/u;
const ANCHOR = /\s*\^([A-Za-z0-9_-]{6,64})\s*$/u;

export interface TodoBlock {
  done: boolean;
  /** The row in `tasks` this block is. Null while it is still being made. */
  taskId: string | null;
  /** The words, without the box and without the anchor. */
  text: string;
}

/** Read a block as a to-do, or null if it is an ordinary line. */
export function readTodo(text: string): TodoBlock | null {
  const box = TODO.exec(text);
  if (!box) return null;
  const rest = text.slice(box[0].length);
  const anchor = ANCHOR.exec(rest);
  return {
    done: box[1].toLowerCase() === "x",
    taskId: anchor ? anchor[1] : null,
    text: (anchor ? rest.slice(0, anchor.index) : rest).trim(),
  };
}

/** Write a to-do back out, keeping the anchor at the end where it is invisible. */
export function writeTodo(todo: TodoBlock): string {
  const box = todo.done ? "[x] " : "[ ] ";
  return `${box}${todo.text}${todo.taskId ? ` ^${todo.taskId}` : ""}`;
}

/** Turn an ordinary block into a to-do, keeping its words. */
export function asTodo(text: string, taskId: string | null): string {
  const already = readTodo(text);
  return writeTodo({
    done: already?.done ?? false,
    taskId: taskId ?? already?.taskId ?? null,
    text: already ? already.text : text.trim(),
  });
}

/**
 * What a block says once the machinery is taken off it.
 *
 * Used everywhere a block's words are shown rather than edited, so an anchor
 * is never on screen — it is a pointer, and a pointer in the middle of a note
 * is somebody's punctuation gone wrong as far as the reader is concerned.
 */
export function blockText(text: string): string {
  const todo = readTodo(text);
  if (todo) return todo.text;
  const anchor = ANCHOR.exec(text);
  return anchor ? text.slice(0, anchor.index) : text;
}
