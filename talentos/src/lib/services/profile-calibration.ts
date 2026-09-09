/**
 * Reading the calibration question, and recording the answer against the
 * success profile.
 *
 * The rules are in `artifact-src/core/profile-calibration.ts`, which imports
 * nothing. This file knows three things the rules do not: where the
 * rejections are, where the profile is, and where the history goes.
 *
 * The history goes under a `profile-calibration:<job id>` settings key, the
 * same way the hill chart and the daily notes are stored, so every job has a
 * history the moment it has a profile and no migration runs to make that
 * true.
 *
 * It holds candidate ids and no candidate words. The hiring manager's note
 * already lives on the candidate record; copying it into a second place would
 * mean deleting a person left their words behind in the profile's history,
 * which is the kind of quiet duplication the deletion path cannot fix.
 */
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import {
  candidates,
  pipelineStages,
  settings,
  successProfiles,
} from "@/lib/db/schema";
import {
  successProfilePayloadSchema,
  type SuccessProfilePayload,
  type TracedItem,
} from "@/lib/core/payloads";
import { DEFAULT_PIPELINE_STAGES, stageLabel } from "@/lib/domain/pipeline";
import {
  applyChange,
  askCalibration,
  changeSays,
  criteriaList,
  describeChange,
  CalibrationRefused,
  MIN_NOTE_CHARS,
  REJECTIONS_BEFORE_ASKING,
  type CalibrationQuestion,
  type CriterionTier,
  type ProfileCriteria,
  type ProfileCriterion,
  type ProfileRevision,
  type Rejection,
} from "../../../artifact-src/core/profile-calibration";

const TIERS = ["mustHave", "preferred", "trainable"] as const;

function key(jobId: string): string {
  return `profile-calibration:${jobId}`;
}

// ── the stored history ────────────────────────────────────────────────────

const tierValue = z.enum(TIERS);

const changeValue = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("relaxed"),
    criterionId: z.string(),
    text: z.string(),
    from: tierValue,
    to: tierValue,
  }),
  z.object({
    kind: z.literal("dropped"),
    criterionId: z.string(),
    text: z.string(),
    from: tierValue,
  }),
  z.object({
    kind: z.literal("reworded"),
    criterionId: z.string(),
    from: z.string(),
    to: z.string(),
    tier: tierValue,
  }),
  z.object({
    kind: z.literal("added"),
    criterionId: z.string(),
    text: z.string(),
    tier: tierValue,
  }),
  z.object({ kind: z.literal("affirmed") }),
]);

const revisionValue = z.object({
  at: z.string(),
  by: z.string().max(80),
  note: z.string().min(MIN_NOTE_CHARS).max(2000),
  change: changeValue,
  promptedBy: z.object({
    stage: z.string(),
    stageLabel: z.string(),
    candidateIds: z.array(z.string()).max(200),
  }),
});

/**
 * Capped for the same reason the hill's trail is: this is read on every job
 * page. A hundred revisions to one profile is already a finding of its own.
 */
export const MAX_REVISIONS = 100;

export const calibrationValue = z.object({
  version: z.literal(1),
  revisions: z.array(revisionValue).max(MAX_REVISIONS),
});

/**
 * The history for a job. A malformed one is reported, never reset — returning
 * an empty history would let the next answer silently replace the record of
 * every previous one.
 */
export function readRevisions(db: Db, jobId: string): ProfileRevision[] {
  const row = db
    .select()
    .from(settings)
    .where(eq(settings.key, key(jobId)))
    .get();
  if (!row) return [];
  const parsed = calibrationValue.safeParse(row.value);
  if (!parsed.success)
    throw new Error(
      "The success profile's revision history could not be read. It has been preserved; repair or restore it before recording another answer.",
    );
  return [...parsed.data.revisions].sort((a, b) => a.at.localeCompare(b.at));
}

function writeRevisions(db: Db, jobId: string, revisions: ProfileRevision[]) {
  const value = calibrationValue.parse({
    version: 1,
    revisions: revisions.slice(-MAX_REVISIONS),
  });
  db.insert(settings)
    .values({ key: key(jobId), value })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: new Date().toISOString() },
    })
    .run();
}

// ── the profile, as three tiers ───────────────────────────────────────────

