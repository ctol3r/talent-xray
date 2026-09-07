"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SurfaceFamily } from "@/lib/core/enums";
import {
  acceptDeclaredLinkAction,
  addProfileLinksAction,
  moveProfileLinkAction,
  readDeclaredLinksAction,
  removeProfileLinkAction,
  setSurfaceOptInAction,
} from "@/lib/actions/profile-links";
import { PROFILE_CARD_FOOTER } from "@/lib/domain/profile-links";
import {
  FAMILY_NOTES,
  FAMILY_WARNINGS,
  OPT_IN_REASON_MIN,
  SURFACE_FAMILY_LABELS,
} from "@/lib/domain/surface-families";
import type { DeclaredReadResult } from "@/lib/services/declared-links";
import type { ProfileLinkView } from "@/lib/services/profile-links";
import { buttonClass, inputClass, subtleButtonClass } from "./forms";
import { Card, Tag } from "./ui";

/**
 * A refusal names the line and the reason in one breath; the full warning is
 * shown once, beside the reason field, so the recruiter reads it there rather
 * than twice in red.
 */
function firstSentence(message: string): string {
  const end = message.indexOf(". ");
  return end === -1 ? message : message.slice(0, end + 1);
}

/** The order families are shown in: work first, private last. */
const FAMILY_ORDER: SurfaceFamily[] = [
  "professional",
  "scholarly_registry",
  "review_site",
  "mixed_broadcast",
  "contact_aggregator",
  "unrecognised",
  "personal_life",
  "document",
  "not_a_person",
];

export interface DeclaredAccountView {
  sourceId: string;
  platform: string;
  account: string;
  configured: boolean;
  mode: string;
}

/**
 * Every public address held for one person, grouped by what kind of surface
 * it is, each with the label that says where it came from and what may be
 * claimed about it. The app never opens any of them.
 */
