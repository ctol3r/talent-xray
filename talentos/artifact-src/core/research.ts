/**
 * Research Gate foundation (spec §8).
 *
 * Types are the spec's, as zod. The gate's rule in this artifact:
 * an output can carry researchStatus "current" or "aging" ONLY with a
 * ResearchSnapshot attached and in date. Without one it is "blocked" and
 * generation requires an explicit acknowledgement ("Generate without
 * current research"); the output is then labelled model-knowledge-only.
 *
 * This runtime has no web access. Research reaches the outside world only
 * through the viewer's claude.ai connectors (`mcp`), and only through
 * adapters that declare where they apply. Phase 1 ships the registry, the
 * user-supplied adapter and honest placeholders for the connector adapters
 * (Phase 3 wires them after observing real request/response pairs).
 */
import { z } from "zod";
import type { SearchContext } from "./search-context";

export const researchStatusSchema = z.enum([
  "current",
  "aging",
  "stale",
  "blocked",
  "failed",
]);
export type ResearchStatus = z.infer<typeof researchStatusSchema>;

export const claimKindSchema = z.enum([
  "source_fact",
  "hiring_manager_statement",
  "estimate",
  "model_inference",
  "unknown",
]);
export type ClaimKind = z.infer<typeof claimKindSchema>;

export const evidenceStateSchema = z.enum([
  "source_backed",
  "checked",
  "self_attested",
  "needs_review",
  "aging",
  "stale",
  "unavailable",
  "contradicted",
  "not_yet_known",
]);
export type EvidenceState = z.infer<typeof evidenceStateSchema>;

/** What a source is ABOUT, which decides how fast it goes stale. */
export const sourceKindSchema = z.enum([
  "job_openings",
  "leadership",
  "compensation",
  "layoffs",
  "company_initiatives",
  "competitor_moves",
  "candidate_employment",
  "publications",
  "licence_registry",
  "government_labor_statistics",
  "occupational_taxonomy",
  "user_supplied",
  "other",
]);
export type SourceKind = z.infer<typeof sourceKindSchema>;

export const researchSourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  canonicalUrl: z.string().optional(),
  publisher: z.string().optional(),
  sourceType: z.enum([
    "primary",
    "official",
    "reputable_secondary",
    "community",
    "user_supplied",
  ]),
  kind: sourceKindSchema.default("other"),
  retrievedAt: z.string(),
  publishedAt: z.string().optional(),
  geography: z.string().optional(),
  jurisdiction: z.string().optional(),
  accessStatus: z.enum(["available", "partial", "unavailable", "blocked"]),
  limitations: z.array(z.string()).default([]),
  /** Which adapter produced it (never a fabricated citation). */
  adapterId: z.string().default("user_supplied"),
  /** Verbatim excerpt the user pasted or the connector returned. */
  excerpt: z.string().optional(),
});
export type ResearchSource = z.infer<typeof researchSourceSchema>;

export const researchClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: claimKindSchema,
  evidenceState: evidenceStateSchema,
  sourceIds: z.array(z.string()).default([]),
  observedAt: z.string().optional(),
  confidence: z.enum(["high", "medium", "low", "not_assessed"]).optional(),
  limitations: z.array(z.string()).default([]),
  contradictions: z.array(z.string()).default([]),
});
export type ResearchClaim = z.infer<typeof researchClaimSchema>;

export const researchSnapshotSchema = z.object({
  id: z.string(),
  searchId: z.string(),
  searchVersion: z.string(),
  researchBrief: z.string(),
  scope: z.object({
    industry: z.string().optional(),
    role: z.string().optional(),
    company: z.string().optional(),
    geography: z.string().optional(),
    jurisdiction: z.string().optional(),
    timeframe: z.string().optional(),
  }),
  status: researchStatusSchema,
  startedAt: z.string(),
  completedAt: z.string().optional(),
  validUntil: z.string().optional(),
  queries: z.array(z.string()).default([]),
  sources: z.array(researchSourceSchema).default([]),
  claims: z.array(researchClaimSchema).default([]),
  unavailableSources: z.array(z.string()).default([]),
  contradictions: z.array(z.string()).default([]),
  missingInformation: z.array(z.string()).default([]),
  providerMetadata: z.record(z.string(), z.unknown()).optional(),
});
export type ResearchSnapshot = z.infer<typeof researchSnapshotSchema>;

/**
 * Source-specific freshness (spec §8): not one universal TTL. `agingAfter`
 * days → "aging"; `staleAfter` days → "stale". Editable constants; the
 * rationale is recorded so a change is a decision, not a drift.
 */
