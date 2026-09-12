/**
 * Pure helpers that make the HSAL loop work for ANY search project, not just
 * the seeded SP104 demo: pipeline counts derived from the workstation's own
 * pipeline events, Success Profile edits that preserve criterion identity,
 * and learning defaults drawn from the project record. No HSAL calls here.
 */
import type {
  CriterionCategory,
  PipelineSnapshot,
  PipelineStage,
  SearchLearningApplicability,
  SuccessCriterion,
  SuccessProfile,
} from "@talentos/hsal-adapter";
import {
  PIPELINE_STAGES,
  pipelineSnapshotSchema,
} from "@talentos/hsal-adapter";
import type { SuccessProfilePayload, TracedItem } from "@/lib/core/payloads";
import { successProfilePayloadSchema } from "@/lib/core/payloads";
import type { StageDefinition } from "@/lib/domain/pipeline";

// ---------------------------------------------------------------- criteria

export const slugId = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

export function inferCriterionCategory(label: string): CriterionCategory {
  const l = label.toLowerCase();
  // "Evidence of Staff-equivalent scope" is an experience criterion, not a title proxy.
  if (
    /\bscope\b|ownership|evidence of|equivalent|track record|has (built|led|owned)/.test(
      l,
    )
  )
    return "experience";
  if (/\btitle\b|\bstaff\b|\bprincipal\b|\bsenior\b/.test(l)) return "title";
  if (/\byears?\b|experience level|\bseniority\b/.test(l)) return "experience";
  if (
    /bay area|remote|on-?site|hybrid|located|relocat|\bnyc\b|\blondon\b/.test(l)
  )
    return "geography";
  if (/degree|\bphd\b|\bmsc?\b|\bbsc?\b|university/.test(l)) return "education";
  if (/industry|company experience|startup|enterprise|sector/.test(l))
    return "industry";
  return "skill";
}

export function tracedItemsToCriteria(items: TracedItem[]): SuccessCriterion[] {
  return items.map((item) => ({
    id: item.id ?? `CRIT-${slugId(item.text)}`,
    label: item.text,
    category: inferCriterionCategory(item.text),
    ...(item.note ? { rationale: item.note } : {}),
  }));
}

export function payloadToSuccessProfile(
  payload: SuccessProfilePayload | undefined,
): SuccessProfile {
  if (!payload) return { mustHave: [], preferred: [], transferable: [] };
  return {
    mustHave: tracedItemsToCriteria(payload.mustHave),
    preferred: tracedItemsToCriteria(payload.preferred),
    transferable: tracedItemsToCriteria(payload.trainable),
  };
}

