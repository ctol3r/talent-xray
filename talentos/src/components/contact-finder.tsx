"use client";

import { useMemo, useState } from "react";
import {
  NOT_STORED_NOTE,
  UNVERIFIED_NOTE,
  contactHunts,
  emailPatterns,
  verificationLinks,
} from "@/lib/domain/contact-patterns";
import { buildHostedEngineUrl } from "@/lib/research/talent-xray";
import { Card } from "@/components/ui";

/**
 * The contact finder.
 *
 * Two halves, and the first is the better one. Searching for a page the
 * person published that carries an address finds a fact; generating patterns
 * finds eight guesses. The searches are listed first for that reason.
 *
 * Nothing is stored, and the panel says so rather than leaving it implied —
 * the Article 14 notice this product drafts tells people it holds no address
 * for them, and that has to stay true.
 */
export function ContactFinder({
  candidateName,
  company,
}: {
  candidateName: string;
  company: string | null;
}) {
  const [name, setName] = useState(candidateName);
  const [employer, setEmployer] = useState(company ?? "");
  const [domain, setDomain] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const patterns = useMemo(() => emailPatterns(name, domain), [name, domain]);
  const hunts = useMemo(() => contactHunts(name, employer), [name, employer]);
  const checks = useMemo(() => verificationLinks(name, domain), [name, domain]);

  const inputClass =
    "w-full rounded border border-edge2 bg-panel2 px-2 py-1.5 text-[13.5px] text-ink";

  return (
    <Card title="✉️ Contact finder">
      <p className="text-[13.5px] text-ink-muted">{NOT_STORED_NOTE}</p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-0.5 block text-[12px] text-ink-muted">
            Person
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[12px] text-ink-muted">
            Employer
          </span>
          <input
            value={employer}
            onChange={(event) => setEmployer(event.target.value)}
            className={inputClass}
            placeholder="Sutter Health"
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[12px] text-ink-muted">
            Email domain
          </span>
          <input
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
            className={inputClass}
            placeholder="sutterhealth.org"
          />
        </label>
      </div>

      <div className="mt-4">
        <p className="text-[12px] uppercase tracking-wider text-ink-faint">
          🔎 Find a page they published — better than a guess
        </p>
        <ul className="mt-1.5 space-y-1.5">
          {hunts.map((hunt) => (
            <li key={hunt.label}>
              <p className="text-[12.5px] text-ink-muted">{hunt.label}</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate text-[12px] text-ink">
                  {hunt.query}
                </code>
                <a
                  href={buildHostedEngineUrl("core", hunt.query)}
                  target="_blank"
                  rel="noopener"
                  className="shrink-0 rounded border border-edge2 px-2 py-0.5 text-[12px] text-ink-muted hover:text-ink"
                >
                  Search
                </a>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <p className="text-[12px] uppercase tracking-wider text-ink-faint">
          🎲 Likely patterns — unverified
        </p>
        {patterns.length === 0 ? (
          <p className="mt-1 text-[13px] text-ink-faint">
            Add an email domain to generate patterns.
          </p>
        ) : (
          <>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              {UNVERIFIED_NOTE}
            </p>
            <ul className="mt-1.5 space-y-1" data-testid="contact-patterns">
              {patterns.map((address, index) => (
                <li
                  key={address}
                  className="flex items-center justify-between gap-2 rounded border border-edge bg-panel2 px-2 py-1"
                >
                  <span className="min-w-0 truncate text-[13px] text-ink">
                    <span className="mr-2 text-[11px] text-ink-faint">
                      {index + 1}
                    </span>
                    {address}
                    <span className="ml-2 rounded bg-warn-soft px-1 text-[11px] text-warn">
                      unverified
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(address).then(() => {
                        setCopied(address);
                        window.setTimeout(() => setCopied(null), 2000);
                      });
                    }}
                    className="shrink-0 rounded border border-edge2 px-2 py-0.5 text-[12px] text-ink-muted hover:text-ink"
                  >
                    {copied === address ? "Copied" : "Copy"}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {checks.length > 0 && (
        <div className="mt-4">
          <p className="text-[12px] uppercase tracking-wider text-ink-faint">
            ✅ Verify before you send
          </p>
          <ul className="mt-1.5 space-y-1.5">
            {checks.map((check) => (
              <li key={check.url}>
                <a
                  href={check.url}
                  target="_blank"
                  rel="noopener"
                  className="text-[13.5px] text-accent hover:underline"
                >
                  {check.label} ↗
                </a>
                <p className="text-[12.5px] text-ink-muted">{check.purpose}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
