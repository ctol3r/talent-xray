"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { PRODUCT_NAME } from "@/lib/product";
import { saveCapturedSourceAction } from "@/lib/actions/browser-companion";
import {
  companionBookmarklet,
  readCaptureFragment,
} from "@/lib/core/browser-companion";
import type { CaptureWorkspace } from "@/lib/services/browser-companion";

const field =
  "mt-1 block w-full rounded border border-edge2 bg-panel2 p-2 text-ink";
const button =
  "rounded border border-edge2 px-3 py-2 text-sm hover:bg-panel2 disabled:opacity-50";

export function BrowserCompanion({
  workspace,
  origin,
  initialProjectId,
}: {
  workspace: CaptureWorkspace;
  origin: string;
  initialProjectId?: string;
}) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const initialError = useRef<HTMLParagraphElement>(null);
  const [projectId, setProjectId] = useState(
    workspace.projects.some((project) => project.id === initialProjectId)
      ? initialProjectId!
      : "",
  );
  const [destination, setDestination] = useState("research");
  const [message, setMessage] = useState("");
  const [savedHref, setSavedHref] = useState("");
  const [pending, startTransition] = useTransition();
  const bookmarklet = companionBookmarklet(origin);
  const available = workspace.candidates.filter(
    (candidate) => candidate.searchProjectId === projectId,
  );
  const saved = workspace.saved.filter(
    (source) => source.searchProjectId === projectId,
  );

  useEffect(() => {
    const fragment = window.location.hash;
    // Consume immediately: fragments never reach the server, then leave browser history too.
    if (!fragment) return;
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
    try {
      const draft = readCaptureFragment(fragment);
      const url = form.current?.elements.namedItem("url");
      const title = form.current?.elements.namedItem("title");
      if (url instanceof HTMLInputElement) url.value = draft.url;
      if (title instanceof HTMLInputElement) title.value = draft.title;
    } catch {
      if (initialError.current)
        initialError.current.textContent =
          "The incoming link could not be read. Paste a complete HTTP or HTTPS URL and title below.";
    }
  }, []);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setMessage("");
    setSavedHref("");
    startTransition(async () => {
      const result = await saveCapturedSourceAction({
        searchProjectId: projectId,
        destination,
        candidateId:
          destination === "candidate" ? fields.get("candidateId") : undefined,
        url: fields.get("url"),
        title: fields.get("title"),
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(
        result.data.duplicate
          ? "This exact URL was already saved here. The existing record was preserved."
          : "Link saved. Its contents and the person’s qualifications have not been verified.",
      );
      setSavedHref(result.data.href);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
      <div className="space-y-5">
        <Card title="Review and save a link">
          <p className="mb-4 text-sm text-ink-muted">
            Only this URL and title will be saved. Edit or remove private query
            parameters before saving. The page itself is never fetched.
          </p>
          <p
            ref={initialError}
            role="alert"
            className="mb-2 text-sm text-warn"
          />
          <form
            ref={form}
            onSubmit={submit}
            className="space-y-4"
            onChange={() => {
              setMessage("");
              setSavedHref("");
            }}
          >
            <label className="block text-sm">
              Source URL
              <input
                required
                type="url"
                name="url"
                maxLength={8192}
                className={field}
                placeholder="https://example.com/profile"
              />
            </label>
            <label className="block text-sm">
              Source title
              <input
                name="title"
                maxLength={500}
                className={field}
                placeholder="A label you can recognize later"
              />
            </label>
            <label className="block text-sm">
              Save to search
              <select
                required
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
                className={field}
              >
                <option value="">Choose a search</option>
                {workspace.projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Link category
              <select
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                className={field}
              >
                <option value="research">
                  Search research / exposure source
                </option>
                <option value="candidate">Existing candidate source</option>
              </select>
            </label>
            {destination === "candidate" && (
              <label className="block text-sm">
                Save to candidate
                <select
                  key={projectId}
                  name="candidateId"
                  required
                  defaultValue=""
                  className={field}
                >
                  <option value="">Choose a candidate</option>
                  {available.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!workspace.projects.length && (
              <p className="text-sm text-ink-muted">
                <Link href="/searches/new" className="text-accent underline">
                  Create a search
                </Link>{" "}
                before saving a link.
              </p>
            )}
            {destination === "candidate" && projectId && !available.length && (
              <p className="text-sm text-ink-muted">
                Add a candidate from this search’s Candidates page, then reopen
                the companion.
              </p>
            )}
            <button
              type="submit"
              disabled={
                pending ||
                !projectId ||
                (destination === "candidate" && !available.length)
              }
              className={`${button} bg-accent-soft text-accent`}
            >
              {pending ? "Saving…" : "Save reviewed link"}
            </button>
          </form>
          <p role="status" className="mt-3 text-sm">
            {message}
          </p>
          {savedHref && (
            <Link
              href={savedHref}
              className="mt-2 block text-sm text-accent underline"
            >
              Open saved destination
            </Link>
          )}
        </Card>
        {projectId && (
          <Card title="Saved browser links for this search">
            {!saved.length ? (
              <p className="text-sm text-ink-muted">
                No browser links have been saved to this search.
              </p>
            ) : (
              <ul className="space-y-3">
                {saved.map((source) => (
                  <li key={source.id} className="break-words text-sm">
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline"
                    >
                      {source.title || source.url}
                    </a>
                    <p className="mt-1 text-xs text-ink-muted">{source.url}</p>
                    <p className="text-xs text-ink-faint">
                      {source.candidateId
                        ? `Candidate: ${workspace.candidates.find((candidate) => candidate.id === source.candidateId)?.name ?? "Saved candidate"}`
                        : "Search research / exposure source"}{" "}
                      · Saved {source.createdAt.slice(0, 10)} · Contents
                      unverified
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
      <Card title={`Take ${PRODUCT_NAME} with you`}>
        <div className="space-y-4 text-sm text-ink-muted">
          <p>
            Keep {PRODUCT_NAME} running at{" "}
            <code className="text-ink">{origin}</code>. Open this companion
            alongside any browser and paste a link.
          </p>
          <details>
            <summary className="cursor-pointer font-medium text-ink">
              Install a bookmarklet in any supporting browser
            </summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Create a bookmark named “Save to {PRODUCT_NAME}”.</li>
              <li>
                Copy the code below into the bookmark’s URL/location field.
              </li>
              <li>
                Open a source page and click the bookmark. {PRODUCT_NAME} opens
                a review form.
              </li>
            </ol>
            <label className="mt-3 block">
              Bookmarklet code
              <textarea
                readOnly
                value={bookmarklet}
                rows={5}
                className={`${field} font-mono text-xs`}
                onFocus={(event) => event.target.select()}
              />
            </label>
            <button
              type="button"
              className={`${button} mt-2`}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(bookmarklet);
                  setMessage(
                    "Bookmarklet copied. Paste it into a bookmark’s URL field.",
                  );
                } catch {
                  setMessage(
                    "Clipboard access is unavailable. Select and copy the bookmarklet code manually.",
                  );
                }
              }}
            >
              Copy bookmarklet
            </button>
            <p className="mt-2">
              Some sites or browsers block bookmarklets or popups. The manual
              form above remains available.
            </p>
          </details>
          <details>
            <summary className="cursor-pointer font-medium text-ink">
              Use the optional Chrome extension
            </summary>
            <p className="mt-3">
              In Chrome, open <code>chrome://extensions</code>, enable Developer
              mode, choose Load unpacked, and select the{" "}
              <code>talentos/browser-extension</code> folder in this checkout.
              Pin “{PRODUCT_NAME} companion”, set its local address to{" "}
              <code>{origin}</code>, and click “Review link in {PRODUCT_NAME}”
              on a page you want to save.
            </p>
            <p className="mt-2">
              The extension uses activeTab permission on your click. It reads
              the tab URL and title only. No account or AI API key is required.
            </p>
          </details>
          <p className="border-t border-edge pt-3 text-xs">
            Opening this page never saves a record or moves a candidate. Titles
            and URLs are untrusted references. Saving a link does not certify
            its contents or promote it to CV evidence.
          </p>
        </div>
      </Card>
    </div>
  );
}
