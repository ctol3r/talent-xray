/**
 * Wave D acceptance: every fixture auto-detects its source, mapping is an
 * allow-list, blocked headers never reach a mapped row, an NPI column
 * becomes a link-out on the official domain only, and overrides re-map.
 */
import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/imports/csv";
import { buildImportPreview } from "@/lib/imports/preview";
import { detectSource } from "@/lib/imports/mappers";
import { scanHeaders } from "@/lib/imports/scan";
import {
  GENERIC_ATS_CSV,
  HEARTBEAT_CSV,
  HIREEZ_CSV,
  LINKEDIN_RECRUITER_CSV,
} from "../fixtures/import-fixtures";

const limits = { maxRows: 2000, maxColumns: 100, maxCellChars: 2000 };
const parse = (csv: string) => parseCsv(csv, limits);

describe("detectSource", () => {
  it("recognises each fixture", () => {
    expect(detectSource(parse(HEARTBEAT_CSV).headers)).toBe("heartbeat");
    expect(detectSource(parse(LINKEDIN_RECRUITER_CSV).headers)).toBe(
      "linkedin_recruiter",
    );
    expect(["hireez", "generic_ats"]).toContain(
      detectSource(parse(HIREEZ_CSV).headers),
    );
    expect(["generic_ats", "hireez"]).toContain(
      detectSource(parse(GENERIC_ATS_CSV).headers),
    );
  });
});

describe("buildImportPreview", () => {
  it("drops blocked headers before mapping and never lets their values through", () => {
    const parsed = parse(HIREEZ_CSV);
    const preview = buildImportPreview({
      source: "hireez",
      ...parsed,
      existing: [],
    });
    expect(preview.droppedColumns.map((d) => d.header)).toEqual(["Gender"]);
    expect(preview.mapping.Gender).toBe("drop");
    const json = JSON.stringify(preview.rows.map((r) => r.row));
    expect(json).not.toMatch(/"F"|"M"/);
    expect(preview.rows[0].row.name).toBe("Ada Example");
    expect(preview.rows[0].row.skills).toEqual(["Rust", "Go", "Kubernetes"]);
    expect(preview.rows[0].row.contact).toEqual([
      { kind: "email", value: "ada@example.com" },
      { kind: "phone", value: "+1 512 555 0100" },
    ]);
    expect(preview.contactColumnsPresent).toBe(true);
  });

  it("drops the LinkedIn and ATS fixtures' blocked columns too", () => {
    expect(
      scanHeaders(parse(LINKEDIN_RECRUITER_CSV).headers).dropped.map(
        (d) => d.header,
      ),
    ).toEqual(["Date of Birth"]);
    expect(
      scanHeaders(parse(GENERIC_ATS_CSV).headers).dropped.map((d) => d.header),
    ).toEqual(["Veteran Status"]);
  });

  it("composes a name from first and last, and flags in-file duplicates", () => {
    const parsed = parse(LINKEDIN_RECRUITER_CSV);
    const preview = buildImportPreview({
      source: "linkedin_recruiter",
      ...parsed,
      existing: [],
    });
    expect(preview.rows.map((r) => r.row.name)).toEqual([
      "Dana Fixture",
      "Eli Sample",
    ]);
    const hireez = buildImportPreview({
      source: "hireez",
      ...parse(HIREEZ_CSV),
      existing: [],
    });
    // Third row shares Ada's URL: same_urls in-file → skip by default.
    expect(hireez.rows[2].decision).toBe("skip");
    expect(hireez.counts.skip).toBe(1);
  });

  it("flags rows that look like existing candidates and skips exact URL matches", () => {
    const preview = buildImportPreview({
      source: "hireez",
      ...parse(HIREEZ_CSV),
      existing: [
        {
          id: "existing-1",
          name: "Ben Sample",
          currentCompany: "Other Corp",
          profileUrls: [],
        },
        {
          id: "existing-2",
          name: "Cara Fixture",
          profileUrls: ["https://www.linkedin.com/in/cara-fixture"],
        },
      ],
    });
    const ben = preview.rows.find((r) => r.row.name === "Ben Sample")!;
    expect(ben.decision).toBe("create_flagged");
    expect(ben.matches[0].strength).toBe("same_name_different_org");
    const cara = preview.rows.find((r) => r.row.name === "Cara Fixture")!;
    expect(cara.decision).toBe("skip");
  });

  it("maps a Heartbeat NPI to a link-out on the official registry domain only", () => {
    const preview = buildImportPreview({
      source: "heartbeat",
      ...parse(HEARTBEAT_CSV),
      existing: [],
    });
    expect(preview.droppedColumns.map((d) => d.header)).toEqual(["Age"]);
    expect(preview.rows[0].row.registryUrl).toBe(
      "https://npiregistry.cms.hhs.gov/provider-view/1234567893",
    );
    expect(preview.rows[1].row.registryUrl).toBeUndefined();
    expect(preview.rows[0].row.currentTitle).toBe("Family Medicine");
    expect(preview.rows[0].row.licenses).toEqual(["TX"]);
  });

  it("applies header overrides", () => {
    const parsed = parse(GENERIC_ATS_CSV);
    const preview = buildImportPreview({
      source: "generic_ats",
      ...parsed,
      existing: [],
      overrides: { Title: "drop", Location: "currentCompany" },
    });
    expect(preview.rows[0].row.currentTitle).toBeUndefined();
    expect(preview.rows[0].row.currentCompany).toBe("Remote");
  });

  it("warns on protected-trait phrases in kept cells without blocking", () => {
    const preview = buildImportPreview({
      source: "generic_ats",
      headers: ["Name", "Title"],
      rows: [["Zed Fixture", "Engineer (religious outreach)"]],
      existing: [],
    });
    expect(preview.cellWarnings[0]).toMatchObject({
      rowIndex: 0,
      field: "currentTitle",
    });
    expect(preview.rows[0].decision).toBe("create");
  });
});
