"use client";

import { useState } from "react";
import {
  setOnboardingStateAction,
  upsertOfferAction,
} from "@/lib/actions/workflow";
import { ErrorNote, FieldLabel, inputClass, useAction } from "./forms";

export function OfferControls({
  searchProjectId,
  candidateId,
  status,
  compensationNote,
}: {
  searchProjectId: string;
  candidateId: string;
  status?: string;
  compensationNote?: string | null;
}) {
  const [comp, setComp] = useState(compensationNote ?? "");
  const { pending, error, submit } = useAction();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label>
          <FieldLabel>Offer status</FieldLabel>
          <select
            value={status ?? ""}
            disabled={pending}
            onChange={(e) =>
              submit(() =>
                upsertOfferAction({
                  searchProjectId,
                  candidateId,
                  status: e.target.value,
                  compensationNote: comp || undefined,
                }),
              )
            }
            className={inputClass}
          >
            <option value="" disabled>
              No offer yet
            </option>
            <option value="preparing">preparing</option>
            <option value="extended">extended</option>
            <option value="accepted">accepted</option>
            <option value="declined">declined</option>
            <option value="withdrawn">withdrawn</option>
          </select>
        </label>
        <label className="min-w-48 flex-1">
          <FieldLabel>Offer compensation note</FieldLabel>
          <input
            value={comp}
            onChange={(e) => setComp(e.target.value)}
            placeholder="e.g. $210k base + bonus"
            className={inputClass}
          />
        </label>
      </div>
      <ErrorNote error={error} />
      <p className="text-[11.5px] text-ink-faint">
        Offer status drives the pipeline stage (preparing → Offer Preparation,
        extended → Offer Extended, accepted → Offer Accepted).
      </p>
    </div>
  );
}

export function OnboardingChecklist({
  searchProjectId,
  candidateId,
  checklist,
  startDate,
  startConfirmed,
}: {
  searchProjectId: string;
  candidateId: string;
  checklist: { id?: string; label: string; owner?: string; dueOffsetDays?: number; done?: boolean }[];
  startDate: string | null;
  startConfirmed: boolean;
}) {
  const [date, setDate] = useState(startDate?.slice(0, 10) ?? "");
  const { pending, error, submit } = useAction();
  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {checklist.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={Boolean(item.done)}
              disabled={pending}
              onChange={(e) =>
                submit(() =>
                  setOnboardingStateAction({
                    candidateId,
                    searchProjectId,
                    checklistItemId: item.id,
                    checklistDone: e.target.checked,
                  }),
                )
              }
              className="mt-0.5 accent-[#6d9cff]"
            />
            <span className={`text-[13px] ${item.done ? "text-ink-faint line-through" : ""}`}>
              {item.label}
              <span className="ml-1 text-[11.5px] text-ink-faint">
                {item.owner ? `· ${item.owner}` : ""}
                {item.dueOffsetDays !== undefined
                  ? ` · day ${item.dueOffsetDays >= 0 ? "+" : ""}${item.dueOffsetDays}`
                  : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-end gap-2 border-t border-edge pt-3">
        <label>
          <FieldLabel>Start date</FieldLabel>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <button
          type="button"
          disabled={pending || !date}
          onClick={() =>
            submit(() =>
              setOnboardingStateAction({
                candidateId,
                searchProjectId,
                startDate: date,
              }),
            )
          }
          className="rounded border border-edge2 px-3 py-2 text-[13px] text-ink-muted hover:bg-panel2"
        >
          Save date
        </button>
        <button
          type="button"
          disabled={pending || startConfirmed}
          onClick={() =>
            submit(() =>
              setOnboardingStateAction({
                candidateId,
                searchProjectId,
                startConfirmed: true,
              }),
            )
          }
          className="rounded bg-ok px-3 py-2 text-[13px] font-medium text-canvas disabled:opacity-50"
        >
          {startConfirmed ? "Start confirmed ✓" : "Confirm start"}
        </button>
      </div>
      <ErrorNote error={error} />
    </div>
  );
}
