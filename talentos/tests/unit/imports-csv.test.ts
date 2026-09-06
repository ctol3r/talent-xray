import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/imports/csv";
import { parseJsonImport } from "@/lib/imports/json";
import {
  HIREEZ_CSV,
  JSON_EXPORT,
  RAGGED_CSV,
} from "../fixtures/import-fixtures";

const limits = { maxRows: 100, maxColumns: 20, maxCellChars: 50 };

describe("parseCsv", () => {
  it("strips a BOM, handles CRLF, quoted commas and escaped quotes", () => {
    const parsed = parseCsv(HIREEZ_CSV, limits);
    expect(parsed.headers[0]).toBe("Full Name");
    expect(parsed.rows).toHaveLength(4);
    expect(parsed.rows[0][1]).toBe("Staff Engineer, Platform");
    expect(parseCsv('a,b\n"x ""quoted"" y",z', limits).rows[0][0]).toBe(
      'x "quoted" y',
    );
  });

  it("keeps embedded newlines inside quotes", () => {
    const parsed = parseCsv('a,b\n"line1\nline2",z', limits);
    expect(parsed.rows[0][0]).toBe("line1\nline2");
  });

  it("pads or trims ragged rows with a warning", () => {
    const parsed = parseCsv(RAGGED_CSV, limits);
    expect(parsed.rows[0]).toEqual(["Gus Ragged", ""]);
    expect(parsed.rows[1]).toEqual(["Hana Extra", "Engineer"]);
    expect(parsed.warnings.length).toBe(2);
  });

  it("enforces row, column and cell limits", () => {
    expect(() => parseCsv("a\n" + "x\n".repeat(101), limits)).toThrow(
      /more than 100 rows/,
    );
    expect(() =>
      parseCsv(Array.from({ length: 21 }, (_, i) => `h${i}`).join(","), limits),
    ).toThrow(/21 columns/);
    const long = parseCsv(`a\n${"y".repeat(80)}`, limits);
    expect(long.rows[0][0]).toHaveLength(50);
    expect(long.warnings[0]).toMatch(/truncated/);
  });

  it("returns nothing for an empty file", () => {
    expect(parseCsv("", limits)).toEqual({
      headers: [],
      rows: [],
      warnings: [],
    });
  });
});

describe("parseJsonImport", () => {
  it("flattens nested objects one level and joins arrays", () => {
    const parsed = parseJsonImport(JSON_EXPORT);
    expect(parsed.headers).toContain("profile.url");
    expect(parsed.rows[0][parsed.headers.indexOf("skills")]).toBe("Rust; Go");
    expect(parsed.rows).toHaveLength(2);
  });

  it("rejects non-JSON and non-array shapes", () => {
    expect(() => parseJsonImport("nope")).toThrow(/valid JSON/);
    expect(() => parseJsonImport('{"foo": 1}')).toThrow(/array of records/);
  });
});
