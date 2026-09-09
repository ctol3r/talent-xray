/**
 * When a job keeps saying no in the same place, ask what the profile got wrong.
 *
 * A rejection is information about a candidate. Four rejections at one stage,
 * against a profile nobody has touched, is information about the profile — and
 * until now the app had no way to say so. It could show you the four, and it
 * could show you the bar, and it left the join between them entirely to you.
 *
 * So this raises exactly one question: which requirement was wrong? It is
 * asked on the hill, beside the chart, because that is where the job's
 * unknowns already live and "the manager and I agree" is one of them.
 *
 * Four refusals hold this up, and they are the whole design:
 *
 * 1. **It does not answer its own question.** Nothing here reads the hiring
 *    manager's words and nominates a requirement. The notes are shown
 *    verbatim next to the list; the recruiter picks. A guess dressed as a
 *    finding is worse than no finding, because the recruiter would stop
 *    reading the notes and start confirming the software. Manual first. If
 *    something automatic is ever added it goes beside this, labelled, and
 *    never in the answer's place.
 *
 * 2. **"The profile is right" is an answer.** It records a revision, and it
 *    clears the question for the next N rejections. Without it, the only way
 *    to stop being asked is to change something, and a question that can only
 *    be silenced by agreeing with it is not a question.
 *
 * 3. **Nothing here touches a candidate.** No disposition is revisited, no
 *    rejection is reversed, nobody is re-scored retroactively as a
 *    consequence of an answer. The profile changes; the people do not.
 *
 * 4. **Only `not_selected` counts.** A withdrawal is the candidate's decision
 *    about the job, not the job's decision about its bar, and counting it
 *    would make the question fire on searches whose profile is fine.
 *
 * Imports nothing, so the same rules run in the browser-only artifact.
 */

/** How many rejections at one stage, since the last revision, before asking. */
export const REJECTIONS_BEFORE_ASKING = 3;

/** Minimum length of the recruiter's own words on a revision. */
export const MIN_NOTE_CHARS = 5;

export type CriterionTier = "mustHave" | "preferred" | "trainable";

export const TIER_LABEL: Record<CriterionTier, string> = {
  mustHave: "must have",
  preferred: "preferred",
  trainable: "trainable",
};

/** Where a tier goes when a requirement turns out to have been too strict. */
export const RELAXES_TO: Record<CriterionTier, CriterionTier | null> = {
  mustHave: "preferred",
  preferred: "trainable",
  // Nothing below trainable. A trainable requirement that is still wrong is
  // not too strict — it is not a requirement, and the answer is to drop it.
  trainable: null,
};

/** One criterion of the profile, flattened out of its tier. */
export interface ProfileCriterion {
  /** Stable where the profile carried one; the text otherwise. */
  id: string;
  text: string;
  tier: CriterionTier;
}

/** The three tiers a candidate is measured against. */
export interface ProfileCriteria {
  mustHave: ProfileCriterion[];
  preferred: ProfileCriterion[];
  trainable: ProfileCriterion[];
}

/**
 * One "not selected", as it stands right now.
 *
 * `note` is the hiring manager's own words where they recorded any. It is
 * read live from the candidate rather than copied, so a deleted candidate
 * takes their words out of the history with them.
 */
export interface Rejection {
  candidateId: string;
  candidateName: string;
  stage: string;
  stageLabel: string;
  /** When the pass was recorded, or when the record last changed. */
  at: string;
  note: string;
}

export type RevisionChange =
  | {
      kind: "relaxed";
      criterionId: string;
      text: string;
      from: CriterionTier;
      to: CriterionTier;
    }
  | { kind: "dropped"; criterionId: string; text: string; from: CriterionTier }
  | {
      kind: "reworded";
      criterionId: string;
      from: string;
      to: string;
      tier: CriterionTier;
    }
  | { kind: "added"; criterionId: string; text: string; tier: CriterionTier }
  | { kind: "affirmed" };

/**
 * One entry in the profile's history.
 *
 * `promptedBy` holds candidate ids and nothing else. The names and the words
 * are resolved from the live records when the history is read, so that
 * deleting a candidate deletes what they were told about, and the entry
 * degrades to "a record that is no longer here" rather than outliving it.
 */
