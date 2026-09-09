"use client";

import { updateOutreachStatusAction } from "@/lib/actions/workflow";
import { useAction } from "./forms";

export function MessageStatusSelect({
  messageId,
  status,
}: {
  messageId: string;
  status: string;
}) {
  const { pending, submit } = useAction();
  return (
    <select
      defaultValue={status}
      disabled={pending}
      onChange={(e) =>
        submit(() =>
          updateOutreachStatusAction({
            messageId,
            status:
              e.target.value === "replied_qualified"
                ? "replied"
                : e.target.value,
            qualified: e.target.value === "replied_qualified",
          }),
        )
      }
      className="rounded border border-edge bg-panel px-1.5 py-0.5 text-[13px] text-ink"
      title="Track manually — nothing ever sends automatically"
    >
      <option value="drafted">drafted</option>
      <option value="sent">sent (manually)</option>
      <option value="replied">replied</option>
      {/*
        The qualification is the reader's, not the software's. Nothing in a
        reply tells a program whether it came from a real candidate, and the
        brief-to-first-qualified-reply measure is only worth having because a
        person answered this here, once, while reading it.
      */}
      <option value="replied_qualified">replied — qualified</option>
      <option value="no_reply">no reply</option>
    </select>
  );
}
