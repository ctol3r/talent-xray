/**
 * "What should I do next?" — a deterministic rules engine over live search
 * state. Priorities: 1 = do now, 2 = do soon, 3 = worth doing.
 */

export interface ProjectSnapshot {
  projectId: string;
  hasJobDescription: boolean;
  hasRoleIntelligence: boolean;
  unresolvedQuestionCount: number;
  hasIntake: boolean;
  unansweredIntakeCount: number;
  intakeComplete: boolean;
  hasSuccessProfile: boolean;
  hasStrategy: boolean;
  channelCount: number;
  queryCount: number;
  candidateCount: number;
  candidatesNeedingReview: number;
  followUpsDueCount: number;
  outreachSent: number;
  outreachReplied: number;
  stalledCandidateCount: number;
  stalledThresholdDays: number;
  openTaskCount: number;
  // W9 — two-sided guidance threads
  hasHmBrief: boolean;
  hmReviewPendingCount: number;
  offersWithoutClosePlanCount: number;
  interviewingWithoutPrepCount: number;
}

export type ActionThread = "pipeline" | "hiring_manager" | "candidate";

export const THREAD_LABELS: Record<ActionThread, string> = {
  pipeline: "Pipeline",
  hiring_manager: "Hiring manager",
  candidate: "Candidates",
};

export interface NextBestAction {
  id: string;
  priority: 1 | 2 | 3;
  title: string;
  detail: string;
  href: string;
  /** Which relationship this move advances. */
  thread: ActionThread;
}

