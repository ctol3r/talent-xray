/**
 * The half of the rule that was not reversed.
 *
 * Fetching is permitted (D-082). Keeping the page is not. This is the test
 * that would fail if somebody added a page store later and did not notice that
 * is what they had done.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as schema from "@/lib/db/schema";
import { getTableColumns, getTableName, is, Table } from "drizzle-orm";

const root = join(__dirname, "..", "..");

describe("nothing keeps a page", () => {
  it("no table holds page text against an address", () => {
    const suspicious: string[] = [];
    for (const [exportName, value] of Object.entries(schema)) {
      if (!is(value, Table)) continue;
      const columns = Object.keys(getTableColumns(value));
      const hasAddress = columns.some((c) =>
        /^(url|address|href|link|normalizedUrl)$/iu.test(c),
      );
      const hasPage = columns.some((c) =>
        /^(body|html|pageText|rawHtml|content|markup|responseBody)$/iu.test(c),
      );
      if (hasAddress && hasPage)
        suspicious.push(`${exportName} (${getTableName(value)})`);
    }
    expect(suspicious).toEqual([]);
  });

  it("the fetch modules write nothing", () => {
    const dir = join(root, "src", "lib", "fetch");
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) continue;
      const source = readFileSync(full, "utf8");
      // No database client, no filesystem, no cache on disk. A page lives in
      // one process-memory object for as long as one read takes.
      expect(source).not.toMatch(/from "@\/lib\/db/u);
      expect(source).not.toMatch(/node:fs/u);
    }
  });

  it("the one call site persists nothing either", () => {
    const source = readFileSync(
      join(root, "src", "lib", "services", "page-reading.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/insert\(|update\(|delete\(/u);
  });
});
