/**
 * The sourcing plan: what one brief would do, before it does any of it.
 *
 * Every angle appears — the ones that run, the ones the recruiter opens
 * themselves, and the ones waiting on a connector. Dormant angles carry the
 * full query they would run and the sentence that turns them on, so the value
 * of a connector is visible before anyone pays for it. Nothing dormant is
 * executed.
 *
 * This is rule 6 of the product, applied to the whole fan-out: the composed
 * query is always visible and editable. Never hide what you searched.
 */
import {
  planAngles,
  type PlannedAngle,
  type SourcingAngle,
} from "@/lib/sourcing/angles";
import {
  availableConnectors,
  routeAngle,
  type ConnectorRouting,
  type ConnectorState,
} from "@/lib/sourcing/connectors";
import {
  describeBrief,
  expandedSkills,
  parseQuery,
  type SourcingBrief,
} from "@/lib/sourcing/query-language";
import { isDirect } from "@/lib/sourcing/ontology";
import type { Connector } from "@/lib/sourcing/connectors";

export interface PlannedQuery extends PlannedAngle {
  routing: ConnectorRouting;
}

/**
 * A structured source that answers the brief in its own request shape.
 *
 * These are not angles. An angle is search-operator syntax; a structured
 * source takes fielded parameters, so the two cannot be swapped and the page
 * must not pretend they can. Built by `structured-sources.ts`, which is the
 * only part of the engine that knows the adapters exist — everything in this
 * file stays free of them so the whole plan can run in a browser.
 */
export interface StructuredSourceRequest {
  connector: Connector;
  state: ConnectorState;
  /** The exact URL the source would be asked. Nothing is hidden (rule 6). */
  url: string;
  purpose: string;
  reason: string;
}

export interface SourcingPlan {
  brief: SourcingBrief;
  /** Rows for the "how Talent read your brief" panel. */
  reading: string[];
  /** Capabilities the brief named, and the neighbours they pulled in. */
  expansions: {
    label: string;
    reason: string;
    direct: boolean;
    weight: number;
  }[];
  /** Angles a connector will run. */
  running: PlannedQuery[];
  /** Angles composed for the recruiter to open. */
  handoff: PlannedQuery[];
  /** Angles waiting on a connector. Shown, never executed. */
  dormant: PlannedQuery[];
  /** Structured public APIs, and the request each would make. */
  structured: StructuredSourceRequest[];
  /** Everything the parser could not honour. */
  warnings: string[];
}

export interface PlanEnvironment {
  openIndex?: string;
  webSearchKey?: string;
  hostedEngine?: boolean;
}

export function buildPlan(
  query: string | SourcingBrief,
  env: PlanEnvironment = {},
  options: {
    includeAdjacent?: boolean;
    limit?: number;
    /** Supplied by the caller that knows the adapters. Omitted in the browser. */
    structured?: StructuredSourceRequest[];
  } = {},
): SourcingPlan {
  const brief = typeof query === "string" ? parseQuery(query) : query;
  const available = availableConnectors(env);

  const running: PlannedQuery[] = [];
  const handoff: PlannedQuery[] = [];
  const dormant: PlannedQuery[] = [];

  for (const planned of planAngles(brief, options)) {
    const routing = routeAngle(planned.angle.kind, available);
    const row: PlannedQuery = { ...planned, routing };
    const bucket: Record<ConnectorState, PlannedQuery[]> = {
      runs: running,
      handoff,
      dormant,
    };
    bucket[routing.state].push(row);
  }

  return {
    brief,
    reading: describeBrief(brief),
    expansions: expandedSkills(brief).map((e) => ({
      label: e.label,
      reason: e.reason,
      direct: isDirect(e),
      weight: e.weight,
    })),
    running,
    handoff,
    dormant,
    structured: options.structured ?? [],
    warnings: brief.warnings,
  };
}

/** One line summarising a plan, for a header or a log. */
export function summarisePlan(plan: SourcingPlan): string {
  const live =
    plan.running.length +
    plan.structured.filter((s) => s.state === "runs").length;
  const parts = [`${live} angles run`];
  if (plan.handoff.length > 0)
    parts.push(`${plan.handoff.length} to open yourself`);
  const dormant =
    plan.dormant.length +
    plan.structured.filter((s) => s.state === "dormant").length;
  if (dormant > 0) parts.push(`${dormant} waiting on a connector`);
  return parts.join(" · ");
}

export function angleRationale(angle: SourcingAngle): string {
  return angle.rationale;
}