export function computeNextBestActions(s: ProjectSnapshot): NextBestAction[] {
  const actions: NextBestAction[] = [];
  const base = `/searches/${s.projectId}`;
  const add = (
    id: string,
    priority: 1 | 2 | 3,
    title: string,
    detail: string,
    path: string,
    thread: ActionThread = "pipeline",
  ) =>
    actions.push({
      id,
      priority,
      title,
      detail,
      href: `${base}${path}`,
      thread,
    });

  // Foundation gaps first — everything downstream depends on them.
  if (!s.hasJobDescription) {
    add(
      "add_jd",
      1,
      "Add the job description",
      "Role intelligence, intake, and strategy all start from the JD (or a manual role brief).",
      "/role",
    );
  } else if (!s.hasRoleIntelligence) {
    add(
      "run_role_intel",
      1,
      "Extract role intelligence",
      "Turn the JD into requirements, signals, assumptions, and open questions you can edit.",
      "/role",
    );
  }

  if (s.hasRoleIntelligence && !s.hasIntake) {
    add(
      "generate_intake",
      1,
      "Generate the hiring-manager intake",
      "The intake resolves what the JD can't tell you — run it before sourcing at scale.",
      "/intake",
    );
  }
  if (s.hasIntake && s.unansweredIntakeCount > 0) {
    add(
      "capture_intake",
      1,
      `Capture ${s.unansweredIntakeCount} open intake answer${s.unansweredIntakeCount === 1 ? "" : "s"}`,
      "Unanswered intake questions become bad sourcing assumptions.",
      "/intake",
      "hiring_manager",
    );
  }
  if (s.hasRoleIntelligence && s.unresolvedQuestionCount > 0) {
    add(
      "resolve_questions",
      2,
      `Resolve ${s.unresolvedQuestionCount} unresolved requirement question${s.unresolvedQuestionCount === 1 ? "" : "s"}`,
      "These are flagged in role intelligence; take them to the hiring manager.",
      "/role",
      "hiring_manager",
    );
  }
  if (s.intakeComplete && !s.hasSuccessProfile) {
    add(
      "compile_profile",
      1,
      "Compile the success profile",
      "Intake answers are in — turn them into a structured, provenance-tracked profile.",
      "/profile",
    );
  }
  if (s.hasSuccessProfile && !s.hasStrategy) {
    add(
      "generate_strategy",
      2,
      "Generate the sourcing strategy",
      "Target and adjacent populations, titles, companies, and geographies.",
      "/strategy",
    );
  }
  if (s.hasStrategy && s.channelCount === 0) {
    add(
      "generate_channels",
      2,
      "Map sourcing channels",
      "Where this population actually exists — ranked, with reasons.",
      "/sources",
    );
  }
  if (s.hasStrategy && s.queryCount === 0) {
    add(
      "generate_strings",
      2,
      "Build search strings",
      "Boolean and x-ray variants across platforms, ready to run.",
      "/strings",
    );
  }

  // Live pipeline work.
  if (s.followUpsDueCount > 0) {
    add(
      "follow_ups",
      1,
      `${s.followUpsDueCount} follow-up${s.followUpsDueCount === 1 ? "" : "s"} due`,
      "Candidates with a next action due today or overdue.",
      "/candidates",
      "candidate",
    );
  }
  if (s.candidatesNeedingReview > 0) {
    add(
      "review_candidates",
      2,
      `${s.candidatesNeedingReview} candidate${s.candidatesNeedingReview === 1 ? "" : "s"} awaiting review`,
      "Run evidence alignment and decide who to contact.",
      "/candidates",
    );
  }
  if (s.queryCount > 0 && s.candidateCount === 0) {
    add(
      "source_candidates",
      2,
      "Start sourcing",
      "Search strings exist but no candidates are recorded yet.",
      "/strings",
    );
  }
  if (s.outreachSent >= 10 && s.outreachReplied / s.outreachSent < 0.1) {
    add(
      "diagnose_response",
      2,
      "Response rate is low — diagnose",
      `${s.outreachReplied}/${s.outreachSent} replies. Check population fit, personalization, and positioning.`,
      "/analytics",
    );
  }
  if (s.stalledCandidateCount > 0) {
    add(
      "unstick_candidates",
      3,
      `${s.stalledCandidateCount} candidate${s.stalledCandidateCount === 1 ? "" : "s"} stalled > ${s.stalledThresholdDays} days`,
      "No pipeline movement recently — advance, park, or archive them.",
      "/pipeline",
      "candidate",
    );
  }
  if (s.openTaskCount > 0) {
    add(
      "open_tasks",
      3,
      `${s.openTaskCount} open task${s.openTaskCount === 1 ? "" : "s"}`,
      "Review the task list for this search.",
      "/../../tasks",
    );
  }

  // W9 — hiring-manager thread.
  if (s.intakeComplete && !s.hasHmBrief) {
    add(
      "generate_hm_brief",
      2,
      "Generate the hiring-manager brief",
      "A three-minute brief that keeps the HM calibrated and teaches evidence-anchored feedback.",
      "/guide",
      "hiring_manager",
    );
  }
  if (s.hmReviewPendingCount > 0) {
    add(
      "collect_hm_feedback",
      1,
      `${s.hmReviewPendingCount} candidate${s.hmReviewPendingCount === 1 ? "" : "s"} awaiting HM feedback`,
      "Collect an evidence-anchored advance/hold/pass — every pass calibrates the search.",
      "/guide",
      "hiring_manager",
    );
  }

  // W9 — candidate thread.
  if (s.interviewingWithoutPrepCount > 0) {
    add(
      "send_interview_prep",
      2,
      `${s.interviewingWithoutPrepCount} interviewing candidate${s.interviewingWithoutPrepCount === 1 ? "" : "s"} without a prep packet`,
      "Draft the interview-prep packet so they can show their real work well.",
      "/candidates",
      "candidate",
    );
  }
  if (s.offersWithoutClosePlanCount > 0) {
    add(
      "create_close_plan",
      1,
      `${s.offersWithoutClosePlanCount} offer${s.offersWithoutClosePlanCount === 1 ? "" : "s"} without a close plan`,
      "Motivations, concerns, competing processes — before the offer conversation, not after.",
      "/close",
      "candidate",
    );
  }

  return actions.sort((a, b) => a.priority - b.priority);
}
