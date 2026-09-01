"use client";

import { useState } from "react";
import { LEARNING_KINDS } from "@/lib/core/enums";
import { addLearningAction } from "@/lib/actions/workflow";
import {
  ErrorNote,
  FieldLabel,
  buttonClass,
  inputClass,
  useAction,
} from "./forms";

const KIND_LABELS: Record<string, string> = {
  why_responded: "Why they responded",
  why_declined: "Why they declined",
  why_hm_passed: "Why the HM passed",
  why_interview_failed: "Why the interview failed",
  why_offer_lost: "Why the offer was lost",
  why_offer_won: "Why the offer was won",
  general: "General",
};

export function LearningForm({ searchProjectId }: { searchProjectId: string }) {
  const [kind, setKind] = useState<string>("general");
  const [text, setText] = useState("");
  const [sampleSize, setSampleSize] = useState("");
  const { pending, error, submit } = useAction();

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit(
          () =>
            addLearningAction({
              searchProjectId,
              kind,
              text,
              sampleSize: sampleSize ? Number(sampleSize) : undefined,
            }),
          () => {
            setText("");
            setSampleSize("");
          },
        );
      }}
    >
      <div className="flex flex-wrap gap-2">
        <label className="min-w-44">
          <FieldLabel>Outcome kind</FieldLabel>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className={inputClass}
          >
            {LEARNING_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="w-32">
          <FieldLabel>Sample size</FieldLabel>
          <input
            type="number"
            min={1}
            value={sampleSize}
            onChange={(e) => setSampleSize(e.target.value)}
            placeholder="e.g. 3"
            className={inputClass}
          />
        </label>
      </div>
      <label className="block">
        <FieldLabel>What happened, and what it teaches</FieldLabel>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          required
          placeholder="e.g. Two of three declined candidates cited the on-site requirement."
          className={`${inputClass} resize-y`}
        />
      </label>
      <ErrorNote error={error} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Record learning"}
      </button>
    </form>
  );
}
