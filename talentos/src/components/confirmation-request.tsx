"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ConfirmationChannel } from "@/lib/core/enums";
import { CONFIRMATION_CHANNELS } from "@/lib/core/enums";
import {
  recordCandidateAnswerAction,
  recordRequestSentAction,
} from "@/lib/actions/profile-confirmations";
import type { ProfileLinkView } from "@/lib/services/profile-links";
import { buttonClass, inputClass, subtleButtonClass } from "./forms";
import { Card } from "./ui";

const TOP_COPY =
  "Nothing is sent from here. Copy the text into your own mail client or message, then tell the app when you sent it. The person's reply is not stored — only which addresses they confirmed, denied or added.";

type Answer = "theirs" | "not_theirs" | "no_answer";

/**
 * Ask the person which addresses are theirs, and record what they said.
 *
 * The message doubles as the GDPR Article 14 notice, so sending it is what
 * stops the clock on the candidate card. The reply is the strongest evidence
 * of identity this system can hold, and the only one the person themselves
 * gave.
 */
export function ConfirmationRequest({
  searchProjectId,
  candidateId,
  candidateName,
  draft,
  links,
  noticeText,
}: {
  searchProjectId: string;
  candidateId: string;
  candidateName: string;
  draft: { subject: string; body: string };
  links: ProfileLinkView[];
  noticeText: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sentChannel, setSentChannel] = useState<ConfirmationChannel>("email");
  const [sentAt, setSentAt] = useState(new Date().toISOString().slice(0, 10));
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [addedUrls, setAddedUrls] = useState("");
  const [respondedAt, setRespondedAt] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [answerChannel, setAnswerChannel] =
    useState<ConfirmationChannel>("email");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (what: "subject" | "body", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied(null);
    }
  };

  const markSent = () =>
    startTransition(async () => {
      setError(null);
      const r = await recordRequestSentAction({
        searchProjectId,
        candidateId,
        channel: sentChannel,
        sentAt: new Date(`${sentAt}T12:00:00.000Z`).toISOString(),
      });
      if (r.ok) {
        setStatus(`Recorded as sent on ${sentAt} via ${sentChannel}.`);
        router.refresh();
      } else setError(r.error);
    });

  const recordAnswer = () =>
    startTransition(async () => {
      setError(null);
      const r = await recordCandidateAnswerAction({
        searchProjectId,
        candidateId,
        respondedAt: new Date(`${respondedAt}T12:00:00.000Z`).toISOString(),
        channel: answerChannel,
        answers: Object.entries(answers).map(([sourceId, answer]) => ({
          sourceId,
          answer,
        })),
        addedUrls: addedUrls
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean),
      });
      if (r.ok) {
        setStatus(
          `${r.data.confirmed} confirmed · ${r.data.removed} removed and blocked · ${r.data.added} added by them`,
        );
        setAnswers({});
        setAddedUrls("");
        router.refresh();
      } else setError(r.error);
    });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title={`Ask ${candidateName}`}>
        <p className="text-[12px] text-ink-muted">{TOP_COPY}</p>
        <p className="mt-2 text-[11.5px] text-ink-faint">
          This message is also the notice you owe them. Recording it as sent is
          what changes the notice state, currently: {noticeText}.
        </p>

        <label className="mt-3 block text-[12px] text-ink-muted">
          Subject
          <input
            readOnly
            value={draft.subject}
            className={`mt-1 ${inputClass}`}
          />
        </label>
        <button
          type="button"
          onClick={() => copy("subject", draft.subject)}
          className={`mt-1 ${subtleButtonClass}`}
        >
          {copied === "subject" ? "Copied" : "Copy subject"}
        </button>

        <label className="mt-3 block text-[12px] text-ink-muted">
          Message
          <textarea
            readOnly
            value={draft.body}
            rows={18}
            className="mt-1 w-full rounded border border-edge bg-panel px-2 py-1.5 font-mono text-[11.5px]"
          />
        </label>
        <button
          type="button"
          onClick={() => copy("body", draft.body)}
          className={`mt-1 ${subtleButtonClass}`}
        >
          {copied === "body" ? "Copied" : "Copy message"}
        </button>

        <div className="mt-4 rounded border border-edge2 px-3 py-2">
          <p className="text-[12px] font-medium">I sent this</p>
          <div className="mt-1.5 flex flex-wrap items-end gap-3">
            <label className="text-[11.5px] text-ink-muted">
              On
              <input
                type="date"
                value={sentAt}
                onChange={(e) => setSentAt(e.target.value)}
                className="mt-1 block rounded border border-edge bg-panel px-2 py-1 text-[12px]"
              />
            </label>
            <label className="text-[11.5px] text-ink-muted">
              Via
              <select
                value={sentChannel}
                onChange={(e) =>
                  setSentChannel(e.target.value as ConfirmationChannel)
                }
                className="mt-1 block rounded border border-edge bg-panel px-2 py-1 text-[12px]"
              >
                {CONFIRMATION_CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={markSent}
              disabled={pending}
              className={buttonClass}
            >
              Record as sent
            </button>
          </div>
        </div>
      </Card>

      <Card title="Record their answer">
        <p className="text-[12px] text-ink-muted">
          Mark each address as theirs or not. An address they say is not theirs
          is deleted and blocked from coming back by any route.
        </p>
        <ul className="mt-3 space-y-2">
          {links.map((link) => (
            <li key={link.id} className="rounded border border-edge px-3 py-2">
              <p className="text-[12px] break-all">{link.url}</p>
              <p className="text-[11px] text-ink-faint">{link.badge}</p>
              <div className="mt-1 flex gap-3">
                {(
                  [
                    ["theirs", "Theirs"],
                    ["not_theirs", "Not theirs"],
                    ["no_answer", "No answer"],
                  ] as [Answer, string][]
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex items-center gap-1 text-[11.5px] text-ink-muted"
                  >
                    <input
                      type="radio"
                      name={`answer-${link.id}`}
                      checked={answers[link.id] === value}
                      onChange={() =>
                        setAnswers((prev) => ({ ...prev, [link.id]: value }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <label className="mt-3 block text-[12px] text-ink-muted">
          Addresses they added — one per line
          <textarea
            value={addedUrls}
            onChange={(e) => setAddedUrls(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-edge bg-panel px-2 py-1.5 font-mono text-[12px]"
          />
        </label>

        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="text-[11.5px] text-ink-muted">
            They replied on
            <input
              type="date"
              value={respondedAt}
              onChange={(e) => setRespondedAt(e.target.value)}
              className="mt-1 block rounded border border-edge bg-panel px-2 py-1 text-[12px]"
            />
          </label>
          <label className="text-[11.5px] text-ink-muted">
            Via
            <select
              value={answerChannel}
              onChange={(e) =>
                setAnswerChannel(e.target.value as ConfirmationChannel)
              }
              className="mt-1 block rounded border border-edge bg-panel px-2 py-1 text-[12px]"
            >
              {CONFIRMATION_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={recordAnswer}
            disabled={pending}
            className={buttonClass}
          >
            Record answer
          </button>
        </div>

        {status && (
          <p className="mt-3 rounded border border-ok/40 bg-ok-soft px-3 py-2 text-[12px] text-ok">
            {status}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded border border-bad/40 bg-bad-soft px-3 py-2 text-[12px] text-bad">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}
