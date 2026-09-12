/**
 * Path A — deterministic diagnosis rules. Recruiting-domain heuristics that
 * turn a pipeline state plus candidate/HM evidence into COMPETING
 * EXPLANATIONS. They generate candidate models with qualitative support;
 * they do not assert truth and never touch beliefs.
 */
import { computePipelineMetrics, formatPct, largestDrop } from "../metrics";
import {
  candidateEvidenceId,
  hmFeedbackEvidenceId,
  hmReasonEvidenceId,
  modelIdFor,
} from "../refs";
import type {
  CandidateSearchEvidence,
  DiagnosisModelType,
  HiringManagerFeedback,
  Level,
  PipelineSnapshot,
  SearchDiagnosisModel,
  SearchProject,
} from "../types";

export interface DiagnosisFacts {
  project: SearchProject;
  snapshot: PipelineSnapshot;
  candidates: CandidateSearchEvidence[];
  hmFeedback: HiringManagerFeedback[];
  /** Ids of evidence actually present in HSAL; links to anything else are dropped. */
  knownEvidenceIds?: ReadonlySet<string>;
}

export const MODEL_SUFFIX: Record<
  Exclude<DiagnosisModelType, "geography" | "other">,
  string
> = {
  talent_supply: "SUPPLY",
  outreach: "OUTREACH",
  success_profile: "PROFILE",
  compensation: "COMP",
  hiring_process: "PROCESS",
};

/** Thresholds are configuration, not buried logic. */
export const DIAGNOSIS_THRESHOLDS = {
  lowReplyRate: 0.15,
  veryLowReplyRate: 0.1,
  lowPositiveReplyRate: 0.1,
  lowQualifiedVolume: 8, // recruiter screens
  healthyScreenToHm: 0.5,
  hmRejectionRateHigh: 0.5,
  proxyRejectionsForHigh: 2,
  hmToOnsiteLow: 0.35,
  minHmScreensForProcess: 3,
  compensationSignalsForMedium: 2,
} as const;

interface Signal {
  evidenceId: string;
  candidateId?: string;
  type: string;
  criterionId?: string;
  category?: string;
}

function collectSignals(facts: DiagnosisFacts): Signal[] {
  const signals: Signal[] = [];
  for (const c of facts.candidates) {
    c.observations.forEach((o, i) => {
      signals.push({
        evidenceId: candidateEvidenceId(facts.project.id, c.candidateId, i),
        candidateId: c.candidateId,
        type: o.type,
        ...(o.criterionId ? { criterionId: o.criterionId } : {}),
      });
    });
  }
  for (const f of facts.hmFeedback) {
    signals.push({
      evidenceId: hmFeedbackEvidenceId(f.id),
      type: `hm_${f.disposition ?? "comment"}`,
      ...(f.candidateId ? { candidateId: f.candidateId } : {}),
    });
    (f.structuredReasons ?? []).forEach((r, i) => {
      signals.push({
        evidenceId: hmReasonEvidenceId(f.id, i),
        type: `hm_reason`,
        category: r.category,
        ...(r.criterionId ? { criterionId: r.criterionId } : {}),
        ...(f.candidateId ? { candidateId: f.candidateId } : {}),
      });
    });
  }
  return signals;
}

function criterionCategory(
  project: SearchProject,
  criterionId: string | undefined,
): string | undefined {
  if (!criterionId) return undefined;
  const all = [
    ...project.successProfile.mustHave,
    ...project.successProfile.preferred,
    ...project.successProfile.transferable,
  ];
  return all.find((c) => c.id === criterionId)?.category;
}

/** A "proxy" criterion is a title or an exact-stack skill requirement — cheap to check, weakly tied to capability. */
function isProxyCriterion(
  project: SearchProject,
  criterionId: string | undefined,
): boolean {
  const cat = criterionCategory(project, criterionId);
  if (cat === "title") return true;
  if (cat === "skill") {
    const label =
      [
        ...project.successProfile.mustHave,
        ...project.successProfile.preferred,
      ].find((c) => c.id === criterionId)?.label ?? "";
    return /\b(go|rust|c\+\+|java|python|typescript|kotlin|scala|kubernetes|k8s)\b/i.test(
      label,
    );
  }
  return false;
}

