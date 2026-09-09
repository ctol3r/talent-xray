"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonClass, inputClass } from "./forms";
import { answerCalibrationAction } from "@/lib/actions/profile-calibration";
import {
  MIN_NOTE_CHARS,
  TIER_LABEL,
  type CalibrationQuestion,
  type CriterionTier,
} from "../../artifact-src/core/profile-calibration";

/**
 * The one question, asked beside the hill.
 *
 * The hiring manager's own words are shown in full, and no requirement is
 * pre-selected, highlighted or ordered by anything but the profile's own
 * order. The join between "he said the title was wrong three times" and
 * "then the title requirement is the one to change" is the recruiter's to
 * make. Software that made it for them would be read as a finding, and it
 * would be a guess.
 *
 * Nothing on this card can move a dot on the chart, reopen a rejection or
 * touch a candidate record.
 */
export function CalibrationQuestionCard({
  jobId,
  question,
}: {
  jobId: string;
  question: CalibrationQuestion;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [criterionId, setCriterionId] = useState<string>("");
  const [kind, setKind] = useState<
    "relaxed" | "dropped" | "reworded" | "added" | "affirmed"
  >("relaxed");
  const [wording, setWording] = useState("");
  const [tier, setTier] = useState<CriterionTier>("preferred");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const needsCriterion =
    kind === "relaxed" || kind === "dropped" || kind === "reworded";
  const chosen = question.criteria.find((c) => c.id === criterionId);
  const ready =
    note.trim().length >= MIN_NOTE_CHARS &&
    (!needsCriterion || Boolean(chosen)) &&
    (kind !== "reworded" || wording.trim().length > 0) &&
    (kind !== "added" || wording.trim().length > 0);

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const edit =
        kind === "affirmed"
          ? { kind: "affirmed" as const }
          : kind === "added"
            ? { kind: "added" as const, text: wording.trim(), tier }
            : kind === "reworded"
              ? {
                  kind: "reworded" as const,
                  criterionId,
                  to: wording.trim(),
                }
              : { kind, criterionId };
      const result = await answerCalibrationAction({
        jobId,
        note: note.trim(),
        edit,
      });
      if (result.ok) {
        setNote("");
        setWording("");
        setCriterionId("");
        router.refresh();
      } else {
        setError(result.error);
      }
    });

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-ink-muted">{question.says}</p>

      <ul className="space-y-1.5 border-l-2 border-edge2 pl-3">
        {question.rejections.map((rejection) => (
          <li key={rejection.candidateId} className="text-[13px]">
            <span className="text-ink-faint">{rejection.at.slice(0, 10)}</span>{" "}
            <span className="font-medium text-ink">
              {rejection.candidateName}
            </span>
            {rejection.note ? (
              <p className="text-ink-muted">{rejection.note}</p>
            ) : (
              <p className="text-ink-faint">
                No reason was recorded with this one.
              </p>
            )}
          </li>
        ))}
      </ul>

      <p className="text-[14px] font-medium text-ink">{question.asks}</p>
      <p className="text-[12.5px] text-ink-faint">
        Read the notes and pick. Nothing here has an opinion about which one it
        is — four passes are a reason to look at the bar, not evidence about
        which part of it moved.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["relaxed", "too strict"],
            ["dropped", "not really required"],
            ["reworded", "worded wrong"],
            ["added", "something was missing"],
            ["affirmed", "the profile is right"],
          ] as const
        ).map(([option, label]) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            className={`rounded border px-2.5 py-1 text-[13px] ${
              kind === option
                ? "border-accent text-accent"
                : "border-edge2 text-ink-muted hover:bg-panel2"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {needsCriterion && (
        <select
          value={criterionId}
          onChange={(e) => setCriterionId(e.target.value)}
          className={inputClass}
          aria-label="Which requirement"
        >
          <option value="">Choose a requirement…</option>
          {question.criteria.map((criterion) => (
            <option key={criterion.id} value={criterion.id}>
              {criterion.text} ({TIER_LABEL[criterion.tier]})
            </option>
          ))}
        </select>
      )}

      {kind === "added" && (
        <div className="flex gap-2">
          <input
            value={wording}
            onChange={(e) => setWording(e.target.value)}
            placeholder="The requirement that should have been there"
            className={inputClass}
          />
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as CriterionTier)}
            className={inputClass}
            aria-label="Which tier"
          >
            {(["mustHave", "preferred", "trainable"] as const).map((option) => (
              <option key={option} value={option}>
                {TIER_LABEL[option]}
              </option>
            ))}
          </select>
        </div>
      )}

      {kind === "reworded" && (
        <input
          value={wording}
          onChange={(e) => setWording(e.target.value)}
          placeholder={chosen ? `Instead of "${chosen.text}"` : "New wording"}
          className={inputClass}
        />
      )}

      {kind === "relaxed" && chosen && (
        <p className="text-[12.5px] text-ink-faint">
          {chosen.tier === "trainable"
            ? "Already trainable. A trainable requirement that is still wrong is not too strict — drop it instead."
            : `Moves from ${TIER_LABEL[chosen.tier]} to ${
                chosen.tier === "mustHave" ? "preferred" : "trainable"
              }, so it weighs less on the next person assessed against it.`}
        </p>
      )}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Why, in your own words — this is the half of the history that will still make sense in a month."
        className={inputClass}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={pending || !ready}
          className={buttonClass}
        >
          Record the answer
        </button>
        <span className="text-[12.5px] text-ink-faint">
          Changes the profile only. No candidate record is touched and no
          rejection is reopened.
        </span>
      </div>
      {error && <p className="text-[13px] text-bad">{error}</p>}
    </div>
  );
}

/** The history, for the Success Profile page. */
export function ProfileRevisions({
  history,
}: {
  history: {
    revision: { at: string; by: string; note: string };
    says: string;
    prompted: { candidateId: string; name: string }[];
    deleted: number;
  }[];
}) {
  if (history.length === 0) {
    return (
      <p className="text-[13.5px] text-ink-muted">
        Nothing recorded yet. When a job turns enough people down at one stage,
        the hill asks which requirement was wrong, and the answer lands here
        with the dispositions that prompted it.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {history.map((entry) => (
        <li key={entry.revision.at} className="text-[13px]">
          <span className="text-ink-faint">
            {entry.revision.at.slice(0, 10)}
          </span>{" "}
          <span className="text-ink">{entry.says}</span>
          <p className="text-ink-muted">{entry.revision.note}</p>
          <p className="text-ink-faint">
            {entry.revision.by} ·{" "}
            {entry.prompted.length === 0 && entry.deleted === 0
              ? "no dispositions recorded"
              : `after ${entry.prompted.map((p) => p.name).join(", ")}`}
            {entry.deleted > 0 &&
              `${entry.prompted.length > 0 ? ", and " : "after "}${entry.deleted} record${
                entry.deleted === 1 ? "" : "s"
              } since deleted`}
          </p>
        </li>
      ))}
    </ul>
  );
}
