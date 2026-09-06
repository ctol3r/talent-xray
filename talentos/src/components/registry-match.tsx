"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearRegistryMatchAction,
  confirmRegistryMatchAction,
  searchNppesAction,
} from "@/lib/actions/registries";
import type { NppesRecord } from "@/lib/core/payloads";
import type { RegistrySearchHit } from "@/lib/services/registries";
import { buttonClass, inputClass, subtleButtonClass } from "./forms";
import { Card, Tag } from "./ui";

const STRONG = new Set([
  "same_urls",
  "same_name_same_location",
  "same_name_same_org",
]);

export function RegistryMatchCard({
  candidateId,
  configured,
  mode,
  linkOut,
  label,
  explainer,
  prefill,
  match,
}: {
  candidateId: string;
  configured: boolean;
  mode: "off" | "live" | "mock";
  linkOut: { label: string; url: string };
  label: string;
  explainer: string;
  prefill: {
    firstName: string;
    lastName: string;
    state?: string;
    npi?: string;
  };
  match: {
    registryId: string;
    matchedAt: string;
    matchStrength: string | null;
    record: NppesRecord;
  } | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: prefill.firstName,
    lastName: prefill.lastName,
    state: prefill.state ?? "",
    npi: prefill.npi ?? "",
  });
  const [hits, setHits] = useState<RegistrySearchHit[] | null>(null);

  const search = () =>
    startTransition(async () => {
      setError(null);
      setHits(null);
      const r = await searchNppesAction({
        candidateId,
        firstName: form.firstName || undefined,
        lastName: form.lastName,
        state: form.state || undefined,
        npi: form.npi || undefined,
      });
      if (r.ok) setHits(r.data.hits);
      else setError(r.error);
    });

  const confirm = (hit: RegistrySearchHit) =>
    startTransition(async () => {
      setError(null);
      const r = await confirmRegistryMatchAction({
        candidateId,
        record: hit.record,
        matchStrength: hit.match?.strength,
      });
      if (r.ok) {
        setHits(null);
        router.refresh();
      } else setError(r.error);
    });

  const clear = () =>
    startTransition(async () => {
      const r = await clearRegistryMatchAction({ candidateId });
      if (r.ok) router.refresh();
      else setError(r.error);
    });

  if (match) {
    const primary =
      match.record.taxonomies.find((t) => t.primary) ??
      match.record.taxonomies[0];
    return (
      <Card title="Registry identity">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="ok">{label}</Tag>
          {mode === "mock" && <Tag tone="warn">MOCK</Tag>}
          <span className="text-[11.5px] text-ink-faint">
            matched {match.matchedAt.slice(0, 10)}
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12.5px]">
          <dt className="text-ink-faint">NPI</dt>
          <dd className="font-mono text-ink">{match.registryId}</dd>
          <dt className="text-ink-faint">Name</dt>
          <dd className="text-ink">
            {match.record.firstName} {match.record.lastName}
            {match.record.credential ? `, ${match.record.credential}` : ""}
          </dd>
          {primary && (
            <>
              <dt className="text-ink-faint">Taxonomy</dt>
              <dd className="text-ink">
                {primary.description}
                {primary.state ? ` · ${primary.state}` : ""}
                {primary.license ? ` · licence ${primary.license}` : ""}
              </dd>
            </>
          )}
          {match.record.practice && (
            <>
              <dt className="text-ink-faint">Practice</dt>
              <dd className="text-ink">
                {[match.record.practice.city, match.record.practice.state]
                  .filter(Boolean)
                  .join(", ")}
                {match.record.practice.telephone
                  ? ` · ${match.record.practice.telephone} (office)`
                  : ""}
              </dd>
            </>
          )}
        </dl>
        <p className="mt-2 text-[11.5px] text-ink-faint">{explainer}</p>
        <div className="mt-2 flex items-center gap-2">
          <a
            href={`https://npiregistry.cms.hhs.gov/provider-view/${match.registryId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12.5px] text-accent hover:underline"
          >
            Open NPI record
          </a>
          <button
            type="button"
            onClick={clear}
            disabled={pending}
            className={subtleButtonClass}
          >
            Clear match
          </button>
        </div>
        {error && <p className="mt-2 text-[12px] text-bad">{error}</p>}
      </Card>
    );
  }

  if (!configured) {
    return (
      <Card title="Registry identity">
        <p className="text-[12.5px] text-ink-muted">
          Registry lookup is off. Set{" "}
          <code className="font-mono">TALENTOS_REGISTRY_NPPES=1</code> to match
          clinicians against the public CMS NPI Registry from here; until then,
          search it by hand.
        </p>
        <a
          href={linkOut.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[12.5px] text-accent hover:underline"
        >
          {linkOut.label} ↗
        </a>
      </Card>
    );
  }

  return (
    <Card title="Registry identity">
      <p className="text-[12px] text-ink-muted">
        Search the public CMS NPI Registry. Results come back in the
        registry&apos;s order; you pick the record. Nothing is stored until you
        do.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="text-[12px] text-ink-muted">
          First name
          <input
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-[12px] text-ink-muted">
          Last name
          <input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-[12px] text-ink-muted">
          State
          <input
            value={form.state}
            maxLength={2}
            onChange={(e) =>
              setForm({ ...form, state: e.target.value.toUpperCase() })
            }
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-[12px] text-ink-muted">
          NPI (if known)
          <input
            value={form.npi}
            onChange={(e) => setForm({ ...form, npi: e.target.value })}
            className={`${inputClass} mt-1 font-mono`}
          />
        </label>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={search}
          disabled={pending || (!form.lastName && !form.npi)}
          className={buttonClass}
        >
          {pending ? "Searching…" : "Search NPPES"}
        </button>
        {mode === "mock" && <Tag tone="warn">MOCK</Tag>}
      </div>
      {error && <p className="mt-2 text-[12px] text-bad">{error}</p>}
      {hits && (
        <ul className="mt-3 space-y-2">
          {hits.length === 0 && (
            <li className="text-[12.5px] text-ink-muted">No records.</li>
          )}
          {hits.map((hit) => {
            const primary =
              hit.record.taxonomies.find((t) => t.primary) ??
              hit.record.taxonomies[0];
            return (
              <li
                key={hit.record.number}
                className="rounded border border-edge bg-panel2/50 px-3 py-2 text-[12.5px]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ink">
                    {hit.record.firstName} {hit.record.lastName}
                    {hit.record.credential ? `, ${hit.record.credential}` : ""}
                  </span>
                  <span className="font-mono text-[11.5px] text-ink-faint">
                    {hit.record.number}
                  </span>
                  <Tag
                    tone={
                      hit.match && STRONG.has(hit.match.strength)
                        ? "ok"
                        : "warn"
                    }
                  >
                    {hit.match
                      ? hit.match.strength.replace(/_/g, " ")
                      : "no name match"}
                  </Tag>
                </div>
                <p className="mt-0.5 text-ink-muted">
                  {primary?.description ?? "no taxonomy"}
                  {hit.record.practice
                    ? ` · ${[hit.record.practice.city, hit.record.practice.state].filter(Boolean).join(", ")}`
                    : ""}
                </p>
                <button
                  type="button"
                  onClick={() => confirm(hit)}
                  disabled={pending}
                  className={`${subtleButtonClass} mt-1.5`}
                >
                  This is them
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
