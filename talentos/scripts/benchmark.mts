/**
 * Print the sourcing benchmark.
 *
 *   pnpm benchmark
 *
 * Offline and deterministic: the corpus is invented people in
 * `src/lib/sourcing/benchmark.ts`. The numbers are worth exactly what a corpus
 * that size is worth, which is why the size is printed beside them.
 */
import { BENCHMARK_QUERIES, runBenchmark } from "../src/lib/sourcing/benchmark";

const report = runBenchmark();
const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
const num = (v: number) => v.toFixed(2).padStart(6);

console.log("=".repeat(78));
console.log("TALENTOS SOURCING BENCHMARK");
console.log("=".repeat(78));

console.log("\nRETRIEVAL");
console.log(
  `  ${pad("query", 30)} ${pad("field", 12)} ${"P@R".padStart(6)} ${"P@5".padStart(6)} ${"recall".padStart(7)}  capabilities read`,
);
let failures = 0;
for (const q of report.queries) {
  console.log(
    `  ${pad(q.id, 30)} ${pad(q.field, 12)} ${num(q.precisionAtR)} ${num(q.precisionAt5)} ${num(q.recall).padStart(7)}  ${q.capabilityDetail}`,
  );
  if (q.missing.length > 0)
    console.log(`      missed: ${q.missing.join(", ")}`);
  if (q.distractorsAboveRelevant.length > 0) {
    console.log(
      `      distractor above a relevant person: ${q.distractorsAboveRelevant.join(", ")}`,
    );
    failures += 1;
  } else if (q.distractorsInTop5.length > 0) {
    console.log(
      `      distractor in top 5 (below every relevant person): ${q.distractorsInTop5.join(", ")}`,
    );
  }
  if (!q.capabilityReadingOk) failures += 1;
}

console.log(
  `\n  mean P@R ${report.meanPrecisionAtR.toFixed(2)}   mean P@5 ${report.meanPrecisionAt5.toFixed(2)}   ` +
    `mean recall ${report.meanRecall.toFixed(2)}   ` +
    `capability reading ${report.capabilityReadingAccuracy.toFixed(2)}`,
);
console.log(
  `  top hit relevant on ${report.queriesWithRelevantTopHit}/${report.queries.length} queries`,
);

console.log("\nCORPUS");
console.log(`  people                 ${report.corpus.people}`);
console.log(
  `  evidence coverage      ${report.corpus.evidenceCoverage.toFixed(2)}`,
);
console.log(
  `  multi-source coverage  ${report.corpus.multiSourceCoverage.toFixed(2)}`,
);
console.log(`  unsourced contacts     ${report.corpus.unsourcedContacts}`);
console.log(`  duplicate-name groups  ${report.corpus.duplicateNameGroups}`);

console.log(
  `\n${failures === 0 ? "no correctness failures" : `${failures} correctness failure(s)`}` +
    `  ·  ${BENCHMARK_QUERIES.length} queries over ${report.corpus.people} people`,
);
console.log(
  `\nThese numbers describe a ${report.corpus.people}-person corpus. They say the ranker\n` +
    "orders the evidence it is given correctly; they say nothing about coverage\n" +
    "of the open web. See docs/SOURCING-EVALUATION.md.",
);

process.exit(failures === 0 ? 0 : 1);