export interface FreshnessRule {
  agingAfterDays: number;
  staleAfterDays: number;
  rationale: string;
}
export const FRESHNESS_RULES: Record<SourceKind, FreshnessRule> = {
  job_openings: {
    agingAfterDays: 7,
    staleAfterDays: 21,
    rationale:
      "Postings open and close weekly; a three-week-old count is not a market.",
  },
  leadership: {
    agingAfterDays: 14,
    staleAfterDays: 45,
    rationale:
      "Leadership changes are announced, not gradual; six weeks is a cycle.",
  },
  compensation: {
    agingAfterDays: 30,
    staleAfterDays: 90,
    rationale:
      "Pay bands move quarterly; a quarter-old figure is one side of a comparison.",
  },
  layoffs: {
    agingAfterDays: 7,
    staleAfterDays: 30,
    rationale: "Layoff news changes the candidate supply the week it lands.",
  },
  company_initiatives: {
    agingAfterDays: 30,
    staleAfterDays: 90,
    rationale: "Strategy announcements hold for a quarter, rarely longer.",
  },
  competitor_moves: {
    agingAfterDays: 14,
    staleAfterDays: 60,
    rationale: "Competing offers and hiring pushes are measured in weeks.",
  },
  candidate_employment: {
    agingAfterDays: 30,
    staleAfterDays: 120,
    rationale:
      "People change jobs; a four-month-old title is a question, not a fact.",
  },
  publications: {
    agingAfterDays: 60,
    staleAfterDays: 180,
    rationale:
      "A publication record only grows; six months without re-checking hides new work.",
  },
  licence_registry: {
    agingAfterDays: 30,
    staleAfterDays: 90,
    rationale:
      "Registries update on renewal cycles; a licence can lapse in a quarter.",
  },
  government_labor_statistics: {
    agingAfterDays: 90,
    staleAfterDays: 400,
    rationale:
      "Follows the source's release cadence (monthly to annual); a year-old series is superseded.",
  },
  occupational_taxonomy: {
    agingAfterDays: 365,
    staleAfterDays: 1095,
    rationale: "Taxonomies (SOC, O*NET, ISCO) revise on multi-year cycles.",
  },
  user_supplied: {
    agingAfterDays: 30,
    staleAfterDays: 90,
    rationale:
      "A pasted source is only as current as the day it was pasted; it is re-checked like compensation.",
  },
  other: {
    agingAfterDays: 30,
    staleAfterDays: 90,
    rationale: "Default window when the source kind is not classified.",
  },
};

const DAY = 86_400_000;

export function sourceFreshness(
  source: Pick<ResearchSource, "kind" | "retrievedAt" | "accessStatus">,
  nowIso: string,
): "current" | "aging" | "stale" | "unavailable" {
  if (
    source.accessStatus === "unavailable" ||
    source.accessStatus === "blocked"
  ) {
    return "unavailable";
  }
  const rule = FRESHNESS_RULES[source.kind] ?? FRESHNESS_RULES.other;
  const age =
    (new Date(nowIso).getTime() - new Date(source.retrievedAt).getTime()) / DAY;
  if (Number.isNaN(age)) return "stale";
  if (age >= rule.staleAfterDays) return "stale";
  if (age >= rule.agingAfterDays) return "aging";
  return "current";
}

/** validUntil = the earliest stale-after across the snapshot's usable sources. */
export function computeValidUntil(
  sources: ResearchSource[],
): string | undefined {
  const times = sources
    .filter(
      (s) => s.accessStatus === "available" || s.accessStatus === "partial",
    )
    .map((s) => {
      const rule = FRESHNESS_RULES[s.kind] ?? FRESHNESS_RULES.other;
      return new Date(s.retrievedAt).getTime() + rule.staleAfterDays * DAY;
    })
    .filter((t) => !Number.isNaN(t));
  if (times.length === 0) return undefined;
  return new Date(Math.min(...times)).toISOString();
}

/**
 * The status a snapshot has NOW. Never trusts `snapshot.status` alone —
 * a snapshot that was "current" when written ages on its own.
 */
export function researchStatusOf(
  snapshot: ResearchSnapshot | undefined,
  nowIso: string,
): ResearchStatus {
  if (!snapshot) return "blocked";
  if (snapshot.status === "failed") return "failed";
  if (snapshot.status === "blocked") return "blocked";
  const usable = snapshot.sources.filter(
    (s) => s.accessStatus === "available" || s.accessStatus === "partial",
  );
  if (usable.length === 0) return "blocked";
  const states = usable.map((s) => sourceFreshness(s, nowIso));
  if (states.some((s) => s === "stale")) return "stale";
  if (states.some((s) => s === "aging")) return "aging";
  return "current";
}

