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

/**
 * The other writer.
 *
 * `runAiTask` has always scanned what the model produced. The boundary a
 * *person* types into — "Edit JSON", which in an install with no model key is
 * the only way a payload is ever written by hand — did not, so the guard was
 * pointed at the writer least likely to need it and away from the one making
 * the actual hiring judgement.
 *
 * Read from the source rather than by calling the action, because the action
 * is a server action: importing it drags in `revalidatePath` and a request
 * scope that does not exist in a unit test. What is being defended here is
 * structural anyway — that no artifact handler has its own private path to
 * the database that skips the check.
 */
describe("the recruiter-edit boundary", () => {
  const source = readFileSync(
    join(root, "src", "lib", "actions", "workflow.ts"),
    "utf8",
  );

  it("validates every artifact through the one checked path", () => {
    // A handler that calls `someSchema.parse(raw)` directly has skipped both
    // `ensureIds` and the trait scan, which is precisely how this gap opened.
    const direct = [...source.matchAll(/(\w+Schema)\.parse\(raw\)/g)].map(
      (m) => m[1],
    );
    expect(direct).toEqual([]);
  });

  it("scans what it saved, not the raw text it was handed", () => {
    // Scanning `raw` would flag words the schema strips out, and telling
    // somebody their brief says something it does not say is how a warning
    // learns to be ignored.
    expect(source).toContain("scanPayloadForProtectedTraits(saved)");
    expect(source).not.toContain("scanPayloadForProtectedTraits(raw)");
  });

  it("warns and never blocks", () => {
    // The hits come back in the success envelope. If they were thrown, a
    // benefits note mentioning parental leave would be unsaveable, and a
    // fair-hiring rule that eats somebody's work is a rule people route
    // around rather than read.
    expect(source).toContain("warnings: scanPayloadForProtectedTraits");
    expect(source).not.toMatch(/throw[^;]*scanPayloadForProtectedTraits/);
  });
});
