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
          updateOutreachStatusAction({ messageId, status: e.target.value }),
        )
      }
      className="rounded border border-edge bg-panel px-1.5 py-0.5 text-[12px] text-ink outline-none"
      title="Track manually — nothing ever sends automatically"
    >
      <option value="drafted">drafted</option>
      <option value="sent">sent (manually)</option>
      <option value="replied">replied</option>
      <option value="no_reply">no reply</option>
    </select>
  );
}
