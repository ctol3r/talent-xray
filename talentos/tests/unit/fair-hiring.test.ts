/**
 * Fair-hiring guardrail — the enforcement half of ARCHITECTURE.md §8.
 * Greps the schema and payload definitions for protected-characteristic
 * field names and fails the build on a match.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BLOCKED_FIELD_PATTERNS,
  scanTextForProtectedTraits,
} from "@/lib/domain/fair-hiring";

const root = join(__dirname, "..", "..");

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("schema and payload definitions", () => {
  // The guardrail module itself necessarily names the traits it blocks.
  const exempt = [join("domain", "fair-hiring.ts")];

  it("contain no protected-characteristic field names", () => {
    const files = collectSourceFiles(join(root, "src")).filter(
      (f) => !exempt.some((e) => f.endsWith(e)),
    );
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const pattern of BLOCKED_FIELD_PATTERNS) {
        const match = pattern.exec(content);
        if (match) {
          violations.push(`${file}: "${match[0]}" (${pattern})`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

describe("scanTextForProtectedTraits", () => {
  it("flags protected-trait references in generated text", () => {
    const hits = scanTextForProtectedTraits(
      "Strong candidate; note their religious background and marital status.",
    );
    expect(hits.map((h) => h.trait)).toContain("religion");
    expect(hits.map((h) => h.trait)).toContain("pregnancy/family status");
  });

  it("flags sex and gender identity, which PROTECTED_TRAITS names", () => {
    // Found by inspection during W12: PROTECTED_TRAITS and
    // BLOCKED_FIELD_PATTERNS both covered gender, but the text scanner had no
    // pattern for it, so the deterministic guard could not catch it.
    expect(
      scanTextForProtectedTraits("Prefers a male candidate; note gender.").map(
        (h) => h.trait,
      ),
    ).toContain("sex/gender identity");
    expect(
      scanTextForProtectedTraits("Record the applicant's sex.").map(
        (h) => h.trait,
      ),
    ).toContain("sex/gender identity");
  });

  it("does not flag ordinary professional evidence", () => {
    const hits = scanTextForProtectedTraits(
      "Three first-author NeurIPS papers; led a team of five; deep coverage of distributed training; strong stage presence at conferences.",
    );
    expect(hits).toEqual([]);
  });
});
