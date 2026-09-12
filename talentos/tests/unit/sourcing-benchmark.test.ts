/**
 * The benchmark, as a gate.
 *
 * `pnpm benchmark` prints it; this asserts the floor so a ranking change that
 * quietly costs precision fails the build instead of shipping. The corpus is a
 * few dozen invented people, which is what these numbers are worth — see
 * `docs/SOURCING-EVALUATION.md`.
 */
import { describe, expect, it } from "vitest";
import {
  BENCHMARK_QUERIES,
  benchmarkCorpus,
  runBenchmark,
  scoreQuery,
} from "@/lib/sourcing/benchmark";
import { parseQuery } from "@/lib/sourcing/query-language";

const report = runBenchmark();

describe("retrieval", () => {
  it("ranks every relevant person above every distractor", () => {
    const offenders = report.queries
      .filter((q) => q.distractorsAboveRelevant.length > 0)
      .map((q) => `${q.id}: ${q.distractorsAboveRelevant.join(", ")}`);
    expect(offenders).toEqual([]);
  });

  it("finds everyone relevant, on every query", () => {
    expect(report.meanRecall).toBe(1);
    for (const q of report.queries) expect(q.missing).toEqual([]);
  });

  it("puts a relevant person first, on every query", () => {
    expect(report.queriesWithRelevantTopHit).toBe(report.queries.length);
  });

  it("reads the capability the query is about, on every query", () => {
    expect(report.capabilityReadingAccuracy).toBe(1);
  });

  it("spans eight unlike fields, so the ranker is not tuned into one", () => {
    // Technical, scientific, recruiting, commercial, finance, law, healthcare
    // and construction. A ranker that only worked for robotics engineers would
    // be a robotics tool.
    expect(new Set(BENCHMARK_QUERIES.map((q) => q.field)).size).toBe(8);
  });
});

describe("the headline recruiting query", () => {
  const spec = BENCHMARK_QUERIES.find(
    (q) => q.id === "autonomy-technical-recruiter",
  )!;

  it("asks for the recruiter, not the engineers they recruit", () => {
    // The defect this pins: reading "hired robotics engineers" as a second
    // requirement made the engineers outrank the people who hire them, so the
    // product's own headline query could not be answered.
    const brief = parseQuery(spec.query);
    expect(brief.skills).toEqual(["technical_recruiting"]);
    expect(brief.qualifierSkills).toContain("robotics");
    expect(brief.qualifierSkills).toContain("machine_learning");
  });

  it("shortlists the recruiters", () => {
    const score = scoreQuery(spec, benchmarkCorpus());
    expect(score.precisionAtR).toBe(1);
    expect(score.topHitRelevant).toBe(true);
  });
});

describe("corpus health", () => {
  it("sources every claim it holds", () => {
    expect(report.corpus.unsourcedContacts).toBe(0);
    expect(report.corpus.evidenceCoverage).toBe(1);
  });

  it("says plainly how small it is", () => {
    // Not an assertion about quality — an assertion that nobody can read these
    // numbers as coverage of the open web.
    expect(report.corpus.people).toBeLessThan(80);
  });
});
