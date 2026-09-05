"use client";

import { useState } from "react";
import { completeTaskAction, createTaskAction } from "@/lib/actions/workflow";
import {
  ErrorNote,
  FieldLabel,
  buttonClass,
  inputClass,
  useAction,
} from "./forms";

export function TaskForm() {
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const { pending, error, submit } = useAction();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit(
          () =>
            createTaskAction({
              title,
              dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
            }),
          () => {
            setTitle("");
            setDueAt("");
          },
        );
      }}
    >
      <label className="min-w-64 flex-1">
        <FieldLabel>New task</FieldLabel>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g. Call HM about the two open intake questions"
          className={inputClass}
        />
      </label>
      <label>
        <FieldLabel>Due</FieldLabel>
        <input
          type="date"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
          className={inputClass}
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Adding…" : "Add task"}
      </button>
      <ErrorNote error={error} />
    </form>
  );
}

export function CompleteTaskButton({ taskId }: { taskId: string }) {
  const { pending, submit } = useAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => submit(() => completeTaskAction({ taskId }))}
      className="rounded border border-edge2 px-2 py-0.5 text-[11.5px] text-ink-muted hover:bg-panel2"
    >
      {pending ? "…" : "Done"}
    </button>
  );
}
