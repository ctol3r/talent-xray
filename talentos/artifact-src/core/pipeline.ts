/**
 * Pipeline events and the four metric groups (spec §13).
 *
 * Events are append-only and every one is RECORDED BY A HUMAN — nothing
 * advances, rejects or contacts anyone on its own, so an event is a record
 * of something that already happened. Metrics are computed from those
 * events and nothing else: there is no seeded history, no estimate, and no
 * back-fill. A metric that cannot be computed says so and names how much
 * data it would need.
 *
 * There is deliberately no way to group any metric by a candidate
 * attribute. The registry is fixed; a protected-characteristic breakdown
 * is not a feature that exists to be misused.
 */
import { z } from "zod";
import { metricResultSchema, rateMetric, type MetricResult } from "./envelope";

export const STAGES = [
  "sourced",
  "contacted",
  "replied",
  "screened",
  "submitted",
  "interviewing",
  "offer",
  "hired",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  sourced: "Sourced",
  contacted: "Contacted",
  replied: "Replied",
  screened: "Screened",
  submitted: "Submitted to HM",
  interviewing: "Interviewing",
  offer: "Offer",
  hired: "Hired",
};

export const EXITS = ["rejected", "withdrawn", "on_hold"] as const;
export type Exit = (typeof EXITS)[number];
export const EXIT_LABELS: Record<Exit, string> = {
  rejected: "Rejected",
  withdrawn: "Withdrew",
  on_hold: "On hold",
};

export const pipelineEventSchema = z.object({
  id: z.string(),
  candidateId: z.string(),
  at: z.string(),
  /** Who recorded it. Always a person; the page never writes one itself. */
  recordedBy: z.string().default("recruiter"),
  type: z.enum([
    "stage_change",
    "outreach_recorded",
    "reply_recorded",
    "exit",
    "note",
  ]),
  fromStage: z.enum(STAGES).optional(),
  toStage: z.enum(STAGES).optional(),
  exit: z.enum(EXITS).optional(),
  /** For a reply: what the person actually said back. */
  outcome: z.enum(["interested", "not_interested", "unclear"]).optional(),
  /** Free text the recruiter wrote. Never generated. */
  note: z.string().default(""),
});
export type PipelineEvent = z.infer<typeof pipelineEventSchema>;

const stageIndex = (s: Stage): number => STAGES.indexOf(s);

/** The furthest stage a candidate actually reached, from their events. */
export function furthestStage(
  candidateId: string,
  events: PipelineEvent[],
): Stage | undefined {
  let best: Stage | undefined;
  for (const e of events) {
    if (e.candidateId !== candidateId) continue;
    const stage =
      e.type === "stage_change"
        ? e.toStage
        : e.type === "outreach_recorded"
          ? "contacted"
          : e.type === "reply_recorded"
            ? "replied"
            : undefined;
    if (!stage) continue;
    if (!best || stageIndex(stage) > stageIndex(best)) best = stage;
  }
  return best;
}

export function exitOf(
  candidateId: string,
  events: PipelineEvent[],
): { exit: Exit; at: string; note: string } | undefined {
  const found = events
    .filter((e) => e.candidateId === candidateId && e.type === "exit" && e.exit)
    .sort((a, b) => a.at.localeCompare(b.at))
    .pop();
  return found
    ? { exit: found.exit as Exit, at: found.at, note: found.note }
    : undefined;
}

/** Where a candidate is NOW: their exit if they have one, else furthest stage. */
export function currentPosition(
  candidateId: string,
  events: PipelineEvent[],
):
  | { kind: "stage"; stage: Stage }
  | { kind: "exit"; exit: Exit }
  | { kind: "none" } {
  const exit = exitOf(candidateId, events);
  if (exit) return { kind: "exit", exit: exit.exit };
  const stage = furthestStage(candidateId, events);
  return stage ? { kind: "stage", stage } : { kind: "none" };
}

/** How many candidates ever REACHED each stage. The funnel's denominators. */
export function reachedCounts(
  candidateIds: string[],
  events: PipelineEvent[],
): Record<Stage, number> {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<
    Stage,
    number
  >;
  for (const id of candidateIds) {
    const furthest = furthestStage(id, events);
    if (!furthest) continue;
    for (const stage of STAGES) {
      if (stageIndex(stage) <= stageIndex(furthest)) counts[stage] += 1;
    }
  }
  return counts;
}

