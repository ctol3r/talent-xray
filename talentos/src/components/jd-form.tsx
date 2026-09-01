"use client";

import { useState } from "react";
import { saveJobDescriptionAction } from "@/lib/actions/projects";
import {
  ErrorNote,
  FieldLabel,
  buttonClass,
  inputClass,
  useAction,
} from "./forms";

export function JdForm({
  searchProjectId,
  hasExisting,
}: {
  searchProjectId: string;
  hasExisting: boolean;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(!hasExisting);
  const { pending, error, submit } = useAction();

  if (!open) {
    return (
      <button
        type="button"
        className="text-[12.5px] text-accent hover:underline"
        onClick={() => setOpen(true)}
      >
        Replace job description…
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(
          () =>
            saveJobDescriptionAction({
              searchProjectId,
              rawText: text,
              source: "pasted",
            }),
          () => {
            setText("");
            setOpen(false);
          },
        );
      }}
      className="space-y-2"
    >
      <FieldLabel>
        Paste the job description (or a manual role brief)
      </FieldLabel>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        required
        placeholder="Paste the JD text here…"
        className={`${inputClass} resize-y font-mono text-[12.5px]`}
        name="jd"
      />
      <ErrorNote error={error} />
      <button
        type="submit"
        disabled={pending || text.trim() === ""}
        className={buttonClass}
      >
        {pending ? "Saving…" : "Save job description"}
      </button>
    </form>
  );
}
