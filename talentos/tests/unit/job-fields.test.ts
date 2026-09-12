/**
 * The job's own fields.
 *
 * Dropdowns exist so two jobs can be compared, so the properties worth
 * holding are: a stored value always renders as a label rather than a raw
 * enum, an unset field says it is unset rather than showing a dash, a salary
 * with only one end still says something useful, and nothing in this file
 * describes a person.
 */
import { describe, expect, it } from "vitest";
import {
  CURRENCIES,
  EMPLOYMENT_TYPES,
  FTE_OPTIONS,
  INDUSTRIES,
  JOB_PRIORITIES,
  SALARY_PERIODS,
  SENIORITY_LEVELS,
  SPONSORSHIP_OPTIONS,
  UNKNOWN,
  WORK_ARRANGEMENTS,
  isValidChoice,
  labelFor,
  salaryLine,
} from "@/lib/domain/job-fields";
import {
  BLOCKED_FIELD_PATTERNS,
  BLOCKED_IMPORT_HEADER_PATTERNS,
} from "@/lib/domain/fair-hiring";

const ALL_LISTS = {
  EMPLOYMENT_TYPES,
  WORK_ARRANGEMENTS,
  FTE_OPTIONS,
  SENIORITY_LEVELS,
  INDUSTRIES,
  CURRENCIES,
  SALARY_PERIODS,
  JOB_PRIORITIES,
  SPONSORSHIP_OPTIONS,
};

describe("a stored value always renders as a label", () => {
  it("turns an enum into words", () => {
    expect(labelFor(EMPLOYMENT_TYPES, "fixed_term")).toBe("Fixed term");
    expect(labelFor(FTE_OPTIONS, "0.8")).toBe("0.8 — four days");
    expect(labelFor(WORK_ARRANGEMENTS, "hybrid_3")).toBe(
      "Hybrid — 3 days on-site",
    );
  });

  it("says a field is unset rather than showing nothing", () => {
    expect(labelFor(EMPLOYMENT_TYPES, null)).toBe(UNKNOWN.label);
    expect(labelFor(EMPLOYMENT_TYPES, "")).toBe(UNKNOWN.label);
  });

  it("shows an unrecognised stored value rather than hiding it", () => {
    // A value written before a list changed is still someone's data.
    expect(labelFor(EMPLOYMENT_TYPES, "zero_hours")).toBe("zero_hours");
  });
});

describe("what the form will accept", () => {
  it("takes a listed value or nothing", () => {
    expect(isValidChoice(EMPLOYMENT_TYPES, "permanent")).toBe(true);
    expect(isValidChoice(EMPLOYMENT_TYPES, "")).toBe(true);
    expect(isValidChoice(EMPLOYMENT_TYPES, "made up")).toBe(false);
  });

  it("has no duplicate values in any list", () => {
    for (const [name, list] of Object.entries(ALL_LISTS)) {
      const values = list.map((choice) => choice.value);
      expect(`${name} → ${values.length}`).toBe(
        `${name} → ${new Set(values).size}`,
      );
    }
  });
});

describe("the salary line", () => {
  it("reads as a range when both ends are known", () => {
    expect(
      salaryLine({
        salaryMin: 145000,
        salaryMax: 185000,
        salaryCurrency: "USD",
        salaryPeriod: "year",
      }),
    ).toBe("USD 145,000 – USD 185,000 per year");
  });

  it("still says something useful with one end", () => {
    expect(
      salaryLine({
        salaryMin: 600,
        salaryCurrency: "GBP",
        salaryPeriod: "day",
      }),
    ).toBe("From GBP 600 per day");
    expect(salaryLine({ salaryMax: 90000, salaryCurrency: "EUR" })).toBe(
      "Up to EUR 90,000 per year",
    );
  });

  it("says nothing when nothing is known, rather than a zero", () => {
    expect(salaryLine({})).toBeNull();
    expect(salaryLine({ salaryCurrency: "USD" })).toBeNull();
  });
});

describe("nothing here describes a person", () => {
  it("has no option that names a protected characteristic", () => {
    const everything = Object.values(ALL_LISTS)
      .flat()
      .map((choice) => `${choice.value} ${choice.label} ${choice.hint ?? ""}`)
      .join(" ");
    for (const pattern of [
      ...BLOCKED_FIELD_PATTERNS,
      ...BLOCKED_IMPORT_HEADER_PATTERNS,
    ]) {
      const test = new RegExp(pattern.source, pattern.flags.replace("g", ""));
      expect(`${pattern.source} → ${test.test(everything)}`).toBe(
        `${pattern.source} → false`,
      );
    }
  });
});