/** One criterion label per line, for the edit form. */
export function criteriaToLines(criteria: SuccessCriterion[]): string {
  return criteria.map((c) => c.label).join("\n");
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Parse one-label-per-line text back into criteria. A label that matches an
 * existing criterion (in ANY list) keeps that criterion's id, category and
 * rationale, so moving "Go" from must-have to transferable is recorded as a
 * move of CRIT-GO rather than a delete plus an unrelated add.
 */
export function criteriaFromLines(
  text: string,
  existing: SuccessCriterion[],
  /** Ids already allocated by sibling lists, so new criteria never share an id across lists. */
  taken: Set<string> = new Set(),
): SuccessCriterion[] {
  const byLabel = new Map(existing.map((c) => [norm(c.label), c]));
  const byId = new Map(existing.map((c) => [c.id, c]));
  const out: SuccessCriterion[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const label = raw.trim().replace(/^[-*•]\s*/, "");
    if (!label) continue;
    const key = norm(label);
    if (seen.has(key)) continue;
    seen.add(key);
    const match = byLabel.get(key);
    if (match) {
      if (taken.has(match.id) || out.some((c) => c.id === match.id))
        throw new Error(
          `"${label}" resolves to criterion ${match.id}, which is already used in another list.`,
        );
      // Keep identity (id, category, rationale) but take the recruiter's spelling.
      out.push({ ...match, label });
      taken.add(match.id);
      continue;
    }
    let id = `CRIT-${slugId(label)}`;
    let n = 2;
    while (byId.has(id) || taken.has(id) || out.some((c) => c.id === id))
      id = `CRIT-${slugId(label)}-${n++}`;
    taken.add(id);
    out.push({ id, label, category: inferCriterionCategory(label) });
  }
  return out;
}

export interface ProfileLines {
  mustHave: string;
  preferred: string;
  transferable: string;
}

/**
 * Parse the three edited lists together. `known` criteria (the current
 * profile plus any preset such as a seeded "after" profile) keep their ids,
 * categories and rationales; a label listed twice is an error because a
 * criterion belongs to exactly one list.
 */
export function parseProfileLists(
  lines: ProfileLines,
  known: SuccessCriterion[],
): SuccessProfile {
  const labelsOf = (text: string) =>
    text
      .split(/\r?\n/)
      .map((l) => l.trim().replace(/^[-*•]\s*/, ""))
      .filter(Boolean);
  const seen = new Map<string, string>();
  for (const text of [lines.mustHave, lines.preferred, lines.transferable]) {
    const inThisList = new Set<string>();
    for (const label of labelsOf(text)) {
      const key = norm(label);
      if (inThisList.has(key)) continue;
      inThisList.add(key);
      if (seen.has(key))
        throw new Error(
          `"${seen.get(key)}" appears in more than one list; a criterion belongs to exactly one.`,
        );
      seen.set(key, label);
    }
  }
  const taken = new Set<string>();
  return {
    mustHave: criteriaFromLines(lines.mustHave, known, taken),
    preferred: criteriaFromLines(lines.preferred, known, taken),
    transferable: criteriaFromLines(lines.transferable, known, taken),
  };
}

/** Same criteria in the same lists with the same wording (identity and spelling both count). */
export function sameProfile(a: SuccessProfile, b: SuccessProfile): boolean {
  const sig = (cs: SuccessCriterion[]) =>
    cs.map((c) => `${c.id}=${c.label}`).join("|");
  return (
    sig(a.mustHave) === sig(b.mustHave) &&
    sig(a.preferred) === sig(b.preferred) &&
    sig(a.transferable) === sig(b.transferable)
  );
}

/**
 * Write edited criteria into the workstation's Success Profile payload,
 * keeping every other section (mission, outcomes, signals, …) and the
 * provenance/notes of criteria that already existed. New criteria are
 * attributed to the recruiter, because the recruiter typed them.
 */
export function mergeCriteriaIntoPayload(
  previous: SuccessProfilePayload | undefined,
  profile: SuccessProfile,
): SuccessProfilePayload {
  const prior = new Map<string, TracedItem>();
  for (const list of [
    previous?.mustHave,
    previous?.preferred,
    previous?.trainable,
  ]) {
    for (const item of list ?? []) {
      if (item.id) prior.set(item.id, item);
      prior.set(`text:${norm(item.text)}`, item);
    }
  }
  const traced = (items: SuccessCriterion[]): TracedItem[] =>
    items.map((c) => {
      const was = prior.get(c.id) ?? prior.get(`text:${norm(c.label)}`);
      return {
        id: c.id,
        text: c.label,
        provenance: was?.provenance ?? "recruiter",
        ...((was?.note ?? c.rationale)
          ? { note: was?.note ?? c.rationale }
          : {}),
      };
    });
  return successProfilePayloadSchema.parse({
    mission: previous?.mission ?? "",
    outcomes: previous?.outcomes ?? [],
    responsibilities: previous?.responsibilities ?? [],
    mustHave: traced(profile.mustHave),
    preferred: traced(profile.preferred),
    trainable: traced(profile.transferable),
    evidenceSignals: previous?.evidenceSignals ?? [],
    negativeSignals: previous?.negativeSignals ?? [],
    adjacentBackgrounds: previous?.adjacentBackgrounds ?? [],
    exemplarPeople: previous?.exemplarPeople ?? [],
    exemplarCompanies: previous?.exemplarCompanies ?? [],
    targetIndustries: previous?.targetIndustries ?? [],
    targetCompanies: previous?.targetCompanies ?? [],
    alternateTitles: previous?.alternateTitles ?? [],
    targetGeographies: previous?.targetGeographies ?? [],
    ...(previous?.compensationNote
      ? { compensationNote: previous.compensationNote }
      : {}),
    candidateMotivators: previous?.candidateMotivators ?? [],
    sellingPoints: previous?.sellingPoints ?? [],
    risks: previous?.risks ?? [],
    unresolvedQuestions: previous?.unresolvedQuestions ?? [],
  });
}

// ---------------------------------------------------------------- pipeline counts

/**
 * Which workstation pipeline stage marks "reached" for each HSAL funnel
 * stage. "positive_reply" has no stage of its own in the workstation, so it
 * is never derived: the recruiter enters it (the form leaves it blank).
 */
export const WORKSTATION_STAGE_FOR: Record<PipelineStage, string | null> = {
  sourced: "identified",
  outreach_sent: "contacted",
  reply: "responded",
  positive_reply: null,
  recruiter_screen: "recruiter_screen",
  hm_screen: "hm_review",
  onsite: "interviewing",
  offer: "offer_extended",
  hire: "offer_accepted",
};

export interface StageEvent {
  candidateId: string;
  toStage: string;
  occurredAt: string;
}

export interface DerivedCounts {
  /** Only funnel stages the workstation can derive; the rest are left for the recruiter. */
  counts: Partial<Record<PipelineStage, number>>;
  /** Funnel stages with no workstation stage (in this project's stage list) or none at all. */
  unmapped: PipelineStage[];
  /** Candidates active in the window (any pipeline event, terminal ones included). */
  candidates: number;
}

/**
 * Funnel counts for a window: the population is every candidate with ANY
 * pipeline event in the window (a rejection in the window keeps the candidate
 * in the denominator); each candidate's furthest non-terminal stage is taken
 * over all their events up to the window end, so a candidate advanced before
 * the window still counts where they stand. Terminal stages (closed,
 * archived) never count as progress. This differs from the Analytics funnel,
 * which counts all-time exact stage entries.
 */
export function deriveCountsFromEvents(
  stages: StageDefinition[],
  events: StageEvent[],
  period?: { start: string; end: string },
): DerivedCounts {
  const position = new Map(
    stages.filter((s) => !s.isTerminal).map((s) => [s.key, s.position]),
  );
  const endStamp = period ? `${period.end}T23:59:59.999Z` : undefined;
  const population = new Set<string>();
  const furthest = new Map<string, number>();
  for (const e of events) {
    if (endStamp && e.occurredAt > endStamp) continue;
    if (!period || e.occurredAt >= period.start) population.add(e.candidateId);
    const pos = position.get(e.toStage);
    if (pos === undefined) continue;
    furthest.set(
      e.candidateId,
      Math.max(furthest.get(e.candidateId) ?? -1, pos),
    );
  }
  const counts: Partial<Record<PipelineStage, number>> = {};
  const unmapped: PipelineStage[] = [];
  for (const stage of PIPELINE_STAGES) {
    const key = WORKSTATION_STAGE_FOR[stage];
    const pos = key ? position.get(key) : undefined;
    if (pos === undefined) {
      unmapped.push(stage);
      continue;
    }
    let n = 0;
    for (const id of population) if ((furthest.get(id) ?? -1) >= pos) n++;
    counts[stage] = n;
  }
  return { counts, unmapped, candidates: population.size };
}

/** One snapshot per project and period; re-recording the same period updates it. */
export function snapshotId(
  searchProjectId: string,
  periodStart: string,
  periodEnd: string,
): string {
  const d = (s: string) => s.replace(/-/g, "");
  return `PIPE-${searchProjectId}-${d(periodStart)}-${d(periodEnd)}`;
}

export function buildSnapshot(input: {
  searchProjectId: string;
  periodStart: string;
  periodEnd: string;
  counts: Record<string, number>;
  source: PipelineSnapshot["source"];
  observedAt: string;
  /** Explicit id (e.g. a seeded fixture id); defaults to project + period. */
  id?: string;
}): PipelineSnapshot {
  return pipelineSnapshotSchema.parse({
    id:
      input.id ??
      snapshotId(input.searchProjectId, input.periodStart, input.periodEnd),
    searchProjectId: input.searchProjectId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    counts: input.counts,
    observedAt: input.observedAt,
    source: input.source,
  });
}

export const isoDay = (iso: string) => iso.slice(0, 10);

/** Calendar day in the machine's local time zone, as YYYY-MM-DD. */
export function localDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Default reporting window for a baseline snapshot: the last six weeks, local dates. */
export function defaultPeriod(now: Date = new Date()): {
  start: string;
  end: string;
} {
  return {
    start: localDay(new Date(now.getTime() - 42 * 24 * 3600 * 1000)),
    end: localDay(now),
  };
}

// ---------------------------------------------------------------- learnings

export function nextLearningId(
  searchProjectId: string,
  existingIds: string[],
): string {
  const prefix = `LEARN-${searchProjectId}-`;
  let n = 1;
  for (const id of existingIds) {
    if (!id.startsWith(prefix)) continue;
    const k = Number(id.slice(prefix.length));
    if (Number.isFinite(k) && k >= n) n = k + 1;
  }
  return `${prefix}${String(n).padStart(3, "0")}`;
}

const splitList = (s: string | null | undefined) =>
  (s ?? "")
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Applicability tags drawn from the project record so a new learning starts scoped, not global. */
export function applicabilityFor(project: {
  roleTitle: string;
  seniority?: string | null;
  industry?: string | null;
  geography?: string | null;
}): SearchLearningApplicability {
  const roleFamilies = [
    project.roleTitle
      .replace(/\b(senior|staff|principal|lead|junior)\b/gi, "")
      .replace(/\s*\/\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ].filter(Boolean);
  return {
    roleFamilies,
    ...(project.seniority
      ? { seniority: splitList(project.seniority).map((s) => s.toLowerCase()) }
      : {}),
    ...(project.industry ? { industries: splitList(project.industry) } : {}),
    ...(project.geography ? { geographies: splitList(project.geography) } : {}),
  };
}

export const listToText = (xs: string[] | undefined) => (xs ?? []).join(", ");
export const textToList = (s: string) => splitList(s);
