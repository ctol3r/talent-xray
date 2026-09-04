/**
 * The artifact's task payload contracts and the one boundary where a
 * provider-returned object becomes ours.
 *
 * Why these are not the app's `src/lib/core/payloads.ts` schemas verbatim:
 * the artifact's prompts ask for narrower shapes (fewer fields, and e.g.
 * `reviewPriority.suggestion` uses "review" where the app uses
 * "review_soon"). The IR schemas ARE shared — imported from
 * `@/lib/core/ir` — because the artifact's canonical-IR prompts were ported
 * from the same source and must not drift (D-017 seam).
 *
 * Required fields mirror what the legacy `shapeCheck()` enforced so that
 * every record already stored under "talentos-lite-v1" still parses.
 * Everything else is optional-with-default.
 */
import { z } from "zod";
import {
  contradictionIRSchema,
  hiringNeedIRSchema,
  irProvenanceSchema,
  managerStatementSchema,
  nextQuestionSchema,
  requirementIRSchema,
  uncertaintyIRSchema,
} from "@/lib/core/ir";
import {
  intakePayloadSchema,
  critiquePayloadSchema,
  ensureIds,
} from "@/lib/core/payloads";

const str = z.string();
const strs = z.array(z.string()).default([]);
const traced = z.object({
  id: z.string().optional(),
  text: z.string(),
  provenance: z.string().optional(),
  note: z.string().optional(),
});
const tracedList = z.array(traced).default([]);

// ── Canonical IR (shared schemas) ──────────────────────────────────────────
export const hiringNeedPayloadSchema = z.object({
  need: hiringNeedIRSchema,
  requirements: z.array(requirementIRSchema),
  uncertainties: z.array(uncertaintyIRSchema),
  contradictions: z.array(contradictionIRSchema),
});
export type HiringNeedPayload = z.infer<typeof hiringNeedPayloadSchema>;

/** The evolving intent: derived IR + verbatim statement log + revision. */
export const intentPayloadSchema = hiringNeedPayloadSchema.extend({
  statements: z.array(managerStatementSchema).default([]),
  revision: z.number().int().nonnegative().default(0),
  nextQuestion: nextQuestionSchema.nullable().optional(),
});
export type IntentPayload = z.infer<typeof intentPayloadSchema>;

export const intakeReasoningPayloadSchema = z.object({
  extractedClaims: z
    .array(
      z.object({
        text: z.string(),
        provenance: irProvenanceSchema.catch("manager_statement"),
      }),
    )
    .default([]),
  requirements: z.array(requirementIRSchema),
  uncertainties: z.array(uncertaintyIRSchema),
  contradictions: z.array(contradictionIRSchema),
  nextQuestion: nextQuestionSchema.nullable().optional(),
});
export type IntakeReasoningPayload = z.infer<
  typeof intakeReasoningPayloadSchema
>;

// ── Module payloads (artifact prompt shapes) ────────────────────────────────
export const roleIntelligencePayloadSchema = z.object({
  canonicalTitle: str,
  alternateTitles: strs,
  seniority: z.string().optional(),
  profession: z.string().optional(),
  roleHypothesis: str,
  hardRequirements: tracedList,
  preferences: tracedList,
  signals: tracedList,
  assumptions: strs,
  unresolvedQuestions: strs,
  likelyTalentCompetitors: strs,
});
export type RoleIntelligencePayload = z.infer<
  typeof roleIntelligencePayloadSchema
>;

export { intakePayloadSchema };
export type IntakePayload = z.infer<typeof intakePayloadSchema>;

export const successProfilePayloadSchema = z.object({
  mission: str,
  outcomes: tracedList,
  mustHave: z.array(traced),
  preferred: tracedList,
  trainable: tracedList,
  evidenceSignals: z.array(traced),
  negativeSignals: tracedList,
  sellingPoints: tracedList,
  candidateMotivators: tracedList,
  unresolvedQuestions: strs,
});
export type SuccessProfilePayload = z.infer<typeof successProfilePayloadSchema>;

export const modelCertaintySchema = z.enum([
  "estimated",
  "inferred",
  "unknown",
]);
export const marketClaimSchema = z.object({
  id: z.string().optional(),
  text: z.string(),
  certainty: z.string(),
  note: z.string().optional(),
});
export const marketIntelligencePayloadSchema = z.object({
  difficulty: z.object({
    rating: z.number().optional(),
    rationale: z.string().optional(),
  }),
  sections: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string(),
      claims: z.array(marketClaimSchema).default([]),
    }),
  ),
  assumptions: z.array(z.string()),
  missingInformation: strs,
});
export type MarketIntelligencePayload = z.infer<
  typeof marketIntelligencePayloadSchema
>;

export const sourcingStrategyPayloadSchema = z.object({
  primaryTargetProfile: str,
  secondaryTargetProfiles: strs,
  adjacentPossibilities: z
    .array(
      z.object({
        id: z.string().optional(),
        text: z.string(),
        rationale: z.string().optional(),
      }),
    )
    .default([]),
  targetTitles: z.array(z.string()),
  excludedTitles: strs,
  targetCompanies: strs,
  feederCompanies: strs,
  targetIndustries: strs,
  targetGeographies: strs,
  rationale: z.string().optional(),
  risks: z.array(z.string()),
});
export type SourcingStrategyPayload = z.infer<
  typeof sourcingStrategyPayloadSchema
>;

export const channelSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  kind: z.string().optional(),
  url: z.string().optional(),
  whyRelevant: z.string().optional(),
  priority: z.string().optional(),
  costModel: z.string().optional(),
  certainty: z.string().optional(),
});
export const channelsPayloadSchema = z.object({
  channels: z.array(channelSchema),
  reasoningSummary: str,
});
export type ChannelsPayload = z.infer<typeof channelsPayloadSchema>;

