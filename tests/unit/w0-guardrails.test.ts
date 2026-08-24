import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..", "..");

describe("W0 repository guardrails", () => {
  it("TypeScript strict mode is on", () => {
    const tsconfig = JSON.parse(
      readFileSync(join(root, "tsconfig.json"), "utf8"),
    ) as {
      compilerOptions?: { strict?: boolean };
    };
    expect(tsconfig.compilerOptions?.strict).toBe(true);
  });

  it("CLAUDE.md is present with the hard product rules", () => {
    const claude = readFileSync(join(root, "CLAUDE.md"), "utf8");
    expect(claude).toContain("## Hard product rules");
    expect(claude).toContain("Never fetch, crawl or scrape a result page");
  });

  it("LEGAL.md lists the three unanswered Google terms questions", () => {
    const legal = readFileSync(join(root, "docs", "LEGAL.md"), "utf8");
    expect(legal).toContain("Q1 — Storage and caching of results");
    expect(legal).toContain("Q2 — Commercial resale and branding");
    expect(legal).toContain("Q3 — Ad display on the free tier");
  });

  it("ADR-001 exists and records an accepted hosting decision", () => {
    const adr = readFileSync(join(root, "docs", "ADR-001-hosting.md"), "utf8");
    expect(adr).toContain("Status: **Accepted**");
    expect(adr).toContain("## Decision");
  });

  it("the reference implementation directory exists", () => {
    expect(existsSync(join(root, "reference"))).toBe(true);
  });
});