export interface GateDecision {
  /** Whether generation may proceed at all. */
  allowed: boolean;
  /** The status the output will carry if generated now. */
  researchStatus: ResearchStatus;
  /** Whether the user had to acknowledge generating without research. */
  acknowledgementRequired: boolean;
  /** The banner text the output must show. */
  banner: string;
  snapshotId?: string;
  asOf?: string;
}

/**
 * Gate rule (owner decision 2026-09-04): fail closed on CURRENCY, not on
 * generation. Without a usable snapshot the module may still be generated
 * once the user acknowledges it, and the result is visibly "blocked".
 */
export function gateDecision(
  snapshot: ResearchSnapshot | undefined,
  nowIso: string,
  acknowledged: boolean,
): GateDecision {
  const status = researchStatusOf(snapshot, nowIso);
  const asOf = snapshot?.completedAt ?? snapshot?.startedAt;
  if (status === "current" || status === "aging") {
    return {
      allowed: true,
      researchStatus: status,
      acknowledgementRequired: false,
      banner:
        status === "current"
          ? `Research current as of ${asOf ?? "unknown"}.`
          : `Research is aging (as of ${asOf ?? "unknown"}); refresh before relying on time-sensitive claims.`,
      snapshotId: snapshot?.id,
      asOf,
    };
  }
  const why =
    status === "failed"
      ? "The last research attempt failed."
      : status === "stale"
        ? `The attached research is stale (as of ${asOf ?? "unknown"}).`
        : "No current research is attached — this runtime has no web access and no connector has been wired.";
  return {
    allowed: acknowledged,
    researchStatus:
      status === "stale" ? "stale" : status === "failed" ? "failed" : "blocked",
    acknowledgementRequired: true,
    banner: `${why} If generated now, this output is MODEL KNOWLEDGE ONLY — not current research — and every claim is self-attested until a source backs it.`,
    snapshotId: snapshot?.id,
    asOf,
  };
}

// ── Source adapters (registry) ──────────────────────────────────────────────

export interface AdapterApplicability {
  viable: boolean;
  reason: string;
}
export type AdapterAvailability =
  | { state: "available" }
  | { state: "unavailable"; reason: string }
  | { state: "blocked"; reason: string };

export interface ResearchSourceAdapter {
  id: string;
  label: string;
  /** Which claims it can ever back. */
  kinds: SourceKind[];
  sourceType: ResearchSource["sourceType"];
  /** Chosen by industry, role family and location (owner decision). */
  applies(ctx: SearchContext): AdapterApplicability;
  availability(): Promise<AdapterAvailability>;
  /** Retrieve sources for a brief. Must never fabricate; empty means empty. */
  retrieve(brief: string, ctx: SearchContext): Promise<ResearchSource[]>;
}

const has = (hay: string, ...needles: string[]) =>
  needles.some((n) => hay.toLowerCase().includes(n));

export const userSuppliedAdapter: ResearchSourceAdapter = {
  id: "user_supplied",
  label: "User-supplied sources",
  kinds: ["user_supplied"],
  sourceType: "user_supplied",
  applies: () => ({
    viable: true,
    reason: "Always available — paste a link or excerpt.",
  }),
  availability: async () => ({ state: "available" }),
  retrieve: async () => [],
};

/** Honest placeholder: declares where a connector WOULD apply, and that it is not wired. */
function unwiredConnector(
  id: string,
  label: string,
  kinds: SourceKind[],
  sourceType: ResearchSource["sourceType"],
  applies: (ctx: SearchContext) => AdapterApplicability,
): ResearchSourceAdapter {
  return {
    id,
    label,
    kinds,
    sourceType,
    applies,
    availability: async () => ({
      state: "unavailable",
      reason: `${label} is not wired in this build (Phase 3: requires an observed request/response and viewer consent).`,
    }),
    retrieve: async () => [],
  };
}

export const bigdataAdapter = unwiredConnector(
  "bigdata",
  "Bigdata.com (company facts, news, filings)",
  [
    "leadership",
    "layoffs",
    "company_initiatives",
    "competitor_moves",
    "job_openings",
  ],
  "reputable_secondary",
  (ctx) =>
    ctx.company
      ? { viable: true, reason: `Company-level claims about ${ctx.company}.` }
      : { viable: false, reason: "No company named on this search." },
);

