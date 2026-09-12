/** Deliberately remove each guard, prove the regression tests turn red, restore it. */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const file = "src/lib/documents/contracts.ts";
const original = readFileSync(file, "utf8");
const anchorStart = original.indexOf("export function validateAnchor");
const anchorEnd = original.indexOf("/** Resolve", anchorStart);
const staleStart = original.indexOf("export function assertCurrent");
if (anchorStart < 0 || anchorEnd < 0 || staleStart < 0)
  throw new Error("Guard source layout changed; inspect the mutation targets.");
const mutants = [
  {
    name: "source-anchor validation removed",
    test: "rejects fabricated anchors",
    source:
      original.slice(0, anchorStart) +
      "export function validateAnchor(_text: string, _anchor: Anchor): void {}\n" +
      original.slice(anchorEnd),
  },
  {
    name: "stale-version protection removed",
    test: "preserves decisions and old comparison",
    source:
      original.slice(0, staleStart) +
      "export function assertCurrent(_expected: string, _actual: string): void {}\n",
  },
];
try {
  for (const mutant of mutants) {
    writeFileSync(file, mutant.source);
    const result = spawnSync(
      "pnpm",
      [
        "exec",
        "vitest",
        "run",
        "tests/unit/document-review.test.ts",
        "-t",
        mutant.test,
      ],
      { encoding: "utf8", timeout: 60000 },
    );
    if (
      result.status === 0 ||
      result.error ||
      !result.stdout.includes("1 failed")
    )
      throw new Error(
        `Defect was not proven by a failing assertion: ${mutant.name}\n${result.stdout}\n${result.stderr}`,
      );
    console.log(`DETECTED: ${mutant.name}`);
    writeFileSync(file, original);
  }
} finally {
  writeFileSync(file, original);
}
