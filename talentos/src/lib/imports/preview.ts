/**
 * Pure import preview (Wave D): scan → map → in-file identity check →
 * identity check against existing candidates → per-row decision default.
 * Nothing here touches the database; the service supplies `existing`.
 */
import {
  findIdentityMatches,
  type IdentityCandidate,
  type IdentityMatch,
} from "@/lib/domain/identity";
import {
  type CanonicalField,
  type ImportSource,
  type ImportedRow,
  type RowDecision,
} from "./contracts";
import { headerMapping, mapRows, mapperFor } from "./mappers";
import {
  scanCells,
  scanHeaders,
  type CellWarning,
  type DroppedColumn,
} from "./scan";

export interface PreviewRow {
  index: number;
  row: ImportedRow;
  matches: IdentityMatch[];
  /** Matches against earlier rows in the same file. */
  inFileMatches: IdentityMatch[];
  decision: RowDecision;
}

export interface ImportPreview {
  source: ImportSource;
  sourceLabel: string;
  mapping: Record<string, CanonicalField | "drop">;
  droppedColumns: DroppedColumn[];
  cellWarnings: CellWarning[];
  parseWarnings: string[];
  contactColumnsPresent: boolean;
  rows: PreviewRow[];
  counts: { total: number; create: number; flagged: number; skip: number };
}

function decisionFor(
  matches: IdentityMatch[],
  inFile: IdentityMatch[],
): RowDecision {
  if (
    matches.some((m) => m.strength === "same_urls") ||
    inFile.some((m) => m.strength === "same_urls")
  ) {
    return "skip";
  }
  if (matches.length > 0 || inFile.length > 0) return "create_flagged";
  return "create";
}

export function buildImportPreview(input: {
  source: ImportSource;
  headers: string[];
  rows: string[][];
  existing: IdentityCandidate[];
  overrides?: Record<string, CanonicalField | "drop">;
  parseWarnings?: string[];
}): ImportPreview {
  const mapper = mapperFor(input.source);
  const { kept, dropped } = scanHeaders(input.headers);
  const keptIndexes = input.headers
    .map((h, i) => (kept.includes(h) ? i : -1))
    .filter((i) => i >= 0);
  const keptRows = input.rows.map((r) => keptIndexes.map((i) => r[i] ?? ""));
  const mapping = headerMapping(mapper, kept, input.overrides);
  const mapped = mapRows(mapping, kept, keptRows);
  const cellWarnings = scanCells(mapped.rows);
  const contactColumnsPresent = Object.values(mapping).some(
    (v) => v === "email" || v === "phone",
  );

  const seenInFile: IdentityCandidate[] = [];
  const rows: PreviewRow[] = mapped.rows.map(({ index, row }) => {
    const me: IdentityCandidate = {
      id: `import:${index}`,
      name: row.name,
      currentCompany: row.currentCompany,
      currentTitle: row.currentTitle,
      geography: row.geography,
      profileUrls: row.profileUrls,
    };
    const matches = findIdentityMatches(me, input.existing);
    const inFileMatches = findIdentityMatches(me, seenInFile);
    seenInFile.push(me);
    return {
      index,
      row,
      matches,
      inFileMatches,
      decision: decisionFor(matches, inFileMatches),
    };
  });
  return {
    source: mapper.id,
    sourceLabel: mapper.label,
    mapping: {
      ...Object.fromEntries(dropped.map((d) => [d.header, "drop" as const])),
      ...mapping,
    },
    droppedColumns: dropped,
    cellWarnings,
    parseWarnings: [...(input.parseWarnings ?? []), ...mapped.warnings],
    contactColumnsPresent,
    rows,
    counts: {
      total: rows.length,
      create: rows.filter((r) => r.decision === "create").length,
      flagged: rows.filter((r) => r.decision === "create_flagged").length,
      skip: rows.filter((r) => r.decision === "skip").length,
    },
  };
}
