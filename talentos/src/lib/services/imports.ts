/**
 * Bring-your-own-data imports (Wave D, D-031). A vendor export (hireEZ,
 * LinkedIn Recruiter, an ATS, a Heartbeat file-upload result) becomes
 * ordinary candidates through `createCandidate`, each with a visible
 * source label. Nothing auto-merges; nothing from a file enters
 * `resume_text`; vendor contact data is dropped unless the recruiter opts
 * in, and then lands as UNVERIFIED source evidence that decays.
 */
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import {
  candidateSourceEvidence,
  candidateSources,
  documentVersions,
} from "@/lib/db/schema";
import {
  findIdentityMatches,
  type IdentityCandidate,
} from "@/lib/domain/identity";
import {
  canonicalFieldSchema,
  importSourceSchema,
  importedRowSchema,
  MAX_IMPORT_ROWS,
} from "@/lib/imports/contracts";
import { parseCsv } from "@/lib/imports/csv";
import { parseJsonImport } from "@/lib/imports/json";
import { detectSource, mapperFor } from "@/lib/imports/mappers";
import { buildImportPreview, type ImportPreview } from "@/lib/imports/preview";
import { rowKeysAreClean } from "@/lib/imports/scan";
import {
  MAX_IMPORT_CELL_CHARS,
  MAX_IMPORT_COLUMNS,
} from "@/lib/imports/contracts";
import { createCandidate, listCandidates } from "./candidates";
import { createTask } from "./workflow";

async function existingIdentities(
  db: Db,
  searchProjectId: string,
): Promise<IdentityCandidate[]> {
  const rows = await listCandidates(db, searchProjectId);
  if (rows.length === 0) return [];
  const sources = await db
    .select({
      candidateId: candidateSources.candidateId,
      url: candidateSources.url,
    })
    .from(candidateSources)
    .where(
      inArray(
        candidateSources.candidateId,
        rows.map((r) => r.id),
      ),
    );
  const urlsBy = new Map<string, string[]>();
  for (const s of sources)
    urlsBy.set(s.candidateId, [...(urlsBy.get(s.candidateId) ?? []), s.url]);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    currentCompany: r.currentCompany ?? undefined,
    currentTitle: r.currentTitle ?? undefined,
    geography: r.geography ?? undefined,
    profileUrls: urlsBy.get(r.id) ?? [],
  }));
}

export const previewImportInput = z.object({
  searchProjectId: z.string().min(1),
  filename: z.string().min(1),
  text: z.string().min(1),
  source: importSourceSchema.optional(),
  overrides: z
    .record(z.string(), z.union([canonicalFieldSchema, z.literal("drop")]))
    .optional(),
});

export async function previewImport(
  db: Db,
  raw: z.input<typeof previewImportInput>,
): Promise<ImportPreview> {
  const input = previewImportInput.parse(raw);
  const parsed = input.filename.toLowerCase().endsWith(".json")
    ? parseJsonImport(input.text)
    : parseCsv(input.text, {
        maxRows: MAX_IMPORT_ROWS,
        maxColumns: MAX_IMPORT_COLUMNS,
        maxCellChars: MAX_IMPORT_CELL_CHARS,
      });
  const source = input.source ?? detectSource(parsed.headers);
  const existing = await existingIdentities(db, input.searchProjectId);
  return buildImportPreview({
    source,
    headers: parsed.headers,
    rows: parsed.rows,
    existing,
    overrides: input.overrides,
    parseWarnings: parsed.warnings,
  });
}

export const commitImportInput = z.object({
  searchProjectId: z.string().min(1),
  source: importSourceSchema,
  filename: z.string().min(1).max(300),
  /** Off by default: vendor contact data decays and is never verified by the vendor. */
  keepContactData: z.boolean().default(false),
  rows: z.array(importedRowSchema).min(1).max(MAX_IMPORT_ROWS),
});

