"use client";

import { updateChannelAction } from "@/lib/actions/workflow";
import { useAction } from "./forms";

const selectClass =
  "rounded border border-edge bg-panel px-1.5 py-0.5 text-[12px] text-ink outline-none";

export function ChannelControls({
  channelId,
  priority,
  status,
}: {
  channelId: string;
  priority: string;
  status: string;
}) {
  const { pending, submit } = useAction();
  return (
    <div className="flex items-center gap-1.5">
      <select
        defaultValue={priority}
        disabled={pending}
        onChange={(e) =>
          submit(() =>
            updateChannelAction({ id: channelId, priority: e.target.value }),
          )
        }
        className={selectClass}
        title="Priority"
      >
        <option value="high">high</option>
        <option value="medium">medium</option>
        <option value="experimental">experimental</option>
      </select>
      <select
        defaultValue={status}
        disabled={pending}
        onChange={(e) =>
          submit(() =>
            updateChannelAction({ id: channelId, status: e.target.value }),
          )
        }
        className={selectClass}
        title="Status — mark 'verified' only after you have checked the venue yourself"
      >
        <option value="suggested">suggested</option>
        <option value="verified">verified</option>
        <option value="rejected">rejected</option>
      </select>
    </div>
  );
}