const DAY = 86_400_000;

/** First time a candidate reached a stage, for the duration metrics. */
function firstAt(
  candidateId: string,
  stage: Stage,
  events: PipelineEvent[],
): number | undefined {
  const times = events
    .filter((e) => {
      if (e.candidateId !== candidateId) return false;
      if (e.type === "stage_change") return e.toStage === stage;
      if (e.type === "outreach_recorded") return stage === "contacted";
      if (e.type === "reply_recorded") return stage === "replied";
      return false;
    })
    .map((e) => new Date(e.at).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);
  return times[0];
}

export function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * A duration metric carries its sample size as the denominator, so "3.5
 * days" can never be read without "across 4 candidates".
 */
export function durationMetric(input: {
  id: string;
  label: string;
  formula: string;
  days: number[];
  minimumSample?: number;
  asOf: string;
  note?: string;
}): MetricResult {
  const min = input.minimumSample ?? 3;
  const value = median(input.days);
  if (input.days.length < min || value === undefined) {
    return metricResultSchema.parse({
      id: input.id,
      label: input.label,
      formula: input.formula,
      numerator: undefined,
      denominator: input.days.length,
      value: null,
      unit: "days",
      status: "not_enough_data",
      minimumSample: min,
      asOf: input.asOf,
      note: input.note,
    });
  }
  return metricResultSchema.parse({
    id: input.id,
    label: input.label,
    formula: input.formula,
    denominator: input.days.length,
    value: Math.round(value * 10) / 10,
    unit: "days",
    status: "measured",
    minimumSample: min,
    asOf: input.asOf,
    note: input.note,
  });
}

export interface MetricGroup {
  key: "funnel" | "responsiveness" | "quality" | "velocity";
  label: string;
  purpose: string;
  metrics: MetricResult[];
}

export interface MetricsInput {
  candidateIds: string[];
  events: PipelineEvent[];
  nowIso: string;
  /** When the search opened, for the days-open metric. */
  openedAt?: string;
}

