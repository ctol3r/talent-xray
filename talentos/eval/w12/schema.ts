/**
 * W12 corpus schema (W12_EVAL_SPEC.md §3). A conversation is a scripted,
 * multi-turn hiring-manager intake with the human-authored EXPECTED
 * canonical outcome after each turn. Expectations are written against what
 * a correct system should produce — never against the current
 * implementation — so a schema that cannot hold a correct outcome fails
 * here rather than being accommodated.
 */
import { z } from "zod";
import { irProvenanceSchema } from "@/lib/core/ir";

export const ADVERSARIAL_CATEGORIES: Record<number, string> = {
  1: "contradictory manager statements",
  2: "vague constructs",
  3: "prestige / institution proxies",
  4: "impossible or mutually constraining requirements",
  5: "changing requirements",
  6: "hidden requirements emerging from candidate rejection feedback",
  7: "disagreements between hiring stakeholders",
  8: "requirements whose evidence cannot be observed from public profiles",
  9: "role-title mismatch",
  10: "adjacent populations visible only after understanding the capability",
  11: "manager deferrals",
  12: "examples that contradict stated rules",
  13: "hard requirements versus heuristics",
  14: "unnecessary credential inflation",
  15: "false signals / anti-filters",
  16: "time-sensitive constraints",
  17: "compensation-versus-market conflicts",
  18: "geography-versus-talent-supply conflicts",
  19: "requirements that should remain UNKNOWN rather than inferred",
  20: "cases where the correct behaviour is to challenge the hiring manager",
};

export const requirementKindSchema = z.enum([
  "must_have",
  "preferred",
  "trainable",
  "disqualifier",
]);
export const requirementStatusSchema = z.enum([
  "explicit",
  "needs_clarification",
  "assumed",
]);

export const expectedRequirementSchema = z.object({
  /** Stable handle within the conversation (used by `untouched`). */
  key: z.string(),
  /** Any one must appear (case-insensitive) in label, definition or statement. */
  aliases: z.array(z.string()).min(1),
  kind: requirementKindSchema.optional(),
  status: requirementStatusSchema.optional(),
  origin: irProvenanceSchema.optional(),
  /** The definition must name the underlying construct (any alias). */
  constructAliases: z.array(z.string()).optional(),
  /** Proxy terms: must be a false signal or a hint — never a search filter. */
  proxyTerms: z.array(z.string()).optional(),
  /** At least one must appear in evidenceSpec. */
  evidenceAliases: z.array(z.string()).optional(),
  /** At least one must appear in falseSignals. */
  falseSignalAliases: z.array(z.string()).optional(),
  /** A proxy that must NOT have become a requirement of its own. */
  mustNotExist: z.boolean().optional(),
  note: z.string().optional(),
});

export const expectedUncertaintySchema = z.object({
  key: z.string(),
  /** Any one must appear in `about` or `consequence`. */
  aliases: z.array(z.string()).min(1),
  consequential: z.boolean(),
  status: z.enum(["open", "resolved"]),
  /** Must stay open AND must not be covered by an `explicit` requirement. */
  shouldRemainUnknown: z.boolean().optional(),
  note: z.string().optional(),
});

export const expectedContradictionSchema = z.object({
  key: z.string(),
  /** Any one must appear in claimA, claimB or note. */
  aliases: z.array(z.string()).min(1),
  status: z.enum(["open", "resolved"]).optional(),
  note: z.string().optional(),
});

export const expectedNextQuestionSchema = z.object({
  /** The question text, or an uncertainty it targets, must contain one. */
  targetsAliases: z.array(z.string()).min(1),
  /** The correct move is to push back on the hiring manager (judge-scored). */
  shouldChallenge: z.boolean().optional(),
  mayBeNull: z.boolean().optional(),
  note: z.string().optional(),
});

export const replanDimensionSchema = z.enum([
  "occupation",
  "population",
  "adjacent",
  "geography",
  "channels",
  "evidence",
  "strings",
  "screening",
  "persona",
]);

export const expectedReplanSchema = z.object({
  required: z.boolean(),
  changes: z
    .array(
      z.object({
        dimension: replanDimensionSchema,
        aliases: z.array(z.string()).default([]),
        mustNotContain: z.array(z.string()).default([]),
        note: z.string().optional(),
      }),
    )
    .default([]),
});

export const expectationSchema = z.object({
  requirements: z.array(expectedRequirementSchema).default([]),
  uncertainties: z.array(expectedUncertaintySchema).default([]),
  contradictions: z.array(expectedContradictionSchema).default([]),
  nextQuestion: expectedNextQuestionSchema.optional(),
  /** Requirement keys (from earlier expectations) that must not change. */
  untouched: z.array(z.string()).default([]),
  replan: expectedReplanSchema.optional(),
  /** Fabrication canaries: must not appear anywhere in the output. */
  forbiddenTerms: z.array(z.string()).default([]),
});

export const turnSchema = z.object({
  speaker: z.string().default("hiring_manager"),
  text: z.string().min(20),
  context: z.string().optional(),
  expect: expectationSchema,
});

export const stakeholderSchema = z.object({
  id: z.string(),
  role: z.string(),
  decisionAuthority: z.boolean().optional(),
});

export const conversationSchema = z.object({
  id: z.string().regex(/^[a-jx]-\d{2}$/),
  occupation: z.string(),
  fixtureLetter: z
    .enum(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"])
    .optional(),
  title: z.string(),
  categories: z.array(z.number().int().min(1).max(20)).min(1),
  project: z.object({
    name: z.string(),
    companyName: z.string().optional(),
    roleTitle: z.string(),
    geography: z.string().optional(),
    country: z.string().optional(),
    industry: z.string().optional(),
    seniority: z.string().optional(),
    businessObjective: z.string().optional(),
  }),
  jd: z.string().min(80),
  stakeholders: z.array(stakeholderSchema).optional(),
  /** Why this conversation is adversarial and what a failure looks like. */
  notes: z.string(),
  /** Expected outcome of derive_hiring_need (JD only, before any statement). */
  initial: expectationSchema,
  turns: z.array(turnSchema).min(2),
});

export type Conversation = z.input<typeof conversationSchema>;
export type ParsedConversation = z.output<typeof conversationSchema>;
export type Expectation = z.output<typeof expectationSchema>;
