/**
 * Hand-written RFC 4180 parser (Wave D). No dependency: the format is
 * small, and a lockfile change would touch the private-build check. Handles
 * a BOM, CRLF and LF, quoted fields, doubled-quote escapes, embedded
 * newlines, and ragged rows (padded, with a warning). Limits are enforced
 * here so a hostile file cannot balloon memory.
 */
export interface CsvLimits {
  maxRows: number;
  maxColumns: number;
  maxCellChars: number;
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  warnings: string[];
}

export function parseCsv(text: string, limits: CsvLimits): ParsedCsv {
  const src = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const records: string[][] = [];
  const warnings: string[] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let i = 0;
  const pushCell = () => {
    if (cell.length > limits.maxCellChars) {
      warnings.push(
        `Row ${records.length + 1}: a cell was truncated to ${limits.maxCellChars} characters.`,
      );
      cell = cell.slice(0, limits.maxCellChars);
    }
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    // Skip fully blank lines.
    if (row.length === 1 && row[0] === "" && records.length > 0) {
      row = [];
      return;
    }
    records.push(row);
    row = [];
    if (records.length > limits.maxRows + 1) {
      throw new Error(
        `The file has more than ${limits.maxRows} rows; split it and import in parts.`,
      );
    }
  };
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      pushCell();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      if (src[i] === "\n") i += 1;
      pushRow();
      continue;
    }
    if (ch === "\n") {
      i += 1;
      pushRow();
      continue;
    }
    cell += ch;
    i += 1;
  }
  if (quoted) warnings.push("The file ends inside a quoted field.");
  if (cell !== "" || row.length > 0) pushRow();
  if (records.length === 0) return { headers: [], rows: [], warnings };

  const headers = records[0].map((h) => h.trim());
  if (headers.length > limits.maxColumns) {
    throw new Error(
      `The file has ${headers.length} columns; the limit is ${limits.maxColumns}.`,
    );
  }
  const rows: string[][] = [];
  for (let r = 1; r < records.length; r += 1) {
    const rec = records[r];
    if (rec.length !== headers.length) {
      warnings.push(
        `Row ${r + 1}: expected ${headers.length} cells, found ${rec.length}; padded or trimmed.`,
      );
    }
    const fixed = headers.map((_, c) => (rec[c] ?? "").trim());
    rows.push(fixed);
  }
  return { headers, rows, warnings };
}
