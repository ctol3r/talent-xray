/**
 * Fair-hiring guardrails. This module is enforcement, not policy prose:
 *  - BLOCKED_FIELD_PATTERNS: identifier patterns that must never appear as a
 *    column/field name anywhere in the schema or payload schemas
 *    (tests/unit/fair-hiring.test.ts greps the source).
 *  - scanTextForProtectedTraits: flags generated content that references
 *    protected characteristics so the UI can demand recruiter review.
 *  - NON_INFERENCE_DIRECTIVE: included in every AI task's system prompt.
 */

export const PROTECTED_TRAITS = [
  "race",
  "ethnicity",
  "religion",
  "age",
  "gender identity",
  "disability",
  "national origin",
  "sexual orientation",
  "health condition",
  "pregnancy",
  "family status",
  "marital status",
  "political affiliation",
  "veteran status",
] as const;

/** Identifier patterns banned from schema/field names. Word-bounded. */
export const BLOCKED_FIELD_PATTERNS: RegExp[] = [
  /\brace\b/i,
  /\bethnicity\b/i,
  /\breligion\b/i,
  /\bgender\b/i,
  /\bdisability\b/i,
  /\bnational_?origin\b/i,
  /\bnationalOrigin\b/,
  /\bsexual_?orientation\b/i,
  /\bsexualOrientation\b/,
  /\bpregnan/i,
  /\bmarital/i,
  /\bfamily_?status\b/i,
  /\bfamilyStatus\b/,
  /\bveteran/i,
  /\bdate_?of_?birth\b/i,
  /\bdateOfBirth\b/,
  /\bbirth_?date\b/i,
  /\bpolitical/i,
];

/** Phrases in generated text that trigger a mandatory-review warning. */
const TEXT_SCAN_PATTERNS: { trait: string; pattern: RegExp }[] = [
  { trait: "race/ethnicity", pattern: /\brace\b|\bethnicit/i },
  { trait: "religion", pattern: /\breligio(n|us)\b/i },
  { trait: "age", pattern: /\bage\b|\byears?\s+old\b/i },
  { trait: "disability/health", pattern: /\bdisabilit|\bdisabled\b|\bmedical condition\b|\bhealth condition\b/i },
  { trait: "national origin", pattern: /\bnational origin\b/i },
  { trait: "sexual orientation", pattern: /\bsexual orientation\b/i },
  { trait: "pregnancy/family status", pattern: /\bpregnan|\bmarital\b|\bfamily status\b/i },
  { trait: "political affiliation", pattern: /\bpolitical (affiliation|beliefs?|views?)\b/i },
  { trait: "veteran status", pattern: /\bveteran status\b/i },
];

export interface TraitScanHit {
  trait: string;
  excerpt: string;
}

/**
 * Scan generated text for protected-trait references. A hit is a review
 * flag, not a hard block — legitimate uses exist (e.g. "coverage for
 * maternity leave" in a benefits summary) and the recruiter decides.
 */
export function scanTextForProtectedTraits(text: string): TraitScanHit[] {
  const hits: TraitScanHit[] = [];
  for (const { trait, pattern } of TEXT_SCAN_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const start = Math.max(0, match.index - 40);
      const end = Math.min(text.length, match.index + match[0].length + 40);
      hits.push({ trait, excerpt: text.slice(start, end).trim() });
    }
  }
  return hits;
}

/** Scan an arbitrary JSON-serializable payload. */
export function scanPayloadForProtectedTraits(payload: unknown): TraitScanHit[] {
  return scanTextForProtectedTraits(JSON.stringify(payload ?? ""));
}

export const NON_INFERENCE_DIRECTIVE = `Fair-hiring constraints (mandatory):
- Never infer, mention, request, or reason about protected characteristics: ${PROTECTED_TRAITS.join(", ")}.
- Evaluate and describe candidates only through job-related professional evidence that is observable in the provided material.
- Never recommend rejecting, deprioritizing, or preferring anyone on the basis of a protected characteristic.
- If provided material contains protected-characteristic information, ignore it entirely; do not repeat it in output.
- All output is advisory decision support for a human recruiter; never phrase output as an employment decision.`;