export function generateDeterministicModels(
  facts: DiagnosisFacts,
): SearchDiagnosisModel[] {
  const { project, snapshot } = facts;
  const dcId = `DC-${project.id}`;
  const counts = snapshot.counts;
  const m = computePipelineMetrics(counts);
  const T = DIAGNOSIS_THRESHOLDS;
  const signals = collectSignals(facts);
  const keep = (ids: string[]) =>
    facts.knownEvidenceIds
      ? ids.filter((id) => facts.knownEvidenceIds!.has(id))
      : ids;
  const drop = largestDrop(counts);

  const hmRejections = signals.filter(
    (s) => s.type === "hm_rejected" || s.type === "hm_reject",
  );
  const hmAdvances = signals.filter(
    (s) => s.type === "hm_advanced" || s.type === "hm_advance",
  );
  const proxyRejections = signals.filter(
    (s) =>
      (s.type === "hm_rejected" || s.type === "hm_reason") &&
      isProxyCriterion(project, s.criterionId),
  );
  const proxyMisses = signals.filter(
    (s) =>
      s.type === "misses_requirement" &&
      isProxyCriterion(project, s.criterionId),
  );
  const strongCoreMatches = signals.filter(
    (s) =>
      s.type === "meets_requirement" &&
      criterionCategory(project, s.criterionId) !== "title" &&
      !isProxyCriterion(project, s.criterionId),
  );
  const compSignals = signals.filter(
    (s) =>
      s.type === "compensation_objection" || s.type === "candidate_withdrew",
  );
  const locationSignals = signals.filter(
    (s) => s.type === "location_objection",
  );
  const rejectedCandidates = new Set(
    hmRejections.map((s) => s.candidateId).filter(Boolean),
  );
  const proxyRejectedCandidates = new Set(
    proxyRejections.map((s) => s.candidateId).filter(Boolean),
  );

  const hmRejectionRate =
    counts.hm_screen > 0 ? 1 - counts.onsite / counts.hm_screen : undefined;

  const models: SearchDiagnosisModel[] = [];

  // ---------------------------------------------------------------- talent supply
  {
    const lowPositive = (m.positiveReplyRate ?? 1) < T.lowPositiveReplyRate;
    const lowVolume = counts.recruiter_screen < T.lowQualifiedVolume;
    const triggered = lowPositive && lowVolume;
    // Strong adjacent candidates rejected on proxies argue AGAINST pure supply scarcity.
    const support: Level = !triggered
      ? "low"
      : proxyRejectedCandidates.size >= T.proxyRejectionsForHigh
        ? "medium"
        : "high";
    models.push({
      id: modelIdFor(project.id, MODEL_SUFFIX.talent_supply),
      decisionCaseId: dcId,
      type: "talent_supply",
      name: "Talent Supply Constraint",
      explanation: `Too few people who meet the profile exist or are reachable: positive reply rate ${formatPct(m.positiveReplyRate)} and only ${counts.recruiter_screen} recruiter screens from ${counts.sourced} sourced.`,
      assumptions: [
        {
          statement:
            "The sourced pool is representative of the reachable market.",
          sensitivity: "high",
        },
        {
          statement:
            "The Success Profile as written is the right definition of a qualified candidate.",
          sensitivity: "high",
          confidence: 0.5,
        },
      ],
      predictions: [
        {
          statement:
            "Broadening geography or seniority will not raise qualified volume much because the market is thin.",
          validationCondition:
            "Adjacent-profile review advances fewer than half of technically strong adjacent candidates.",
        },
      ],
      evidenceForIds: keep([
        ...signals
          .filter((s) => s.type === "outreach_response")
          .map((s) => s.evidenceId),
      ]),
      evidenceAgainstIds: keep([
        ...new Set(proxyRejections.map((s) => s.evidenceId)),
      ]),
      assessment: {
        support,
        reasoning: triggered
          ? `Low positive replies and low qualified volume fit a thin market, but ${proxyRejectedCandidates.size} technically strong candidate(s) were rejected on title or exact-language proxies, which a pure supply story does not explain.`
          : "Top-of-funnel volume and positive replies are not low enough to indicate scarcity.",
      },
      status: support === "low" ? "weakened" : "candidate",
    });
  }

  // ---------------------------------------------------------------- outreach
  {
    const lowReply = (m.outreachReplyRate ?? 1) < T.lowReplyRate;
    const healthyDownstream =
      (m.recruiterScreenToHMRate ?? 0) >= T.healthyScreenToHm;
    const triggered = lowReply && healthyDownstream;
    const support: Level = !triggered
      ? "low"
      : (m.outreachReplyRate ?? 1) < T.veryLowReplyRate
        ? "medium"
        : "low";
    models.push({
      id: modelIdFor(project.id, MODEL_SUFFIX.outreach),
      decisionCaseId: dcId,
      type: "outreach",
      name: "Outreach Constraint",
      explanation: `Messaging or channel is losing candidates before they engage: reply rate ${formatPct(m.outreachReplyRate)} on ${counts.outreach_sent} messages while screen → HM conversion is ${formatPct(m.recruiterScreenToHMRate)}.`,
      assumptions: [
        {
          statement:
            "Non-responders include qualified people who would engage with a better message.",
          sensitivity: "medium",
        },
      ],
      predictions: [
        {
          statement:
            "A revised message or channel will lift reply rate materially.",
          validationCondition:
            "A/B outreach test raises reply rate by at least 5 points.",
        },
      ],
      evidenceForIds: keep(
        signals
          .filter((s) => s.type === "outreach_response")
          .map((s) => s.evidenceId),
      ),
      evidenceAgainstIds: keep(
        hmRejections.map((s) => s.evidenceId).slice(0, 2),
      ),
      assessment: {
        support,
        reasoning: triggered
          ? `Reply rate is marginally low (${formatPct(m.outreachReplyRate)}) but the observed loss is downstream, at HM review, not at engagement.`
          : "Reply rate is not the dominant loss point.",
      },
      status: support === "low" ? "weakened" : "candidate",
    });
  }

  // ---------------------------------------------------------------- success profile
  {
    const highRejection =
      (hmRejectionRate ?? 0) >= T.hmRejectionRateHigh && counts.hm_screen >= 3;
    const proxyHeavy = proxyRejectedCandidates.size >= T.proxyRejectionsForHigh;
    const support: Level =
      highRejection && proxyHeavy
        ? "high"
        : proxyHeavy || highRejection
          ? "medium"
          : "low";
    models.push({
      id: modelIdFor(project.id, MODEL_SUFFIX.success_profile),
      decisionCaseId: dcId,
      type: "success_profile",
      name: "Success Profile Constraint",
      explanation: `The profile screens on proxies (exact language, current title) that exclude capable people: ${proxyRejectedCandidates.size} of ${rejectedCandidates.size} HM rejections cite title or exact-language criteria while the same candidates show strong distributed-systems scope.`,
      assumptions: [
        {
          statement:
            "Exact programming language and current title are weak proxies for Staff-level distributed-systems capability.",
          sensitivity: "high",
          confidence: 0.6,
        },
        {
          statement:
            "The HM would accept adjacent candidates if judged on scope rather than proxies.",
          sensitivity: "high",
        },
      ],
      predictions: [
        {
          statement:
            "With language and title hidden, the HM will advance a majority of technically strong adjacent candidates.",
          validationCondition:
            "Blind adjacent profile review advance rate ≥ 50%.",
        },
      ],
      evidenceForIds: keep([
        ...new Set([
          ...proxyRejections.map((s) => s.evidenceId),
          ...proxyMisses.map((s) => s.evidenceId),
          ...strongCoreMatches
            .filter((s) => proxyRejectedCandidates.has(s.candidateId))
            .map((s) => s.evidenceId),
        ]),
      ]),
      evidenceAgainstIds: keep(hmAdvances.map((s) => s.evidenceId)),
      assessment: {
        support,
        reasoning:
          highRejection && proxyHeavy
            ? `${proxyRejectedCandidates.size} strong candidates were rejected primarily for programming-language or title mismatch; HM → onsite conversion is ${formatPct(m.hmToOnsiteRate)}. Largest observed drop: ${drop?.label ?? "n/a"}.`
            : "Rejections are not concentrated on proxy criteria.",
      },
      status: support === "high" ? "active" : "candidate",
    });
  }

  // ---------------------------------------------------------------- compensation
  {
    const n = new Set(compSignals.map((s) => s.candidateId)).size;
    const support: Level =
      n >= T.compensationSignalsForMedium ? "medium" : "low";
    models.push({
      id: modelIdFor(project.id, MODEL_SUFFIX.compensation),
      decisionCaseId: dcId,
      type: "compensation",
      name: "Compensation Constraint",
      explanation: `Budget is below what qualified candidates expect: ${n} candidate(s) raised compensation objections or withdrew.`,
      assumptions: [
        {
          statement:
            "Compensation objections generalize beyond the candidates who voiced them.",
          sensitivity: "medium",
        },
      ],
      predictions: [
        {
          statement:
            "Raising the range will convert late-stage candidates who currently withdraw.",
          validationCondition:
            "Two or more withdrawals cite compensation within a period.",
        },
      ],
      evidenceForIds: keep(compSignals.map((s) => s.evidenceId)),
      evidenceAgainstIds: keep(
        hmRejections.map((s) => s.evidenceId).slice(0, 1),
      ),
      assessment: {
        support,
        reasoning:
          n >= T.compensationSignalsForMedium
            ? "Repeated compensation objections."
            : `Only ${n} compensation signal(s); real but not the dominant loss.`,
      },
      status: support === "low" ? "weakened" : "candidate",
    });
  }

  // ---------------------------------------------------------------- hiring process
  {
    const concentrated =
      (m.hmToOnsiteRate ?? 1) < T.hmToOnsiteLow &&
      counts.hm_screen >= T.minHmScreensForProcess;
    const support: Level = concentrated ? "medium" : "low";
    models.push({
      id: modelIdFor(project.id, MODEL_SUFFIX.hiring_process),
      decisionCaseId: dcId,
      type: "hiring_process",
      name: "Hiring Process Constraint",
      explanation: `Loss is concentrated at one gate: HM → onsite ${formatPct(m.hmToOnsiteRate)} (${counts.hm_screen} → ${counts.onsite}), suggesting an uncalibrated or informal HM review step.`,
      assumptions: [
        {
          statement:
            "The HM review applies criteria not shared with the recruiter screen.",
          sensitivity: "medium",
        },
      ],
      predictions: [
        {
          statement:
            "A structured HM rubric will raise HM → onsite conversion without changing the profile.",
          validationCondition: "HM → onsite ≥ 50% after rubric adoption.",
        },
      ],
      evidenceForIds: keep(hmRejections.map((s) => s.evidenceId)),
      evidenceAgainstIds: [],
      assessment: {
        support,
        reasoning: concentrated
          ? "Downstream rejection is unusually concentrated at HM review; overlaps with the Success Profile explanation."
          : "No single-gate concentration.",
      },
      status: support === "low" ? "weakened" : "candidate",
    });
  }

  // geography (only when there are explicit location signals)
  if (locationSignals.length > 0) {
    models.push({
      id: modelIdFor(project.id, "GEO"),
      decisionCaseId: dcId,
      type: "geography",
      name: "Geography Constraint",
      explanation: `${locationSignals.length} candidate(s) objected to location.`,
      assumptions: [
        {
          statement:
            "Location objections would persist for remote-capable candidates.",
          sensitivity: "medium",
        },
      ],
      predictions: [
        {
          statement: "Allowing remote will lift positive replies.",
          validationCondition:
            "Remote-allowed outreach cohort shows a higher positive reply rate.",
        },
      ],
      evidenceForIds: keep(locationSignals.map((s) => s.evidenceId)),
      evidenceAgainstIds: [],
      assessment: {
        support: locationSignals.length >= 2 ? "medium" : "low",
        reasoning: "Explicit location objections observed.",
      },
      status: "candidate",
    });
  }

  return models;
}

export const SUPPORT_RANK: Record<Level, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export function strongestModel(
  models: SearchDiagnosisModel[],
): SearchDiagnosisModel | undefined {
  return [...models].sort(
    (a, b) =>
      SUPPORT_RANK[b.assessment?.support ?? "low"] -
      SUPPORT_RANK[a.assessment?.support ?? "low"],
  )[0];
}
