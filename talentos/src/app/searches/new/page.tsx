"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSearchProjectAction } from "@/lib/actions/projects";
import { PageHeader } from "@/components/ui";
import {
  CURRENCIES,
  EMPLOYMENT_TYPES,
  FTE_OPTIONS,
  INDUSTRIES,
  JOB_PRIORITIES,
  SALARY_PERIODS,
  SENIORITY_LEVELS,
  SPONSORSHIP_OPTIONS,
  START_DATE_AGREEMENTS,
  UNKNOWN,
  WORK_ARRANGEMENTS,
  type Choice,
} from "@/lib/domain/job-fields";

/**
 * The new-job form.
 *
 * Grouped rather than listed, because eighteen fields in one column is a
 * wall. Two of them are required and everything else can wait, which the
 * heading says out loud so nobody fills in a salary band they are guessing.
 *
 * Anything with a fixed set of answers is a dropdown. Free text where the
 * words matter (the title, the objective) and a list where they do not: a
 * job typed "Permanent, full-time" and another "perm FT" cannot be compared,
 * and comparing is most of what a list of jobs is for.
 */

type Field =
  | {
      kind: "text";
      key: string;
      label: string;
      placeholder: string;
      required?: boolean;
      hint?: string;
    }
  | {
      kind: "choice";
      key: string;
      label: string;
      choices: Choice[];
      hint?: string;
      /** No blank option, and the form will not submit until it is answered. */
      required?: boolean;
    }
  | {
      kind: "number";
      key: string;
      label: string;
      placeholder: string;
      hint?: string;
    }
  | { kind: "date"; key: string; label: string; hint?: string };

const GROUPS: { title: string; note?: string; fields: Field[] }[] = [
  {
    title: "What the job is",
    fields: [
      {
        kind: "text",
        key: "name",
        label: "Job title",
        placeholder: "CAIS — Founding Recruiter",
        required: true,
        hint: "Yours to write, and unique across the workspace. This is what you will see in a list and write in a note.",
      },
      {
        kind: "text",
        key: "roleTitle",
        label: "Role",
        placeholder: "Founding Recruiter",
        required: true,
        hint: "What the market calls it.",
      },
      {
        kind: "text",
        key: "companyName",
        label: "Company",
        placeholder: "Center for AI Safety",
      },
      {
        kind: "choice",
        key: "industry",
        label: "Industry",
        choices: INDUSTRIES,
      },
      {
        kind: "choice",
        key: "seniority",
        label: "Seniority",
        choices: SENIORITY_LEVELS,
      },
    ],
  },
  {
    title: "Where it is",
    fields: [
      {
        kind: "text",
        key: "geography",
        label: "Location",
        placeholder: "San Francisco, CA",
        hint: "Shown beside the title everywhere, because it is what tells two jobs apart fastest.",
      },
      {
        kind: "text",
        key: "country",
        label: "Country",
        placeholder: "United States",
      },
      {
        kind: "choice",
        key: "workArrangement",
        label: "Work arrangement",
        choices: WORK_ARRANGEMENTS,
      },
      {
        kind: "choice",
        key: "sponsorship",
        label: "Work permit sponsorship",
        choices: SPONSORSHIP_OPTIONS,
        hint: "An attribute of the offer. It decides which markets this job can be sourced in at all.",
      },
    ],
  },
  {
    title: "The offer",
    note: "Leave anything you are guessing at empty. A band you invented is worse than no band.",
    fields: [
      {
        kind: "choice",
        key: "employmentType",
        label: "Employment type",
        choices: EMPLOYMENT_TYPES,
      },
      { kind: "choice", key: "fte", label: "FTE", choices: FTE_OPTIONS },
      {
        kind: "number",
        key: "salaryMin",
        label: "Salary from",
        placeholder: "145000",
      },
      {
        kind: "number",
        key: "salaryMax",
        label: "Salary to",
        placeholder: "185000",
      },
      {
        kind: "choice",
        key: "salaryCurrency",
        label: "Currency",
        choices: CURRENCIES,
      },
      {
        kind: "choice",
        key: "salaryPeriod",
        label: "Per",
        choices: SALARY_PERIODS,
      },
      {
        kind: "text",
        key: "compensationNote",
        label: "Anything else in the package",
        placeholder: "Equity, bonus, pension",
      },
    ],
  },
  {
    title: "How it is being run",
    fields: [
      {
        kind: "choice",
        key: "priority",
        label: "Priority",
        choices: JOB_PRIORITIES,
      },
      { kind: "number", key: "openings", label: "Openings", placeholder: "1" },
      {
        kind: "choice",
        key: "startDateAgreement",
        label: "Start date agreed with the manager",
        choices: START_DATE_AGREEMENTS,
        required: true,
        hint: "Asked because every pace reading on this job is measured against this window. Leaving it blank used to mean the product assumed a fortnight without telling you.",
      },
      { kind: "date", key: "targetStartDate", label: "Target start" },
      {
        kind: "text",
        key: "businessObjective",
        label: "Why this hire, why now",
        placeholder: "What breaks if this seat stays empty",
        hint: "The single most useful sentence you can write here.",
      },
    ],
  },
];

