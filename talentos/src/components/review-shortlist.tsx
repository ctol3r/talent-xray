"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { shortlistWorkspace } from "@/lib/services/review-shortlist";
import {
  saveShortlistDraftAction,
  exportShortlistDraftAction,
} from "@/lib/actions/document-review";
import "./document-review.css";
export function ReviewShortlist({
  searchProjectId,
  workspace: w,
}: {
  searchProjectId: string;
  workspace: ReturnType<typeof shortlistWorkspace>;
}) {
  const [ids, setIds] = useState(w.comparisonIds),
    [message, setMessage] = useState("");
  const [busy, run] = useTransition();
  const router = useRouter();
  return (
    <div className="document-review">
      <h1>Reviewed shortlist draft</h1>
      <p>
        Select reviewed candidates for this draft. Saving or exporting does not
        contact, submit, reject or move a candidate.
      </p>
      <Link href={`/searches/${searchProjectId}/candidates`}>
        Back to candidate deck / list
      </Link>
      <section className="review-output">
        <h2>Source-based review summaries</h2>
        {w.reviews.length === 0 && (
          <p>No comparisons yet. Review a candidate CV and JD first.</p>
        )}
        {w.reviews.map((r) => (
          <article key={r.comparisonId}>
            <label>
              <input
                type="checkbox"
                checked={ids.includes(r.comparisonId)}
                disabled={
                  busy ||
                  (r.freshness !== "current" && !ids.includes(r.comparisonId))
                }
                onChange={(e) =>
                  setIds(
                    e.target.checked
                      ? [...ids, r.comparisonId]
                      : ids.filter((id) => id !== r.comparisonId),
                  )
                }
              />
              {r.candidateName} · {r.freshness} · {r.accepted.length} accepted
              relationships
            </label>
            <Link
              href={`/searches/${searchProjectId}/candidates/${r.candidateId}/review?comparison=${r.comparisonId}`}
            >
              Open exact comparison
            </Link>
            <p>
              CV {r.cvVersionId} · JD {r.jdVersionId}
            </p>
            <p>Recruiter conclusion: {r.conclusion || "None recorded"}</p>
            {r.accepted.map((l) => (
              <div key={l.id}>
                <strong>
                  {
                    r.requirements.find((q) => q.id === l.payload.requirementId)
                      ?.label
                  }{" "}
                  · {l.payload.assessment}
                </strong>
                <blockquote>{l.payload.cvAnchor.quote}</blockquote>
                <p>{l.payload.explanation}</p>
                <p>Limitations: {l.payload.limitation || "None recorded"}</p>
              </div>
            ))}
            <p>
              Unresolved:{" "}
              {r.unresolvedRequirements.map((q) => q.label).join("; ") ||
                "No requirements without an accepted relevant relationship."}
            </p>
          </article>
        ))}
      </section>
      <div className="review-toolbar">
        <button disabled={busy} onClick={() => setIds([])}>
          Clear draft selection
        </button>
        <button
          disabled={busy}
          onClick={() =>
            run(async () => {
              const r = await saveShortlistDraftAction({
                searchProjectId,
                comparisonIds: ids,
              });
              setMessage(r.ok ? "Draft selection saved." : r.error);
              if (r.ok) router.refresh();
            })
          }
        >
          Save draft selection
        </button>
        <button
          disabled={
            busy || JSON.stringify(ids) !== JSON.stringify(w.comparisonIds)
          }
          onClick={() =>
            run(async () => {
              const r = await exportShortlistDraftAction(searchProjectId);
              if (!r.ok) {
                setMessage(r.error);
                return;
              }
              const url = URL.createObjectURL(
                new Blob([JSON.stringify(r.data, null, 2)], {
                  type: "application/json",
                }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = "reviewed-shortlist-draft.json";
              a.click();
              URL.revokeObjectURL(url);
              setMessage(
                "Draft exported. No hiring workflow event was recorded.",
              );
            })
          }
        >
          Export saved draft shortlist
        </button>
      </div>
      <p role="status">{message}</p>
    </div>
  );
}
