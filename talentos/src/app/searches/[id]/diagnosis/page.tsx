import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { getSearchProject } from "@/lib/services/search-projects";
import { loadDiagnosisView } from "@/lib/hsal/view";
import {
  applyProfileChangeAction,
  captureBeliefAction,
  recordExperimentResultAction,
  recordPostInterventionAction,
  reviseBeliefAction,
  runDiagnosisAction,
  saveLearningAction,
  selectTestAction,
} from "@/lib/actions/hsal";
import {
  CaptureBeliefForm,
  DiagnosisAction,
  ReviseBeliefForm,
} from "@/components/diagnosis-actions";
import { Card, EmptyState, KeyValue, PageHeader, Tag } from "@/components/ui";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  formatPct,
} from "@talentos/hsal-adapter";
import { SP104_ID, sp104 } from "../../../../../fixtures/sp104";
import { PRODUCT_NAME } from "@/lib/product";

export const metadata = { title: "Search Diagnosis" };
export const dynamic = "force-dynamic";

const pct = (n: number | undefined) =>
  n === undefined ? "—" : `${Math.round(n * 100)}%`;
const supportTone = (s: string | undefined) =>
  (s === "high" ? "warn" : s === "medium" ? "accent" : "neutral") as
    "warn" | "accent" | "neutral";