const controlClass =
  "w-full rounded border border-edge bg-panel px-3 py-2 text-[14px] placeholder:text-ink-faint focus:border-accent";

export default function NewSearchPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const set = (key: string, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  // "Agreed" without a date is a claim with nothing behind it, so the date
  // becomes required exactly when the answer says one exists — and answering
  // "not agreed" empties and disables it rather than leaving a stale date
  // sitting under an answer that contradicts it.
  const agreedDate = values.startDateAgreement === "agreed";

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="💼 New job"
        description="Title, role and whether a start date is agreed are required. Everything else sharpens the sourcing and can be added later — leave a field empty rather than guessing at it."
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            setError(null);
            const answers =
              values.startDateAgreement === "not_agreed"
                ? { ...values, targetStartDate: "" }
                : values;
            const cleaned = Object.fromEntries(
              Object.entries(answers).filter(
                ([, value]) => value.trim() !== "",
              ),
            );
            const result = await createSearchProjectAction(cleaned);
            if (result.ok) {
              router.push(`/searches/${result.data.id}/role`);
            } else {
              setError(result.error);
            }
          });
        }}
        className="space-y-5"
      >
        {GROUPS.map((group) => (
          <section
            key={group.title}
            className="rounded-lg border border-edge bg-panel p-4"
          >
            <h2 className="text-[14px] font-semibold text-ink">
              {group.title}
            </h2>
            {group.note && (
              <p className="mt-0.5 text-[12.5px] text-ink-faint">
                {group.note}
              </p>
            )}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {group.fields.map((field) => (
                <label
                  key={field.key}
                  className={`block ${
                    field.kind === "text" && field.hint ? "sm:col-span-2" : ""
                  }`}
                >
                  <span className="mb-1 block text-[13.5px] text-ink-muted">
                    {field.label}
                    {((field.kind === "text" || field.kind === "choice") &&
                      field.required) ||
                    (field.kind === "date" && agreedDate) ? (
                      <span className="text-bad"> *</span>
                    ) : null}
                  </span>
                  {field.kind === "choice" ? (
                    <select
                      name={field.key}
                      value={values[field.key] ?? ""}
                      required={field.required}
                      onChange={(event) => set(field.key, event.target.value)}
                      className={controlClass}
                    >
                      <option value="">
                        {field.required ? "Answer this one" : UNKNOWN.label}
                      </option>
                      {field.choices.map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name={field.key}
                      type={
                        field.kind === "number"
                          ? "number"
                          : field.kind === "date"
                            ? "date"
                            : "text"
                      }
                      inputMode={
                        field.kind === "number" ? "numeric" : undefined
                      }
                      required={
                        (field.kind === "text" && field.required) ||
                        (field.kind === "date" &&
                          field.key === "targetStartDate" &&
                          agreedDate)
                      }
                      disabled={
                        field.kind === "date" &&
                        field.key === "targetStartDate" &&
                        values.startDateAgreement === "not_agreed"
                      }
                      value={values[field.key] ?? ""}
                      onChange={(event) => set(field.key, event.target.value)}
                      placeholder={
                        field.kind === "date" ? undefined : field.placeholder
                      }
                      className={controlClass}
                    />
                  )}
                  {field.hint && (
                    <span className="mt-1 block text-[12px] text-ink-faint">
                      {field.hint}
                    </span>
                  )}
                  {field.kind === "choice" &&
                    field.choices.find(
                      (choice) => choice.value === values[field.key],
                    )?.hint && (
                      <span className="mt-1 block text-[12px] text-ink-faint">
                        {
                          field.choices.find(
                            (choice) => choice.value === values[field.key],
                          )?.hint
                        }
                      </span>
                    )}
                </label>
              ))}
            </div>
          </section>
        ))}
        {error && (
          <p className="rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[13.5px] text-bad">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-4 py-2 text-[14px] font-medium text-canvas hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create job"}
        </button>
      </form>
    </div>
  );
}
