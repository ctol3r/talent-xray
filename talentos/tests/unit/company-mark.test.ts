/**
 * The square that stands for a company.
 *
 * Two properties matter: the same company always draws the same mark, and a
 * favicon is never requested from anywhere except the company's own site.
 */
import { describe, expect, it } from "vitest";
import {
  companyFaviconUrl,
  companyHue,
  companyInitials,
  companyMark,
} from "../../artifact-src/core/company-mark";

describe("initials", () => {
  it("drops the legal furniture, which is not the company", () => {
    expect(companyInitials("Northwind Trading Ltd")).toBe("NT");
    expect(companyInitials("The Meridian Group")).toBe("ME");
    expect(companyInitials("Precision Ohio, Inc.")).toBe("PO");
    expect(companyInitials("Müller & Söhne GmbH")).toBe("MS");
    expect(companyInitials("Johnson & Johnson")).toBe("JJ");
    // Attached, it is part of the word rather than a joiner.
    expect(companyInitials("AT&T")).toBe("AT");
  });

  it("gives one word two letters, because one letter collides constantly", () => {
    expect(companyInitials("Stripe")).toBe("ST");
    expect(companyInitials("CAIS")).toBe("CA");
  });

  it("never draws an empty square", () => {
    expect(companyInitials("Ltd")).toBe("LT");
    expect(companyInitials("   ")).toBe("?");
    expect(companyInitials("...")).toBe("?");
  });
});

describe("colour", () => {
  it("is the same every time for the same company", () => {
    expect(companyHue("Northwind")).toBe(companyHue("northwind "));
    expect(companyMark("Acme").background).toBe(companyMark("acme").background);
  });

  it("varies only in hue, so no mark reads as louder than another", () => {
    const a = companyMark("Acme");
    const b = companyMark("Zenith Labs");
    expect(a.background).not.toBe(b.background);
    for (const mark of [a, b]) {
      expect(mark.background).toContain("62% 82%");
      expect(mark.foreground).toContain("70% 22%");
    }
  });

  it("stays inside the wheel", () => {
    for (const name of ["a", "bb", "a very long company name indeed", "字"]) {
      const hue = companyHue(name);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    }
  });
});

describe("the favicon", () => {
  it("comes from the company's own site and nowhere else", () => {
    // Never a third-party favicon service: that would hand somebody else the
    // list of every employer this workspace looks at.
    expect(companyFaviconUrl("https://example.com/careers")).toBe(
      "https://example.com/favicon.ico",
    );
    expect(companyFaviconUrl("example.com")).toBe(
      "https://example.com/favicon.ico",
    );
    for (const url of [
      "https://example.com/x",
      "http://example.com",
      "example.com",
    ]) {
      expect(companyFaviconUrl(url)).not.toContain("google");
      expect(companyFaviconUrl(url)).not.toContain("duckduckgo");
    }
  });

  it("refuses anything that is not an ordinary web address", () => {
    // A malformed or non-http column must never become a request.
    for (const url of [
      null,
      undefined,
      "",
      "   ",
      "javascript:alert(1)",
      "data:text/html,<b>",
      "file:///etc/passwd",
      "localhost",
      "not a url at all",
    ]) {
      expect(companyFaviconUrl(url)).toBeNull();
    }
  });
});
