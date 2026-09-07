/**
 * Wave H acceptance: the surface classifier answers for every pattern in the
 * two live engines' corpus, the defaults are the ones the legal memo asked
 * for, an unknown host is saveable but never an identity signal, and every
 * piece of warning copy passes the fair-hiring scanner.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SURFACE_FAMILIES, type SurfaceFamily } from "@/lib/core/enums";
import { scanTextForProtectedTraits } from "@/lib/domain/fair-hiring";
import {
  classifySurface,
  DEFAULT_ON_FAMILIES,
  FAMILY_BADGE_SUFFIX,
  FAMILY_NOTES,
  FAMILY_WARNINGS,
  familyEnabled,
  MATCHABLE_FAMILIES,
  matchableProfileUrls,
  MODEL_VISIBLE_FAMILIES,
  modelVisibleUrls,
  NOT_A_PERSON_MESSAGE,
  OPT_IN_FAMILIES,
  SURFACE_FAMILY_LABELS,
} from "@/lib/domain/surface-families";

/** Turn a corpus pattern like `*.linkedin.com/in/*` into a URL to classify. */
function urlFromPattern(pattern: string): string {
  const [hostPart, ...rest] = pattern.split("/");
  const host = hostPart.replace(/^\*\./, "www.").replace(/\*/g, "example");
  const pathPart = rest
    .join("/")
    .replace(/\*/g, "example")
    .replace(/@example/g, "@example");
  return `https://${host}/${pathPart}`.replace(/\/+$/, "/");
}

