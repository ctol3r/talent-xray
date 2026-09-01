import Link from "next/link";
import { getDb } from "@/lib/db/client";
import {
  THREAD_LABELS,
  type ActionThread,
  type NextBestAction,
} from "@/lib/domain/next-best-action";
import {
  buildProjectSnapshot,
  getNextBestActions,
} from "@/lib/services/search-projects";
import { getHmBrief } from "@/lib/services/guidance";
import { listCandidates } from "@/lib/services/candidates";
import { generateHmBriefAction } from "@/lib/actions/guidance";
import { ArtifactMeta } from "@/components/artifact-meta";
import { GenerateButton } from "@/components/generate-button";
import { HmFeedbackForm } from "@/components/hm-feedback-form";
import {
  ProvenanceBadge,
  Card,
  EmptyState,
  PageHeader,
  Tag,
} from "@/components/ui";

export const metadata = { title: "Guide" };

const PRIORITY_TONE: Record<number, "bad" | "warn" | "neutral"> = {
  1: "bad",
  2: "warn",
  3: "neutral",
};

function ThreadColumn({
  thread,
  actions,
}: {
  thread: ActionThread;
  actions: NextBestAction[];
}) {
  const items = actions.filter((a) => a.thread === thread);
  return (
    <div className="rounded border border-edge bg-panel p-4">
      <h3 className="text-[13px] font-semibold">{THREAD_LABELS[thread]}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-ink-muted">
          Nothing urgent on this thread.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((action) => (
            <li key={action.id} className="flex items-start gap-2">
              <Tag tone={PRIORITY_TONE[action.priority]}>
                P{action.priority}
              </Tag>
              <div>
                <Link
                  href={action.href}
                  className="text-[13px] font-medium hover:text-accent"
                >
                  {action.title}
                </Link>
                <p className="text-[12px] text-ink-muted">{action.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [actions, snapshot, brief, candidates] = await Promise.all([
    getNextBestActions(db, id),
    buildProjectSnapshot(db, id),
    getHmBrief(db, id),
    listCandidates(db, id),
  ]);
  const awaitingFeedback = candidates.filter(
    (c) =>
      c.stage === "hm_review" &&
      c.disposition === "active" &&
      (c.hmFeedback ?? []).length === 0,
  );
  const payload = brief?.payload;

  return (
    <div>
      <PageHeader
        title="Guide"
        description="The search's three working relationships in one place: what to do next for the pipeline, with the hiring manager, and with each candidate — plus the HM brief and evidence-anchored feedback capture."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ThreadColumn thread="pipeline" actions={actions} />
        <ThreadColumn thread="hiring_manager" actions={actions} />
        <ThreadColumn thread="candidate" actions={actions} />
      </div>

      <div className="mt-6">
        <Card
          title={
            <span className="flex items-center justify-between">
              <span>Hiring-manager brief</span>
              <GenerateButton
                action={generateHmBriefAction}
                input={{ searchProjectId: id }}
                label={payload ? "Regenerate brief" : "Generate brief"}
                regenerate={Boolean(payload)}
              />
            </span>
          }
        >
          {!payload ? (
            <p className="text-[13px] text-ink-muted">
              A three-minute, HM-facing brief: the agreed bar with provenance,
              calibration questions, and how to give feedback the search can
              use. Best generated after the intake is complete.
              {!snapshot.intakeComplete && " (Intake is not complete yet.)"}
            </p>
          ) : (
            <div className="space-y-4">
              <ArtifactMeta
                meta={brief?.meta ?? null}
                kind="hm_brief"
                ownerId={id}
                payload={payload}
              />
              <p className="text-[13.5px] leading-6">{payload.headline}</p>
              <div>
                <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                  What we are looking for
                </h4>
                <ul className="space-y-1">
                  {payload.whatWeAreLookingFor.map((item) => (
                    <li key={item.text} className="text-[13px]">
                      {item.text} <ProvenanceBadge source={item.provenance} />
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                  Calibration questions
                </h4>
                <ul className="space-y-1.5">
                  {payload.calibrationQuestions.map((q) => (
                    <li key={q.question} className="text-[13px]">
                      {q.question}
                      <span className="block text-[12px] text-ink-muted">
                        {q.whyItMatters}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                  How to review candidates
                </h4>
                <p className="text-[13px]">{payload.reviewInstructions}</p>
              </div>
              <div>
                <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                  Process expectations
                </h4>
                <ul className="list-disc pl-5 text-[13px]">
                  {payload.processExpectations.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              {payload.openQuestions.length > 0 && (
                <div>
                  <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                    Still open — only you can settle these
                  </h4>
                  <ul className="list-disc pl-5 text-[13px]">
                    {payload.openQuestions.map((q) => (
                      <li key={q}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="text-[11.5px] text-ink-faint">
                Share it your way — print this page or copy the content; nothing
                is sent automatically.
              </p>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card title={`Awaiting HM feedback (${awaitingFeedback.length})`}>
          {awaitingFeedback.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              No candidates are sitting with the hiring manager without
              feedback.
            </p>
          ) : (
            <div className="space-y-5">
              {awaitingFeedback.map((candidate) => (
                <div key={candidate.id}>
                  <p className="mb-1.5 text-[13px] font-medium">
                    <Link
                      href={`/searches/${id}/candidates/${candidate.id}`}
                      className="hover:text-accent"
                    >
                      {candidate.name}
                    </Link>
                    {candidate.currentTitle ? (
                      <span className="ml-2 text-[12px] text-ink-muted">
                        {candidate.currentTitle}
                      </span>
                    ) : null}
                  </p>
                  <HmFeedbackForm candidateId={candidate.id} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