export const extraQuerySchema = z.object({
  id: z.string().optional(),
  platform: z.string(),
  query: z.string(),
  purpose: z.string().optional(),
  breadth: z.string().optional(),
});
export const searchStringsPayloadSchema = z.object({
  titles: z.array(z.string()),
  alternateTitles: strs,
  adjacentTitles: strs,
  mustHave: strs,
  anyOf: z.array(z.string()),
  credentials: strs,
  locations: z.array(z.string()),
  companies: strs,
  exclusions: z.array(z.string()),
  relevantPlatforms: strs,
  extraQueries: z.array(extraQuerySchema).default([]),
});
export type SearchStringsPayload = z.infer<typeof searchStringsPayloadSchema>;

export const evidenceItemSchema = z.object({
  id: z.string().optional(),
  criterion: z.string(),
  status: z.string(),
  evidenceText: z.string().optional(),
  /**
   * W16: the verbatim span the claim rests on, and which attached source
   * it came from. Optional so older stored records still load; an item
   * without them cannot be supported evidence (see core/evidence.ts).
   */
  quote: z.string().optional(),
  sourceId: z.string().optional(),
});
export const evidencePayloadSchema = z.object({
  items: z.array(evidenceItemSchema),
  reviewPriority: z.object({
    suggestion: z.string().optional(),
    reasoning: z.string().optional(),
  }),
  questionsToValidate: strs,
});
export type EvidencePayload = z.infer<typeof evidencePayloadSchema>;

export const outreachStepSchema = z.object({
  id: z.string().optional(),
  kind: z.string(),
  dayOffset: z.number().optional(),
  subjectVariants: strs,
  body: z.string(),
  citations: z
    .array(z.object({ personalization: z.string(), evidence: z.string() }))
    .default([]),
});
export const outreachPayloadSchema = z.object({
  steps: z.array(outreachStepSchema),
  cadenceRationale: str,
});
export type OutreachPayload = z.infer<typeof outreachPayloadSchema>;

export { critiquePayloadSchema };
export type CritiquePayload = z.infer<typeof critiquePayloadSchema>;

/** Task key → payload schema. Golden test / intent are validated elsewhere. */
export const PAYLOAD_SCHEMAS = {
  hiring_need: hiringNeedPayloadSchema,
  role_intelligence: roleIntelligencePayloadSchema,
  intake: intakePayloadSchema,
  success_profile: successProfilePayloadSchema,
  market_intelligence: marketIntelligencePayloadSchema,
  sourcing_strategy: sourcingStrategyPayloadSchema,
  channels: channelsPayloadSchema,
  search_strings: searchStringsPayloadSchema,
  evidence: evidencePayloadSchema,
  outreach: outreachPayloadSchema,
  critique: critiquePayloadSchema,
  intake_reasoning: intakeReasoningPayloadSchema,
} as const;
export type PayloadTaskKey = keyof typeof PAYLOAD_SCHEMAS;
export type PayloadOf<K extends PayloadTaskKey> = z.infer<
  (typeof PAYLOAD_SCHEMAS)[K]
>;

export class PayloadShapeError extends Error {
  readonly code = "invalid_json" as const;
  constructor(
    readonly task: string,
    readonly issues: string[],
    readonly text: string,
  ) {
    super(`shape: ${issues.join("; ")}`);
    this.name = "PayloadShapeError";
  }
}

/**
 * The provider boundary (P0-A). Whatever `sample.json()` hands back may be
 * frozen or non-extensible; nothing downstream may ever write into it.
 * This returns a fresh, fully owned deep copy with ids on every list item,
 * validated against the task's schema. Every later mutation in the app is a
 * copy-on-write of THIS object, never of the provider's.
 */
export function normalizeGenerated<K extends PayloadTaskKey>(
  task: K,
  raw: unknown,
): PayloadOf<K> {
  const schema = PAYLOAD_SCHEMAS[task];
  const parsed = schema.safeParse(deepCopy(raw));
  if (!parsed.success) {
    throw new PayloadShapeError(
      task,
      parsed.error.issues
        .slice(0, 6)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
      safeStringify(raw),
    );
  }
  return ensureIds(parsed.data) as PayloadOf<K>;
}

/** Deep copy that also strips freezing — arrays and plain objects only. */
export function deepCopy<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => deepCopy(v)) as T;
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepCopy(v);
    }
    return out as T;
  }
  return value;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Model output may never claim "verified" (NO FAKE DATA). Pure: returns a
 * new tree and the count of labels it had to downgrade. The old version
 * mutated in place and blew up on frozen payloads.
 */
export function downgradeVerified<T>(value: T): {
  value: T;
  downgrades: number;
} {
  let downgrades = 0;
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node !== null && typeof node === "object") {
      const rec = node as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(rec)) out[k] = walk(v);
      if (rec.certainty === "verified") {
        out.certainty = "inferred";
        out.note = (
          (typeof rec.note === "string" ? rec.note : "") +
          " [downgraded from 'verified' — model output cannot verify]"
        ).trim();
        downgrades += 1;
      }
      return out;
    }
    return node;
  };
  return { value: walk(value) as T, downgrades };
}

/** Immutable answer write for HM Intake — returns a new payload. */
export function withIntakeAnswer(
  payload: IntakePayload,
  questionId: string,
  answer: string,
  answeredAt: string,
): IntakePayload {
  return {
    ...payload,
    categories: payload.categories.map((cat) => ({
      ...cat,
      questions: cat.questions.map((q) =>
        q.id === questionId ? { ...q, answer, answeredAt } : q,
      ),
    })),
  };
}