/**
 * A criterion's id is its own where the profile carried one and its text
 * otherwise, because that is exactly the key the match score already falls
 * back to when it looks a criterion up.
 */
function idOf(item: TracedItem): string {
  return item.id ?? item.text;
}

export function criteriaOf(payload: SuccessProfilePayload): ProfileCriteria {
  const tier = (items: TracedItem[], name: CriterionTier): ProfileCriterion[] =>
    items.map((item) => ({ id: idOf(item), text: item.text, tier: name }));
  return {
    mustHave: tier(payload.mustHave, "mustHave"),
    preferred: tier(payload.preferred, "preferred"),
    trainable: tier(payload.trainable, "trainable"),
  };
}

/**
 * Write the criteria back onto the payload, keeping every field the question
 * did not ask about. A criterion that moved tier keeps its provenance — where
 * a requirement came from does not change because the bar for it did — and a
 * reworded one is marked as the recruiter's, because now it is.
 */
export function applyCriteria(
  payload: SuccessProfilePayload,
  criteria: ProfileCriteria,
): SuccessProfilePayload {
  const before = new Map(
    [...payload.mustHave, ...payload.preferred, ...payload.trainable].map(
      (item) => [idOf(item), item],
    ),
  );
  const rebuild = (list: ProfileCriterion[]): TracedItem[] =>
    list.map((criterion) => {
      const original = before.get(criterion.id);
      if (!original)
        return {
          id: criterion.id,
          text: criterion.text,
          provenance: "recruiter" as const,
          note: "Added when the profile was recalibrated.",
        };
      if (original.text === criterion.text) return original;
      return {
        ...original,
        text: criterion.text,
        provenance: "recruiter" as const,
        note: `Reworded from "${original.text}" when the profile was recalibrated.`,
      };
    });
  return successProfilePayloadSchema.parse({
    ...payload,
    mustHave: rebuild(criteria.mustHave),
    preferred: rebuild(criteria.preferred),
    trainable: rebuild(criteria.trainable),
  });
}

// ── the rejections ────────────────────────────────────────────────────────

function stagesFor(db: Db, jobId: string) {
  const rows = db
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.searchProjectId, jobId))
    .all();
  return rows.length > 0 ? rows : DEFAULT_PIPELINE_STAGES;
}

/**
 * Every "not selected" on this job, with the hiring manager's own words where
 * they recorded any.
 *
 * Dated from the pass that was recorded rather than from the row's timestamp,
 * because a candidate edited last week was not turned down last week, and the
 * date is what decides whether an answer has already covered them.
 */
export function rejectionsFor(db: Db, jobId: string): Rejection[] {
  const stages = stagesFor(db, jobId);
  const rows = db
    .select()
    .from(candidates)
    .where(
      and(
        eq(candidates.searchProjectId, jobId),
        eq(candidates.disposition, "not_selected"),
      ),
    )
    .all();
  return rows
    .map((row) => {
      const passes = (row.hmFeedback ?? []).filter(
        (entry) => entry.decision === "pass",
      );
      const last = passes[passes.length - 1];
      return {
        candidateId: row.id,
        candidateName: row.name,
        stage: row.stage,
        stageLabel: stageLabel(stages, row.stage),
        at: last?.at ?? row.updatedAt,
        note: last?.evidenceNote ?? "",
      };
    })
    .sort((a, b) => a.at.localeCompare(b.at));
}

// ── reading it all ────────────────────────────────────────────────────────

/** One revision, with the people it was prompted by resolved as they are now. */
export interface RevisionReading {
  revision: ProfileRevision;
  says: string;
  /** The prompting candidates that still exist, in the order recorded. */
  prompted: { candidateId: string; name: string }[];
  /** How many of them have since been deleted. */
  deleted: number;
}

export interface CalibrationReading {
  question: CalibrationQuestion | null;
  /** Newest first, which is the order anybody reads a history in. */
  history: RevisionReading[];
  threshold: number;
  /** Null when the job has no compiled profile to ask about. */
  profile: ProfileCriteria | null;
}

