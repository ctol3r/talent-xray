"use client";

import { useState } from "react";
import { updateCandidateAction } from "@/lib/actions/candidates";
import { ErrorNote, buttonClass, inputClass, useAction } from "./forms";
import type {
  CandidateProfilePayload,
  ContactProvenance,
} from "@/lib/core/payloads";

/**
 * The candidate's own profile: how to reach them, and what they have done.
 *
 * Every contact detail carries how it came to be held, and that is not
 * decoration. A pattern this product generated is a guess; one the person
 * sent you is a fact; one you read off a public page is somewhere between.
 * The Article 14 notice reads the record to tell the person what is held, so
 * the provenance has to be true at the point it is typed.
 *
 * A generated address stays labelled unverified wherever it is rendered
 * (product rule 3), including here.
 */

const PROVENANCE: { value: ContactProvenance; label: string }[] = [
  { value: "given_by_person", label: "They gave it to me" },
  { value: "from_a_public_page", label: "From a page they published" },
  { value: "typed_by_recruiter", label: "I typed it from elsewhere" },
  { value: "generated_unverified", label: "Generated — unverified" },
];

type ContactKey = "emails" | "phones" | "links";

const CONTACT_FIELDS: {
  key: ContactKey;
  label: string;
  placeholder: string;
}[] = [
  { key: "emails", label: "Email", placeholder: "name@company.com" },
  { key: "phones", label: "Phone", placeholder: "+44 7700 900000" },
  { key: "links", label: "Other address", placeholder: "https://…" },
];

