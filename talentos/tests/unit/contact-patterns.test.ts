/**
 * Contact hypotheses.
 *
 * The logic is ported verbatim from the Talent X-Ray reference console, so
 * the first thing to hold is that it stayed verbatim: the eight patterns, in
 * that order. The rest is about the promise around it — these are guesses,
 * they are labelled as guesses, and none of them is ever stored, because the
 * notice this product sends people says it holds no address for them.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  NOT_STORED_NOTE,
  UNVERIFIED_NOTE,
  contactHunts,
  emailPatterns,
  normalizeDomain,
  verificationLinks,
} from "@/lib/domain/contact-patterns";

describe("the eight patterns, in the order the reference had them", () => {
  it("produces exactly what the validated implementation produces", () => {
    expect(emailPatterns("Jordan Rivera", "acme.com")).toEqual([
      "jordan.rivera@acme.com",
      "jrivera@acme.com",
      "jordanrivera@acme.com",
      "jordan_rivera@acme.com",
      "jordan@acme.com",
      "riveraj@acme.com",
      "j.rivera@acme.com",
      "rivera.jordan@acme.com",
    ]);
  });

  it("uses the last name part, so a middle name does not break it", () => {
    expect(emailPatterns("Jordan Lee Rivera", "x.org")[0]).toBe(
      "jordan.rivera@x.org",
    );
  });

  it("folds an accent instead of deleting it", () => {
    // The reference console stripped anything outside a-z, so this produced
    // "ana.lpez@" — a wrong address, for exactly the names an English speaker
    // is least likely to notice being wrong.
    expect(emailPatterns("Ana María López", "x.org")[0]).toBe(
      "ana.lopez@x.org",
    );
  });

  it("drops an apostrophe and keeps a hyphen", () => {
    expect(emailPatterns("Siobhán O'Neill-Burke", "x.org")[0]).toBe(
      "siobhan.oneill-burke@x.org",
    );
  });

  it("refuses to guess from one name or no domain", () => {
    expect(emailPatterns("Cher", "acme.com")).toEqual([]);
    expect(emailPatterns("Jordan Rivera", "")).toEqual([]);
  });

  it("takes a domain however it was pasted", () => {
    expect(normalizeDomain("https://www.Acme.com/careers?x=1")).toBe(
      "acme.com",
    );
    expect(normalizeDomain("@acme.com")).toBe("acme.com");
  });
});

describe("finding a fact beats generating a guess", () => {
  it("offers searches for a page the person published", () => {
    const hunts = contactHunts("Jordan Rivera", "Acme");
    expect(hunts.length).toBeGreaterThanOrEqual(4);
    for (const hunt of hunts) {
      expect(hunt.query).toContain('"Jordan Rivera"');
      expect(hunt.query).toContain('"Acme"');
    }
  });

  it("works without an employer", () => {
    expect(contactHunts("Jordan Rivera", "")[0].query).not.toContain('""');
  });

  it("offers a way to check the pattern before sending", () => {
    const checks = verificationLinks("Jordan Rivera", "acme.com");
    expect(checks.some((check) => check.url.includes("hunter.io"))).toBe(true);
    for (const check of checks)
      expect(check.purpose.length).toBeGreaterThan(20);
  });
});

describe("the promise around it", () => {
  it("says the addresses are generated, not looked up", () => {
    expect(UNVERIFIED_NOTE).toContain("not looked up");
    expect(UNVERIFIED_NOTE).toContain("Verify");
  });

  it("says why nothing is stored, rather than leaving it implied", () => {
    expect(NOT_STORED_NOTE).toContain("None of this is stored");
    expect(NOT_STORED_NOTE).toContain("holds no address");
  });

  it("writes nothing: the module has no database import at all", () => {
    const source = fs.readFileSync(
      path.resolve("src/lib/domain/contact-patterns.ts"),
      "utf8",
    );
    for (const forbidden of ["db/", "drizzle", "insert(", "update("]) {
      expect(`${forbidden} → ${source.includes(forbidden)}`).toBe(
        `${forbidden} → false`,
      );
    }
  });
});
