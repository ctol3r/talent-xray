/**
 * JSON import (Wave D): an array of flat objects, or `{results: [...]}` /
 * `{data: [...]}`, flattened one level with dotted keys, then handed to the
 * same header mapping as CSV.
 */
import { MAX_IMPORT_COLUMNS, MAX_IMPORT_ROWS } from "./contracts";

export function parseJsonImport(text: string): {
  headers: string[];
  rows: string[][];
  warnings: string[];
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object"
      ? ((parsed as Record<string, unknown>).results ??
        (parsed as Record<string, unknown>).data ??
        (parsed as Record<string, unknown>).items)
      : undefined;
  if (!Array.isArray(list)) {
    throw new Error(
      "Expected an array of records, or an object with a results/data/items array.",
    );
  }
  if (list.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `The file has more than ${MAX_IMPORT_ROWS} records; split it and import in parts.`,
    );
  }
  const warnings: string[] = [];
  const flat: Record<string, string>[] = [];
  const headerSet = new Set<string>();
  list.forEach((item, i) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      warnings.push(`Record ${i + 1} is not an object; skipped.`);
      return;
    }
    const record: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      item as Record<string, unknown>,
    )) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        for (const [k2, v2] of Object.entries(
          value as Record<string, unknown>,
        )) {
          record[`${key}.${k2}`] = stringify(v2);
        }
      } else {
        record[key] = stringify(value);
      }
    }
    for (const k of Object.keys(record)) headerSet.add(k);
    flat.push(record);
  });
  const headers = [...headerSet];
  if (headers.length > MAX_IMPORT_COLUMNS) {
    throw new Error(
      `The file has ${headers.length} fields; the limit is ${MAX_IMPORT_COLUMNS}.`,
    );
  }
  const rows = flat.map((r) => headers.map((h) => r[h] ?? ""));
  return { headers, rows, warnings };
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value))
    return value.map(stringify).filter(Boolean).join("; ");
  if (typeof value === "object") return "";
  return String(value);
}
