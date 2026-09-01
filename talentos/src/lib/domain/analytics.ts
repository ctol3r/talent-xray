/**
 * Funnel analytics computed deterministically from pipeline events and
 * outreach message records. No LLM involvement anywhere in this module.
 */

export interface StageRecord {
  key: string;
  label: string;
  position: number;
  isTerminal: boolean;
}

export interface StageEventRecord {
  candidateId: string;
  fromStage: string | null;
  toStage: string;
  occurredAt: string;
}

export interface OutreachRecord {
  status: "drafted" | "sent" | "replied" | "no_reply";
}

export interface FunnelStage {
  key: string;
  label: string;
  /** Distinct candidates who have ever entered this stage. */
  reached: number;
  /** reached ÷ reached-of-previous-non-terminal-stage; null when undefined. */
  conversionFromPrevious: number | null;
}

export function computeFunnel(
  stages: StageRecord[],
  events: StageEventRecord[],
): FunnelStage[] {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const reachedBy = new Map<string, Set<string>>();
  for (const event of events) {
    if (!reachedBy.has(event.toStage)) reachedBy.set(event.toStage, new Set());
    reachedBy.get(event.toStage)?.add(event.candidateId);
  }
  const funnel: FunnelStage[] = [];
  let previousReached: number | null = null;
  for (const stage of ordered) {
    const reached = reachedBy.get(stage.key)?.size ?? 0;
    let conversion: number | null = null;
    if (!stage.isTerminal) {
      if (previousReached !== null && previousReached > 0) {
        conversion = reached / previousReached;
      }
      previousReached = reached;
    }
    funnel.push({
      key: stage.key,
      label: stage.label,
      reached,
      conversionFromPrevious: stage.isTerminal ? null : conversion,
    });
  }
  return funnel;
}

/** Average time spent in each stage (completed visits only), in milliseconds. */
export function computeTimeInStage(
  events: StageEventRecord[],
): Record<string, number> {
  const byCandidate = new Map<string, StageEventRecord[]>();
  for (const event of events) {
    if (!byCandidate.has(event.candidateId)) {
      byCandidate.set(event.candidateId, []);
    }
    byCandidate.get(event.candidateId)?.push(event);
  }
  const totals = new Map<string, { totalMs: number; visits: number }>();
  for (const list of byCandidate.values()) {
    const sorted = [...list].sort((a, b) =>
      a.occurredAt.localeCompare(b.occurredAt),
    );
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const stageKey = sorted[i].toStage;
      const ms =
        new Date(sorted[i + 1].occurredAt).getTime() -
        new Date(sorted[i].occurredAt).getTime();
      if (ms < 0) continue;
      const entry = totals.get(stageKey) ?? { totalMs: 0, visits: 0 };
      entry.totalMs += ms;
      entry.visits += 1;
      totals.set(stageKey, entry);
    }
  }
  const result: Record<string, number> = {};
  for (const [key, { totalMs, visits }] of totals) {
    result[key] = visits > 0 ? totalMs / visits : 0;
  }
  return result;
}

export interface OutreachStats {
  drafted: number;
  sent: number;
  replied: number;
  responseRate: number | null;
}

export function computeOutreachStats(
  messages: OutreachRecord[],
): OutreachStats {
  const drafted = messages.length;
  const sent = messages.filter(
    (m) => m.status === "sent" || m.status === "replied" || m.status === "no_reply",
  ).length;
  const replied = messages.filter((m) => m.status === "replied").length;
  return {
    drafted,
    sent,
    replied,
    responseRate: sent > 0 ? replied / sent : null,
  };
}

export interface SourceEffectivenessRow {
  sourceType: string;
  candidates: number;
  reachedScreenOrBeyond: number;
}

/**
 * How well each candidate source performs, measured as candidates who ever
 * reached a stage at or past `screenStageKey`.
 */
export function computeSourceEffectiveness(
  candidateSourceTypes: Map<string, string[]>,
  events: StageEventRecord[],
  stages: StageRecord[],
  screenStageKey = "recruiter_screen",
): SourceEffectivenessRow[] {
  const screenPosition =
    stages.find((s) => s.key === screenStageKey)?.position ?? Infinity;
  const positionByKey = new Map(stages.map((s) => [s.key, s.position]));
  const advanced = new Set<string>();
  for (const event of events) {
    const pos = positionByKey.get(event.toStage);
    if (pos !== undefined && pos >= screenPosition) {
      advanced.add(event.candidateId);
    }
  }
  const rows = new Map<string, SourceEffectivenessRow>();
  for (const [candidateId, sourceTypes] of candidateSourceTypes) {
    for (const sourceType of new Set(sourceTypes)) {
      const row = rows.get(sourceType) ?? {
        sourceType,
        candidates: 0,
        reachedScreenOrBeyond: 0,
      };
      row.candidates += 1;
      if (advanced.has(candidateId)) row.reachedScreenOrBeyond += 1;
      rows.set(sourceType, row);
    }
  }
  return [...rows.values()].sort((a, b) => b.candidates - a.candidates);
}