/** The four groups. Every rate states its formula, numerator and denominator. */
export function computeMetrics(input: MetricsInput): MetricGroup[] {
  const { candidateIds, events, nowIso } = input;
  const reached = reachedCounts(candidateIds, events);
  const asOf = nowIso;

  const conversion = (
    from: Stage,
    to: Stage,
    minimumSample = 5,
  ): MetricResult =>
    rateMetric({
      id: `funnel_${from}_${to}`,
      label: `${STAGE_LABELS[from]} → ${STAGE_LABELS[to]}`,
      formula: `candidates who reached ${STAGE_LABELS[to]} ÷ candidates who reached ${STAGE_LABELS[from]}`,
      numerator: reached[to],
      denominator: reached[from],
      minimumSample,
      asOf,
    });

  const replies = events.filter((e) => e.type === "reply_recorded");
  const interested = replies.filter((e) => e.outcome === "interested").length;

  const durations = (from: Stage, to: Stage): number[] =>
    candidateIds
      .map((id) => {
        const a = firstAt(id, from, events);
        const b = firstAt(id, to, events);
        return a !== undefined && b !== undefined && b >= a
          ? (b - a) / DAY
          : undefined;
      })
      .filter((d): d is number => d !== undefined);

  const exits = candidateIds
    .map((id) => exitOf(id, events))
    .filter((e): e is NonNullable<typeof e> => Boolean(e));
  const rejected = exits.filter((e) => e.exit === "rejected").length;

  const daysOpen = input.openedAt
    ? Math.max(
        0,
        (new Date(nowIso).getTime() - new Date(input.openedAt).getTime()) / DAY,
      )
    : undefined;

  return [
    {
      key: "funnel",
      label: "Funnel",
      purpose:
        "Where the search loses people. Each rate is the share of those who reached the earlier stage — never a share of everyone.",
      metrics: [
        conversion("sourced", "contacted"),
        conversion("contacted", "replied"),
        conversion("replied", "screened"),
        conversion("screened", "submitted"),
        conversion("submitted", "interviewing"),
        conversion("interviewing", "offer", 3),
        conversion("offer", "hired", 1),
      ],
    },
    {
      key: "responsiveness",
      label: "Responsiveness",
      purpose:
        "Whether the approach is landing. A low reply rate is a message or targeting problem, not a candidate problem.",
      metrics: [
        rateMetric({
          id: "reply_rate",
          label: "Reply rate",
          formula: "candidates who replied ÷ candidates contacted",
          numerator: reached.replied,
          denominator: reached.contacted,
          minimumSample: 10,
          asOf,
          note: "Ten contacts is the smallest sample worth reading as a rate.",
        }),
        rateMetric({
          id: "interested_rate",
          label: "Interested replies",
          formula: "replies recorded as interested ÷ replies recorded",
          numerator: interested,
          denominator: replies.length,
          minimumSample: 5,
          asOf,
        }),
        durationMetric({
          id: "time_to_reply",
          label: "Median time to first reply",
          formula:
            "median days between the recorded contact and the recorded reply",
          days: durations("contacted", "replied"),
          asOf,
        }),
      ],
    },
    {
      key: "quality",
      label: "Quality of submission",
      purpose:
        "Whether the hiring manager agrees with the profile. This is the only honest read on whether the search is calibrated.",
      metrics: [
        rateMetric({
          id: "hm_pass_through",
          label: "Submitted → interviewing",
          formula:
            "candidates who reached Interviewing ÷ candidates submitted to the hiring manager",
          numerator: reached.interviewing,
          denominator: reached.submitted,
          minimumSample: 5,
          asOf,
          note: "Below roughly half, the profile and the hiring manager disagree — that is a conversation, not a sourcing problem.",
        }),
        rateMetric({
          id: "interview_to_offer",
          label: "Interviewing → offer",
          formula:
            "candidates who reached Offer ÷ candidates who reached Interviewing",
          numerator: reached.offer,
          denominator: reached.interviewing,
          minimumSample: 3,
          asOf,
        }),
        rateMetric({
          id: "offer_accept",
          label: "Offer → hired",
          formula: "candidates hired ÷ candidates who reached Offer",
          numerator: reached.hired,
          denominator: reached.offer,
          minimumSample: 1,
          asOf,
        }),
        rateMetric({
          id: "rejection_share",
          label: "Exits that were rejections",
          formula: "exits recorded as rejected ÷ all recorded exits",
          numerator: rejected,
          denominator: exits.length,
          minimumSample: 3,
          asOf,
          note: "The rest withdrew or went on hold — a different problem with a different fix.",
        }),
      ],
    },
    {
      key: "velocity",
      label: "Velocity",
      purpose:
        "How long the search actually takes, measured from what was recorded rather than from when the requisition opened.",
      metrics: [
        durationMetric({
          id: "sourced_to_contacted",
          label: "Median sourced → contacted",
          formula:
            "median days between finding someone and recording the outreach",
          days: durations("sourced", "contacted"),
          asOf,
        }),
        durationMetric({
          id: "sourced_to_submitted",
          label: "Median sourced → submitted",
          formula: "median days between finding someone and submitting them",
          days: durations("sourced", "submitted"),
          asOf,
        }),
        metricResultSchema.parse({
          id: "days_open",
          label: "Days open",
          formula: "days between the recorded open date and today",
          denominator: daysOpen === undefined ? undefined : 1,
          value: daysOpen === undefined ? null : Math.round(daysOpen),
          unit: "days",
          status: daysOpen === undefined ? "not_enough_data" : "measured",
          asOf,
          note:
            daysOpen === undefined
              ? "No open date on the brief, so this cannot be computed. It is not zero."
              : undefined,
        }),
      ],
    },
  ];
}

/**
 * A comparison is only reportable when BOTH sides are measured and both
 * meet their minimum sample. "Improved" without that is a claim, not a
 * measurement (spec §16).
 */
export function compareMetric(
  before: MetricResult,
  after: MetricResult,
): { reportable: boolean; direction: "up" | "down" | "flat"; reason: string } {
  if (before.status !== "measured" || after.status !== "measured") {
    return {
      reportable: false,
      direction: "flat",
      reason:
        "One side of the comparison has no measurement, so nothing can be said about a change.",
    };
  }
  const a = before.value ?? 0;
  const b = after.value ?? 0;
  const direction = b > a ? "up" : b < a ? "down" : "flat";
  return {
    reportable: true,
    direction,
    reason: `${before.label}: ${a} (n=${before.denominator}) → ${b} (n=${after.denominator}).`,
  };
}