export interface ProfileRevision {
  at: string;
  by: string;
  /** Why, in the recruiter's own words. Never generated. */
  note: string;
  change: RevisionChange;
  promptedBy: {
    stage: string;
    stageLabel: string;
    candidateIds: string[];
  };
}

export interface CalibrationQuestion {
  stage: string;
  stageLabel: string;
  /** The rejections that have not been answered yet, oldest first. */
  rejections: Rejection[];
  /** Every criterion the recruiter may name, in the profile's own order. */
  criteria: ProfileCriterion[];
  /** The count, said as counts. */
  says: string;
  /** The question itself. */
  asks: string;
}

// ---------------------------------------------------------------------------
// reading the profile

export function criteriaList(profile: ProfileCriteria): ProfileCriterion[] {
  return [...profile.mustHave, ...profile.preferred, ...profile.trainable];
}

export function findCriterion(
  profile: ProfileCriteria,
  criterionId: string,
): ProfileCriterion | null {
  return criteriaList(profile).find((c) => c.id === criterionId) ?? null;
}

// ---------------------------------------------------------------------------
// asking

/** The moment the profile was last answered for, or null if it never was. */
export function lastAnsweredAt(revisions: ProfileRevision[]): string | null {
  let latest: string | null = null;
  for (const revision of revisions) {
    if (latest === null || revision.at > latest) latest = revision.at;
  }
  return latest;
}

/**
 * The one question, or none.
 *
 * Counted per stage and only from rejections recorded since the last answer,
 * so answering clears it and the next three raise it again. Deliberately not
 * cumulative: a job that was asked at three and answered honestly should not
 * be asked again at four.
 */
export function askCalibration(
  rejections: Rejection[],
  profile: ProfileCriteria,
  revisions: ProfileRevision[],
  threshold: number = REJECTIONS_BEFORE_ASKING,
): CalibrationQuestion | null {
  const criteria = criteriaList(profile);
  // Nothing to name means nothing to ask. A job with no compiled profile is
  // not miscalibrated; it is uncompiled, and that is a different sentence.
  if (criteria.length === 0) return null;

  const since = lastAnsweredAt(revisions);
  const unanswered = rejections.filter((r) => since === null || r.at > since);

  const byStage = new Map<string, Rejection[]>();
  for (const rejection of unanswered) {
    const list = byStage.get(rejection.stage);
    if (list) list.push(rejection);
    else byStage.set(rejection.stage, [rejection]);
  }

  let chosen: Rejection[] | null = null;
  // Most rejections wins; then the most recent; then the stage key, so the
  // same data always produces the same question.
  for (const list of [...byStage.values()].sort(compareStageGroups)) {
    if (list.length >= threshold) {
      chosen = list;
      break;
    }
  }
  if (!chosen) return null;

  const ordered = [...chosen].sort((a, b) => a.at.localeCompare(b.at));
  const first = ordered[0];
  return {
    stage: first.stage,
    stageLabel: first.stageLabel,
    rejections: ordered,
    criteria,
    says: `${ordered.length} ${ordered.length === 1 ? "person" : "people"} turned down at ${first.stageLabel}, against a profile that has not changed since.`,
    asks: "Which requirement was wrong?",
  };
}

function latestOf(list: Rejection[]): string {
  return list.reduce((max, r) => (r.at > max ? r.at : max), "");
}

function compareStageGroups(a: Rejection[], b: Rejection[]): number {
  if (b.length !== a.length) return b.length - a.length;
  const byRecency = latestOf(b).localeCompare(latestOf(a));
  if (byRecency !== 0) return byRecency;
  return a[0].stage.localeCompare(b[0].stage);
}

// ---------------------------------------------------------------------------
// answering

export class CalibrationRefused extends Error {}

/**
 * Apply one answer to the criteria. Returns new criteria; nothing mutates.
 *
 * Refuses rather than guesses: an edit naming a criterion the profile does
 * not hold, or one the profile cannot make, throws. Silently doing something
 * near enough would put a change in the history that the recruiter did not
 * make.
 */
