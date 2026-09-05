"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSearchProjectAction } from "@/lib/actions/projects";
import { PageHeader } from "@/components/ui";

const FIELDS: {
  key: string;
  label: string;
  placeholder: string;
  required?: boolean;
}[] = [
  {
    key: "name",
    label: "Search name",
    placeholder: "Acme — Staff Platform Engineer",
    required: true,
  },
  {
    key: "roleTitle",
    label: "Role title",
    placeholder: "Staff Platform Engineer",
    required: true,
  },
  { key: "companyName", label: "Company", placeholder: "Acme" },
  {
    key: "geography",
    label: "Geography",
    placeholder: "Denver, CO / Remote US",
  },
  { key: "country", label: "Country", placeholder: "United States" },
  { key: "industry", label: "Industry", placeholder: "B2B SaaS" },
  {
    key: "seniority",
    label: "Seniority",
    placeholder: "Staff / Senior / Executive…",
  },
  {
    key: "employmentType",
    label: "Employment type",
    placeholder: "Permanent, full-time",
  },
  {
    key: "workArrangement",
    label: "Work arrangement",
    placeholder: "Hybrid, 3 days on-site",
  },
  {
    key: "compensationNote",
    label: "Compensation",
    placeholder: "$180k–$220k + equity",
  },
  {
    key: "businessObjective",
    label: "Business objective",
    placeholder: "Why this hire, why now",
  },
];

export default function NewSearchPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="max-w-xl">
      <PageHeader
        title="New search"
        description="Only name and role title are required — everything else improves the AI's context and can be added later."
      />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const cleaned = Object.fromEntries(
              Object.entries(values).filter(([, v]) => v.trim() !== ""),
            );
            const result = await createSearchProjectAction(cleaned);
            if (result.ok) {
              router.push(`/searches/${result.data.id}/role`);
            } else {
              setError(result.error);
            }
          });
        }}
        className="space-y-3"
      >
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="mb-1 block text-[12.5px] text-ink-muted">
              {field.label}
              {field.required && <span className="text-bad"> *</span>}
            </span>
            <input
              value={values[field.key] ?? ""}
              required={field.required}
              onChange={(e) =>
                setValues((v) => ({ ...v, [field.key]: e.target.value }))
              }
              placeholder={field.placeholder}
              className="w-full rounded border border-edge bg-panel px-3 py-2 text-[13px] outline-none placeholder:text-ink-faint focus:border-accent"
              name={field.key}
            />
          </label>
        ))}
        {error && (
          <p className="rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[12.5px] text-bad">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-accent px-4 py-2 text-[13px] font-medium text-canvas hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create search"}
        </button>
      </form>
    </div>
  );
}