export default async function DiagnosisPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const project = await getSearchProject(db, id);
  if (!project) notFound();
  const v = await loadDiagnosisView(db, id);
  const isDemo = id === SP104_ID;
  const belief = v.beliefs.find(
    (b) => b.status === "active" || b.status === "contested",
  );
  const selected = v.interventions.find((i) => i.status === "selected");
  const experimentEvidence = v.evidence.filter(
    (e) => e.sourceKind === "experiment",
  );
  const profileChanged = v.evidence.some((e) =>
    e.sourceRef?.startsWith("talentos:success-profile-change"),
  );
  const profileBelief = v.beliefs.find((b) => b.id.endsWith("-PROFILE"));
  const strongest = v.models[0];

  return (
    <div>
      <PageHeader
        title="Search Diagnosis"
        description="Why is this search underperforming, what competing explanations exist, and what is the best next experiment to reduce uncertainty? Your beliefs are yours: nothing here changes your confidence for you."
        actions={
          v.status.configured && v.status.reachable ? (
            <DiagnosisAction
              action={runDiagnosisAction}
              input={{ searchProjectId: id }}
              label={v.bound ? "Re-run diagnosis" : "Run diagnosis"}
            />
          ) : null
        }
      />

      {!v.status.configured && (
        <Card title="Connect HSAL">
          <p className="text-sm text-ink-muted">
            The diagnosis loop is held in HSAL (Human State Access Layer), a
            separate local runtime. Start its gateway (<code>pnpm dev</code> in
            the HSAL repository), issue a token with{" "}
            <code>pnpm hsal auth issue talentos</code>, and set{" "}
            <code>HSAL_TOKEN</code> in {PRODUCT_NAME}&apos;s environment.
            Gateway: {v.status.baseUrl}.
          </p>
        </Card>
      )}
      {v.status.configured && !v.status.reachable && (
        <Card title="HSAL gateway unreachable">
          <p className="text-sm text-bad">
            {v.status.error ?? `Cannot reach ${v.status.baseUrl}`}
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* ------------------------------------------------ WHAT'S HAPPENING */}
        <Card title="What's happening?">
          {!v.snapshot ? (
            <EmptyState
              title="No pipeline snapshot yet"
              detail="Import or record a pipeline snapshot to start."
            />
          ) : (
            <div className="space-y-2">
              <ul className="grid grid-cols-3 gap-x-4 gap-y-1 text-sm">
                {PIPELINE_STAGES.map((s) => (
                  <li key={s}>
                    <span className="font-semibold tabular-nums">
                      {v.snapshot!.counts[s]}
                    </span>{" "}
                    <span className="text-ink-muted">
                      {PIPELINE_STAGE_LABELS[s].toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="text-xs text-ink-muted">
                {v.snapshot.periodStart} → {v.snapshot.periodEnd} · source{" "}
                {v.snapshot.source}
              </div>
              <KeyValue
                label="Reply rate"
                value={formatPct(v.metrics?.outreachReplyRate)}
              />
              <KeyValue
                label="Positive reply rate"
                value={formatPct(v.metrics?.positiveReplyRate)}
              />
              <KeyValue
                label="Recruiter screen → HM"
                value={formatPct(v.metrics?.recruiterScreenToHMRate)}
              />
              <KeyValue
                label="HM → onsite"
                value={formatPct(v.metrics?.hmToOnsiteRate, 0)}
              />
              {v.largestDrop && (
                <p className="text-sm">
                  Largest observed drop: <strong>{v.largestDrop.label}</strong>{" "}
                  ({v.largestDrop.fromCount} → {v.largestDrop.toCount})
                </p>
              )}
              {v.currentState && (
                <div className="text-xs text-ink-faint">
                  Recorded in HSAL as state {v.currentState.id} · counts
                  observed, rates inferred
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ------------------------------------------------ WHAT DO YOU THINK */}
        <Card title="What do you think?">
          {!v.status.configured || !v.status.reachable ? (
            <p className="text-sm text-ink-muted">
              Connect HSAL to record your belief.
            </p>
          ) : belief ? (
            <div className="space-y-2">
              <blockquote className="border-l-2 border-edge2 pl-3 text-sm">
                “{belief.statement}”
              </blockquote>
              <div className="text-3xl font-bold tabular-nums">
                {pct(belief.confidence)}
              </div>
              <div className="text-xs text-ink-muted">
                Your confidence · {belief.id} · held by {belief.holderActorId}
              </div>
              {v.revisions
                .filter((r) => r.beliefId === belief.id)
                .map((r) => (
                  <div key={r.id} className="text-xs text-ink-muted">
                    Revised {pct(r.previousConfidence)} → {pct(r.newConfidence)}
                    : {r.reason}
                  </div>
                ))}
              {profileBelief && (
                <div className="mt-2 border-t border-edge pt-2">
                  <blockquote className="border-l-2 border-edge2 pl-3 text-sm">
                    “{profileBelief.statement}”
                  </blockquote>
                  <div className="text-xl font-bold tabular-nums">
                    {pct(profileBelief.confidence)}
                  </div>
                  <div className="text-xs text-ink-muted">
                    New belief · {profileBelief.id}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <CaptureBeliefForm
              action={captureBeliefAction}
              searchProjectId={id}
              {...(isDemo
                ? {
                    defaultStatement: sp104.belief.statement,
                    defaultConfidence: sp104.belief.confidence,
                    id: sp104.belief.id,
                  }
                : {})}
            />
          )}
        </Card>

        {/* ------------------------------------------------ WHAT ELSE COULD EXPLAIN IT */}
        <Card title="What else could explain it?">
          {v.models.length === 0 ? (
            <EmptyState
              title="No competing explanations yet"
              detail="Run the diagnosis to generate them from the pipeline, candidate and hiring-manager evidence."
            />
          ) : (
            <ul className="space-y-3">
              {v.models.map((m) => (
                <li key={m.id} className="rounded border border-edge p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{m.name}</span>
                    <span className="flex gap-1">
                      <Tag tone={supportTone(m.assessment?.support)}>
                        Support: {m.assessment?.support ?? "?"}
                      </Tag>
                      <Tag>{m.status}</Tag>
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{m.explanation}</p>
                  {m.assessment?.reasoning && (
                    <p className="mt-1 text-xs">{m.assessment.reasoning}</p>
                  )}
                  {m.predictions[0] && (
                    <p className="mt-1 text-xs text-ink-faint">
                      Predicts: {m.predictions[0].statement}{" "}
                      {m.predictions[0].resolved ? (
                        <Tag tone={m.predictions[0].outcome ? "ok" : "bad"}>
                          {m.predictions[0].outcome ? "confirmed" : "refuted"}
                        </Tag>
                      ) : null}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ------------------------------------------------ WHAT EVIDENCE SUPPORTS EACH VIEW */}
        <Card title="What evidence supports each view?">
          {v.evidence.length === 0 ? (
            <EmptyState
              title="No evidence linked yet"
              detail="Candidate observations and hiring-manager feedback appear here after the diagnosis runs."
            />
          ) : (
            <div className="space-y-2">
              {strongest && (
                <p className="text-xs text-ink-muted">
                  <strong>{strongest.name}</strong>:{" "}
                  {strongest.evidenceForIds.length} for,{" "}
                  {strongest.evidenceAgainstIds.length} against.
                </p>
              )}
              <ul className="max-h-80 space-y-1 overflow-y-auto text-xs">
                {v.evidence.map((e) => (
                  <li key={e.id} className="border-b border-edge pb-1">
                    <span className="text-ink-faint">{e.id}</span>{" "}
                    <Tag>{e.sourceKind ?? e.sourceType}</Tag>{" "}
                    <Tag>{e.epistemicStatus}</Tag>
                    <div>{e.content}</div>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-faint">
                HM feedback is recorded as what the HM said — observed
                behaviour, not a verdict on candidate quality.
              </p>
            </div>
          )}
        </Card>

        {/* ------------------------------------------------ WHAT SHOULD WE TEST NEXT */}
        <Card title="What should we test next?">
          {!v.recommended ? (
            <EmptyState
              title="No test recommended yet"
              detail="Run the diagnosis to rank candidate experiments."
            />
          ) : (
            <div className="space-y-2">
              <div className="text-sm font-semibold">{v.recommended.name}</div>
              <p className="text-sm">{v.recommended.description}</p>
              {v.recommended.experiment && (
                <>
                  <KeyValue
                    label="Information gain"
                    value={v.recommended.experiment.expectedInformationGain.toUpperCase()}
                  />
                  <KeyValue
                    label="Cost"
                    value={v.recommended.cost.toUpperCase()}
                  />
                  <KeyValue
                    label="Reversibility"
                    value={v.recommended.reversibility.toUpperCase()}
                  />
                  <KeyValue
                    label="Duration"
                    value={v.recommended.experiment.durationEstimate}
                  />
                  <p className="text-xs text-ink-muted">
                    {v.recommended.experiment.rationale}
                  </p>
                </>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Tag
                  tone={v.recommended.status === "selected" ? "ok" : "accent"}
                >
                  {v.recommended.status}
                </Tag>
                {v.recommended.status === "proposed" && (
                  <DiagnosisAction
                    action={selectTestAction}
                    input={{
                      searchProjectId: id,
                      interventionId: v.recommended.id,
                    }}
                    label="Select test"
                  />
                )}
                {v.recommended.status === "selected" &&
                  experimentEvidence.length === 0 && (
                    <DiagnosisAction
                      action={recordExperimentResultAction}
                      input={{
                        searchProjectId: id,
                        interventionId: v.recommended.id,
                      }}
                      label={
                        isDemo
                          ? "Record result (seeded: 7/10 advanced)"
                          : "Record result"
                      }
                      tone="secondary"
                    />
                  )}
              </div>
              {experimentEvidence.length > 0 && (
                <div className="rounded border border-edge bg-panel2 p-2 text-xs">
                  <div className="font-semibold">Experiment result</div>
                  <ul className="list-disc pl-4">
                    {experimentEvidence.map((e) => (
                      <li key={e.id}>
                        {e.content.replace(/^\[[^\]]+\]\s*/, "")}
                      </li>
                    ))}
                  </ul>
                  {belief && (
                    <p className="mt-1 text-ink-muted">
                      Your belief still reads{" "}
                      <strong>{pct(belief.confidence)}</strong>. Nothing changes
                      it until you revise it below.
                    </p>
                  )}
                </div>
              )}
              {v.interventions.length > 1 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-ink-muted">
                    Other candidate tests ({v.interventions.length - 1})
                  </summary>
                  <ul className="mt-1 space-y-1">
                    {v.interventions
                      .filter((i) => i.id !== v.recommended!.id)
                      .map((i) => (
                        <li key={i.id}>
                          <strong>{i.name}</strong> · gain{" "}
                          {i.experiment?.expectedInformationGain} · cost{" "}
                          {i.cost} · score{" "}
                          {typeof i.parameters["score"] === "number"
                            ? (i.parameters["score"] as number).toFixed(2)
                            : "—"}
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </Card>

        {/* ------------------------------------------------ REVISE */}
        {belief && experimentEvidence.length > 0 && (
          <Card title="Revise what you think?">
            {v.revisions.some((r) => r.beliefId === belief.id) ? (
              <div className="space-y-2 text-sm">
                <p>
                  Revised to <strong>{pct(belief.confidence)}</strong>. History
                  is kept in HSAL.
                </p>
                {!profileBelief && isDemo && (
                  <DiagnosisAction
                    action={captureBeliefAction}
                    input={{
                      searchProjectId: id,
                      id: sp104.revision.newBelief.id,
                      statement: sp104.revision.newBelief.statement,
                      confidence: sp104.revision.newBelief.confidence,
                    }}
                    label={`Add belief: “${sp104.revision.newBelief.statement}” at ${pct(sp104.revision.newBelief.confidence)}`}
                    tone="secondary"
                  />
                )}
              </div>
            ) : (
              <ReviseBeliefForm
                action={reviseBeliefAction}
                searchProjectId={id}
                beliefId={belief.id}
                currentConfidence={belief.confidence}
                {...(isDemo
                  ? {
                      suggestedConfidence: sp104.revision.newConfidence,
                      suggestedReason: sp104.revision.reason,
                    }
                  : {})}
                evidenceIds={experimentEvidence.map((e) => e.id)}
              />
            )}
          </Card>
        )}

        {/* ------------------------------------------------ ACT + OBSERVE AGAIN */}
        {selected && experimentEvidence.length > 0 && (
          <Card title="Act, then observe again">
            <div className="space-y-2 text-sm">
              {profileChanged ? (
                <p>
                  Success Profile changed by you (recorded as user-asserted
                  evidence).
                </p>
              ) : isDemo ? (
                <DiagnosisAction
                  action={applyProfileChangeAction}
                  input={{ searchProjectId: id, interventionId: selected.id }}
                  label="Apply profile change (Go → transferable; title → Staff-equivalent scope)"
                  tone="secondary"
                  confirm={`This changes the SP104 Success Profile in ${PRODUCT_NAME}. HSAL will only record that you did it. Continue?`}
                />
              ) : (
                <p className="text-ink-muted">
                  Apply the change in the Profile module.
                </p>
              )}
              {v.trajectories.length === 0 ? (
                isDemo && profileChanged ? (
                  <DiagnosisAction
                    action={recordPostInterventionAction}
                    input={{ searchProjectId: id, interventionId: selected.id }}
                    label="Ingest post-intervention pipeline (seeded W9)"
                    tone="secondary"
                  />
                ) : null
              ) : (
                v.trajectories.map((t) => (
                  <div
                    key={t.id}
                    className="rounded border border-edge bg-panel2 p-2 text-xs"
                  >
                    <div className="font-semibold">Trajectory {t.id}</div>
                    <ul className="grid grid-cols-2 gap-x-4">
                      {t.outcomes
                        .filter((o) => o.interpretation)
                        .map((o) => (
                          <li key={o.key}>{o.interpretation}</li>
                        ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {/* ------------------------------------------------ WHAT DID WE LEARN */}
        <Card title="What did we learn?">
          {v.learnings.length > 0 ? (
            v.learnings.map((l) => (
              <div key={l.id} className="space-y-1 text-sm">
                <div className="font-semibold">{l.title}</div>
                <p>{l.statement}</p>
                <div className="text-xs text-ink-muted">
                  <Tag>{l.category}</Tag> confidence {pct(l.confidence)} · from
                  beliefs {l.originatingBeliefIds.join(", ")} · models{" "}
                  {l.originatingModelIds.join(", ")}
                </div>
              </div>
            ))
          ) : v.trajectories.length > 0 && isDemo ? (
            <DiagnosisAction
              action={saveLearningAction}
              input={{
                searchProjectId: id,
                evidenceIds: experimentEvidence.map((e) => e.id),
                originatingBeliefIds: v.beliefs.map((b) => b.id),
                originatingModelIds: strongest ? [strongest.id] : [],
              }}
              label="Save learning"
            />
          ) : (
            <EmptyState
              title="Nothing learned yet"
              detail="Learnings are written after an experiment result and a belief revision."
            />
          )}
        </Card>

        {/* ------------------------------------------------ PROVENANCE */}
        {v.events.length > 0 && (
          <Card title="Provenance" className="xl:col-span-2">
            <ul className="max-h-64 overflow-y-auto font-mono text-[11px] leading-5">
              {v.events.map((e, i) => (
                <li key={`${e.createdAt}-${i}`}>
                  <span className="text-ink-faint">
                    {e.createdAt.replace("T", " ").slice(0, 19)}
                  </span>{" "}
                  {e.type} <span className="text-ink-faint">{e.actorId}</span> →{" "}
                  {e.objectId}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
