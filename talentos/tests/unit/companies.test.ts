/**
 * A company's address, and the one thing this must never do.
 *
 * A favicon needs a domain, and the temptation is to guess one from the name.
 * "Meridian Software" resolving to whoever owns meridian.com would put a
 * stranger's logo beside a live job, and a wrong logo is worse than none: it
 * is wrong silently, confidently, on the surface a recruiter scans fastest.
 * So the address is recorded by a person, and nothing here derives one.
 */
import { describe, expect, it } from "vitest";
import { siteOrigin } from "@/lib/services/companies";
import {
  companyFaviconUrl,
  companyFaviconUrls,
  suggestedCompanySite,
} from "../../artifact-src/core/company-mark";

describe("reading a web address", () => {
  it("keeps the origin and nothing else", () => {
    // A pasted careers-page URL brings a path and whatever tracking was on
    // the end of it; a favicon lives at the root, so none of that is kept.
    expect(siteOrigin("https://acme.com/careers?utm_source=x")).toBe(
      "https://acme.com",
    );
    expect(siteOrigin("acme.com")).toBe("https://acme.com");
    expect(siteOrigin("  https://sub.acme.co.uk/jobs  ")).toBe(
      "https://sub.acme.co.uk",
    );
  });

  it("refuses what is not a web address", () => {
    expect(siteOrigin("")).toBeNull();
    expect(siteOrigin("acme")).toBeNull();
    expect(siteOrigin("javascript:alert(1)")).toBeNull();
    expect(siteOrigin("file:///etc/passwd")).toBeNull();
    expect(siteOrigin("not a url at all")).toBeNull();
  });

  it("asks the company's own server and never a favicon service", () => {
    // The whole privacy argument rests on this. A favicon service would mean
    // one request naming every employer on the desk to a third party.
    const icon = companyFaviconUrl("https://acme.com/careers");
    expect(icon).toBe("https://acme.com/favicon.ico");
    expect(icon).not.toContain("google");
    expect(icon).not.toContain("duckduckgo");
    expect(icon).not.toContain("clearbit");
  });

  it("has no icon for a company nobody has given an address", () => {
    expect(companyFaviconUrl(null)).toBeNull();
    expect(companyFaviconUrl("")).toBeNull();
    expect(companyFaviconUrl("Meridian Software")).toBeNull();
  });
});

describe("where a logo actually lives", () => {
  it("tries the paths sites really serve, not only /favicon.ico", () => {
    // A tab's logo is rarely at the twenty-year-old default path; a modern
    // site declares it with <link rel="icon"> pointing wherever it likes.
    // Reading that means fetching the home page, which is behind the policy
    // gate, so the browser walks the common places instead.
    const tried = companyFaviconUrls("https://acme.com");
    expect(tried[0]).toBe("https://acme.com/favicon.ico");
    expect(tried.some((u) => u.endsWith("/favicon.png"))).toBe(true);
    expect(tried.some((u) => u.endsWith("/apple-touch-icon.png"))).toBe(true);
  });

  it("tries www and the bare host, because which one was pasted is an accident", () => {
    expect(companyFaviconUrls("acme.com")).toContain(
      "https://www.acme.com/favicon.ico",
    );
    expect(companyFaviconUrls("https://www.acme.com")).toContain(
      "https://acme.com/favicon.ico",
    );
  });

  it("never leaves the company's own origin", () => {
    for (const url of companyFaviconUrls("https://acme.com/careers?x=1")) {
      expect(new URL(url).hostname.endsWith("acme.com")).toBe(true);
    }
  });

  it("offers nothing for what is not a web address", () => {
    expect(companyFaviconUrls("")).toEqual([]);
    expect(companyFaviconUrls("Meridian Software")).toEqual([]);
    expect(companyFaviconUrls("javascript:alert(1)")).toEqual([]);
    expect(companyFaviconUrl(null)).toBeNull();
  });
});

describe("the address a company probably lives at", () => {
  it("is a suggestion and nothing writes it by itself", () => {
    // The value of this test is the name of it. `suggestedCompanySite` is
    // pure and returns a string; what keeps a stranger's logo off a live job
    // is that the only caller puts it in a field somebody has to press.
    expect(suggestedCompanySite("GitLab")).toBe("gitlab.com");
    expect(suggestedCompanySite("Merge Labs")).toBe("mergelabs.com");
    expect(suggestedCompanySite("Acme, Inc.")).toBe("acme.com");
  });

  it("is often wrong, which is why it is only ever offered", () => {
    // The real one is safe.ai. A product that wrote this down on its own
    // would put somebody else's logo beside a live job.
    expect(suggestedCompanySite("Center for AI Safety")).toBe(
      "centeraisafety.com",
    );
  });

  it("has nothing to suggest for a name that is not one", () => {
    expect(suggestedCompanySite("")).toBeNull();
    expect(suggestedCompanySite("   ")).toBeNull();
    expect(suggestedCompanySite("Ltd")).toBeNull();
  });
});
