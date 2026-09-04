/**
 * Module registry, dependency graph and the ONE derived state per module
 * (spec P0-B, §6). Nothing stores a module state; it is computed from the
 * stored record, the current search-context version, the research status
 * and the states of upstream modules.
 */
import type { ContextChange, SearchContext } from "./search-context";
import type { ResearchStatus } from "./research";
import type { ActionType } from "./envelope";

export const MODULE_KEYS = [
  "hiring_need",
  "intake_loop",
  "role_intelligence",
  "intake",
  "success_profile",
  "market_intelligence",
  "sourcing_strategy",
  "channels",
  "search_strings",
  "candidates",
  "golden_test",
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export type ModuleStateName =
  | "not_started"
  | "researching"
  | "generating"
  | "current"
  | "aging"
  | "stale"
  | "blocked"
  | "failed"
  | "needs_review";

export const STATE_LABELS: Record<ModuleStateName, string> = {
  not_started: "Not started",
  researching: "Researching",
  generating: "Generating",
  current: "Current",
  aging: "Aging",
  stale: "Stale",
  blocked: "Blocked",
  failed: "Failed",
  needs_review: "Needs review",
};

export interface ModuleSpec {
  key: ModuleKey;
  label: string;
  /** Modules whose change makes this one stale. */
  upstream: ModuleKey[];
  /** Search-context fields whose change makes this one stale. */
  contextFields: Array<keyof SearchContext>;
  /** Makes market/company/competitive/channel/compensation claims → Research Gate. */
  requiresResearch: boolean;
  kind: "generated" | "loop" | "collection" | "benchmark";
}

const ROLE_FIELDS: Array<keyof SearchContext> = [
  "roleTitle",
  "company",
  "industry",
  "subindustry",
  "profession",
  "roleFamily",
  "seniority",
  "employmentType",
  "jobDescription",
  "businessObjective",
  "hiringReason",
  "teamContext",
  "constraints",
  "recruiterNotes",
  "selectedIndustryPack",
];
const MARKET_FIELDS: Array<keyof SearchContext> = [
  ...ROLE_FIELDS,
  "companyStage",
  "companySize",
  "companyBusinessModel",
  "companyReputationContext",
  "geography",
  "country",
  "jurisdiction",
  "workplaceModel",
  "compensationContext",
  "urgency",
  "availableTimeframe",
  "desiredStartDate",
];

export const MODULES: Record<ModuleKey, ModuleSpec> = {
  hiring_need: {
    key: "hiring_need",
    label: "Canonical IR",
    upstream: [],
    contextFields: ROLE_FIELDS,
    requiresResearch: false,
    kind: "generated",
  },
  intake_loop: {
    key: "intake_loop",
    label: "Intake loop",
    upstream: ["hiring_need"],
    contextFields: ["hiringManagerStatements"],
    requiresResearch: false,
    kind: "loop",
  },
  role_intelligence: {
    key: "role_intelligence",
    label: "Role Intelligence",
    upstream: [],
    contextFields: ROLE_FIELDS,
    requiresResearch: false,
    kind: "generated",
  },
  intake: {
    key: "intake",
    label: "HM Intake",
    upstream: ["hiring_need"],
    contextFields: ROLE_FIELDS,
    requiresResearch: false,
    kind: "generated",
  },
  success_profile: {
    key: "success_profile",
    label: "Success Profile",
    upstream: ["hiring_need", "intake_loop", "intake"],
    contextFields: ROLE_FIELDS,
    requiresResearch: false,
    kind: "generated",
  },
  market_intelligence: {
    key: "market_intelligence",
    label: "Market Intel",
    upstream: ["hiring_need", "success_profile"],
    contextFields: MARKET_FIELDS,
    requiresResearch: true,
    kind: "generated",
  },
  sourcing_strategy: {
    key: "sourcing_strategy",
    label: "Strategy",
    upstream: ["hiring_need", "success_profile", "market_intelligence"],
    contextFields: MARKET_FIELDS,
    requiresResearch: true,
    kind: "generated",
  },
  channels: {
    key: "channels",
    label: "Channels",
    upstream: ["sourcing_strategy"],
    contextFields: MARKET_FIELDS,
    requiresResearch: true,
    kind: "generated",
  },
  search_strings: {
    key: "search_strings",
    label: "Search Strings",
    upstream: ["sourcing_strategy"],
    contextFields: MARKET_FIELDS,
    requiresResearch: true,
    kind: "generated",
  },
  candidates: {
    key: "candidates",
    label: "Candidates",
    upstream: ["success_profile"],
    contextFields: [],
    requiresResearch: false,
    kind: "collection",
  },
  golden_test: {
    key: "golden_test",
    label: "Golden Test",
    upstream: [],
    contextFields: [],
    requiresResearch: false,
    kind: "benchmark",
  },
};

/** Which modules a set of context changes invalidates (direct + transitive). */
export function affectedByChanges(changes: ContextChange[]): ModuleKey[] {
  const changed = new Set(changes.map((c) => c.field));
  const direct = new Set<ModuleKey>();
  for (const spec of Object.values(MODULES)) {
    if (spec.contextFields.some((f) => changed.has(f))) direct.add(spec.key);
  }
  return closeDownstream(direct);
}

/** Everything downstream of a set of modules (transitively), in registry order. */
export function closeDownstream(seed: Set<ModuleKey>): ModuleKey[] {
  const out = new Set<ModuleKey>(seed);
  let grew = true;
  while (grew) {
    grew = false;
    for (const spec of Object.values(MODULES)) {
      if (out.has(spec.key)) continue;
      if (spec.upstream.some((u) => out.has(u))) {
        out.add(spec.key);
        grew = true;
      }
    }
  }
  return MODULE_KEYS.filter((k) => out.has(k));
}

export interface RecordMetaLike {
  generatedAt?: string;
  editedAt?: string;
  inputVersion?: string;
  researchSnapshotId?: string;
  researchStatus?: ResearchStatus;
  /** Owner acknowledged generating without current research. */
  acknowledgedNoResearch?: boolean;
}

export interface StoredRecordLike {
  payload?: unknown;
  meta?: RecordMetaLike;
  traitWarnings?: string[];
  validationIssues?: string[];
  lastError?: { at: string; message: string; code?: string };
}

export interface Recovery {
  label: string;
  actionType: ActionType;
  targetId?: string;
}

export interface ModuleState {
  key: ModuleKey;
  label: string;
  state: ModuleStateName;
  reason: string;
  lastGeneratedAt?: string;
  inputVersion?: string;
  currentVersion: string;
  researchSnapshotId?: string;
  researchStatus?: ResearchStatus;
  recovery?: Recovery;
}

export interface ModuleStateInput {
  key: ModuleKey;
  record?: StoredRecordLike;
  currentVersion: string;
  /** Labels of context fields that changed since the record's inputVersion. */
  changedSince?: string[];
  researchStatus: ResearchStatus;
  researchSnapshotId?: string;
  inflight?: "researching" | "generating";
  upstream: Partial<Record<ModuleKey, ModuleState>>;
  /** For collections/loops: whether they hold anything. */
  hasContent?: boolean;
}

export function moduleState(input: ModuleStateInput): ModuleState {
  const spec = MODULES[input.key];
  const rec = input.record;
  const base = {
    key: spec.key,
    label: spec.label,
    currentVersion: input.currentVersion,
    lastGeneratedAt: rec?.meta?.generatedAt,
    inputVersion: rec?.meta?.inputVersion,
    researchSnapshotId:
      rec?.meta?.researchSnapshotId ?? input.researchSnapshotId,
    researchStatus: rec?.meta?.researchStatus,
  };
  const gen = (label: string): Recovery => ({
    label,
    actionType: rec?.payload ? "regenerate_module" : "generate_module",
    targetId: spec.key,
  });

  if (input.inflight === "researching") {
    return {
      ...base,
      state: "researching",
      reason: "Research is running for this module.",
    };
  }
  if (input.inflight === "generating") {
    return { ...base, state: "generating", reason: "Generation is running." };
  }

  const hasPayload =
    spec.kind === "generated"
      ? Boolean(rec?.payload)
      : Boolean(input.hasContent);

  if (!hasPayload) {
    if (rec?.lastError) {
      return {
        ...base,
        state: "failed",
        reason: `Last attempt failed ${rec.lastError.at}: ${rec.lastError.message}`,
        recovery: gen("Try again"),
      };
    }
    const blockedBy = spec.upstream.filter((u) => {
      const s = input.upstream[u]?.state;
      return !s || s === "not_started" || s === "failed";
    });
    return {
      ...base,
      state: "not_started",
      reason:
        blockedBy.length > 0
          ? `Not generated yet. Generate ${blockedBy.map((u) => MODULES[u].label).join(", ")} first for best results.`
          : "Not generated yet.",
      recovery:
        spec.kind === "generated"
          ? gen("Generate")
          : spec.kind === "loop"
            ? {
                label: "Record a statement",
                actionType: "record_statement",
                targetId: "intake_loop",
              }
            : spec.kind === "collection"
              ? {
                  label: "Add a candidate",
                  actionType: "add_candidate",
                  targetId: "candidates",
                }
              : {
                  label: "Run the Golden Test",
                  actionType: "run_golden",
                  targetId: "golden_test",
                },
    };
  }

  if (rec?.lastError && rec.lastError.at > (rec.meta?.generatedAt ?? "")) {
    return {
      ...base,
      state: "failed",
      reason: `Regeneration failed ${rec.lastError.at}: ${rec.lastError.message}. The previous output is still shown.`,
      recovery: gen("Try again"),
    };
  }

  if (
    rec?.meta?.inputVersion &&
    rec.meta.inputVersion !== input.currentVersion
  ) {
    const what = input.changedSince?.length
      ? input.changedSince.join(", ")
      : "the search brief";
    return {
      ...base,
      state: "stale",
      reason: `Generated against ${rec.meta.inputVersion}; ${what} changed since (now ${input.currentVersion}).`,
      recovery: gen("Regenerate"),
    };
  }

  const staleUpstream = spec.upstream.filter((u) => {
    const s = input.upstream[u]?.state;
    return s === "stale";
  });
  if (staleUpstream.length > 0) {
    return {
      ...base,
      state: "stale",
      reason: `Upstream ${staleUpstream.map((u) => MODULES[u].label).join(", ")} is stale.`,
      recovery: gen("Regenerate after upstream"),
    };
  }
  const newerUpstream = spec.upstream.filter((u) => {
    const up = input.upstream[u];
    return (
      up?.lastGeneratedAt &&
      base.lastGeneratedAt &&
      up.lastGeneratedAt > base.lastGeneratedAt
    );
  });
  if (newerUpstream.length > 0 && spec.kind === "generated") {
    return {
      ...base,
      state: "stale",
      reason: `${newerUpstream.map((u) => MODULES[u].label).join(", ")} was regenerated after this output.`,
      recovery: gen("Regenerate"),
    };
  }

  if (rec?.traitWarnings && rec.traitWarnings.length > 0) {
    return {
      ...base,
      state: "needs_review",
      reason: `Mentions ${rec.traitWarnings.join(", ")} — protected characteristics must never drive evaluation. Edit before use.`,
      recovery: {
        label: "Review and edit",
        actionType: "navigate_module",
        targetId: spec.key,
      },
    };
  }
  if (rec?.validationIssues && rec.validationIssues.length > 0) {
    return {
      ...base,
      state: "needs_review",
      reason: `Output contract not met: ${rec.validationIssues[0]}${rec.validationIssues.length > 1 ? ` (+${rec.validationIssues.length - 1} more)` : ""}`,
      recovery: gen("Regenerate"),
    };
  }

  if (spec.requiresResearch) {
    const rs = rec?.meta?.researchStatus ?? "blocked";
    if (rs === "blocked") {
      return {
        ...base,
        state: "blocked",
        reason:
          "Generated without current research (model knowledge only). Add sources or refresh research, then regenerate.",
        recovery: {
          label: "Add research sources",
          actionType: "add_source",
          targetId: "research",
        },
      };
    }
    if (rs === "failed") {
      return {
        ...base,
        state: "failed",
        reason:
          "The research attached to this output failed; its claims are unsupported.",
        recovery: {
          label: "Refresh research",
          actionType: "refresh_research",
          targetId: "research",
        },
      };
    }
    // Live freshness beats the status stamped at generation time.
    if (input.researchStatus === "stale" || rs === "stale") {
      return {
        ...base,
        state: "stale",
        reason: "The research behind this output is stale.",
        recovery: {
          label: "Refresh research",
          actionType: "refresh_research",
          targetId: "research",
        },
      };
    }
    if (input.researchStatus === "aging" || rs === "aging") {
      return {
        ...base,
        state: "aging",
        reason:
          "The research behind this output is aging; refresh before relying on time-sensitive claims.",
        recovery: {
          label: "Refresh research",
          actionType: "refresh_research",
          targetId: "research",
        },
      };
    }
  }

  return {
    ...base,
    state: "current",
    reason: spec.requiresResearch
      ? `Current — research ${base.researchStatus ?? "current"} as of ${base.lastGeneratedAt ?? "unknown"}.`
      : `Current as of ${base.lastGeneratedAt ?? "unknown"}.`,
  };
}

/** Compute every module's state in dependency order. */
export function allModuleStates(
  read: (key: ModuleKey) => Omit<ModuleStateInput, "key" | "upstream">,
): Record<ModuleKey, ModuleState> {
  const out: Partial<Record<ModuleKey, ModuleState>> = {};
  const visit = (key: ModuleKey): ModuleState => {
    const cached = out[key];
    if (cached) return cached;
    const upstream: Partial<Record<ModuleKey, ModuleState>> = {};
    for (const u of MODULES[key].upstream) upstream[u] = visit(u);
    const s = moduleState({ key, upstream, ...read(key) });
    out[key] = s;
    return s;
  };
  for (const k of MODULE_KEYS) visit(k);
  return out as Record<ModuleKey, ModuleState>;
}
