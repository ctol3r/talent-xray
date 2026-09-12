/**
 * Zod boundaries for the HSAL server actions. Kept in their own module so the
 * rules (blank counts rejected, advanced ≤ total, learning ids scoped to the
 * project, …) can be unit-tested without a Next.js request context.
 */
import { z } from "zod";
import {
  learningCategorySchema,
  PIPELINE_STAGES,
  successCriterionSchema,
  type PipelineStage,
} from "@talentos/hsal-adapter";
import { textToList } from "./generic";

export const dayString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");

/** A count typed into the form: digits only. A blank field is an error, never a zero. */
const countField = z
  .union([z.number().int().min(0), z.string().regex(/^\d+$/, "enter a count")])
  .transform(Number);

export const countsInput = z.object(
  Object.fromEntries(PIPELINE_STAGES.map((s) => [s, countField])) as Record<
    PipelineStage,
    typeof countField
  >,
);

export const snapshotInput = z
  .object({
    searchProjectId: z.string().min(1),
    periodStart: dayString,
    periodEnd: dayString,
    counts: countsInput,
    source: z.enum(["seed", "ats", "manual", "import"]).default("manual"),
    /** Explicit snapshot id (seeded demo); otherwise derived from project + period. */
    id: z.string().min(1).optional(),
    observedAt: z.string().datetime({ offset: true }).optional(),
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    message: "Period end must not be before period start.",
    path: ["periodEnd"],
  });
export type SnapshotInput = z.infer<typeof snapshotInput>;

export const postInterventionInput = snapshotInput.safeExtend({
  interventionId: z.string().min(1),
});

export const profileChangeInput = z.object({
  searchProjectId: z.string().min(1),
  interventionId: z.string().optional(),
  /** One criterion label per line. Labels matching known criteria keep their ids. */
  mustHave: z.string().default(""),
  preferred: z.string().default(""),
  transferable: z.string().default(""),
  /** Extra criteria whose labels should resolve to these exact ids/categories (e.g. a seeded profile). */
  knownCriteria: z.array(successCriterionSchema).default([]),
});

const observationLines = z
  .array(z.string())
  .transform((xs) => xs.map((x) => x.trim()).filter(Boolean))
  .pipe(z.array(z.string().min(1)).min(1, "enter at least one observation"));

export const experimentInput = z
  .object({
    searchProjectId: z.string().min(1),
    interventionId: z.string().min(1),
    summary: z.string().trim().min(1).optional(),
    observations: observationLines.optional(),
    metrics: z.record(z.string(), z.number()).optional(),
    /** Calibration tests only: advanced / total → metrics.advanceRate. */
    advanced: z.coerce.number().int().min(0).optional(),
    total: z.coerce.number().int().min(1).optional(),
  })
  .refine((v) => (v.advanced === undefined) === (v.total === undefined), {
    message: "enter both advanced and total, or neither",
    path: ["advanced"],
  })
  .refine(
    (v) =>
      v.advanced === undefined ||
      v.total === undefined ||
      v.advanced <= v.total,
    {
      message: "advanced cannot exceed total",
      path: ["advanced"],
    },
  );

const tagList = z
  .union([z.array(z.string()), z.string()])
  .transform((v) =>
    (Array.isArray(v) ? v : textToList(v)).map((x) => x.trim()).filter(Boolean),
  );

export const learningInput = z
  .object({
    searchProjectId: z.string().min(1),
    id: z.string().min(1).optional(),
    title: z.string().trim().min(1),
    statement: z.string().trim().min(1),
    category: learningCategorySchema,
    confidence: z.coerce.number().min(0).max(1),
    applicability: z
      .object({
        roleFamilies: tagList.optional(),
        skills: tagList.optional(),
        seniority: tagList.optional(),
        industries: tagList.optional(),
        geographies: tagList.optional(),
      })
      .default({}),
    evidenceIds: z.array(z.string()).default([]),
    originatingBeliefIds: z.array(z.string()).default([]),
    originatingModelIds: z.array(z.string()).default([]),
  })
  .refine((v) => !v.id || v.id.startsWith(`LEARN-${v.searchProjectId}-`), {
    message: "a learning id must belong to this search",
    path: ["id"],
  });
