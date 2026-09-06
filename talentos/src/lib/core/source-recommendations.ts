import { z } from "zod";
import { channelSuggestionSchema } from "./payloads";

/** Saved as structured metadata in the existing channel note, never a second catalog. */
const NOTE_PREFIX = "talentos:source-recommendation:v1\n";
export const sourcePurposeSchema = z.enum(["sourcing", "exposure", "both"]);
export const sourcePurposeLabel = {
  sourcing: "Candidate sourcing",
  exposure: "Opportunity exposure",
  both: "Sourcing and exposure",
} as const;

export function safeSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return false;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    // Recommendations link to public venues, never local services or IP literals.
    return (
      host.includes(".") &&
      !host.includes(":") &&
      !/^\d+(\.\d+){3}$/.test(host) &&
      !/(^|\.)(localhost|local|internal|test|invalid)$/.test(host)
    );
  } catch {
    return false;
  }
}
const url = z
  .string()
  .max(2048)
  .refine(safeSourceUrl, "Use a public HTTP(S) venue URL without credentials.");
const text = z.string().trim().min(1).max(3000);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  }, "Use a real calendar date.");
export const sourceEvidenceSchema = z
  .object({
    url,
    excerpt: text,
    checkedOn: date.nullable(),
    dataAsOf: date.nullable(),
    limitation: text,
  })
  .strict();
export const sourceRecommendationSchema = channelSuggestionSchema
  .omit({ certainty: true, note: true })
  .extend({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
    name: text,
    url,
    audience: text,
    geography: text,
    whyRelevant: text,
    purpose: sourcePurposeSchema,
    evidence: z.array(sourceEvidenceSchema).max(8),
    limitation: text,
  })
  .strict()
  .superRefine((recommendation, ctx) => {
    if (
      recommendation.costModel !== "unknown" &&
      recommendation.evidence.length === 0
    )
      ctx.addIssue({
        code: "custom",
        path: ["costModel"],
        message:
          "A reported free or paid cost needs supporting evidence; otherwise use unknown.",
      });
  });
export const sourceRecommendationsSchema = z
  .object({
    contextHash: z.string().regex(/^[a-f0-9]{64}$/),
    recommendations: z.array(sourceRecommendationSchema).max(40),
    reasoningSummary: text,
    limitations: z.array(text).min(1).max(12),
  })
  .strict()
  .superRefine((output, ctx) => {
    if (
      new Set(output.recommendations.map((r) => r.id)).size !==
      output.recommendations.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["recommendations"],
        message: "Recommendation identifiers must be unique.",
      });
  });
export type SourceRecommendation = z.infer<typeof sourceRecommendationSchema>;
export type SourceRecommendations = z.infer<typeof sourceRecommendationsSchema>;
export const savedSourceRecommendationSchema = z.object({
  version: z.literal(1),
  purpose: sourcePurposeSchema,
  contextHash: z.string().regex(/^[a-f0-9]{64}$/),
  importedAt: z.iso.datetime(),
  author: z.literal("Imported session response; author unverified"),
  evidence: z.array(sourceEvidenceSchema),
  limitation: text,
  reasoningSummary: text,
  researchLimitations: z.array(text).min(1).max(12),
});
export type SavedSourceRecommendation = z.infer<
  typeof savedSourceRecommendationSchema
>;
export function sourceRecommendationNote(meta: SavedSourceRecommendation) {
  return (
    NOTE_PREFIX + JSON.stringify(savedSourceRecommendationSchema.parse(meta))
  );
}
export function readSourceRecommendationNote(
  note: string | null | undefined,
): SavedSourceRecommendation | null {
  if (!note?.startsWith(NOTE_PREFIX)) return null;
  try {
    const result = savedSourceRecommendationSchema.safeParse(
      JSON.parse(note.slice(NOTE_PREFIX.length)),
    );
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
export function validateSourceDates(
  output: SourceRecommendations,
  now = new Date(),
) {
  const today = now.toISOString().slice(0, 10);
  for (const recommendation of output.recommendations) {
    for (const evidence of recommendation.evidence) {
      if (
        (evidence.checkedOn && evidence.checkedOn > today) ||
        (evidence.dataAsOf && evidence.dataAsOf > today)
      )
        throw new Error(
          "Source evidence contains a future date. Correct it before importing.",
        );
    }
  }
}
