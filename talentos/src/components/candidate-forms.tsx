"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createCandidateAction,
  deleteCandidateAction,
  exportCandidateAction,
  moveCandidateStageAction,
  updateCandidateAction,
} from "@/lib/actions/candidates";
import {
  ErrorNote,
  FieldLabel,
  buttonClass,
  inputClass,
  subtleButtonClass,
  useAction,
} from "./forms";
import { TagTextarea, type TagOption } from "./tag-textarea";
import { TagRow } from "./tag-text";
import { tagsIn } from "@/lib/core/tags";

export function AddCandidateForm({
  searchProjectId,
}: {
  searchProjectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({
    name: "",
    currentTitle: "",
    currentCompany: "",
    geography: "",
    profileUrl: "",
    resumeText: "",
  });
  const { pending, error, submit } = useAction();

  if (!open) {
    return (
      <button
        type="button"
        className={buttonClass}
        onClick={() => setOpen(true)}
      >
        Add candidate
      </button>
    );
  }

  return (
    <form
      className="w-full max-w-xl space-y-2 rounded-lg border border-edge bg-panel p-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(
          () =>
            createCandidateAction({
              searchProjectId,
              name: values.name,
              currentTitle: values.currentTitle || undefined,
              currentCompany: values.currentCompany || undefined,
              geography: values.geography || undefined,
              resumeText: values.resumeText || undefined,
              profileUrls: values.profileUrl ? [values.profileUrl] : [],
            }),
          () => {
            setValues({
              name: "",
              currentTitle: "",
              currentCompany: "",
              geography: "",
              profileUrl: "",
              resumeText: "",
            });
            setOpen(false);
          },
        );
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <label className="col-span-2">
          <FieldLabel>Name *</FieldLabel>
          <input
            required
            value={values.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
            className={inputClass}
            name="candidateName"
          />
        </label>
        <label>
          <FieldLabel>Current title</FieldLabel>
          <input
            value={values.currentTitle}
            onChange={(e) =>
              setValues((v) => ({ ...v, currentTitle: e.target.value }))
            }
            className={inputClass}
          />
        </label>
        <label>
          <FieldLabel>Current company</FieldLabel>
          <input
            value={values.currentCompany}
            onChange={(e) =>
              setValues((v) => ({ ...v, currentCompany: e.target.value }))
            }
            className={inputClass}
          />
        </label>
        <label>
          <FieldLabel>Geography</FieldLabel>
          <input
            value={values.geography}
            onChange={(e) =>
              setValues((v) => ({ ...v, geography: e.target.value }))
            }
            className={inputClass}
          />
        </label>
        <label>
          <FieldLabel>Profile URL</FieldLabel>
          <input
            value={values.profileUrl}
            onChange={(e) =>
              setValues((v) => ({ ...v, profileUrl: e.target.value }))
            }
            placeholder="https://…"
            className={inputClass}
          />
        </label>
      </div>
      <label className="block">
        <FieldLabel>Pasted profile / resume text (optional)</FieldLabel>
        <textarea
          value={values.resumeText}
          onChange={(e) =>
            setValues((v) => ({ ...v, resumeText: e.target.value }))
          }
          rows={4}
          className={`${inputClass} resize-y`}
          placeholder="Paste public profile text or a resume — this is what evidence alignment reads."
        />
      </label>
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Adding…" : "Add candidate"}
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

export function StageSelect({
  candidateId,
  currentStage,
  stages,
}: {
  candidateId: string;
  currentStage: string;
  stages: { key: string; label: string }[];
}) {
  const { pending, error, submit } = useAction();
  return (
    <div>
      <select
        defaultValue={currentStage}
        disabled={pending}
        onChange={(e) =>
          submit(() =>
            moveCandidateStageAction({ candidateId, toStage: e.target.value }),
          )
        }
        className="rounded border border-edge bg-panel px-2 py-1 text-[13.5px] text-ink"
        title="Move stage — every move is logged as a pipeline event"
      >
        {stages.map((stage) => (
          <option key={stage.key} value={stage.key}>
            {stage.label}
          </option>
        ))}
      </select>
      <ErrorNote error={error} />
    </div>
  );
}

/**
 * Where a person stands, as distinct from where they are.
 *
 * Stage says how far somebody got; disposition says whether they are still
 * in it. Keeping them apart is what lets a job hold four people who reached
 * hiring-manager review and were turned down there — which is the fact the
 * hill reads when it asks whether the profile is right. Recording one moves
 * nobody's stage: a person is turned down at the stage they reached, and
 * overwriting that would lose the only thing the count is about.
 */
export function DispositionSelect({
  candidateId,
  disposition,
}: {
  candidateId: string;
  disposition: string;
}) {
  const { pending, error, submit } = useAction();
  return (
    <div>
      <select
        defaultValue={disposition}
        disabled={pending}
        onChange={(e) =>
          submit(() =>
            updateCandidateAction({
              id: candidateId,
              disposition: e.target.value,
            }),
          )
        }
        className="rounded border border-edge bg-panel px-2 py-1 text-[13.5px] text-ink"
        title="Where this person stands — separate from the stage they reached"
        aria-label="Disposition"
      >
        {(
          [
            ["active", "Active"],
            ["on_hold", "On hold"],
            ["not_selected", "Not selected"],
            ["withdrawn", "Withdrew"],
            ["hired", "Hired"],
          ] as const
        ).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <ErrorNote error={error} />
    </div>
  );
}

export function NextActionForm({
  candidateId,
  nextAction,
  nextActionDue,
}: {
  candidateId: string;
  nextAction: string | null;
  nextActionDue: string | null;
}) {
  const [action, setAction] = useState(nextAction ?? "");
  const [due, setDue] = useState(nextActionDue?.slice(0, 10) ?? "");
  const { pending, error, submit } = useAction();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() =>
          updateCandidateAction({
            id: candidateId,
            nextAction: action || undefined,
            nextActionDue: due ? new Date(due).toISOString() : undefined,
          }),
        );
      }}
    >
      <label className="min-w-52 flex-1">
        <FieldLabel>Next action</FieldLabel>
        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="e.g. Send follow-up 2"
          className={inputClass}
        />
      </label>
      <label>
        <FieldLabel>Due</FieldLabel>
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className={inputClass}
        />
      </label>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save"}
      </button>
      <ErrorNote error={error} />
    </form>
  );
}

