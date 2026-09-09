"use client";

import { useState, useTransition } from "react";
import {
  reorderTasksAction,
  setTaskStatusAction,
} from "@/lib/actions/workflow";

/**
 * Tasks you can put in the order you actually want to do them.
 *
 * Dragging is the obvious way and it is not the only way: every row also has
 * move-up and move-down buttons, because a list you can only reorder with a
 * mouse is a list some people cannot reorder at all. The buttons are not a
 * consolation prize either — for moving one row one place they are faster.
 *
 * The whole order is saved on each move rather than a "moved 3 to 1"
 * instruction, so what is stored is exactly what is on screen. Relative
 * nudges drift the moment two of them arrive at once.
 *
 * The list moves first and saves after. A reorder that waited for a round
 * trip would feel broken over anything but a local database, and the failure
 * is recoverable: the order comes back on the next load.
 */

export interface TaskRow {
  id: string;
  title: string;
  dueAt: string | null;
  searchProjectId: string | null;
  done: boolean;
}

/**
 * A ticked task stays where it is, struck through.
 *
 * It was a "Done" button that removed the row, which is two mistakes in one
 * control: there was no way back from a mis-click, and the list lost the only
 * evidence that anything had been got through today. A checkbox goes both
 * ways and a struck-out line is still a line — you can see what you did, and
 * untick the one you should not have ticked.
 *
 * The tick is optimistic for the same reason the drag is: a checkbox that
 * waits for a round trip before it looks ticked feels broken, and the failure
 * is recoverable on the next load.
 */
export function TaskList({
  tasks,
  olderDone = 0,
}: {
  tasks: TaskRow[];
  /** Ticked longer ago than the list keeps. Counted rather than listed. */
  olderDone?: number;
}) {
  /**
   * Local order and ticks, held only until the server says otherwise.
   *
   * Seeding `useState` from props once was a bug older than any of this: a
   * task added by the form beside this list did not appear until the page was
   * reloaded, because the server re-rendered with the new task and the state
   * kept the old array. Holding the props' signature alongside the rows fixes
   * it without an effect — when the server's list differs from the one this
   * copy was made from, the server's is the one shown.
   */
  const signature = tasks
    .map((task) => `${task.id}:${task.done ? 1 : 0}`)
    .join(",");
  const [local, setLocal] = useState({ signature, rows: tasks });
  const rows = local.signature === signature ? local.rows : tasks;
  const setRows = (next: TaskRow[] | ((current: TaskRow[]) => TaskRow[])) =>
    setLocal({
      signature,
      rows: typeof next === "function" ? next(rows) : next,
    });
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function save(next: TaskRow[]) {
    setRows(next);
    startTransition(async () => {
      const result = await reorderTasksAction({
        orderedIds: next.map((row) => row.id),
      });
      setError(result.ok ? null : result.error);
    });
  }

  function move(id: string, to: number) {
    const from = rows.findIndex((row) => row.id === id);
    if (from === -1) return;
    const target = Math.max(0, Math.min(rows.length - 1, to));
    if (target === from) return;
    const next = [...rows];
    const [row] = next.splice(from, 1);
    next.splice(target, 0, row);
    save(next);
  }

  function tick(task: TaskRow, done: boolean) {
    setRows((current) =>
      current.map((row) => (row.id === task.id ? { ...row, done } : row)),
    );
    startTransition(async () => {
      const result = await setTaskStatusAction({ taskId: task.id, done });
      if (!result.ok) {
        setError(result.error);
        setRows((current) =>
          current.map((row) =>
            row.id === task.id ? { ...row, done: !done } : row,
          ),
        );
      } else {
        setError(null);
      }
    });
  }

  if (rows.length === 0) {
    return (
      <p className="text-[14px] text-ink-muted">
        Nothing open. The daily briefing will tell you when something is.
      </p>
    );
  }

  return (
    <>
      <p className="mb-2 text-[12.5px] text-ink-faint">
        Drag a task to reorder, or use the arrows. The order is yours and is
        saved as you go.
      </p>
      <ul data-testid="task-list" className="divide-y divide-edge">
        {rows.map((task, index) => (
          <li
            key={task.id}
            draggable
            data-task-id={task.id}
            onDragStart={(event) => {
              setDragging(task.id);
              event.dataTransfer.effectAllowed = "move";
              // Firefox refuses to start a drag without payload.
              event.dataTransfer.setData("text/plain", task.id);
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              if (over !== task.id) setOver(task.id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const id = dragging ?? event.dataTransfer.getData("text/plain");
              setOver(null);
              setDragging(null);
              if (id && id !== task.id) move(id, index);
            }}
            className={`flex items-center gap-2 py-2 ${
              dragging === task.id ? "opacity-40" : ""
            } ${over === task.id && dragging !== task.id ? "border-t-2 border-accent" : ""}`}
          >
            <span
              aria-hidden
              className="cursor-grab select-none px-1 text-[14px] text-ink-faint active:cursor-grabbing"
              title="Drag to reorder"
            >
              ⠿
            </span>
            <input
              type="checkbox"
              checked={task.done}
              onChange={(event) => tick(task, event.target.checked)}
              aria-label={
                task.done ? `Reopen "${task.title}"` : `Finish "${task.title}"`
              }
              className="size-3.5 shrink-0 accent-accent"
            />
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-[14px] ${
                  task.done ? "text-ink-faint line-through" : ""
                }`}
              >
                {task.title}
              </span>
              {task.dueAt && !task.done && (
                <span
                  className={`text-[12.5px] ${
                    task.dueAt <= new Date().toISOString()
                      ? "text-bad"
                      : "text-ink-faint"
                  }`}
                >
                  due {new Date(task.dueAt).toLocaleDateString()}
                </span>
              )}
            </span>
            <span className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                aria-label={`Move "${task.title}" up`}
                disabled={index === 0}
                onClick={() => move(task.id, index - 1)}
                className="rounded px-1.5 text-[13px] text-ink-faint hover:text-ink disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move "${task.title}" down`}
                disabled={index === rows.length - 1}
                onClick={() => move(task.id, index + 1)}
                className="rounded px-1.5 text-[13px] text-ink-faint hover:text-ink disabled:opacity-30"
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ul>
      {olderDone > 0 && (
        <p className="mt-2 text-[12.5px] text-ink-faint">
          {olderDone} finished more than a fortnight ago, not listed.
        </p>
      )}
      {error && (
        <p className="mt-2 rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[13px] text-bad">
          The order could not be saved: {error}
        </p>
      )}
    </>
  );
}