export function readCalibration(
  db: Db,
  jobId: string,
  threshold: number = REJECTIONS_BEFORE_ASKING,
): CalibrationReading {
  const row = db
    .select()
    .from(successProfiles)
    .where(eq(successProfiles.searchProjectId, jobId))
    .get();
  const profile = row ? criteriaOf(row.payload) : null;
  const revisions = readRevisions(db, jobId);
  const rejections = rejectionsFor(db, jobId);

  const names = new Map(
    db
      .select({ id: candidates.id, name: candidates.name })
      .from(candidates)
      .where(eq(candidates.searchProjectId, jobId))
      .all()
      .map((c) => [c.id, c.name]),
  );

  const history: RevisionReading[] = [...revisions]
    .reverse()
    .map((revision) => {
      const prompted = revision.promptedBy.candidateIds
        .map((id) => ({ candidateId: id, name: names.get(id) }))
        .filter((p): p is { candidateId: string; name: string } =>
          Boolean(p.name),
        );
      return {
        revision,
        says: changeSays(revision.change),
        prompted,
        deleted: revision.promptedBy.candidateIds.length - prompted.length,
      };
    });

  return {
    question: profile
      ? askCalibration(rejections, profile, revisions, threshold)
      : null,
    history,
    threshold,
    profile,
  };
}

// ── answering ─────────────────────────────────────────────────────────────

export const answerCalibrationInput = z.object({
  jobId: z.string().min(1),
  by: z.string().max(80).default("you"),
  /** Why. Required on every answer, including the one that changes nothing. */
  note: z.string().trim().min(MIN_NOTE_CHARS).max(2000),
  edit: z.discriminatedUnion("kind", [
    z.object({
      kind: z.enum(["relaxed", "dropped"]),
      criterionId: z.string().min(1),
    }),
    z.object({
      kind: z.literal("reworded"),
      criterionId: z.string().min(1),
      to: z.string().trim().min(1).max(400),
    }),
    z.object({
      kind: z.literal("added"),
      text: z.string().trim().min(1).max(400),
      tier: tierValue,
    }),
    z.object({ kind: z.literal("affirmed") }),
  ]),
});

/**
 * Record one answer: change the profile, and write down what changed, when,
 * and which dispositions prompted it.
 *
 * Both halves or neither. A profile that moved without a history entry is a
 * profile nobody can argue with later, which is the failure this whole loop
 * exists to fix.
 */
export function answerCalibration(
  db: Db,
  raw: unknown,
  now = new Date().toISOString(),
): ProfileRevision {
  const input = answerCalibrationInput.parse(raw);
  return db.transaction((tx) => {
    const row = tx
      .select()
      .from(successProfiles)
      .where(eq(successProfiles.searchProjectId, input.jobId))
      .get();
    if (!row)
      throw new CalibrationRefused(
        "This job has no success profile yet, so there is nothing to calibrate. Compile it first.",
      );

    const before = criteriaOf(row.payload);
    const revisions = readRevisions(tx, input.jobId);
    const question = askCalibration(
      rejectionsFor(tx, input.jobId),
      before,
      revisions,
      REJECTIONS_BEFORE_ASKING,
    );
    if (!question)
      throw new CalibrationRefused(
        "There is no open question on this job right now. The profile is edited on its own page; this loop only records answers to a question the rejections actually raised.",
      );

    const intent =
      input.edit.kind === "added"
        ? {
            kind: "added" as const,
            criterionId: crypto.randomUUID(),
            text: input.edit.text,
            tier: input.edit.tier,
          }
        : input.edit;
    const change = describeChange(before, intent);
    const after = applyChange(before, change);

    const revision: ProfileRevision = {
      at: now,
      by: input.by,
      note: input.note,
      change,
      promptedBy: {
        stage: question.stage,
        stageLabel: question.stageLabel,
        candidateIds: question.rejections.map((r) => r.candidateId),
      },
    };

    if (change.kind !== "affirmed") {
      tx.update(successProfiles)
        .set({
          payload: applyCriteria(row.payload, after),
          updatedAt: now,
        })
        .where(eq(successProfiles.searchProjectId, input.jobId))
        .run();
    }
    writeRevisions(tx, input.jobId, [...revisions, revision]);
    return revision;
  });
}

export { CalibrationRefused, criteriaList, REJECTIONS_BEFORE_ASKING };
export type {
  CalibrationQuestion,
  ProfileCriteria,
  ProfileRevision,
  Rejection,
};
