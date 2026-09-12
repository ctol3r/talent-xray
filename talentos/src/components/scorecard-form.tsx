"use client";

import { useState } from "react";
import {
  RUBRIC_LABELS,
  RUBRIC_LEVELS,
  type RubricLevel,
} from "@/lib/core/enums";
import { saveScorecardAction } from "@/lib/actions/workflow";
import {
  ErrorNote,
  FieldLabel,
  buttonClass,
  inputClass,
  subtleButtonClass,
  useAction,
} from "./forms";

interface EntryDraft {
  competency: string;
  observation: string;
  interpretation: string;
  rating: RubricLevel;
  evidenceText: string;
}

const emptyEntry = (): EntryDraft => ({
  competency: "",
  observation: "",
  interpretation: "",
  rating: "insufficient_evidence",
  evidenceText: "",
});

/**
 * Structured interview evidence: observation ≠ interpretation ≠ rating, and
 * a rating above "insufficient evidence" cannot be saved without written
 * evidence ("culture fit = 2" is rejected by the server schema).
 */
export function ScorecardForm({
  searchProjectId,
  candidates,
  stageNames,
}: {
  searchProjectId: string;
  candidates: { id: string; name: string }[];
  stageNames: string[];
}) {
  const [open, setOpen] = useState(false);
  const [candidateId, setCandidateId] = useState(candidates[0]?.id ?? "");
  const [stageName, setStageName] = useState(stageNames[0] ?? "");
  const [interviewer, setInterviewer] = useState("");
  const [entries, setEntries] = useState<EntryDraft[]>([emptyEntry()]);
  const { pending, error, submit } = useAction();

  if (!open) {
    return (
      <button
        type="button"
        className={buttonClass}
        onClick={() => setOpen(true)}
        disabled={candidates.length === 0}
        title={candidates.length === 0 ? "Add a candidate first" : undefined}
      >
        Record interview evidence
      </button>
    );
  }

  const setEntry = (index: number, patch: Partial<EntryDraft>) =>
    setEntries((list) =>
      list.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
    );

  return (
    <form
      className="w-full space-y-3 rounded-lg border border-edge bg-panel p-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(
          () =>
            saveScorecardAction({
              searchProjectId,
              candidateId,
              stageName,
              interviewer: interviewer || undefined,
              status: "submitted",
              entries,
            }),
          () => {
            setEntries([emptyEntry()]);
            setOpen(false);
          },
        );
      }}
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label>
          <FieldLabel>Candidate</FieldLabel>
          <select
            value={candidateId}
            onChange={(e) => setCandidateId(e.target.value)}
            className={inputClass}
          >
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <FieldLabel>Interview stage</FieldLabel>
          <input
            value={stageName}
            onChange={(e) => setStageName(e.target.value)}
            list="stage-names"
            required
            className={inputClass}
          />
          <datalist id="stage-names">
            {stageNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label>
          <FieldLabel>Interviewer</FieldLabel>
          <input
            value={interviewer}
            onChange={(e) => setInterviewer(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      {entries.map((entry, index) => (
        <div
          key={index}
          className="space-y-2 rounded border border-edge bg-panel2/50 p-3"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label>
              <FieldLabel>Competency</FieldLabel>
              <input
                value={entry.competency}
                onChange={(e) =>
                  setEntry(index, { competency: e.target.value })
                }
                required
                className={inputClass}
              />
            </label>
            <label>
              <FieldLabel>Rating</FieldLabel>
              <select
                value={entry.rating}
                aria-label="Rating"
                onChange={(e) =>
                  setEntry(index, { rating: e.target.value as RubricLevel })
                }
                className={inputClass}
              >
                {RUBRIC_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {RUBRIC_LABELS[level]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <FieldLabel>
              Observation (what happened — verbatim, factual)
            </FieldLabel>
            <textarea
              value={entry.observation}
              onChange={(e) => setEntry(index, { observation: e.target.value })}
              rows={2}
              className={`${inputClass} resize-y`}
            />
          </label>
          <label className="block">
            <FieldLabel>Interpretation (what you make of it)</FieldLabel>
            <textarea
              value={entry.interpretation}
              onChange={(e) =>
                setEntry(index, { interpretation: e.target.value })
              }
              rows={2}
              className={`${inputClass} resize-y`}
            />
          </label>
          <label className="block">
            <FieldLabel>
              Written evidence for the rating (required above &quot;insufficient
              evidence&quot;)
            </FieldLabel>
            <textarea
              value={entry.evidenceText}
              onChange={(e) =>
                setEntry(index, { evidenceText: e.target.value })
              }
              rows={2}
              className={`${inputClass} resize-y`}
            />
          </label>
        </div>
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          className={subtleButtonClass}
          onClick={() => setEntries((list) => [...list, emptyEntry()])}
        >
          Add competency
        </button>
      </div>
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Submit scorecard"}
        </button>
        <button
          type="button"
          className={subtleButtonClass}
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