export function ProfileConnections({
  searchProjectId,
  candidateId,
  candidateName,
  links,
  otherCandidates,
  declaredAccounts,
  notice,
}: {
  searchProjectId: string;
  candidateId: string;
  candidateName: string;
  links: ProfileLinkView[];
  otherCandidates: { id: string; name: string }[];
  declaredAccounts: DeclaredAccountView[];
  notice: { tone: "ok" | "warn" | "bad" | "neutral"; text: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState("");
  const [whyNote, setWhyNote] = useState("");
  const [fromPerson, setFromPerson] = useState(false);
  const [refused, setRefused] = useState<
    { url: string; message: string; family?: string }[]
  >([]);
  const [status, setStatus] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pendingFamily, setPendingFamily] = useState<SurfaceFamily | null>(
    null,
  );
  const [read, setRead] = useState<DeclaredReadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const confirmedCount = links.filter((l) => l.confirmedAt).length;

  const add = () =>
    startTransition(async () => {
      setError(null);
      setStatus(null);
      setRefused([]);
      const r = await addProfileLinksAction({
        searchProjectId,
        candidateId,
        text,
        whyNote: whyNote || undefined,
        fromPerson,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setRefused(r.data.refused);
      const bits = [`${r.data.added} kept`];
      if (r.data.duplicates > 0) bits.push(`${r.data.duplicates} already held`);
      if (r.data.conflicts.length > 0)
        bits.push(
          `also on ${r.data.conflicts.map((c) => c.name).join(", ")} — review task opened`,
        );
      setStatus(bits.join(" · "));
      if (r.data.added > 0) {
        setText("");
        setWhyNote("");
      }
      const off = r.data.refused.find((x) => x.family);
      setPendingFamily((off?.family as SurfaceFamily | undefined) ?? null);
      router.refresh();
    });

  const turnOn = (family: SurfaceFamily) =>
    startTransition(async () => {
      setError(null);
      const r = await setSurfaceOptInAction({
        searchProjectId,
        family,
        reason,
      });
      if (r.ok) {
        setPendingFamily(null);
        setReason("");
        setStatus(`${SURFACE_FAMILY_LABELS[family]} is on for this search.`);
        router.refresh();
      } else setError(r.error);
    });

  const remove = (sourceId: string) =>
    startTransition(async () => {
      const r = await removeProfileLinkAction({
        searchProjectId,
        candidateId,
        sourceId,
      });
      if (r.ok) router.refresh();
      else setError(r.error);
    });

  const move = (sourceId: string, toCandidateId: string) =>
    startTransition(async () => {
      const r = await moveProfileLinkAction({
        searchProjectId,
        sourceId,
        toCandidateId,
      });
      if (r.ok) router.refresh();
      else setError(r.error);
    });

  const readDeclared = (sourceId: string) =>
    startTransition(async () => {
      setError(null);
      setRead(null);
      const r = await readDeclaredLinksAction({ candidateId, sourceId });
      if (r.ok) setRead(r.data);
      else setError(r.error);
    });

  const keep = (suggestion: DeclaredReadResult["suggestions"][number]) =>
    startTransition(async () => {
      if (!read) return;
      const origin = declaredAccounts.find(
        (a) => a.account === read.account && a.platform === read.platform,
      );
      const r = await acceptDeclaredLinkAction({
        searchProjectId,
        candidateId,
        originSourceId: origin?.sourceId ?? "",
        retrievedAt: read.retrievedAt,
        link: suggestion.link,
      });
      if (r.ok) {
        setRead({
          ...read,
          suggestions: read.suggestions.filter(
            (s) => s.link.url !== suggestion.link.url,
          ),
        });
        router.refresh();
      } else setError(r.error);
    });

  const grouped = FAMILY_ORDER.map((family) => ({
    family,
    rows: links.filter((l) => l.family === family),
  })).filter((g) => g.rows.length > 0);

  return (
    <Card
      title={`Profile connections — ${links.length} address${links.length === 1 ? "" : "es"}`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
        <span>{confirmedCount} confirmed by the person</span>
        <span aria-hidden>·</span>
        <span>notice:</span>
        <Tag tone={notice.tone === "neutral" ? "neutral" : notice.tone}>
          {notice.text}
        </Tag>
      </div>

      {grouped.length === 0 && (
        <p className="text-[13px] text-ink-muted">
          No addresses yet. Paste the profiles you have found below, one per
          line.
        </p>
      )}

      {grouped.map(({ family, rows }) => (
        <div key={family} className="mb-4">
          <h4 className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">
            {SURFACE_FAMILY_LABELS[family]} ({rows.length})
          </h4>
          {FAMILY_NOTES[family] && (
            <p className="mt-0.5 text-[11px] text-ink-faint">
              {FAMILY_NOTES[family]}
            </p>
          )}
          <ul className="mt-1.5 space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded border border-edge bg-panel2/40 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {/* The address is the thing being kept, so the address is
                        what the row shows; a platform's own field name is
                        context, not a substitute for it. */}
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12.5px] break-all text-accent hover:underline"
                    >
                      {row.url}
                    </a>
                    {row.label && (
                      <span className="ml-2 text-[11px] text-ink-faint">
                        listed as “{row.label}”
                      </span>
                    )}
                    <p className="mt-0.5 text-[11px] text-ink-faint">
                      <span className="mr-1.5 rounded border border-edge2 px-1 py-0.5 uppercase tracking-wide">
                        {row.badge}
                      </span>
                      {row.provenanceLine}
                    </p>
                    {row.subLines.map((line) => (
                      <p key={line} className="text-[11px] text-ink-faint">
                        {line}
                      </p>
                    ))}
                    {row.originUrl && (
                      <p className="text-[11px] text-ink-faint">
                        found on: {row.originUrl}
                      </p>
                    )}
                    {row.whyNote && (
                      <p className="mt-0.5 text-[11.5px] text-ink-muted">
                        Why you kept it: {row.whyNote}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <button
                      type="button"
                      onClick={() => remove(row.id)}
                      disabled={pending}
                      className="text-[11.5px] text-ink-faint hover:text-bad disabled:opacity-50"
                    >
                      Remove
                    </button>
                    {otherCandidates.length > 0 && (
                      <select
                        defaultValue=""
                        onChange={(e) =>
                          e.target.value && move(row.id, e.target.value)
                        }
                        className="rounded border border-edge bg-canvas px-1.5 py-0.5 text-[11px] text-ink-muted"
                      >
                        <option value="">Move to…</option>
                        {otherCandidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="mt-4 rounded border border-edge bg-canvas p-3">
        <p className="text-[12.5px] font-medium">Add addresses</p>
        <p className="mt-0.5 text-[11.5px] text-ink-faint">
          One per line. Open each one and judge it yourself first — this app
          never opens or reads these pages.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder={
            "https://github.com/example\nhttps://orcid.org/0000-0002-1825-0097"
          }
          className="mt-2 w-full rounded border border-edge bg-panel px-2 py-1.5 font-mono text-[12px]"
        />
        <input
          type="text"
          value={whyNote}
          onChange={(e) => setWhyNote(e.target.value)}
          placeholder="Why you think these are the same person (your own note)"
          className={`mt-2 ${inputClass}`}
        />
        <label className="mt-2 flex items-center gap-2 text-[12px] text-ink-muted">
          <input
            type="checkbox"
            checked={fromPerson}
            onChange={(e) => setFromPerson(e.target.checked)}
          />
          The person gave me these
        </label>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={add}
            disabled={pending || text.trim().length < 4}
            className={buttonClass}
          >
            Add
          </button>
          {status && <span className="text-[11.5px] text-ok">{status}</span>}
        </div>

        {refused.length > 0 && (
          <div className="mt-3 rounded border border-bad/40 bg-bad-soft px-3 py-2">
            {refused.map((r) => (
              <p key={r.url} className="text-[11.5px] text-bad">
                {r.url} — {firstSentence(r.message)}
              </p>
            ))}
          </div>
        )}

        {pendingFamily && FAMILY_WARNINGS[pendingFamily] && (
          <div className="mt-3 rounded border border-warn/40 bg-warn-soft px-3 py-2">
            <p className="text-[12px] text-ink-muted">
              {FAMILY_WARNINGS[pendingFamily]}
            </p>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={`Reason this search needs ${SURFACE_FAMILY_LABELS[pendingFamily].toLowerCase()} addresses (kept with the search)`}
              className={`mt-2 ${inputClass}`}
            />
            <button
              type="button"
              onClick={() => turnOn(pendingFamily)}
              disabled={pending || reason.trim().length < OPT_IN_REASON_MIN}
              className={`mt-2 ${subtleButtonClass}`}
            >
              Turn on for this search
            </button>
          </div>
        )}
      </div>

      {declaredAccounts.length > 0 && (
        <div className="mt-4 rounded border border-edge bg-canvas p-3">
          <p className="text-[12.5px] font-medium">
            Addresses this person listed themselves
          </p>
          <p className="mt-0.5 text-[11.5px] text-ink-faint">
            Reads the links {candidateName} published on a profile they control,
            through that platform&apos;s own public API. One person, one click.
            Nothing is kept until you keep it.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {declaredAccounts.map((account) => (
              <button
                key={account.sourceId}
                type="button"
                onClick={() => readDeclared(account.sourceId)}
                disabled={pending || !account.configured}
                className={subtleButtonClass}
                title={
                  account.configured
                    ? undefined
                    : `Not enabled. Set TALENTOS_PROFILES_${account.platform.toUpperCase()}=1 to read the links this person listed; nothing calls out otherwise.`
                }
              >
                Read {account.platform} list for {account.account}
                {account.mode === "mock" ? " [Mock]" : ""}
                {account.configured ? "" : " — not enabled"}
              </button>
            ))}
          </div>

          {read && (
            <div className="mt-3">
              {read.suggestions.length === 0 && (
                <p className="text-[12px] text-ink-muted">
                  No addresses to show from {read.platform}.
                </p>
              )}
              <ul className="space-y-1.5">
                {read.suggestions.map((suggestion) => (
                  <li
                    key={suggestion.link.url}
                    className="flex items-start justify-between gap-3 rounded border border-edge px-3 py-2"
                  >
                    <div className="min-w-0">
                      <a
                        href={suggestion.link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12.5px] break-all text-accent hover:underline"
                      >
                        {suggestion.link.url}
                      </a>
                      <p className="text-[11px] text-ink-faint">
                        <span className="mr-1.5 rounded border border-edge2 px-1 py-0.5 uppercase tracking-wide">
                          suggested · not yet opened
                        </span>
                        {suggestion.familyLabel} ·{" "}
                        {suggestion.link.label ?? "listed"} · open it and judge
                        it is the same person before keeping it
                      </p>
                      {suggestion.alreadySavedOn && (
                        <p className="text-[11px] text-warn">
                          already saved on {suggestion.alreadySavedOn}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => keep(suggestion)}
                      disabled={pending}
                      className="shrink-0 rounded border border-edge2 px-2 py-1 text-[11.5px] text-ink-muted hover:bg-panel2 disabled:opacity-50"
                    >
                      This is them — keep
                    </button>
                  </li>
                ))}
              </ul>
              {read.hiddenCount > 0 && (
                <p className="mt-2 text-[11.5px] text-ink-faint">
                  {read.hiddenCount} address
                  {read.hiddenCount === 1 ? "" : "es"} on surfaces that are off
                  for this search were not shown. Paste one by hand if you
                  decide you need it.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[12px] text-bad">
          {error}
        </p>
      )}

      <p className="mt-4 text-[11px] text-ink-faint">{PROFILE_CARD_FOOTER}</p>
    </Card>
  );
}
