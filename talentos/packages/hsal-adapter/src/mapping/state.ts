import type { CreateStateRequest, StateDimension } from "@hsal/sdk";
import { computePipelineMetrics, formatPct, largestDrop } from "../metrics";
import { decisionCaseIdFor, snapshotRef, stateIdForSnapshot } from "../refs";
import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type PipelineSnapshot,
  type SearchProject,
} from "../types";

const METRIC_LABELS: Record<string, string> = {
  outreachReplyRate: "Reply rate",
  positiveReplyRate: "Positive reply rate",
  recruiterScreenToHMRate: "Recruiter screen → HM",
  hmToOnsiteRate: "HM → onsite",
  onsiteToOfferRate: "Onsite → offer",
  offerToHireRate: "Offer → hire",
};

/**
 * PipelineSnapshot → HSAL State. Counts are `observed`; derived rates are
 * `inferred` because they are calculated from observations.
 */
export function toHSALStateRequest(
  project: SearchProject,
  snapshot: PipelineSnapshot,
): CreateStateRequest {
  const dimensions: StateDimension[] = PIPELINE_STAGES.map((stage) => ({
    key: `count.${stage}`,
    label: PIPELINE_STAGE_LABELS[stage],
    value: snapshot.counts[stage],
    unit: "candidates",
    epistemicStatus: "observed",
  }));
  const metrics = computePipelineMetrics(snapshot.counts);
  for (const [key, value] of Object.entries(metrics)) {
    if (value === undefined) continue;
    dimensions.push({
      key: `rate.${key}`,
      label: METRIC_LABELS[key] ?? key,
      value: Number(value.toFixed(4)),
      unit: "ratio",
      epistemicStatus: "inferred",
    });
  }
  const drop = largestDrop(snapshot.counts);
  if (drop) {
    dimensions.push({
      key: "bottleneck.largest_drop",
      label: "Largest observed drop",
      value: drop.label,
      epistemicStatus: "inferred",
    });
  }

  const unknowns: string[] = [];
  if (snapshot.counts.hm_screen < 8)
    unknowns.push(
      `HM-stage conversion rests on ${snapshot.counts.hm_screen} HM screens; small sample.`,
    );
  if (snapshot.counts.onsite < 3)
    unknowns.push(
      `Onsite → offer cannot be assessed from ${snapshot.counts.onsite} onsite(s).`,
    );
  if (snapshot.counts.outreach_sent < 50)
    unknowns.push(
      `Reply rate rests on ${snapshot.counts.outreach_sent} messages.`,
    );
  const level =
    unknowns.length >= 2 ? "high" : unknowns.length === 1 ? "medium" : "low";

  return {
    id: stateIdForSnapshot(snapshot.id),
    decisionCaseId: decisionCaseIdFor(project.id),
    label: `${project.id} pipeline ${snapshot.periodStart} → ${snapshot.periodEnd}`,
    timestamp: new Date(snapshot.observedAt).toISOString(),
    status: "actual",
    dimensions,
    uncertainty: {
      level,
      notes: `Reply ${formatPct(metrics.outreachReplyRate)}, positive ${formatPct(metrics.positiveReplyRate)}, screen→HM ${formatPct(metrics.recruiterScreenToHMRate)}, HM→onsite ${formatPct(metrics.hmToOnsiteRate)}.`,
      unknowns,
    },
    sourceRefs: [snapshotRef(snapshot.id)],
  };
}

export function dimensionValue(
  dimensions: StateDimension[],
  key: string,
): StateDimension["value"] | undefined {
  return dimensions.find((d) => d.key === key)?.value;
}
