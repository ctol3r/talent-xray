/**
 * W12 corpus coverage contract (W12_EVAL_SPEC.md §3): the adversarial
 * corpus validates, and it carries every category, every special fixture
 * A–J, and the stakeholder-disagreement case. This test does not touch
 * the model; it guards the instrument.
 */
import { describe, expect, it } from "vitest";
import { loadCorpus } from "../../eval/w12/corpus";
import { ADVERSARIAL_CATEGORIES } from "../../eval/w12/schema";

describe("W12 adversarial corpus", () => {
  const corpus = loadCorpus();

  it("has at least 50 conversations across at least 10 occupations, all valid", () => {
    expect(corpus.length).toBeGreaterThanOrEqual(50);
    const occupations = new Set(corpus.map((c) => c.occupation));
    expect(occupations.size).toBeGreaterThanOrEqual(10);
    for (const c of corpus) {
      expect(c.turns.length).toBeGreaterThanOrEqual(2);
      for (const t of c.turns) expect(t.expect).toBeTruthy();
    }
  });

  it("covers all 20 adversarial categories", () => {
    const covered = new Set(corpus.flatMap((c) => c.categories));
    const missing = Object.keys(ADVERSARIAL_CATEGORIES)
      .map(Number)
      .filter((n) => !covered.has(n));
    expect(missing).toEqual([]);
  });

  it("carries the special fixtures A–J with several conversations each", () => {
    for (const letter of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]) {
      const n = corpus.filter((c) => c.fixtureLetter === letter).length;
      expect(n, `fixture ${letter}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("includes stakeholder disagreements where two stakeholders weigh one requirement differently", () => {
    const disagreements = corpus.filter(
      (c) => c.categories.includes(7) && (c.stakeholders?.length ?? 0) >= 2,
    );
    expect(disagreements.length).toBeGreaterThanOrEqual(3);
    for (const c of disagreements) {
      // At least one turn must expect a contradiction attributed to the disagreement.
      expect(c.turns.some((t) => t.expect.contradictions.length > 0)).toBe(
        true,
      );
      // Exactly one decision authority is declared.
      expect(c.stakeholders?.filter((s) => s.decisionAuthority).length).toBe(1);
    }
  });

  it("exercises every search-mutation dimension somewhere", () => {
    const dims = new Set(
      corpus.flatMap((c) =>
        c.turns.flatMap(
          (t) => t.expect.replan?.changes.map((ch) => ch.dimension) ?? [],
        ),
      ),
    );
    for (const d of [
      "occupation",
      "population",
      "adjacent",
      "geography",
      "channels",
      "evidence",
      "strings",
      "screening",
      "persona",
    ]) {
      expect(dims.has(d as never), d).toBe(true);
    }
  });

  it("marks things that must remain unknown, and cases that require a challenge", () => {
    const unknowns = corpus.flatMap((c) =>
      c.turns.flatMap((t) =>
        t.expect.uncertainties.filter((u) => u.shouldRemainUnknown),
      ),
    );
    expect(unknowns.length).toBeGreaterThanOrEqual(8);
    const challenges = corpus
      .flatMap((c) => [c.initial, ...c.turns.map((t) => t.expect)])
      .filter((e) => e.nextQuestion?.shouldChallenge);
    expect(challenges.length).toBeGreaterThanOrEqual(12);
  });
});