export interface CommitResult {
  created: { id: string; name: string }[];
  flagged: { candidateId: string; taskId: string; reason: string }[];
  contactEvidenceCount: number;
}

export async function commitImport(
  db: Db,
  raw: z.input<typeof commitImportInput>,
): Promise<CommitResult> {
  // Defence in depth: the client sends canonical rows back; their keys are
  // re-checked here BEFORE zod strips unknown keys, never trusted.
  const rawRows = (raw as { rows?: unknown }).rows;
  if (Array.isArray(rawRows)) {
    for (const row of rawRows) {
      if (
        row &&
        typeof row === "object" &&
        !rowKeysAreClean(row as Record<string, unknown>)
      ) {
        throw new Error("Import payload contains a blocked field.");
      }
    }
  }
  const input = commitImportInput.parse(raw);
  const mapper = mapperFor(input.source);
  const label = `${mapper.label} export`;
  const importedAt = new Date().toISOString();
  const existing = await existingIdentities(db, input.searchProjectId);
  const created: CommitResult["created"] = [];
  const flagged: CommitResult["flagged"] = [];
  let contactEvidenceCount = 0;

  for (const row of input.rows) {
    const me: IdentityCandidate = {
      id: "incoming",
      name: row.name,
      currentCompany: row.currentCompany,
      currentTitle: row.currentTitle,
      geography: row.geography,
      profileUrls: row.profileUrls,
    };
    const matches = findIdentityMatches(me, existing);
    const candidate = await createCandidate(db, {
      searchProjectId: input.searchProjectId,
      name: row.name,
      currentTitle: row.currentTitle,
      currentCompany: row.currentCompany,
      geography: row.geography,
      profileUrls: row.profileUrls,
      addedVia: `import:${input.source}`,
      sourceLabel: label,
      profile: {
        licenses: row.licenses,
        certifications: row.certifications,
        skills: row.skills,
      },
      recruiterNotes: `Imported from ${mapper.label} file ${input.filename} on ${importedAt.slice(0, 10)}.`,
      stage: "identified",
    });
    created.push({ id: candidate.id, name: candidate.name });
    existing.push({ ...me, id: candidate.id });

    if (row.registryUrl) {
      await db.insert(candidateSources).values({
        candidateId: candidate.id,
        url: row.registryUrl,
        sourceType: "registry",
        label: "NPI record (from export, unverified)",
        addedVia: `import:${input.source}`,
      });
    }
    if (input.keepContactData && row.contact.length > 0) {
      const sourceUrl = row.profileUrls[0] ?? mapper.vendorUrl ?? "";
      for (const c of row.contact) {
        await db.insert(candidateSourceEvidence).values({
          candidateId: candidate.id,
          searchProjectId: input.searchProjectId,
          sourceUrl: sourceUrl || `import:${input.source}`,
          sourceType: "vendor_contact",
          title: `${label} — ${c.kind}`,
          snippet: c.value,
          retrievedAt: importedAt,
          provider: `import:${input.source}`,
          verificationStatus: "unverified",
          provenance: "imported",
        });
        contactEvidenceCount += 1;
      }
    }
    if (matches.length > 0) {
      const strongest = matches[0];
      const other = existing.find((e) => e.id === strongest.otherId);
      const task = await createTask(db, {
        title: `Identity review: "${row.name}" may be "${other?.name ?? strongest.otherId}" — ${strongest.reason}`,
        searchProjectId: input.searchProjectId,
        candidateId: candidate.id,
        kind: "identity_review",
      });
      flagged.push({
        candidateId: candidate.id,
        taskId: task.id,
        reason: strongest.reason,
      });
    }
  }
  return { created, flagged, contactEvidenceCount };
}

/** For tests and the smoke script: how many CV versions exist for a search. */
export async function countDocumentVersions(db: Db, searchProjectId: string) {
  const rows = await db
    .select({ id: documentVersions.id })
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.searchProjectId, searchProjectId),
        eq(documentVersions.kind, "cv"),
      ),
    );
  return rows.length;
}
