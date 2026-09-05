"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  importDocumentAction,
  saveDocumentAction,
} from "@/lib/actions/document-review";
import { MAX_DOCUMENT_CHARS, MAX_FILE_BYTES } from "@/lib/documents/contracts";
export function DocumentImporter({
  searchProjectId,
  candidateId,
  kind,
  current,
}: {
  searchProjectId: string;
  candidateId?: string;
  kind: "cv" | "jd";
  current?: {
    id: string;
    text: string;
    extractionStatus: string;
    originalFileId: string | null;
    mediaType: string | null;
  };
}) {
  const [text, setText] = useState(current?.text ?? "");
  const [message, setMessage] = useState("");
  const [busy, run] = useTransition();
  const router = useRouter();
  return (
    <section className="review-import" id={`import-${kind}`}>
      <h3>{kind.toUpperCase()} document intake</h3>
      <p>
        PDF, DOCX or pasted text · 20 MiB · 100 PDF pages · 200,000 characters.
        Text PDFs only; OCR is unavailable.
      </p>
      <form
        action={(form) =>
          run(async () => {
            const file = form.get("file");
            if (file instanceof File && file.size > MAX_FILE_BYTES) {
              setMessage("File exceeds 20 MiB.");
              return;
            }
            form.set("searchProjectId", searchProjectId);
            form.set("kind", kind);
            if (candidateId) form.set("candidateId", candidateId);
            const result = await importDocumentAction(form);
            setMessage(
              result.ok
                ? "Imported. Inspect the extracted text below before confirming."
                : result.error,
            );
            if (result.ok) router.refresh();
          })
        }
      >
        <label>
          Upload {kind.toUpperCase()}{" "}
          <input
            aria-label={`Upload ${kind.toUpperCase()}`}
            type="file"
            name="file"
            accept=".pdf,.docx"
            required
            disabled={busy}
          />
        </label>
        <button disabled={busy}>Extract file</button>
      </form>
      <label>
        Review or paste {kind.toUpperCase()} text
        <textarea
          aria-label={`${kind.toUpperCase()} extracted text`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_DOCUMENT_CHARS}
          rows={9}
        />
      </label>
      <p>
        Extraction state: {current?.extractionStatus ?? "no document"}. Check
        columns, reading order and omitted text. Saving preserves earlier
        versions.
      </p>
      <button
        disabled={busy || !text.trim()}
        onClick={() =>
          run(async () => {
            const r = await saveDocumentAction({
              searchProjectId,
              candidateId,
              kind,
              text,
              confirmed: true,
              previousId: current?.id,
            });
            setMessage(
              r.ok ? "Text confirmed and saved as a new version." : r.error,
            );
            if (r.ok) router.refresh();
          })
        }
      >
        Confirm {kind.toUpperCase()} text
      </button>
      {current?.originalFileId && (
        <span>
          {" "}
          <a href={`/documents/${current.id}/original`}>Download original</a>
          {current.mediaType === "application/pdf" && (
            <>
              {" "}
              ·{" "}
              <a
                href={`/documents/${current.id}/original?view=1`}
                target="_blank"
                rel="noopener"
              >
                View original PDF
              </a>
            </>
          )}
        </span>
      )}
      <p role="status">{busy ? "Processing document…" : message}</p>
    </section>
  );
}
