"use client";

import { useState } from "react";
import { updateSearchProjectAction } from "@/lib/actions/projects";
import { SaveNote, buttonClass, inputClass, useAutosave } from "./forms";
import { TagTextarea, type TagOption } from "./tag-textarea";
import { TagRow } from "./tag-text";
import { tagsIn } from "@/lib/core/tags";

/**
 * The job's notes, and the place a job's tags live.
 *
 * A tag written here and the same tag written on a person are what put the
 * two on one page. That is the whole mechanism: no join table, no matcher,
 * just the same word in two places.
 */
export function SearchNotesForm({
  projectId,
  notes,
  tags = [],
}: {
  projectId: string;
  notes: string | null;
  tags?: TagOption[];
}) {
  const [value, setValue] = useState(notes ?? "");
  const { state, says, saveNow } = useAutosave(value, (next) =>
    updateSearchProjectAction({ id: projectId, recruiterNotes: next }),
  );
  const written = tagsIn(value);
  return (
    <form
      className="space-y-1.5"
      onSubmit={(event) => {
        event.preventDefault();
        saveNow();
      }}
    >
      <TagTextarea
        value={value}
        onChange={setValue}
        options={tags}
        rows={3}
        placeholder="What this search is really about. Type @, # or [[ to tag it — the same tag on a person links the two."
        className={`${inputClass} resize-y`}
      />
      {written.length > 0 && <TagRow tags={written} className="pt-0.5" />}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={state.kind === "saving"}
          className={buttonClass}
        >
          {state.kind === "saving" ? "Saving…" : "Save notes"}
        </button>
        {/* Failures show here rather than in a separate red box: one line
            that says saved, saving or why not is easier to trust than two
            places that each know half of it. */}
        <SaveNote state={state} says={says} />
      </div>
    </form>
  );
}
