/**
 * The product name is a working name (see src/lib/product.ts). Nothing in
 * src/ may hardcode it outside that file — renaming must be a one-file edit.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_NAME } from "@/lib/product";

const srcRoot = join(__dirname, "..", "..", "src");

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectSourceFiles(full, out);
    } else if (/\.(ts|tsx|css)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("naming abstraction", () => {
  it(`no file in src/ hardcodes "${PRODUCT_NAME}" except product.ts`, () => {
    const files = collectSourceFiles(srcRoot).filter(
      (f) => !f.endsWith(join("lib", "product.ts")),
    );
    const violations = files.filter((f) =>
      readFileSync(f, "utf8").includes(PRODUCT_NAME),
    );
    expect(violations).toEqual([]);
  });
});
