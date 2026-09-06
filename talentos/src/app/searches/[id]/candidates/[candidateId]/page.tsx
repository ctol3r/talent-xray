import { ReviewResumeLink } from "@/components/review-resume-link";
import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { outreachSequences } from "@/lib/db/schema";
import { getCandidateEvidence } from "@/lib/services/artifacts";
import {
  getCandidate,
  getCandidateSources,
  getPipelineStages,
} from "@/lib/services/candidates";
import { listCandidateMessages } from "@/lib/services/workflow";
import { listCandidateSourceEvidence } from "@/lib/services/discovery";
import { listCandidatePackets } from "@/lib/services/guidance";
import {
  getRegistryMatch,
  prefillFromCandidate,
} from "@/lib/services/registries";
import {
  REGISTRY_LINK_OUTS,
  REGISTRY_MATCH_EXPLAINER,
  REGISTRY_MATCH_LABEL,
  registryStatus,
} from "@/lib/registries";
import { RegistryMatchCard } from "@/components/registry-match";
import { generateCandidatePacketAction } from "@/lib/actions/guidance";
import { HmFeedbackForm } from "@/components/hm-feedback-form";
import { PACKET_KINDS, PACKET_KIND_LABELS } from "@/lib/core/enums";
import {
  generateEvidenceAlignmentAction,
  generateOutreachAction,
} from "@/lib/actions/generate";
import { kickoffCandidateCrewAction } from "@/lib/actions/crew";
import { ArtifactMeta } from "@/components/artifact-meta";
import {
  CandidateDataControls,
  NextActionForm,
  NotesForm,
  StageSelect,
} from "@/components/candidate-forms";
import { GenerateButton } from "@/components/generate-button";
import { MessageStatusSelect } from "@/components/outreach-controls";
import { Card, PageHeader, Tag } from "@/components/ui";
import type { EvidenceStatus } from "@/lib/core/enums";

const EVIDENCE_TONE: Record<EvidenceStatus, "ok" | "warn" | "neutral" | "bad"> =
  {
    strong: "ok",
    partial: "warn",
    missing: "neutral",
    contradictory: "bad",
    unknown: "neutral",
  };