function corpusPatterns(): string[] {
  const dir = path.resolve("docs/engines");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".txt"))
    .flatMap((f) =>
      fs
        .readFileSync(path.join(dir, f), "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    );
}

describe("the corpus classifies", () => {
  it("gives every one of the engines' patterns a family, and only company pages are not people", () => {
    const patterns = corpusPatterns();
    expect(patterns.length).toBeGreaterThanOrEqual(100);
    const unrecognised: string[] = [];
    const notPeople: string[] = [];
    for (const pattern of patterns) {
      const family = classifySurface(urlFromPattern(pattern));
      if (family === "unrecognised") unrecognised.push(pattern);
      if (family === "not_a_person") notPeople.push(pattern);
    }
    expect(unrecognised).toEqual([]);
    // linkedin.com/company and apollo.io/companies are company pages that
    // occupy people slots in the engines; the classifier says so.
    expect(notPeople.sort()).toEqual([
      "www.apollo.io/companies/*",
      "www.linkedin.com/company/*",
    ]);
  });

  it("puts representative addresses where the legal memo puts them", () => {
    const table: [string, SurfaceFamily][] = [
      ["https://www.linkedin.com/in/jordan-rivera", "professional"],
      ["https://www.linkedin.com/company/acme", "not_a_person"],
      ["https://github.com/jrivera-dev", "professional"],
      ["https://stackoverflow.com/users/123/jr", "professional"],
      ["https://orcid.org/0000-0002-1825-0097", "scholarly_registry"],
      [
        "https://npiregistry.cms.hhs.gov/provider-view/1234567890",
        "scholarly_registry",
      ],
      ["https://www.zocdoc.com/doctor/jordan-rivera-123", "review_site"],
      ["https://www.zoominfo.com/p/jordan-rivera/123", "contact_aggregator"],
      ["https://x.com/jrivera", "mixed_broadcast"],
      ["https://bsky.app/profile/jrivera.bsky.social", "mixed_broadcast"],
      ["https://www.facebook.com/jordan.rivera", "personal_life"],
      ["https://www.instagram.com/jrivera", "personal_life"],
      ["https://www.reddit.com/user/jrivera", "personal_life"],
      ["https://www.scribd.com/document/1/cv", "document"],
      ["https://drive.google.com/file/d/abc/view", "document"],
      ["https://jrivera.dev", "unrecognised"],
      ["https://cs.stanford.edu/~jrivera", "unrecognised"],
    ];
    for (const [url, expected] of table) {
      expect(`${url} → ${classifySurface(url)}`).toBe(`${url} → ${expected}`);
    }
  });

  it("treats an unparseable or non-http address as unrecognised, never as professional", () => {
    expect(classifySurface("not a url")).toBe("unrecognised");
    expect(classifySurface("javascript:alert(1)")).toBe("unrecognised");
    expect(classifySurface("ftp://example.com/x")).toBe("unrecognised");
  });
});

describe("defaults and opt-in", () => {
  it("has a label for every family and splits them into on and opt-in", () => {
    for (const family of SURFACE_FAMILIES) {
      expect(SURFACE_FAMILY_LABELS[family]).toBeTruthy();
    }
    expect(DEFAULT_ON_FAMILIES).toEqual([
      "professional",
      "scholarly_registry",
      "review_site",
      "unrecognised",
    ]);
    expect(OPT_IN_FAMILIES).toEqual([
      "contact_aggregator",
      "mixed_broadcast",
      "personal_life",
      "document",
    ]);
  });

  it("keeps an off family off until this search turns it on, and a company page off always", () => {
    expect(familyEnabled("professional", null)).toBe(true);
    expect(familyEnabled("unrecognised", null)).toBe(true);
    expect(familyEnabled("personal_life", null)).toBe(false);
    expect(
      familyEnabled("personal_life", {
        personal_life: { reason: "documented in the intake", at: "2026-09-07" },
      }),
    ).toBe(true);
    expect(familyEnabled("not_a_person", null)).toBe(false);
    expect(
      familyEnabled("not_a_person", {
        not_a_person: { reason: "no", at: "2026-09-07" },
      }),
    ).toBe(false);
  });

  it("carries a warning for every opt-in family", () => {
    for (const family of OPT_IN_FAMILIES) {
      expect(FAMILY_WARNINGS[family]).toBeTruthy();
    }
  });
});

describe("what may reach the matcher and the model", () => {
  const urls = [
    "https://www.linkedin.com/in/jordan-rivera",
    "https://orcid.org/0000-0002-1825-0097",
    "https://www.zocdoc.com/doctor/jr",
    "https://x.com/jrivera",
    "https://www.zoominfo.com/p/jr/1",
    "https://www.facebook.com/jordan.rivera",
    "https://www.scribd.com/document/1/cv",
    "https://jrivera.dev",
    "https://www.linkedin.com/company/acme",
  ];

  it("lets identity see work surfaces and never a private or vendor page", () => {
    expect(MATCHABLE_FAMILIES).toEqual([
      "professional",
      "scholarly_registry",
      "review_site",
      "mixed_broadcast",
    ]);
    expect(matchableProfileUrls(urls)).toEqual([
      "https://www.linkedin.com/in/jordan-rivera",
      "https://orcid.org/0000-0002-1825-0097",
      "https://www.zocdoc.com/doctor/jr",
      "https://x.com/jrivera",
    ]);
  });

  it("lets a model see only professional and scholarly addresses", () => {
    expect(MODEL_VISIBLE_FAMILIES).toEqual([
      "professional",
      "scholarly_registry",
    ]);
    expect(modelVisibleUrls(urls)).toEqual([
      "https://www.linkedin.com/in/jordan-rivera",
      "https://orcid.org/0000-0002-1825-0097",
    ]);
  });
});

describe("the copy itself is safe to render", () => {
  const allCopy = [
    ...Object.values(FAMILY_WARNINGS),
    ...Object.values(FAMILY_NOTES),
    ...Object.values(FAMILY_BADGE_SUFFIX),
    ...Object.values(SURFACE_FAMILY_LABELS),
    NOT_A_PERSON_MESSAGE,
  ].filter(Boolean) as string[];

  it("names no protected characteristic, even while describing why a surface is off", () => {
    for (const text of allCopy) {
      expect(
        `${text.slice(0, 40)} → ${scanTextForProtectedTraits(text).length}`,
      ).toBe(`${text.slice(0, 40)} → 0`);
    }
  });

  it("never uses the bare word 'verified'", () => {
    for (const text of allCopy) {
      const hits = text.match(/\bverified\b/gi) ?? [];
      expect(`${text.slice(0, 40)} → ${hits.length}`).toBe(
        `${text.slice(0, 40)} → 0`,
      );
    }
  });
});
