"use client";

import { useState } from "react";
import {
  answerIntakeQuestionAction,
  completeIntakeAction,
} from "@/lib/actions/workflow";
import {
  ErrorNote,
  buttonClass,
  inputClass,
  subtleButtonClass,
  useAction,
} from "./forms";

export function IntakeAnswer({
  sessionId,
  questionId,
  existingAnswer,
}: {
  sessionId: string;
  questionId: string;
  existingAnswer?: string;
}) {
  const [value, setValue] = useState(existingAnswer ?? "");
  const [editing, setEditing] = useState(!existingAnswer);
  const { pending, error, submit } = useAction();

  if (!editing) {
    return (
      <div className="mt-1.5 flex items-start gap-2 rounded border border-ok/20 bg-ok-soft/40 px-3 py-2">
        <p className="flex-1 text-[13px] whitespace-pre-wrap">
          {existingAnswer}
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="shrink-0 text-[11.5px] text-ink-faint hover:text-ink"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-1.5 space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(
          () =>
            answerIntakeQuestionAction({
              sessionId,
              questionId,
              answer: value,
            }),
          () => setEditing(false),
        );
      }}
    >
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={2}
        placeholder="Capture the hiring manager's answer…"
        className={`${inputClass} resize-y`}
      />
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || value.trim() === ""}
          className={buttonClass}
        >
          {pending ? "Saving…" : "Save answer"}
        </button>
        {existingAnswer && (
          <button
            type="button"
            className={subtleButtonClass}
            onClick={() => {
              setValue(existingAnswer);
              setEditing(false);
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function CompleteIntakeButton({
  sessionId,
  searchProjectId,
  disabled,
}: {
  sessionId: string;
  searchProjectId: string;
  disabled: boolean;
}) {
  const { pending, error, submit } = useAction();
  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() =>
          submit(() => completeIntakeAction({ sessionId, searchProjectId }))
        }
        className={buttonClass}
        title={
          disabled
            ? "Answer at least one question before completing"
            : undefined
        }
      >
        {pending ? "Saving…" : "Mark intake complete"}
      </button>
      <ErrorNote error={error} />
    </div>
  );
}
