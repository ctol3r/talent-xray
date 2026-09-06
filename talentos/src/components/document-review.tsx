"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { reviewWorkspace } from "@/lib/services/document-review";
import type { getProviderStatus } from "@/lib/ai/provider";
import type { Anchor, LinkInput } from "@/lib/documents/contracts";
import { validateAnchor } from "@/lib/documents/contracts";
import {
  addConnectionAction,
  addRequirementAction,
  prepareReviewArtifactAction,
  importReviewArtifactAction,
  reviewConnectionAction,
  saveReviewConclusionAction,
  startComparisonAction,
} from "@/lib/actions/document-review";
import type { ActionResult } from "@/lib/actions/helpers";
import { DocumentImporter } from "./document-importer";
import { ReviewWheel, type ReviewAction } from "./review-wheel";
import { ribbonPath } from "../../artifact-src/core/parallel";
import "./document-review.css";

type Workspace = ReturnType<typeof reviewWorkspace>;
type Connection = Workspace["links"][number];
function valid(text: string, anchor: Anchor) {
  try {
    validateAnchor(text, anchor);
    return true;
  } catch {
    return false;
  }
}
function MarkedText({
  text,
  links,
  side,
  select,
}: {
  text: string;
  links: Connection[];
  side: "cv" | "jd";
  select: (id: string) => void;
}) {
  const anchors = links.flatMap((link) => {
    const anchor =
      side === "cv" ? link.payload.cvAnchor : link.payload.jdAnchor;
    return anchor && valid(text, anchor) ? [{ ...anchor, id: link.id }] : [];
  });
  const cuts = [
    ...new Set([0, text.length, ...anchors.flatMap((a) => [a.start, a.end])]),
  ].sort((a, b) => a - b);
  return (
    <pre>
      {cuts.slice(0, -1).map((start, i) => {
        const end = cuts[i + 1];
        const active = anchors.filter((a) => a.start <= start && a.end >= end);
        return active.length ? (
          <mark
            key={start}
            data-link={active.map((a) => a.id).join(" ")}
            tabIndex={0}
            role="button"
            aria-label={`${side.toUpperCase()} linked passage: ${text.slice(start, end)}`}
            onClick={() => select(active[0].id)}
            onKeyDown={(e) => {
              if (["Enter", " "].includes(e.key)) {
                e.preventDefault();
                select(active[0].id);
              }
            }}
          >
            {text.slice(start, end)}
          </mark>
        ) : (
          <span key={start}>{text.slice(start, end)}</span>
        );
      })}
    </pre>
  );
}
export function DocumentReview({
  workspace: w,
  provider,
  searchProjectId,
}: {
  workspace: Workspace;
  provider: ReturnType<typeof getProviderStatus>;
  searchProjectId: string;
}) {
  const router = useRouter(),
    query = useSearchParams();
  const comparison =
    w.comparisons.find((c) => c.id === query.get("comparison")) ??
    w.comparisons.find((c) => c.contextHash === w.contextHash);
  const cv =
    w.cvVersions.find((v) => v.id === comparison?.cvVersionId) ??
    w.cvVersions[0];
  const jd =
    w.jdVersions.find((v) => v.id === comparison?.jdVersionId) ??
    w.jdVersions[0];
  const requirements = comparison?.requirements ?? w.requirements;
  const requirementId = query.get("requirement") ?? requirements[0]?.id;
  const requirement = requirements.find((r) => r.id === requirementId);
  const stale = !!comparison && comparison.contextHash !== w.contextHash;
  const links = w.links.filter(
    (l) =>
      l.comparisonId === comparison?.id &&
      cv &&
      jd &&
      valid(cv.text, l.payload.cvAnchor) &&
      (!l.payload.jdAnchor || valid(jd.text, l.payload.jdAnchor)),
  );
  const selected = links.find((l) => l.id === query.get("link"));
  const [intakes, setIntakes] = useState({
    cv: !w.cvVersions[0],
    jd: !w.jdVersions[0],
  });
  const [artifactRequest, setArtifactRequest] = useState("");
  const [artifactResponse, setArtifactResponse] = useState("");
  const [all, setAll] = useState(false),
    [manual, setManual] = useState(false),
    [context, setContext] = useState(true),
    [summary, setSummary] = useState(false);
  const [cvAnchor, setCvAnchor] = useState<Anchor | null>(null),
    [jdAnchor, setJdAnchor] = useState<Anchor | null>(null);
  const [explanation, setExplanation] = useState(""),
    [limitation, setLimitation] = useState(""),
    [assessment, setAssessment] = useState<LinkInput["assessment"]>("unknown");
  const [replaces, setReplaces] = useState<string | undefined>(),
    [note, setNote] = useState(""),
    [conclusion, setConclusion] = useState(comparison?.conclusion ?? ""),
    [manager, setManager] = useState("");
  const [message, setMessage] = useState(""),
    [busy, run] = useTransition(),
    [exportIds, setExportIds] = useState<string[]>([]);
  const pages = useRef<HTMLDivElement>(null),
    left = useRef<HTMLDivElement>(null),
    right = useRef<HTMLDivElement>(null);
  const [ribbons, setRibbons] = useState<{ id: string; path: string }[]>([]);
  const base = `/searches/${searchProjectId}/candidates/${w.candidate.id}/review`;
  const navigate = (updates: Record<string, string | undefined>) => {
    const p = new URLSearchParams(query.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.replace(`${base}?${p}`, { scroll: false });
  };
  useEffect(() => {
    if (!query.toString()) return;
    try {
      localStorage.setItem(`review:${base}`, query.toString());
    } catch {
      /* Optional navigation memory. */
    }
  }, [base, query]);
  useEffect(() => {
    const container = pages.current;
    if (!container) return;
    const key = `review-scroll:${base}:${cv?.id}:${jd?.id}`;
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
      if (
        Array.isArray(saved) &&
        saved.length === 2 &&
        saved.every((n) => typeof n === "number" && Number.isFinite(n))
      ) {
        if (left.current) left.current.scrollTop = saved[0];
        if (right.current) right.current.scrollTop = saved[1];
      }
    } catch {
      /* Optional navigation memory. */
    }
    const save = () => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify([
            left.current?.scrollTop ?? 0,
            right.current?.scrollTop ?? 0,
          ]),
        );
      } catch {}
    };
    container.addEventListener("scroll", save, true);
    return () => container.removeEventListener("scroll", save, true);
  }, [base, cv?.id, jd?.id]);
  const reviewState = (id: string) =>
    w.reviews.find((r) => r.linkId === id)?.decision ?? "suggested";
  const visible = links.filter(
    (l) =>
      reviewState(l.id) !== "dismissed" &&
      (all || l.payload.requirementId === requirementId),
  );
  const visibleKey = visible.map((l) => l.id).join(" ");
  useEffect(() => {
    const container = pages.current;
    if (!container) return;
    const measure = () => {
      if (manual || window.innerWidth < 900) {
        setRibbons([]);
        return;
      }
      const box = container.getBoundingClientRect();
      const end = (
        pane: HTMLDivElement | null,
        id: string,
        side: "cv" | "jd",
      ) => {
        if (!pane) return null;
        const bounds = pane.getBoundingClientRect();
        const marks = Array.from(
          pane.querySelectorAll<HTMLElement>(`[data-link~="${id}"]`),
        );
        const rect = marks
          .flatMap((m) => Array.from(m.getClientRects()))
          .find((r) => r.bottom > bounds.top && r.top < bounds.bottom);
        if (!rect) return null;
        const top = Math.max(rect.top, bounds.top),
          bottom = Math.min(rect.bottom, bounds.bottom);
        return {
          x: (side === "cv" ? bounds.right : bounds.left) - box.left,
          y: (top + bottom) / 2 - box.top,
          height: Math.min(12, bottom - top),
        };
      };
      setRibbons(
        visibleKey
          .split(" ")
          .filter(Boolean)
          .flatMap((id) => {
            const a = end(left.current, id, "cv"),
              b = end(right.current, id, "jd");
            return a && b ? [{ id, path: ribbonPath(a, b) }] : [];
          }),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (left.current) observer.observe(left.current);
    if (right.current) observer.observe(right.current);
    container.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      container.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [visibleKey, manual, context, cv?.id, jd?.id]);
  useEffect(() => {
    if (!selected || manual) return;
    for (const pane of [left.current, right.current]) {
      const mark = pane?.querySelector<HTMLElement>(
        `[data-link~="${selected.id}"]`,
      );
      if (mark && pane)
        pane.scrollTop +=
          mark.getBoundingClientRect().top -
          pane.getBoundingClientRect().top -
          pane.clientHeight / 3;
    }
  }, [selected, manual]);
  const perform = <T,>(
    action: () => Promise<ActionResult<T>>,
    done?: (value: T) => void,
  ) =>
    run(async () => {
      const r = await action();
      setMessage(r.ok ? "Saved." : r.error);
      if (r.ok) {
        done?.(r.data);
        router.refresh();
      }
    });
  const pick = (id: string) => {
    const l = links.find((l) => l.id === id);
    for (const pane of [left.current, right.current]) {
      const mark = pane?.querySelector<HTMLElement>(`[data-link~="${id}"]`);
      if (mark && pane)
        pane.scrollTop +=
          mark.getBoundingClientRect().top -
          pane.getBoundingClientRect().top -
          pane.clientHeight / 3;
    }
    navigate({ link: id, requirement: l?.payload.requirementId });
    setContext(true);
  };
  const openIntake = (kind: string) => {
    const el = document.getElementById(
      `intake-${kind}`,
    ) as HTMLDetailsElement | null;
    if (el) {
      el.open = true;
      el.scrollIntoView({ block: "start" });
      el.querySelector<HTMLElement>("input,textarea")?.focus();
    }
  };
  const blocked = busy
    ? "An operation is running."
    : !comparison
      ? "Start a comparison after confirming documents and requirements."
      : stale
        ? "Historical comparison: open current versions first."
        : undefined;
  const decide = (decision: "accepted" | "dismissed") => {
    if (!selected) return;
    perform(() =>
      reviewConnectionAction({
        linkId: selected.id,
        decision,
        note:
          note.trim() ||
          (decision === "accepted"
            ? "Recruiter accepted this relationship; source authenticity and qualifications are not verified."
            : "Recruiter dismissed this relationship."),
      }),
    );
  };
  const actions: ReviewAction[] = [
    { label: "Import CV", run: () => openIntake("cv") },
    { label: "Import JD", run: () => openIntake("jd") },
    {
      label: "Analyze",
      reason: blocked,
      run: () =>
        perform(
          () => prepareReviewArtifactAction(comparison!.id),
          (r) => {
            setArtifactRequest(JSON.stringify(r, null, 2));
            setContext(true);
            setMessage(
              "Artifact request prepared locally. No model API was called.",
            );
          },
        ),
    },
    {
      label: "Manual link",
      reason: blocked,
      run: () => {
        setManual(true);
        setContext(true);
        setReplaces(undefined);
      },
    },
    {
      label: "Accept",
      reason: blocked || (!selected ? "Select a connection first." : undefined),
      run: () => decide("accepted"),
    },
    {
      label: "Dismiss",
      reason: blocked || (!selected ? "Select a connection first." : undefined),
      run: () => decide("dismissed"),
    },
    {
      label: "Draft question",
      reason: !requirement ? "Select a requirement first." : undefined,
      run: () => {
        setNote(
          `Can you provide a specific example demonstrating ${requirement?.statement}? Please describe your role, context, and outcome.`,
        );
        setContext(true);
      },
    },
    {
      label: "Review output",
      reason: !comparison ? "Start a comparison first." : undefined,
      run: () => {
        setConclusion(comparison?.conclusion ?? "");
        setSummary(!summary);
      },
    },
  ].map((a) => ({
    ...a,
    run: () => {
      if (a.reason) setMessage(a.reason);
      else a.run();
    },
  }));
  const accepted = links.filter((l) => reviewState(l.id) === "accepted");
  const exportReview = () => {
    const chosen = accepted.filter((l) => exportIds.includes(l.id));
    const data = {
      type: "recruiter-reviewed-material",
      candidate: w.candidate.name,
      comparisonId: comparison?.id,
      freshness: stale ? "stale" : "current",
      cvVersion: cv?.id,
      jdVersion: jd?.id,
      reviewerConclusion: comparison?.conclusion,
      relationships: chosen.map((l) => ({
        ...l,
        reviewHistory: w.reviews.filter((r) => r.linkId === l.id),
      })),
      requirementsWithoutAcceptedEvidence: requirements.filter(
        (r) =>
          !accepted.some(
            (l) =>
              l.payload.requirementId === r.id &&
              l.payload.assessment === "relevant",
          ),
      ),
      notice:
        "Acceptance approves a relationship, not source authenticity, employment or qualification.",
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "reviewed-material.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="document-review">
      <header className="review-heading">
        <div>
          <p>CONNECTED RECRUITING · SOURCE REVIEW</p>
          <h1>{w.candidate.name} · CV ↔ JD</h1>
          <p>
            Inspect exact passages. Record what the relationship does—and does
            not—support.
          </p>
        </div>
        <Link href={`/searches/${searchProjectId}/candidates`}>
          Candidate deck / list
        </Link>
      </header>
      <nav className="review-toolbar" aria-label="Review actions">
        {actions.map((a, i) => (
          <button
            key={a.label}
            type="button"
            aria-disabled={!!a.reason}
            title={a.reason}
            onClick={a.run}
          >
            {String.fromCharCode(65 + i)} · {a.label}
          </button>
        ))}
        <button onClick={() => setContext(!context)} aria-expanded={context}>
          Context panel
        </button>
      </nav>
      <p className="review-provider">
        Analyze CV against JD prepares a local artifact request. No AI model API
        key or automatic model request is used. Open it in your Codex or Claude
        artifact/session, then import the response below. Suggested links
        require your review. Other workspace modules are configured for{" "}
        {provider.kind}.
      </p>
      <p role="status" className="review-status">
        {busy ? "Working…" : message}
      </p>
      {artifactRequest && (
        <section className="review-import">
          <h2>Keyless comparison artifact</h2>
          <p>
            This request contains the confirmed CV and JD. Copy it only into the
            Codex or Claude artifact/session you intend to use. Importing a
            response verifies its structure and source anchors; it does not
            establish who generated it.
          </p>
          <label>
            Artifact request
            <textarea
              aria-label="Artifact request"
              readOnly
              value={artifactRequest}
              rows={8}
            />
          </label>
          <button
            onClick={() => {
              navigator.clipboard.writeText(artifactRequest).then(
                () => setMessage("Artifact request copied."),
                () => setMessage("Copy the request text manually."),
              );
            }}
          >
            Copy artifact request
          </button>
          <label>
            Artifact response JSON
            <textarea
              value={artifactResponse}
              onChange={(e) => setArtifactResponse(e.target.value)}
              rows={6}
            />
          </label>
          <button
            disabled={!!blocked || !artifactResponse.trim()}
            onClick={() => {
              try {
                const response: unknown = JSON.parse(artifactResponse);
                perform(
                  () =>
                    importReviewArtifactAction({
                      comparisonId: comparison?.id,
                      response,
                    }),
                  (r) =>
                    setMessage(
                      `${r.proposed} suggested relationships imported; ${r.unresolved} unresolved anchors rejected. No decisions were made.`,
                    ),
                );
              } catch {
                setMessage("Response must be valid JSON.");
              }
            }}
          >
            Validate and import suggestions
          </button>
        </section>
      )}
      <div className="review-intakes">
        {(["cv", "jd"] as const).map((kind) => (
          <details
            id={`intake-${kind}`}
            key={kind}
            open={intakes[kind]}
            onToggle={(e) => {
              const opened = e.currentTarget.open;
              setIntakes((s) =>
                s[kind] === opened ? s : { ...s, [kind]: opened },
              );
            }}
          >
            <summary>{kind.toUpperCase()} · import, correct or replace</summary>
            <DocumentImporter
              key={
                (kind === "cv" ? w.cvVersions[0]?.id : w.jdVersions[0]?.id) ??
                kind
              }
              kind={kind}
              searchProjectId={searchProjectId}
              candidateId={kind === "cv" ? w.candidate.id : undefined}
              current={kind === "cv" ? w.cvVersions[0] : w.jdVersions[0]}
            />
          </details>
        ))}
      </div>
      <div className="review-toolbar">
        <button
          disabled={busy}
          onClick={() =>
            perform(
              () =>
                startComparisonAction({
                  searchProjectId,
                  candidateId: w.candidate.id,
                }),
              (id) => navigate({ comparison: id, link: undefined }),
            )
          }
        >
          Open current comparison
        </button>
        <label>
          History{" "}
          <select
            aria-label="Comparison history"
            value={comparison?.id ?? ""}
            onChange={(e) =>
              navigate({ comparison: e.target.value, link: undefined })
            }
          >
            <option value="">Current document versions</option>
            {w.comparisons.map((c) => (
              <option key={c.id} value={c.id}>
                {c.createdAt} ·{" "}
                {c.contextHash === w.contextHash ? "current" : "stale"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={all}
            onChange={(e) => setAll(e.target.checked)}
          />{" "}
          All connections
        </label>
        <label>
          <input
            type="checkbox"
            checked={manual}
            onChange={(e) => setManual(e.target.checked)}
          />{" "}
          Select exact passages
        </label>
      </div>
      {stale && (
        <p className="review-stale">
          STALE · This historical comparison retains its original documents and
          decisions. New documents require new connections and review.
        </p>
      )}
      <div className={`review-workspace ${context ? "" : "context-hidden"}`}>
        <aside className="review-requirements">
          <h2>Requirements</h2>
          {requirements.map((r) => {
            const related = links.filter(
              (l) =>
                l.payload.requirementId === r.id &&
                reviewState(l.id) !== "dismissed",
            );
            return (
              <button
                key={r.id}
                className={r.id === requirementId ? "selected" : ""}
                onClick={() => navigate({ requirement: r.id, link: undefined })}
              >
                <strong>{r.label}</strong>
                <small>
                  {r.origin === "manager_statement"
                    ? "Manager-added"
                    : "JD / intake"}{" "}
                  ·{" "}
                  {related.length
                    ? `${related.length} connections`
                    : comparison?.meta
                      ? "Unsupported in this analysis"
                      : "Unassessed"}
                </small>
              </button>
            );
          })}
          <details>
            <summary>Add requirement manually</summary>
            <p>
              Use “Select exact passages” to select JD text. Manager additions
              stay separate from the JD.
            </p>
            <button
              disabled={!jdAnchor || stale || busy}
              onClick={() =>
                perform(() =>
                  addRequirementAction({
                    searchProjectId,
                    statement: jdAnchor?.quote,
                    origin: "jd",
                    jdVersionId: jd?.id,
                    anchor: jdAnchor,
                  }),
                )
              }
            >
              Add selected JD requirement
            </button>
            <label>
              Manager-added requirement
              <textarea
                value={manager}
                onChange={(e) => setManager(e.target.value)}
              />
            </label>
            <button
              disabled={!manager.trim() || busy}
              onClick={() =>
                perform(
                  () =>
                    addRequirementAction({
                      searchProjectId,
                      statement: manager,
                      origin: "manager_statement",
                    }),
                  () => setManager(""),
                )
              }
            >
              Add manager requirement
            </button>
          </details>
          <p>
            Missing evidence means unknown. It does not establish that the
            candidate lacks a qualification.
          </p>
        </aside>
        <div className="review-pages" ref={pages}>
          {(["cv", "jd"] as const).map((side) => {
            const doc = side === "cv" ? cv : jd;
            return (
              <section className={`review-document review-${side}`} key={side}>
                <header>
                  <h2>{side.toUpperCase()}</h2>
                  <small>
                    {doc
                      ? `${doc.extractionStatus} · ${doc.id.slice(0, 12)}`
                      : "No document"}
                  </small>
                  {doc?.originalFileId && (
                    <a
                      href={`/documents/${doc.id}/original${doc.mediaType === "application/pdf" ? "?view=1" : ""}`}
                      target="_blank"
                      rel="noopener"
                    >
                      Original
                    </a>
                  )}
                </header>
                <div
                  className="review-scroll"
                  ref={side === "cv" ? left : right}
                >
                  {doc &&
                    (manual ? (
                      <textarea
                        aria-label={`Select ${side.toUpperCase()} passage`}
                        readOnly
                        value={doc.text}
                        onSelect={(e) => {
                          const el = e.currentTarget;
                          if (el.selectionEnd > el.selectionStart) {
                            const a = {
                              start: el.selectionStart,
                              end: el.selectionEnd,
                              quote: doc.text.slice(
                                el.selectionStart,
                                el.selectionEnd,
                              ),
                            };
                            if (side === "cv") setCvAnchor(a);
                            else setJdAnchor(a);
                          }
                        }}
                      />
                    ) : (
                      <MarkedText
                        text={doc.text}
                        links={visible}
                        side={side}
                        select={pick}
                      />
                    ))}
                </div>
              </section>
            );
          })}
          <svg
            className="review-ribbons"
            aria-label="Connections between visible source passages"
          >
            {ribbons.map((r) => (
              <path
                key={r.id}
                d={r.path}
                fill={r.id === selected?.id ? "#147e81" : "#75acac"}
                stroke="#296b70"
                strokeWidth="1"
                strokeDasharray={
                  reviewState(r.id) === "suggested" ? "4 3" : undefined
                }
                opacity=".38"
              />
            ))}
          </svg>
        </div>
        {context && (
          <aside className="review-context">
            <h2>{requirement?.label ?? "Review context"}</h2>
            <p>{requirement?.statement}</p>
            <p>
              {stale ? "Stale" : "Current"} ·{" "}
              {
                links.filter((l) => l.payload.requirementId === requirementId)
                  .length
              }{" "}
              relationships
            </p>
            {links
              .filter((l) => l.payload.requirementId === requirementId)
              .map((l) => (
                <button
                  className={l.id === selected?.id ? "selected" : ""}
                  key={l.id}
                  onClick={() => pick(l.id)}
                >
                  {l.payload.assessment} · {reviewState(l.id)} · {l.provenance}
                </button>
              ))}
            {selected && (
              <article>
                <h3>
                  {selected.payload.assessment} · {reviewState(selected.id)}
                </h3>
                <blockquote>{selected.payload.cvAnchor.quote}</blockquote>
                <blockquote>
                  {selected.payload.jdAnchor?.quote ??
                    "Manager-added requirement; no invented JD passage."}
                </blockquote>
                <p>{selected.payload.explanation}</p>
                <p>
                  <strong>Limitations:</strong>{" "}
                  {selected.payload.limitation ||
                    "No limitation recorded; assess support yourself."}
                </p>
                <p>
                  Acceptance approves this relationship. It does not verify
                  employment, source authenticity or qualifications.
                </p>
                <button
                  disabled={!!blocked}
                  onClick={() => {
                    setManual(true);
                    setCvAnchor(selected.payload.cvAnchor);
                    setJdAnchor(selected.payload.jdAnchor);
                    setExplanation(selected.payload.explanation);
                    setLimitation(selected.payload.limitation);
                    setAssessment(selected.payload.assessment);
                    setReplaces(selected.id);
                  }}
                >
                  Correct connection
                </button>
                <details>
                  <summary>Review history</summary>
                  {w.reviews
                    .filter((r) => r.linkId === selected.id)
                    .map((r) => (
                      <p key={r.id}>
                        {r.createdAt} · {r.actor} · {r.decision}
                        <br />
                        {r.note}
                      </p>
                    ))}
                </details>
              </article>
            )}
            <label>
              Review note / follow-up draft
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <p>Draft only. No communication is sent.</p>
            {manual && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!comparison || !cvAnchor) return;
                  perform(
                    () =>
                      addConnectionAction({
                        comparisonId: comparison.id,
                        replacesId: replaces,
                        link: {
                          requirementId,
                          cvAnchor,
                          jdAnchor:
                            requirement?.origin === "jd" ? jdAnchor : null,
                          assessment,
                          explanation,
                          limitation,
                        },
                      }),
                    (id) => {
                      setManual(false);
                      setReplaces(undefined);
                      navigate({ link: id });
                    },
                  );
                }}
              >
                <h3>
                  {replaces
                    ? "Correct relationship"
                    : "Create manual relationship"}
                </h3>
                <p>
                  CV selection:{" "}
                  {cvAnchor?.quote ??
                    "Select text in the CV pane using mouse or keyboard."}
                </p>
                <p>
                  JD selection:{" "}
                  {jdAnchor?.quote ?? "Select text in the JD pane."}
                </p>
                <label>
                  Assessment
                  <select
                    aria-label="Assessment"
                    value={assessment}
                    onChange={(e) =>
                      setAssessment(e.target.value as LinkInput["assessment"])
                    }
                  >
                    {["relevant", "partial", "contradictory", "unknown"].map(
                      (a) => (
                        <option key={a}>{a}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Explanation
                  <textarea
                    required
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                  />
                </label>
                <label>
                  Limitations
                  <textarea
                    value={limitation}
                    onChange={(e) => setLimitation(e.target.value)}
                  />
                </label>
                <button
                  disabled={
                    !!blocked ||
                    !cvAnchor ||
                    !requirement ||
                    (requirement.origin === "jd" && !jdAnchor)
                  }
                >
                  Save relationship
                </button>
              </form>
            )}
            <Link href={`/searches/${searchProjectId}/review-shortlist`}>
              Prepare reviewed shortlist
            </Link>
            <ReviewWheel actions={actions} />
            <details>
              <summary>References and backlinks</summary>
              <Link
                href={`/searches/${searchProjectId}/graph?node=${encodeURIComponent(`candidate:${w.candidate.id}`)}`}
              >
                Explore candidate connections
              </Link>
              <br />
              <Link
                href={`/searches/${searchProjectId}/candidates/${w.candidate.id}`}
              >
                Candidate record
              </Link>
              <br />
              <Link href={`/searches/${searchProjectId}/guide`}>
                Search brief
              </Link>
              {w.comparisons
                .filter(
                  (c) => c.cvVersionId === cv?.id || c.jdVersionId === jd?.id,
                )
                .map((c) => (
                  <p key={c.id}>
                    <Link href={`${base}?comparison=${c.id}`}>
                      Comparison · {c.createdAt}
                    </Link>
                  </p>
                ))}
            </details>
          </aside>
        )}
      </div>
      {summary && comparison && (
        <section className="review-output">
          <h2>Recruiter review · {w.candidate.name}</h2>
          <p>
            {stale ? "Historical / stale" : "Current"} comparison{" "}
            {comparison.id}
            <br />
            CV {cv?.id} · JD {jd?.id}
          </p>
          <p>
            Only accepted connections appear below. Acceptance is relationship
            review, not independent verification.
          </p>
          {accepted.map((l) => (
            <article key={l.id}>
              <label>
                <input
                  type="checkbox"
                  checked={exportIds.includes(l.id)}
                  onChange={(e) =>
                    setExportIds(
                      e.target.checked
                        ? [...exportIds, l.id]
                        : exportIds.filter((id) => id !== l.id),
                    )
                  }
                />{" "}
                Include in export
              </label>
              <h3>
                {
                  requirements.find((r) => r.id === l.payload.requirementId)
                    ?.label
                }{" "}
                · {l.payload.assessment}
              </h3>
              <blockquote>{l.payload.cvAnchor.quote}</blockquote>
              <p>
                CV characters {l.payload.cvAnchor.start}–
                {l.payload.cvAnchor.end}; JD{" "}
                {l.payload.jdAnchor
                  ? `${l.payload.jdAnchor.start}–${l.payload.jdAnchor.end}`
                  : "manager addition"}
              </p>
              <p>{l.payload.explanation}</p>
              <p>Limitations: {l.payload.limitation || "None recorded"}</p>
            </article>
          ))}
          <h3>Unresolved requirements</h3>
          {requirements
            .filter(
              (r) =>
                !accepted.some(
                  (l) =>
                    l.payload.requirementId === r.id &&
                    l.payload.assessment === "relevant",
                ),
            )
            .map((r) => (
              <p key={r.id}>
                {r.statement} — unresolved: no accepted relevant connection;
                review any partial or conflicting evidence.
              </p>
            ))}
          <label>
            Recruiter-authored conclusion
            <textarea
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
            />
          </label>
          <button
            disabled={!!blocked}
            onClick={() =>
              perform(() =>
                saveReviewConclusionAction({
                  comparisonId: comparison.id,
                  conclusion,
                }),
              )
            }
          >
            Save conclusion
          </button>
          <p>Saved conclusion: {comparison.conclusion || "None"}</p>
          <button onClick={() => window.print()}>Print review</button>
          <button
            disabled={
              !exportIds.some((id) => accepted.some((l) => l.id === id))
            }
            onClick={exportReview}
          >
            Export selected reviewed material
          </button>
        </section>
      )}
    </div>
  );
}