export default async function CandidatePage({
  params,
}: {
  params: Promise<{ id: string; candidateId: string }>;
}) {
  const { id, candidateId } = await params;
  const db = getDb();
  const candidate = await getCandidate(db, candidateId);
  if (!candidate || candidate.searchProjectId !== id) notFound();
  const [
    stages,
    sources,
    sourceEvidence,
    evidence,
    messages,
    packets,
    registryMatch,
  ] = await Promise.all([
    getPipelineStages(db, id),
    getCandidateSources(db, candidateId),
    listCandidateSourceEvidence(db, candidateId),
    getCandidateEvidence(db, candidateId),
    listCandidateMessages(db, candidateId),
    listCandidatePackets(db, candidateId),
    getRegistryMatch(db, candidateId),
  ]);
  const [sequence] = await db
    .select()
    .from(outreachSequences)
    .where(eq(outreachSequences.candidateId, candidateId))
    .orderBy(desc(outreachSequences.createdAt))
    .limit(1);

  return (
    <div>
      <PageHeader
        title={candidate.name}
        description={
          [
            candidate.currentTitle,
            candidate.currentCompany,
            candidate.geography,
          ]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        actions={
          <div className="flex items-start gap-3">
            <ReviewResumeLink
              className="underline text-teal-800"
              href={`/searches/${id}/candidates/${candidateId}/review`}
            >
              Review CV ↔ JD
            </ReviewResumeLink>
            <GenerateButton
              action={kickoffCandidateCrewAction}
              input={{ candidateId }}
              label="Queue candidate agents"
              regenerate
            />
            <StageSelect
              candidateId={candidateId}
              currentStage={candidate.stage}
              stages={stages}
            />
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card
            title={
              <span className="flex items-center justify-between">
                <span>Evidence alignment</span>
              </span>
            }
          >
            <div className="mb-3 flex justify-end">
              <GenerateButton
                action={generateEvidenceAlignmentAction}
                input={{ candidateId }}
                label={evidence ? "Re-align evidence" : "Align evidence"}
                regenerate={Boolean(evidence)}
              />
            </div>
            {!evidence ? (
              <p className="text-[13px] text-ink-muted">
                Compare this candidate&apos;s observable, job-related evidence
                against the success profile. Advisory decision support — never
                an automated decision.
              </p>
            ) : (
              <div className="space-y-4">
                <ArtifactMeta
                  meta={evidence.meta}
                  kind="evidence"
                  ownerId={candidateId}
                  payload={evidence.payload}
                />
                <div className="rounded border border-accent/30 bg-accent-soft/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Tag tone="accent">
                      {evidence.payload.reviewPriority.suggestion.replaceAll(
                        "_",
                        " ",
                      )}
                    </Tag>
                    <span className="text-[11.5px] text-ink-faint">
                      advisory review priority — you decide
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] text-ink-muted">
                    {evidence.payload.reviewPriority.rationale}
                  </p>
                </div>
                <ul className="space-y-2">
                  {evidence.payload.items.map((item) => (
                    <li
                      key={item.id}
                      className="rounded border border-edge bg-panel2/50 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13px] font-medium">
                          {item.criterion}
                        </span>
                        <Tag tone={EVIDENCE_TONE[item.status]}>
                          {item.status}
                        </Tag>
                      </div>
                      <p className="mt-1 text-[12.5px] text-ink-muted">
                        {item.evidenceText}
                      </p>
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-accent hover:underline"
                        >
                          source
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
                {evidence.payload.questionsToValidate.length > 0 && (
                  <div>
                    <h3 className="mb-1.5 text-[11.5px] font-semibold tracking-wider text-ink-faint uppercase">
                      Validate on the screen
                    </h3>
                    <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-muted">
                      {evidence.payload.questionsToValidate.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {evidence.payload.outreachAngle && (
                  <p className="text-[13px]">
                    <span className="text-ink-faint">Outreach angle: </span>
                    {evidence.payload.outreachAngle}
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card title="Outreach">
            <div className="mb-3 flex justify-end">
              <GenerateButton
                action={generateOutreachAction}
                input={{ candidateId }}
                label={
                  sequence ? "Regenerate sequence" : "Draft outreach sequence"
                }
                regenerate={Boolean(sequence)}
              />
            </div>
            {!sequence ? (
              <p className="text-[13px] text-ink-muted">
                Drafts a personalized multi-step sequence citing only recorded
                evidence, written for the research-backed audience persona of
                this candidate&apos;s segment (the audience is researched on the
                web first when no personas exist yet — never the individual).
                Nothing sends automatically — copy out what you use.
              </p>
            ) : (
              <div className="space-y-3">
                {sequence.payload.personaLabel && (
                  <Tag tone="neutral">
                    persona: {sequence.payload.personaLabel}
                  </Tag>
                )}
                <p className="text-[12.5px] text-ink-muted italic">
                  {sequence.payload.cadenceRationale}
                </p>
                {sequence.payload.steps.map((step) => {
                  const message = messages.find(
                    (m) => m.kind === step.kind && m.sequenceId === sequence.id,
                  );
                  return (
                    <details
                      key={step.id}
                      className="rounded border border-edge bg-panel2/50 px-3 py-2"
                    >
                      <summary className="flex cursor-pointer items-center justify-between gap-2">
                        <span className="text-[13px] font-medium">
                          {step.kind.replaceAll("_", " ")} · day{" "}
                          {step.dayOffset}
                        </span>
                        {message && (
                          <MessageStatusSelect
                            messageId={message.id}
                            status={message.status}
                          />
                        )}
                      </summary>
                      {step.subjectVariants.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          {step.subjectVariants.map((subject, i) => (
                            <p key={i} className="text-[12.5px] text-ink-muted">
                              Subject {i + 1}: {subject}
                            </p>
                          ))}
                        </div>
                      )}
                      <pre className="mt-2 rounded border border-edge bg-canvas p-3 font-sans text-[13px] whitespace-pre-wrap">
                        {step.body}
                      </pre>
                      {step.citations.length > 0 && (
                        <div className="mt-2">
                          <h4 className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">
                            Personalization citations
                          </h4>
                          <ul className="mt-1 space-y-0.5 text-[12px] text-ink-faint">
                            {step.citations.map((citation, i) => (
                              <li key={i}>
                                “{citation.personalization}” ←{" "}
                                {citation.evidence}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </details>
                  );
                })}
              </div>
            )}
          </Card>

          {candidate.resumeText && (
            <Card title="Pasted profile / resume">
              <pre className="max-h-72 overflow-y-auto rounded border border-edge bg-canvas p-3 font-mono text-[12px] whitespace-pre-wrap text-ink-muted">
                {candidate.resumeText}
              </pre>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <RegistryMatchCard
            candidateId={candidateId}
            configured={registryStatus().nppes.configured}
            mode={registryStatus().nppes.mode}
            linkOut={REGISTRY_LINK_OUTS.nppes}
            label={REGISTRY_MATCH_LABEL}
            explainer={REGISTRY_MATCH_EXPLAINER}
            prefill={prefillFromCandidate(candidate, sources)}
            match={
              registryMatch
                ? {
                    registryId: registryMatch.registryId,
                    matchedAt: registryMatch.matchedAt,
                    matchStrength: registryMatch.matchStrength,
                    record: registryMatch.matchedFields,
                  }
                : null
            }
          />
          <Card title="Next action">
            <NextActionForm
              candidateId={candidateId}
              nextAction={candidate.nextAction}
              nextActionDue={candidate.nextActionDue}
            />
          </Card>
          <Card title="Sources">
            {sources.length === 0 ? (
              <p className="text-[13px] text-ink-muted">
                No profile URLs saved.
              </p>
            ) : (
              <ul className="space-y-1">
                {sources.map((source) => (
                  <li key={source.id}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12.5px] break-all text-accent hover:underline"
                    >
                      {source.url}
                    </a>
                    {(source.label || source.addedVia) && (
                      <span className="ml-2 text-[11px] text-ink-faint">
                        {[source.label, source.addedVia]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11.5px] text-ink-faint">
              Links open at the source. Pages are never fetched or stored.
            </p>
          </Card>
          {sourceEvidence.length > 0 && (
            <Card title="Source evidence">
              <ul className="space-y-3">
                {sourceEvidence.map((item) => (
                  <li key={item.id} className="text-[12.5px]">
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <Tag
                        tone={
                          item.verificationStatus === "recruiter_verified"
                            ? "ok"
                            : "warn"
                        }
                      >
                        {item.verificationStatus === "recruiter_verified"
                          ? "verified by you"
                          : "unverified"}
                      </Tag>
                      {item.provider && (
                        <span className="text-[11px] text-ink-faint">
                          {item.provider}
                          {item.providerRank ? ` · #${item.providerRank}` : ""}
                        </span>
                      )}
                      {item.provenance === "imported" && (
                        <span className="text-[11px] text-warn">
                          vendor data from {item.retrievedAt.slice(0, 10)} —
                          decays
                        </span>
                      )}
                    </div>
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-accent hover:underline"
                    >
                      {item.title ?? item.sourceUrl}
                    </a>
                    {item.snippet && (
                      <p className="mt-0.5 text-[12px] text-ink-muted">
                        “{item.snippet}”
                      </p>
                    )}
                    {item.query && (
                      <p className="mt-0.5 font-mono text-[11px] text-ink-faint">
                        query: {item.query}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] text-ink-faint">
                Search-result snippets are evidence about a source — not resume
                content. Verify on the source page before relying on one.
              </p>
            </Card>
          )}
          <Card title="Recruiter notes">
            <NotesForm
              candidateId={candidateId}
              notes={candidate.recruiterNotes}
            />
          </Card>
          <Card title="Candidate packets">
            <p className="text-[12.5px] text-ink-muted">
              Candidate-facing drafts you share manually — process transparency,
              interview prep, offer explainers. Nothing sends automatically.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PACKET_KINDS.map((kind) => (
                <GenerateButton
                  key={kind}
                  action={generateCandidatePacketAction}
                  input={{ candidateId, kind }}
                  label={
                    packets.some((p) => p.kind === kind)
                      ? `Redraft ${PACKET_KIND_LABELS[kind].toLowerCase()}`
                      : `Draft ${PACKET_KIND_LABELS[kind].toLowerCase()}`
                  }
                  regenerate={packets.some((p) => p.kind === kind)}
                />
              ))}
            </div>
            {packets.map((packet) => (
              <div
                key={packet.id}
                className="mt-3 rounded border border-edge2 bg-canvas p-3"
              >
                <p className="text-[13px] font-semibold">
                  {packet.payload.title}{" "}
                  <span className="ml-1 text-[11px] font-normal text-ink-faint">
                    {PACKET_KIND_LABELS[packet.kind]} ·{" "}
                    {packet.meta?.provider ?? "draft"}
                  </span>
                </p>
                {packet.payload.sections.map((section) => (
                  <div key={section.title} className="mt-2">
                    <p className="text-[12px] font-semibold text-ink-muted">
                      {section.title}
                    </p>
                    <p className="whitespace-pre-wrap text-[12.5px]">
                      {section.body}
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </Card>
          <Card title="Hiring-manager feedback">
            {(candidate.hmFeedback ?? []).length > 0 && (
              <ul className="mb-3 space-y-1.5">
                {(candidate.hmFeedback ?? []).map((entry) => (
                  <li key={entry.at} className="text-[12.5px]">
                    <Tag
                      tone={
                        entry.decision === "advance"
                          ? "ok"
                          : entry.decision === "hold"
                            ? "warn"
                            : "bad"
                      }
                    >
                      {entry.decision}
                    </Tag>{" "}
                    <span className="text-ink-muted">{entry.evidenceNote}</span>
                    <span className="ml-1 text-[11px] text-ink-faint">
                      {entry.at.slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <HmFeedbackForm candidateId={candidateId} />
          </Card>
          <Card title="Close & onboarding">
            <p className="text-[13px] text-ink-muted">
              Offer, close plan, and onboarding live in the{" "}
              <Link
                href={`/searches/${id}/close`}
                className="text-accent hover:underline"
              >
                Close module
              </Link>
              . Interview scorecards live in{" "}
              <Link
                href={`/searches/${id}/interviews`}
                className="text-accent hover:underline"
              >
                Interviews
              </Link>
              .
            </p>
          </Card>
          <Card title="Data controls">
            <CandidateDataControls candidateId={candidateId} />
            <p className="mt-2 text-[11.5px] text-ink-faint">
              Candidate data is sensitive: export everything held about this
              person, or delete it permanently.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
