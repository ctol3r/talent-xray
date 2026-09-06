/**
 * Fair-hiring scan for imports (Wave D). Headers matching a blocked
 * pattern are dropped before mapping and reported by name; kept string
 * cells are scanned for protected-trait phrases as review warnings (never
 * a block — the recruiter decides). The patterns themselves live in
 * `domain/fair-hiring.ts`, the one module allowed to spell them.
 */
import {
  BLOCKED_FIELD_PATTERNS,
  BLOCKED_IMPORT_HEADER_PATTERNS,
  scanTextForProtectedTraits,
} from "@/lib/domain/fair-hiring";
import type { ImportedRow } from "./contracts";

export interface DroppedColumn {
  header: string;
  pattern: string;
}

export function scanHeaders(headers: string[]): {
  kept: string[];
  dropped: DroppedColumn[];
} {
  const kept: string[] = [];
  const dropped: DroppedColumn[] = [];
  for (const header of headers) {
    const hit = [
      ...BLOCKED_FIELD_PATTERNS,
      ...BLOCKED_IMPORT_HEADER_PATTERNS,
    ].find((p) => p.test(header));
    if (hit) dropped.push({ header, pattern: String(hit) });
    else kept.push(header);
  }
  return { kept, dropped };
}

export interface CellWarning {
  rowIndex: number;
  field: string;
  trait: string;
}

export function scanCells(
  rows: { index: number; row: ImportedRow }[],
): CellWarning[] {
  const out: CellWarning[] = [];
  for (const { index, row } of rows) {
    const fields: [string, string][] = [
      ["name", row.name],
      ["currentTitle", row.currentTitle ?? ""],
      ["currentCompany", row.currentCompany ?? ""],
      ["geography", row.geography ?? ""],
      ["skills", row.skills.join("; ")],
      ["licenses", row.licenses.join("; ")],
      ["certifications", row.certifications.join("; ")],
    ];
    for (const [field, text] of fields) {
      if (!text) continue;
      for (const hit of scanTextForProtectedTraits(text)) {
        out.push({ rowIndex: index, field, trait: hit.trait });
      }
    }
  }
  return out;
}

/** True when a canonical row's keys contain anything a blocked pattern matches. */
export function rowKeysAreClean(row: Record<string, unknown>): boolean {
  return Object.keys(row).every(
    (k) =>
      ![...BLOCKED_FIELD_PATTERNS, ...BLOCKED_IMPORT_HEADER_PATTERNS].some(
        (p) => p.test(k),
      ),
  );
}
