"use client";

import { useState } from "react";
import { setCompanySiteAction } from "@/lib/actions/companies";
import { suggestedCompanySite } from "../../artifact-src/core/company-mark";
import { CompanyMark } from "./company-mark";
import { ErrorNote, inputClass, useAction } from "./forms";

/**
 * Where a company lives on the web, so its logo can be shown.
 *
 * One field, and the mark beside it updates the moment it is saved, because
 * the reason somebody is typing here is to see the logo appear. Clearing the
 * field takes the address back off, which is how a wrong one is undone.
 */
export function CompanySiteForm({
  name,
  url,
  favicons,
}: {
  name: string;
  url: string | null;
  favicons: boolean;
}) {
  const [value, setValue] = useState(url ?? "");
  const { pending, error, submit } = useAction();
  /**
   * What the address probably is, offered rather than assumed.
   *
   * Nothing here resolves a name to a domain on its own — "Center for AI
   * Safety" is not centeraisafety.com, and a stranger's logo beside a live job
   * is wrong silently and confidently on the surface a recruiter scans
   * fastest. This is only to save the typing: it fills the empty field, and a
   * person presses it or corrects it first.
   */
  const guess = url ? null : suggestedCompanySite(name);

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit(() => setCompanySiteAction({ name, url: value }));
      }}
    >
      <CompanyMark name={name} url={url} favicons={favicons} size={20} />
      <label className="sr-only" htmlFor={`site-${name}`}>
        Web address for {name}
      </label>
      <input
        id={`site-${name}`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={guess ?? "acme.com"}
        className={`${inputClass} max-w-[16rem]`}
      />
      {guess && !value.trim() && (
        <button
          type="button"
          disabled={pending}
          onClick={() => setValue(guess)}
          className="rounded border border-edge2 px-2 py-1 text-[12px] text-ink-faint hover:bg-panel2 hover:text-ink disabled:opacity-40"
        >
          use {guess}
        </button>
      )}
      <button
        type="submit"
        disabled={pending || value.trim() === (url ?? "")}
        className="rounded border border-edge2 px-2.5 py-1 text-[13px] text-ink-muted hover:bg-panel2 hover:text-ink disabled:opacity-40"
      >
        {pending ? "Saving…" : url ? "Change" : "Add site"}
      </button>
      <ErrorNote error={error} />
    </form>
  );
}
