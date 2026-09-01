import Link from "next/link";
import { getDb } from "@/lib/db/client";
import { getClosePlan, getOnboardingPlan } from "@/lib/services/artifacts";
import { listCandidates } from "@/lib/services/candidates";
import { getOffer } from "@/lib/services/workflow";
import {
  generateClosePlanAction,
  generateOnboardingPlanAction,
} from "@/lib/actions/generate";
import { ArtifactMeta } from "@/components/artifact-meta";
import {
  OfferControls,
  OnboardingChecklist,
} from "@/components/close-controls";
import { GenerateButton } from "@/components/generate-button";
import { StringList } from "@/components/traced-list";
import { Card, EmptyState, PageHeader, Tag } from "@/components/ui";

export const metadata = { title: "Close & Offer" };

export default async function ClosePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();
  const candidates = await listCandidates(db, id);
  // Closing is relevant from the screen stage onward (or once an offer exists).
  const lateStages = new Set([
    "recruiter_screen",
    "hm_review",
    "interviewing",
    "final",
    "offer_prep",
    "offer_extended",
    "offer_accepted",
    "onboarding",
    "closed",
  ]);
  const closable = [];
  for (const candidate of candidates) {
    const offer = await getOffer(db, candidate.id);
    if (lateStages.has(candidate.stage) || offer) {
      closable.push({
        candidate,
        offer,
        closePlan: await getClosePlan(db, candidate.id),
        onboarding: await getOnboardingPlan(db, candidate.id),
      });
    }
  }

  return (
    <div>
      <PageHeader
        title="Close · Offer · Onboarding"
        description="Close plans built on captured motivations and honest objection handling — no manipulation, no deceptive pressure. Accepted offers flow into onboarding."
      />
      {closable.length === 0 ? (
        <EmptyState
          title="No candidates in closing range"
          detail="Candidates appear here from the recruiter-screen stage onward. Start capturing motivations early — close plans built at offer time are too late."
        />
      ) : (
        <div className="space-y-5">
          {closable.map(({ candidate, offer, closePlan, onboarding }) => (
            <Card
              key={candidate.id}
              title={
                <span className="flex items-center gap-2">
                  <Link
                    href={`/searches/${id}/candidates/${candidate.id}`}
                    className="text-accent hover:underline"
                  >
                    {candidate.name}
                  </Link>
                  {offer && (
                    <Tag
                      tone={
                        offer.status === "accepted"
                          ? "ok"
                          : offer.status === "declined"
                            ? "bad"
                            : "warn"
                      }
                    >
                      offer {offer.status}
                    </Tag>
                  )}
                </span>
              }
            >
              <div className="space-y-4">
                <OfferControls
                  searchProjectId={id}
                  candidateId={candidate.id}
                  status={offer?.status}
                  compensationNote={offer?.compensationNote}
                />

                <div className="border-t border-edge pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[13px] font-semibold">Close plan</h3>
                    <GenerateButton
                      action={generateClosePlanAction}
                      input={{ candidateId: candidate.id }}
                      label={closePlan ? "Regenerate" : "Build close plan"}
                      regenerate={Boolean(closePlan)}
                    />
                  </div>
                  {!closePlan ? (
                    <p className="text-[13px] text-ink-muted">
                      No close plan yet — build one from captured motivations,
                      concerns, and compensation notes.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <ArtifactMeta
                        meta={closePlan.meta}
                        kind="close_plan"
                        ownerId={candidate.id}
                        payload={closePlan.payload}
                      />
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <div className="space-y-3">
                          <StringList
                            title="Motivations"
                            items={closePlan.payload.motivations}
                          />
                          <StringList
                            title="Concerns"
                            items={closePlan.payload.concerns}
                          />
                          <StringList
                            title="Decision criteria"
                            items={closePlan.payload.decisionCriteria}
                          />
                          <StringList
                            title="Competing opportunities"
                            items={closePlan.payload.competingOpportunities}
                          />
                          <StringList
                            title="Stakeholders"
                            items={closePlan.payload.stakeholders}
                          />
                        </div>
                        <div className="space-y-3">
                          <div className="rounded border border-warn/30 bg-warn-soft/40 px-3 py-2">
                            <p className="text-[12.5px] font-medium text-warn">
                              Risk of decline:{" "}
                              {closePlan.payload.riskOfDecline.level}
                            </p>
                            <p className="text-[12.5px] text-ink-muted">
                              {closePlan.payload.riskOfDecline.rationale}
                            </p>
                          </div>
                          <StringList
                            title="Missing information (go get it)"
                            items={closePlan.payload.missingInformation}
                          />
                          <StringList
                            title="Recommended topics"
                            items={closePlan.payload.recommendedTopics}
                          />
                          <StringList
                            title="HM involvement"
                            items={closePlan.payload.hmInvolvement}
                          />
                          <StringList
                            title="Offer-call prep"
                            items={closePlan.payload.offerCallPrep}
                          />
                        </div>
                      </div>
                      {closePlan.payload.likelyObjections.length > 0 && (
                        <div>
                          <h4 className="mb-1.5 text-[11.5px] font-semibold tracking-wider text-ink-faint uppercase">
                            Likely objections
                          </h4>
                          <ul className="space-y-1.5">
                            {closePlan.payload.likelyObjections.map(
                              (objection, i) => (
                                <li
                                  key={i}
                                  className="rounded border border-edge bg-panel2/50 px-3 py-2 text-[13px]"
                                >
                                  <span className="font-medium">
                                    {objection.objection}
                                  </span>
                                  <span className="block text-[12.5px] text-ink-muted">
                                    {objection.suggestedResponse}
                                  </span>
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {offer?.status === "accepted" && (
                  <div className="border-t border-edge pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="text-[13px] font-semibold">Onboarding</h3>
                      <GenerateButton
                        action={generateOnboardingPlanAction}
                        input={{ candidateId: candidate.id }}
                        label={
                          onboarding
                            ? "Regenerate plan"
                            : "Generate onboarding plan"
                        }
                        regenerate={Boolean(onboarding)}
                      />
                    </div>
                    {!onboarding ? (
                      <p className="text-[13px] text-ink-muted">
                        Offer accepted — generate the onboarding plan to protect
                        the start.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        <OnboardingChecklist
                          searchProjectId={id}
                          candidateId={candidate.id}
                          checklist={onboarding.payload.checklist}
                          startDate={onboarding.startDate}
                          startConfirmed={onboarding.startConfirmed}
                        />
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          <StringList
                            title="Recruiter handoff"
                            items={onboarding.payload.recruiterHandoff}
                          />
                          <StringList
                            title="Manager handoff"
                            items={onboarding.payload.managerHandoff}
                          />
                          <StringList
                            title="Day-1 prep"
                            items={onboarding.payload.day1Prep}
                          />
                          <StringList
                            title="30-day follow-up"
                            items={onboarding.payload.day30FollowUp}
                          />
                        </div>
                        {onboarding.payload.communicationSchedule.length >
                          0 && (
                          <div>
                            <h4 className="mb-1.5 text-[11.5px] font-semibold tracking-wider text-ink-faint uppercase">
                              Candidate communication schedule
                            </h4>
                            <ul className="space-y-1 text-[13px]">
                              {onboarding.payload.communicationSchedule.map(
                                (touch, i) => (
                                  <li key={i}>
                                    <span className="text-ink-faint">
                                      {touch.day}:{" "}
                                    </span>
                                    {touch.touchpoint}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