/**
 * A person's notes, and the place their tags live.
 *
 * Tags are written here rather than kept in a field of their own, so a tag
 * always has the sentence that justifies it beside it, and removing the word
 * removes the tag. Typing @, # or [[ recalls the tags that already exist.
 */
export function NotesForm({
  candidateId,
  notes,
  tags = [],
}: {
  candidateId: string;
  notes: string | null;
  tags?: TagOption[];
}) {
  const [value, setValue] = useState(notes ?? "");
  const { pending, error, submit } = useAction();
  const written = tagsIn(value);
  return (
    <form
      className="space-y-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() =>
          updateCandidateAction({ id: candidateId, recruiterNotes: value }),
        );
      }}
    >
      <TagTextarea
        value={value}
        onChange={setValue}
        options={tags}
        rows={3}
        placeholder="Recruiter notes — motivations, concerns, context. Job-related only. [[ or # makes a page, @ finds a person, jj finds a job."
        className={`${inputClass} resize-y`}
      />
      {written.length > 0 && <TagRow tags={written} className="pt-0.5" />}
      <ErrorNote error={error} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Save notes"}
      </button>
    </form>
  );
}

export function CandidateDataControls({
  candidateId,
}: {
  candidateId: string;
}) {
  const router = useRouter();
  const { pending, error, submit } = useAction();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          className={subtleButtonClass}
          onClick={async () => {
            const result = await exportCandidateAction({ candidateId });
            if (result.ok) {
              const blob = new Blob([result.data.json], {
                type: "application/json",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `candidate-${candidateId}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }
          }}
        >
          Export JSON
        </button>
        {!confirming ? (
          <button
            type="button"
            className="rounded border border-bad/40 px-3 py-1.5 text-[14px] text-bad hover:bg-bad-soft"
            onClick={() => setConfirming(true)}
          >
            Delete candidate…
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            className="rounded bg-bad px-3 py-1.5 text-[14px] font-medium text-canvas"
            onClick={() =>
              submit(
                () => deleteCandidateAction({ candidateId }),
                () => router.push(".."),
              )
            }
          >
            {pending ? "Deleting…" : "Confirm permanent delete"}
          </button>
        )}
      </div>
      <ErrorNote error={error} />
    </div>
  );
}