export function applyChange(
  profile: ProfileCriteria,
  change: RevisionChange,
): ProfileCriteria {
  if (change.kind === "affirmed") return profile;

  if (change.kind === "added") {
    const text = change.text.trim();
    if (!text) throw new CalibrationRefused("A new requirement needs wording.");
    if (
      criteriaList(profile).some(
        (c) => c.text.trim().toLowerCase() === text.toLowerCase(),
      )
    )
      throw new CalibrationRefused(
        `The profile already asks for "${text}". Reword that one rather than adding a second.`,
      );
    return {
      ...profile,
      [change.tier]: [
        ...profile[change.tier],
        { id: change.criterionId, text, tier: change.tier },
      ],
    };
  }

  const existing = findCriterion(profile, change.criterionId);
  if (!existing)
    throw new CalibrationRefused(
      "That requirement is not in the profile any more. Reload the page and answer against what it says now.",
    );

  const without = (tier: CriterionTier) =>
    profile[tier].filter((c) => c.id !== change.criterionId);

  if (change.kind === "dropped") {
    return { ...profile, [existing.tier]: without(existing.tier) };
  }

  if (change.kind === "reworded") {
    const text = change.to.trim();
    if (!text)
      throw new CalibrationRefused("A reworded requirement needs wording.");
    return {
      ...profile,
      [existing.tier]: profile[existing.tier].map((c) =>
        c.id === change.criterionId ? { ...c, text } : c,
      ),
    };
  }

  const to = RELAXES_TO[existing.tier];
  if (!to)
    throw new CalibrationRefused(
      `"${existing.text}" is already trainable. A trainable requirement that is still wrong is not too strict — drop it instead.`,
    );
  return {
    ...profile,
    [existing.tier]: without(existing.tier),
    [to]: [...profile[to], { ...existing, tier: to }],
  };
}

/**
 * Fill in the parts of a change that come from the profile rather than the
 * form, so the history records what the criterion actually said at the time
 * rather than what the browser thought it said.
 */
export function describeChange(
  profile: ProfileCriteria,
  intent:
    | { kind: "relaxed" | "dropped"; criterionId: string }
    | { kind: "reworded"; criterionId: string; to: string }
    | { kind: "added"; criterionId: string; text: string; tier: CriterionTier }
    | { kind: "affirmed" },
): RevisionChange {
  if (intent.kind === "affirmed") return { kind: "affirmed" };
  if (intent.kind === "added")
    return {
      kind: "added",
      criterionId: intent.criterionId,
      text: intent.text.trim(),
      tier: intent.tier,
    };

  const existing = findCriterion(profile, intent.criterionId);
  if (!existing)
    throw new CalibrationRefused(
      "That requirement is not in the profile any more. Reload the page and answer against what it says now.",
    );

  if (intent.kind === "dropped")
    return {
      kind: "dropped",
      criterionId: existing.id,
      text: existing.text,
      from: existing.tier,
    };

  if (intent.kind === "reworded")
    return {
      kind: "reworded",
      criterionId: existing.id,
      from: existing.text,
      to: intent.to.trim(),
      tier: existing.tier,
    };

  const to = RELAXES_TO[existing.tier];
  if (!to)
    throw new CalibrationRefused(
      `"${existing.text}" is already trainable. A trainable requirement that is still wrong is not too strict — drop it instead.`,
    );
  return {
    kind: "relaxed",
    criterionId: existing.id,
    text: existing.text,
    from: existing.tier,
    to,
  };
}

/** What a revision did, in one line, for the history. */
export function changeSays(change: RevisionChange): string {
  switch (change.kind) {
    case "relaxed":
      return `"${change.text}" moved from ${TIER_LABEL[change.from]} to ${TIER_LABEL[change.to]}`;
    case "dropped":
      return `"${change.text}" dropped from ${TIER_LABEL[change.from]}`;
    case "reworded":
      return `"${change.from}" reworded to "${change.to}"`;
    case "added":
      return `"${change.text}" added as ${TIER_LABEL[change.tier]}`;
    case "affirmed":
      return "no change — the profile was judged right as it stood";
  }
}