export const npiAdapter = unwiredConnector(
  "npi_registry",
  "NPI Registry (US healthcare provider licences)",
  ["licence_registry"],
  "official",
  (ctx) => {
    const us =
      has(ctx.country, "united states", "usa", "us") ||
      ctx.country.trim() === "";
    const health = has(
      `${ctx.industry} ${ctx.profession} ${ctx.roleFamily} ${ctx.selectedIndustryPack}`,
      "health",
      "clinic",
      "nurse",
      "physician",
      "medical",
      "hospital",
    );
    if (!health)
      return { viable: false, reason: "Only applies to healthcare roles." };
    if (!us)
      return {
        viable: false,
        reason: "NPI is a US registry; this search is outside the US.",
      };
    return {
      viable: true,
      reason:
        "US healthcare role — licence checks apply (candidate evidence only).",
    };
  },
);

export const publicationsAdapter = unwiredConnector(
  "publications",
  "PubMed / bioRxiv / Consensus (publications)",
  ["publications"],
  "primary",
  (ctx) => {
    const research = has(
      `${ctx.industry} ${ctx.profession} ${ctx.roleFamily} ${ctx.roleTitle} ${ctx.selectedIndustryPack}`,
      "research",
      "scientist",
      "phd",
      "machine learning",
      "ai ",
      "biolog",
      "clinical",
      "academic",
    );
    return research
      ? {
          viable: true,
          reason:
            "Research role — publication evidence applies (candidate evidence only).",
        }
      : {
          viable: false,
          reason: "Publication records do not bear on this role family.",
        };
  },
);

export const RESEARCH_ADAPTERS: ResearchSourceAdapter[] = [
  userSuppliedAdapter,
  bigdataAdapter,
  npiAdapter,
  publicationsAdapter,
];

export function viableAdapters(ctx: SearchContext): Array<{
  adapter: ResearchSourceAdapter;
  applicability: AdapterApplicability;
}> {
  return RESEARCH_ADAPTERS.map((adapter) => ({
    adapter,
    applicability: adapter.applies(ctx),
  }));
}

/** A user-pasted source becomes a real, honestly-labelled ResearchSource. */
export function userSource(input: {
  id: string;
  title: string;
  url?: string;
  publisher?: string;
  kind?: SourceKind;
  excerpt?: string;
  publishedAt?: string;
  retrievedAt: string;
}): ResearchSource {
  return researchSourceSchema.parse({
    id: input.id,
    title: input.title,
    canonicalUrl: input.url,
    publisher: input.publisher,
    sourceType: "user_supplied",
    kind: input.kind ?? "user_supplied",
    retrievedAt: input.retrievedAt,
    publishedAt: input.publishedAt,
    accessStatus: "available",
    limitations: [
      "Supplied by the recruiter; not retrieved or verified by TalentOS.",
    ],
    adapterId: "user_supplied",
    excerpt: input.excerpt,
  });
}

/** Build a snapshot from whatever sources exist right now. Honest by construction. */
export function buildSnapshot(input: {
  id: string;
  ctx: SearchContext;
  brief: string;
  sources: ResearchSource[];
  claims?: ResearchClaim[];
  unavailableSources?: string[];
  queries?: string[];
  nowIso: string;
  failed?: string;
}): ResearchSnapshot {
  const usable = input.sources.filter(
    (s) => s.accessStatus === "available" || s.accessStatus === "partial",
  );
  const status: ResearchStatus = input.failed
    ? "failed"
    : usable.length === 0
      ? "blocked"
      : "current";
  return researchSnapshotSchema.parse({
    id: input.id,
    searchId: input.ctx.searchId,
    searchVersion: input.ctx.searchVersion,
    researchBrief: input.brief,
    scope: {
      industry: input.ctx.industry || undefined,
      role: input.ctx.roleTitle,
      company: input.ctx.company || undefined,
      geography: input.ctx.geography || undefined,
      jurisdiction: input.ctx.jurisdiction || undefined,
      timeframe: input.ctx.availableTimeframe || undefined,
    },
    status,
    startedAt: input.nowIso,
    completedAt: input.nowIso,
    validUntil: computeValidUntil(input.sources),
    queries: input.queries ?? [],
    sources: input.sources,
    claims: input.claims ?? [],
    unavailableSources: input.unavailableSources ?? [],
    contradictions: [],
    missingInformation: input.failed ? [input.failed] : [],
  });
}
