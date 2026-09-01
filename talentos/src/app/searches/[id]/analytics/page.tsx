import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { outreachMessages } from "@/lib/db/schema";
import {
  computeFunnel,
  computeOutreachStats,
  computeTimeInStage,
} from "@/lib/domain/analytics";
import { diagnosePipeline } from "@/lib/domain/diagnosis";
import {
  getPipelineEvents,
  getPipelineStages,
  listCandidates,
} from "@/lib/services/candidates";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Analytics" };

function days(ms: number): string {
  return `${(ms / (24 * 3600 * 1000)).toFixed(1)}d`;
}

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const [stages, events, candidates] = await Promise.all([
    getPipelineStages(db, id),
    getPipelineEvents(db, id),
    listCandidates(db, id),
  ]);
  const messages =
    candidates.length > 0
      ? await db
          .select()
          .from(outreachMessages)
          .where(
            inArray(
              outreachMessages.candidateId,
              candidates.map((c) => c.id),
            ),
          )
      : [];
  const funnel = computeFunnel(stages, events);
  const timeInStage = computeTimeInStage(events);
  const outreach = computeOutreachStats(messages);
  const reached = new Map(funnel.map((f) => [f.key, f.reached]));
  const diagnosis = diagnosePipeline({
    identified: reached.get("identified") ?? 0,
    contacted: reached.get("contacted") ?? 0,
    responded: reached.get("responded") ?? 0,
    screens: reached.get("recruiter_screen") ?? 0,
    hmApprovals: reached.get("hm_review") ?? 0,
    interviews: reached.get("interviewing") ?? 0,
    finals: reached.get("final") ?? 0,
    offers: reached.get("offer_extended") ?? 0,
    accepts: reached.get("offer_accepted") ?? 0,
  });
  const maxReached = Math.max(1, ...funnel.map((f) => f.reached));

  if (events.length === 0) {
    return (
      <div>
        <PageHeader title="Analytics" />
        <EmptyState
          title="No pipeline activity yet"
          detail="Analytics are computed deterministically from pipeline events. Add candidates and move them through stages."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Computed deterministically from pipeline events and outreach tracking — no model involvement in these numbers."
      />
      <div className="space-y-4">
        <Card title="Funnel — candidates who ever reached each stage">
          <div className="space-y-1.5">
            {funnel
              .filter(
                (f) => !["closed", "archived", "onboarding"].includes(f.key),
              )
              .map((stage) => (
                <div key={stage.key} className="flex items-center gap-3">
                  <span className="w-44 shrink-0 text-[12.5px] text-ink-muted">
                    {stage.label}
                  </span>
                  <div className="h-4 flex-1 rounded-sm bg-panel2">
                    <div
                      className="h-4 rounded-sm bg-accent/70"
                      style={{
                        width: `${(stage.reached / maxReached) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[13px] font-medium">
                    {stage.reached}
                  </span>
                  <span className="w-14 shrink-0 text-right text-[12px] text-ink-faint">
                    {stage.conversionFromPrevious !== null
                      ? `${Math.round(stage.conversionFromPrevious * 100)}%`
                      : ""}
                  </span>
                </div>
              ))}
          </div>
        </Card>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Outreach">
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-ink-muted">Drafted</span>
                <span>{outreach.drafted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Sent</span>
                <span>{outreach.sent}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Replied</span>
                <span>{outreach.replied}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">Response rate</span>
                <span>
                  {outreach.responseRate === null
                    ? "— (nothing sent)"
                    : `${Math.round(outreach.responseRate * 100)}%`}
                </span>
              </div>
            </div>
          </Card>
          <Card title="Average time in stage (completed visits)">
            {Object.keys(timeInStage).length === 0 ? (
              <p className="text-[13px] text-ink-muted">
                Not enough movement yet.
              </p>
            ) : (
              <div className="space-y-1.5 text-[13px]">
                {stages
                  .filter((s) => timeInStage[s.key] !== undefined)
                  .map((stage) => (
                    <div key={stage.key} className="flex justify-between">
                      <span className="text-ink-muted">{stage.label}</span>
                      <span>{days(timeInStage[stage.key])}</span>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>
        <Card title="Pipeline diagnosis">
          {diagnosis.findings.length === 0 ? (
            <p className="text-[13px] text-ink-muted">
              No failure patterns detected at current sample sizes.
            </p>
          ) : (
            <div className="space-y-3">
              {diagnosis.findings.map((finding) => (
                <div
                  key={finding.id}
                  className="rounded border border-warn/30 bg-warn-soft/30 p-3"
                >
                  <p className="text-[13.5px] font-medium text-warn">
                    {finding.symptom}
                  </p>
                  <div className="mt-2 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div>
                      <h4 className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">
                        Possible causes
                      </h4>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12.5px]">
                        {finding.possibleCauses.map((cause, i) => (
                          <li key={i}>{cause}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">
                        Experiments to run
                      </h4>
                      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[12.5px]">
                        {finding.experiments.map((experiment, i) => (
                          <li key={i}>{experiment}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {diagnosis.insufficientData.length > 0 && (
            <div className="mt-3 border-t border-edge pt-2">
              <p className="text-[12px] text-ink-faint">
                Withheld for small samples:{" "}
                {diagnosis.insufficientData.join(" ")}
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
