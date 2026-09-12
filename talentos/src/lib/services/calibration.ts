/**
 * Calibration signals for a search (Wave B, D-030): every candidate's
 * review workspace → link outcomes → per-requirement signals, with the
 * requirement `kind` joined from the live IR (the comparison snapshot drops
 * it). Read-only; nothing here writes.
 */
import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { hiringIntelligence } from "@/lib/db/schema";
import {
  buildSignals,
  summarizeOutcomes,
  type CalibrationSignals,
  type LinkOutcome,
} from "@/lib/domain/calibration";
import { listCandidates } from "./candidates";
import { reviewWorkspace } from "./document-review";

export interface CalibrationContext {
  signals: CalibrationSignals;
  outcomes: LinkOutcome[];
}

export async function loadCalibrationSignals(
  db: Db,
  searchProjectId: string,
): Promise<CalibrationContext> {
  const ir = db
    .select()
    .from(hiringIntelligence)
    .where(eq(hiringIntelligence.searchProjectId, searchProjectId))
    .get();
  const requirements = (ir?.payload.intent.requirements ?? []).map((r) => ({
    id: r.id,
    label: r.label,
    kind: r.kind,
  }));
  const candidates = await listCandidates(db, searchProjectId);
  const outcomes: LinkOutcome[] = [];
  for (const candidate of candidates) {
    const w = reviewWorkspace(db, searchProjectId, candidate.id);
    if (w.links.length === 0) continue;
    outcomes.push(
      ...summarizeOutcomes(
        w.links,
        w.reviews,
        w.comparisons.map((c) => ({ id: c.id, candidateId: c.candidateId })),
      ),
    );
  }
  return { signals: buildSignals(outcomes, requirements), outcomes };
}

export function requirementLabels(
  db: Db,
  searchProjectId: string,
): Map<string, string> {
  const ir = db
    .select()
    .from(hiringIntelligence)
    .where(eq(hiringIntelligence.searchProjectId, searchProjectId))
    .get();
  return new Map(
    (ir?.payload.intent.requirements ?? [])
      .filter((r) => r.id)
      .map((r) => [r.id!, r.label]),
  );
}
