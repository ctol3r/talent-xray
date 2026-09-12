import {
  PIPELINE_STAGES,
  PIPELINE_STAGE_LABELS,
  type PipelineCounts,
  type PipelineMetrics,
  type PipelineSnapshot,
  type PipelineStage,
} from "./types";

function rate(numerator: number, denominator: number): number | undefined {
  if (denominator <= 0) return undefined;
  return numerator / denominator;
}

/** Conversion metrics derived from a snapshot. Computed, never stored. */
export function computePipelineMetrics(
  counts: PipelineCounts,
): PipelineMetrics {
  const m: PipelineMetrics = {};
  const set = (k: keyof PipelineMetrics, v: number | undefined) => {
    if (v !== undefined) m[k] = v;
  };
  set("outreachReplyRate", rate(counts.reply, counts.outreach_sent));
  set("positiveReplyRate", rate(counts.positive_reply, counts.outreach_sent));
  set(
    "recruiterScreenToHMRate",
    rate(counts.hm_screen, counts.recruiter_screen),
  );
  set("hmToOnsiteRate", rate(counts.onsite, counts.hm_screen));
  set("onsiteToOfferRate", rate(counts.offer, counts.onsite));
  set("offerToHireRate", rate(counts.hire, counts.offer));
  return m;
}

export interface StageDrop {
  from: PipelineStage;
  to: PipelineStage;
  fromCount: number;
  toCount: number;
  /** 1 - to/from; the share lost between the two stages. */
  loss: number;
  label: string;
}

/** Stages from which a candidate is "engaged"; drops are measured from here on. */
export const ENGAGED_STAGE_INDEX = PIPELINE_STAGES.indexOf("positive_reply");

/**
 * Largest proportional drop between consecutive ENGAGED stages (positive
 * reply onward), considering only stages with enough volume to say anything
 * (from >= minFrom). Sourcing capacity and reply rates are reported as rates,
 * not as drops: a low reply rate is an engagement signal, not a pipeline
 * leak between qualified candidates.
 */
export function largestDrop(
  counts: PipelineCounts,
  minFrom = 3,
): StageDrop | undefined {
  let best: StageDrop | undefined;
  for (let i = ENGAGED_STAGE_INDEX; i < PIPELINE_STAGES.length - 1; i++) {
    const from = PIPELINE_STAGES[i]!;
    const to = PIPELINE_STAGES[i + 1]!;
    const fromCount = counts[from];
    const toCount = counts[to];
    if (fromCount < minFrom) continue;
    const loss = 1 - toCount / fromCount;
    if (!best || loss > best.loss) {
      best = {
        from,
        to,
        fromCount,
        toCount,
        loss,
        label: `${PIPELINE_STAGE_LABELS[from].toUpperCase()} → ${PIPELINE_STAGE_LABELS[to].toUpperCase()}`,
      };
    }
  }
  return best;
}

export function formatPct(v: number | undefined, digits = 1): string {
  return v === undefined ? "n/a" : `${(v * 100).toFixed(digits)}%`;
}

export function snapshotSummaryLines(snapshot: PipelineSnapshot): string[] {
  return PIPELINE_STAGES.map(
    (s) => `${snapshot.counts[s]} ${PIPELINE_STAGE_LABELS[s].toLowerCase()}`,
  );
}
