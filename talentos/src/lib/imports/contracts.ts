/**
 * Import limits and the canonical imported row (Wave D, D-031). The
 * canonical row deliberately has no free-text CV field: a vendor export is
 * never candidate-supplied material, so nothing from it can become
 * `resume_text`.
 */
import { z } from "zod";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_COLUMNS = 100;
export const MAX_IMPORT_CELL_CHARS = 2000;
export const MAX_URLS_PER_ROW = 5;
export const MAX_LIST_ITEMS_PER_ROW = 50;

export const IMPORT_SOURCES = [
  "hireez",
  "linkedin_recruiter",
  "generic_ats",
  "heartbeat",
] as const;
export const importSourceSchema = z.enum(IMPORT_SOURCES);
export type ImportSource = z.infer<typeof importSourceSchema>;

export const CANONICAL_FIELDS = [
  "fullName",
  "firstName",
  "lastName",
  "currentTitle",
  "currentCompany",
  "geography",
  "profileUrl",
  "email",
  "phone",
  "skills",
  "licenses",
  "certifications",
  "registryId",
] as const;
export const canonicalFieldSchema = z.enum(CANONICAL_FIELDS);
export type CanonicalField = z.infer<typeof canonicalFieldSchema>;

export const contactSchema = z.object({
  kind: z.enum(["email", "phone"]),
  value: z.string().min(1).max(200),
});

export const importedRowSchema = z.object({
  name: z.string().min(1).max(200),
  currentTitle: z.string().max(200).optional(),
  currentCompany: z.string().max(200).optional(),
  geography: z.string().max(200).optional(),
  profileUrls: z.array(z.string().url()).max(MAX_URLS_PER_ROW).default([]),
  skills: z
    .array(z.string().min(1).max(120))
    .max(MAX_LIST_ITEMS_PER_ROW)
    .default([]),
  licenses: z
    .array(z.string().min(1).max(120))
    .max(MAX_LIST_ITEMS_PER_ROW)
    .default([]),
  certifications: z
    .array(z.string().min(1).max(120))
    .max(MAX_LIST_ITEMS_PER_ROW)
    .default([]),
  /** Link-out to an official registry record (e.g. an NPI page). Never a verification claim. */
  registryUrl: z.string().url().optional(),
  contact: z.array(contactSchema).max(10).default([]),
});
export type ImportedRow = z.infer<typeof importedRowSchema>;

export const OFFICIAL_REGISTRY_HOST = "npiregistry.cms.hhs.gov";

/** Per-row decision the preview proposes and the recruiter can override. */
export const rowDecisionSchema = z.enum(["create", "create_flagged", "skip"]);
export type RowDecision = z.infer<typeof rowDecisionSchema>;
