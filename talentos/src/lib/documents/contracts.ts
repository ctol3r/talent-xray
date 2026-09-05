import { z } from "zod";

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_DOCUMENT_CHARS = 200_000;
export const MAX_PDF_PAGES = 100;
export const documentKind = z.enum(["cv", "jd"]);
export const anchorSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
  quote: z.string().min(1),
});
export type Anchor = z.infer<typeof anchorSchema>;
export const assessmentSchema = z.enum([
  "relevant",
  "partial",
  "contradictory",
  "unknown",
]);
export const linkInputSchema = z.object({
  requirementId: z.string().min(1),
  cvAnchor: anchorSchema,
  jdAnchor: anchorSchema.nullable(),
  explanation: z.string().min(1).max(4000),
  limitation: z.string().max(4000),
  assessment: assessmentSchema,
});
export type LinkInput = z.infer<typeof linkInputSchema>;
export const requirementSnapshotSchema = z.object({
  id: z.string(),
  label: z.string(),
  statement: z.string(),
  definition: z.string(),
  origin: z.string(),
});
export type ReviewRequirement = z.infer<typeof requirementSnapshotSchema>;
export function validateAnchor(text: string, anchor: Anchor): void {
  if (
    anchor.end <= anchor.start ||
    anchor.end > text.length ||
    text.slice(anchor.start, anchor.end) !== anchor.quote
  ) {
    throw new Error(
      "The selected passage no longer matches the document. Select it again.",
    );
  }
}
/** Resolve only an unambiguous exact quote. Repeated text requires explicit offsets. */
export function locateUnique(text: string, quote: string): Anchor | null {
  if (!quote.trim()) return null;
  const start = text.indexOf(quote);
  if (start < 0 || text.indexOf(quote, start + 1) >= 0) return null;
  return { start, end: start + quote.length, quote };
}
export function assertCurrent(expected: string, actual: string): void {
  if (expected !== actual)
    throw new Error(
      "This comparison is stale. Open the current document versions and analyze or link again.",
    );
}
