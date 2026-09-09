"use client";

import { useState } from "react";
import Link from "next/link";
import { saveDailyNoteAction } from "@/lib/actions/daily";
import { type TagOption } from "./tag-textarea";
import { Outliner } from "./outliner";
import { SaveNote, useAutosave } from "./forms";

/**
 * Today's note, on the dashboard.
 *
 * The same note the daily page holds, not a second one — writing here and
 * writing there are the same act, and a second scratchpad would be somewhere
 * for things to get lost. It is on the dashboard because a note you have to
 * navigate to is a note you write on the days you were going to write anyway.
 *
 * `[[` opens any page, `@` a person, `jj` a job, `/` the command menu —
 * exactly as on the notes page, because it is the same note and one editor is
 * the only way that stays true.
 */
export function QuickNote({
  day,
  initial,
  pages,
}: {
  day: string;
  initial: string;
  pages: TagOption[];
}) {
  const [text, setText] = useState(initial);
  const [zoom, setZoom] = useState<{ id: string; mark: string } | null>(null);
  const { state, says, saveNow } = useAutosave(text, (value) =>
    saveDailyNoteAction({ day, text: value }),
  );

  return (
    <div>
      <Outliner
        text={text}
        onChange={setText}
        options={pages}
        zoom={zoom}
        onZoom={setZoom}
        placeholder="What happened, what you decided, who to come back to. Tab indents · / for a to-do · [[page]] · @person · jj job"
      />
      <div className="mt-1.5 flex items-center gap-2">
        <button
          type="button"
          disabled={state.kind === "saving"}
          onClick={saveNow}
          className="rounded border border-accent/40 bg-accent-soft px-2.5 py-1 text-[13px] text-accent disabled:opacity-50"
        >
          {state.kind === "saving" ? "saving…" : "Save note"}
        </button>
        <Link
          href={`/daily/${day}`}
          className="text-[12px] text-ink-muted hover:text-ink"
        >
          the whole day →
        </Link>
        <SaveNote state={state} says={says} />
      </div>
    </div>
  );
}
