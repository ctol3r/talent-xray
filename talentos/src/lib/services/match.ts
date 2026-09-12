/**
 * A candidate's match against the job they sit in.
 *
 * Assembled from two things that already exist: the evidence alignment
 * stored for the candidate, and the canonical requirements for the job. The
 * second is what supplies each criterion's kind, which is what makes a
 * must-have weigh more than a nice-to-have and a disqualifier run the other
 * way. Without it every criterion would count the same and the number would
 * mean nothing.
 *
 * The success profile is consulted where the requirements do not answer,
 * which is what makes recalibrating the profile show up in the score. A
 * criterion nothing recognises used to become "preferred" by default even
 * when the profile plainly called it a must-have; now the default is the
 * last resort rather than the second one. It follows that a requirement
 * moved from must-have to preferred by an answer on the hill weighs less on
 * the next candidate assessed against it, and one dropped from the profile
 * altogether stops carrying a must-have's weight — the shape of the number
 * does not change, only what feeds it.
 *
 * Returns null when there is no alignment yet, rather than a zero. A
 * candidate nobody has assessed has no score, and showing 0% would say
 * something false about them.
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  candidateEvidence,
  candidates,
  successProfiles,
} from "@/lib/db/schema";
import { evidenceAlignmentPayloadSchema } from "@/lib/core/payloads";
import {
  scoreMatch,
  type MatchScore,
  type RequirementKind,
} from "@/lib/domain/match-score";
import { getIntelligence } from "./intelligence";
import { criteriaOf, criteriaList } from "./profile-calibration";
import type { CriterionTier } from "../../../artifact-src/core/profile-calibration";

/**
 * A profile tier read as a requirement kind. The profile has no tier for a
 * disqualifier — `negativeSignals` is a different idea, and a signal that
 * predicts failure is not the same as a criterion that rules somebody out —
 * so nothing here can produce one by accident.
 */
const PROFILE_TIER_KIND: Record<CriterionTier, RequirementKind> = {
  mustHave: "must_have",
  preferred: "preferred",
  trainable: "trainable",
};

export async function candidateMatch(
  db: Db,
  candidateId: string,
): Promise<MatchScore | null> {
  const row = db
    .select()
    .from(candidateEvidence)
    .where(eq(candidateEvidence.candidateId, candidateId))
    .get();
  if (!row) return null;

  const parsed = evidenceAlignmentPayloadSchema.safeParse(row.payload);
  if (!parsed.success || parsed.data.items.length === 0) return null;

  const person = db
    .select()
    .from(candidates)
    .where(eq(candidates.id, candidateId))
    .get();
  if (!person) return null;

  const intelligence = await getIntelligence(db, person.searchProjectId);
  const requirements = intelligence?.payload.intent.requirements ?? [];
  const byId = new Map(requirements.map((req) => [req.id, req.kind]));
  const byLabel = new Map(
    requirements.map((req) => [req.label.toLowerCase(), req.kind]),
  );

  const profileRow = db
    .select()
    .from(successProfiles)
    .where(eq(successProfiles.searchProjectId, person.searchProjectId))
    .get();
  const profileById = new Map<string, RequirementKind>();
  const profileByText = new Map<string, RequirementKind>();
  if (profileRow) {
    const criteria = criteriaOf(profileRow.payload);
    for (const criterion of criteriaList(criteria)) {
      const kind = PROFILE_TIER_KIND[criterion.tier];
      profileById.set(criterion.id, kind);
      profileByText.set(criterion.text.toLowerCase(), kind);
    }
  }

  // A criterion is matched to its requirement by id where the alignment
  // carried one, and by label otherwise; the success profile answers where
  // the requirements do not. Anything still unmatched is treated as
  // preferred — the middle weight, so an unknown criterion neither dominates
  // the number nor disappears from it.
  const kindOf = (criterion: string, id?: string): RequirementKind => {
    const text = criterion.toLowerCase();
    return (
      (id ? byId.get(id) : undefined) ??
      (id ? profileById.get(id) : undefined) ??
      byLabel.get(text) ??
      profileByText.get(text) ??
      "preferred"
    );
  };

  return scoreMatch(parsed.data.items, kindOf);
}

/** Every candidate in a job, with their score where one exists. */
export async function jobMatches(
  db: Db,
  searchProjectId: string,
): Promise<Map<string, MatchScore>> {
  const people = db
    .select()
    .from(candidates)
    .where(eq(candidates.searchProjectId, searchProjectId))
    .all();
  const out = new Map<string, MatchScore>();
  for (const person of people) {
    const score = await candidateMatch(db, person.id);
    if (score) out.set(person.id, score);
  }
  return out;
}