export function CandidateProfileForm({
  candidateId,
  profile,
}: {
  candidateId: string;
  profile: CandidateProfilePayload;
}) {
  const [draft, setDraft] = useState<CandidateProfilePayload>(profile);
  const { pending, error, submit } = useAction();
  const [saved, setSaved] = useState(false);

  const contact = draft.contact ?? { emails: [], phones: [], links: [] };

  function setContact(key: ContactKey, next: (typeof contact)[ContactKey]) {
    setDraft({ ...draft, contact: { ...contact, [key]: next } });
  }

  function addContact(key: ContactKey) {
    setContact(key, [
      ...contact[key],
      {
        value: "",
        provenance: "typed_by_recruiter" as ContactProvenance,
        addedAt: new Date().toISOString(),
      },
    ]);
  }

  function addExperience() {
    setDraft({
      ...draft,
      experience: [...draft.experience, { title: "", company: "" }],
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        submit(async () => {
          const result = await updateCandidateAction({
            id: candidateId,
            // Empty rows are the ones somebody added and thought better of.
            profile: {
              ...draft,
              contact: {
                emails: contact.emails.filter((row) => row.value.trim()),
                phones: contact.phones.filter((row) => row.value.trim()),
                links: contact.links.filter((row) => row.value.trim()),
              },
              experience: draft.experience.filter(
                (row) => row.title.trim() || row.company.trim(),
              ),
            },
          });
          if (result.ok) setSaved(true);
          return result;
        });
      }}
    >
      <section>
        <p className="mb-1 text-[12px] tracking-wider text-ink-faint uppercase">
          Contact
        </p>
        <p className="mb-2 text-[12.5px] text-ink-muted">
          Anything you record here is declared to the person in the notice this
          app drafts. Say honestly where each one came from.
        </p>
        {CONTACT_FIELDS.map((field) => (
          <div key={field.key} className="mb-2">
            {contact[field.key].map((row, index) => (
              <div key={index} className="mb-1 flex flex-wrap gap-1.5">
                <input
                  value={row.value}
                  placeholder={field.placeholder}
                  aria-label={`${field.label} ${index + 1}`}
                  onChange={(event) =>
                    setContact(
                      field.key,
                      contact[field.key].map((entry, at) =>
                        at === index
                          ? { ...entry, value: event.target.value }
                          : entry,
                      ),
                    )
                  }
                  className={`${inputClass} min-w-0 flex-1`}
                />
                <select
                  value={row.provenance}
                  aria-label={`Where ${field.label} ${index + 1} came from`}
                  onChange={(event) =>
                    setContact(
                      field.key,
                      contact[field.key].map((entry, at) =>
                        at === index
                          ? {
                              ...entry,
                              provenance: event.target
                                .value as ContactProvenance,
                            }
                          : entry,
                      ),
                    )
                  }
                  className={`${inputClass} w-52 shrink-0`}
                >
                  {PROVENANCE.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {row.provenance === "generated_unverified" && (
                  <span className="self-center rounded bg-warn-soft px-1.5 py-0.5 text-[11px] text-warn">
                    unverified
                  </span>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${field.label} ${index + 1}`}
                  onClick={() =>
                    setContact(
                      field.key,
                      contact[field.key].filter((_, at) => at !== index),
                    )
                  }
                  className="shrink-0 rounded px-2 text-[13px] text-ink-faint hover:text-bad"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addContact(field.key)}
              className="rounded border border-edge2 px-2 py-1 text-[12.5px] text-ink-muted hover:text-ink"
            >
              + {field.label}
            </button>
          </div>
        ))}
      </section>

      <section>
        <p className="mb-1 text-[12px] tracking-wider text-ink-faint uppercase">
          Work history
        </p>
        {draft.experience.map((role, index) => (
          <div
            key={index}
            className="mb-2 rounded border border-edge bg-panel2 p-2"
          >
            <div className="grid gap-1.5 sm:grid-cols-2">
              <input
                value={role.title}
                placeholder="Title"
                aria-label={`Role ${index + 1} title`}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    experience: draft.experience.map((entry, at) =>
                      at === index
                        ? { ...entry, title: event.target.value }
                        : entry,
                    ),
                  })
                }
                className={inputClass}
              />
              <input
                value={role.company}
                placeholder="Company"
                aria-label={`Role ${index + 1} company`}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    experience: draft.experience.map((entry, at) =>
                      at === index
                        ? { ...entry, company: event.target.value }
                        : entry,
                    ),
                  })
                }
                className={inputClass}
              />
            </div>
            <textarea
              value={role.summary ?? ""}
              rows={2}
              placeholder="What they did there, in their own words where you have them"
              aria-label={`Role ${index + 1} summary`}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  experience: draft.experience.map((entry, at) =>
                    at === index
                      ? { ...entry, summary: event.target.value }
                      : entry,
                  ),
                })
              }
              className={`${inputClass} mt-1.5 resize-y`}
            />
            <button
              type="button"
              onClick={() =>
                setDraft({
                  ...draft,
                  experience: draft.experience.filter((_, at) => at !== index),
                })
              }
              className="mt-1 text-[12px] text-ink-faint hover:text-bad"
            >
              Remove this role
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addExperience}
          className="rounded border border-edge2 px-2 py-1 text-[12.5px] text-ink-muted hover:text-ink"
        >
          + Role
        </button>
      </section>

      <section className="grid gap-2 sm:grid-cols-2">
        {(
          [
            ["skills", "Skills"],
            ["certifications", "Certifications"],
            ["motivations", "What moves them"],
            ["concerns", "What worries them"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block">
            <span className="mb-0.5 block text-[12px] text-ink-muted">
              {label}
              <span className="ml-1 text-ink-faint">one per line</span>
            </span>
            <textarea
              rows={3}
              aria-label={label}
              value={(draft[key] as string[]).join("\n")}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  [key]: event.target.value
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean),
                })
              }
              className={`${inputClass} resize-y`}
            />
          </label>
        ))}
      </section>

      <ErrorNote error={error} />
      <div className="flex items-center gap-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Save profile"}
        </button>
        {saved && !error && (
          <span className="text-[13px] text-ink-muted">Saved</span>
        )}
      </div>
    </form>
  );
}
