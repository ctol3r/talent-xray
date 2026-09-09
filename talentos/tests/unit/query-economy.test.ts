/**
 * Spending the 32 terms well.
 *
 * Google ignores everything past the 32nd word and says so in a line nobody
 * reads; this product has watched it happen to its own strings. So every
 * rewrite here has to either give a term back or win a match, and none of
 * them may change what the query means — which is the property most of these
 * tests are about.
 */
import { describe, expect, it } from "vitest";
import {
  countGoogleTerms,
  economise,
} from "../../artifact-src/core/query-economy";

describe("counting the budget", () => {
  it("counts words and operators, not the brackets", () => {
    expect(countGoogleTerms("(recruiter|sourcer) remote")).toBe(4);
    expect(countGoogleTerms('"talent acquisition" -agency')).toBe(3);
  });

  it("charges for | exactly as it charges for OR", () => {
    // Whether Google charges for the operator is not documented anywhere I
    // could verify, so it is charged: a counter that guesses low lets a query
    // truncate in silence, which is the failure this module exists to
    // prevent. Which means `|` buys characters, not budget — and the budget
    // is bought by dropping alternatives that were never doing anything.
    expect(countGoogleTerms("a|b")).toBe(3);
    expect(countGoogleTerms("a OR b")).toBe(3);
  });
});

describe("what it drops", () => {
  it("drops a phrase already covered by a word in the same group", () => {
    // Anything matching "technical recruiter" matches recruiter, so the
    // phrase spends two terms on nothing. This is the real version of the
    // instinct that a long phrase is wasteful.
    const out = economise('(recruiter|"technical recruiter"|sourcer)');
    expect(out.query).toBe("(recruiter|sourcer)");
    expect(out.after).toBeLessThan(out.before);
    expect(out.savings[0].why).toContain("already matches");
  });

  it("drops the same alternative written twice", () => {
    const out = economise('(sourcer|"sourcer"|Sourcer)');
    expect(out.query).toBe("sourcer");
  });

  it("unquotes a single word, which turns stemming back on", () => {
    const out = economise('("recruiter"|"sourcer")');
    expect(out.query).toBe("(recruiter|sourcer)");
    expect(out.savings.some((s) => s.why.includes("stemming"))).toBe(true);
  });

  it("writes OR as |", () => {
    expect(economise("(a OR b) c").query).toBe("(a|b) c");
  });
});

describe("what it must never do", () => {
  it("never breaks a phrase into its words", () => {
    // `"talent sourcer"` and `talent|sourcer` are not the same search and not
    // close: the first wants the words adjacent, the second wants either word
    // anywhere, and on a corpus of profiles the second matches almost
    // everybody. This is the one rewrite that would look like a saving and
    // destroy the query.
    const out = economise('"talent sourcer" remote');
    expect(out.query).toBe('"talent sourcer" remote');
    expect(out.savings).toEqual([]);
  });

  it("never touches a required term or an exclusion", () => {
    const out = economise('recruiter "talent acquisition" -agency -recruiting');
    expect(out.query).toBe(
      'recruiter "talent acquisition" -agency -recruiting',
    );
  });

  it("never merges across groups, because that is a different search", () => {
    // (a|b) (c|d) means one of a,b AND one of c,d. Flattening it to
    // (a|b|c|d) asks for something else entirely.
    const out = economise("(recruiter|sourcer) (remote|hybrid)");
    expect(out.query).toBe("(recruiter|sourcer) (remote|hybrid)");
  });

  it("leaves site: and other operators alone inside a group", () => {
    const out = economise("(site:linkedin.com/in OR site:github.com)");
    expect(out.query).toBe("(site:linkedin.com/in|site:github.com)");
  });

  it("keeps two phrases that genuinely differ", () => {
    const out = economise('("talent acquisition"|"people operations")');
    expect(out.query).toBe('("talent acquisition"|"people operations")');
    expect(out.savings).toEqual([]);
  });

  it("never makes a query longer", () => {
    for (const q of [
      '(recruiter|"technical recruiter") "talent acquisition" -agency',
      "(a OR b OR c) d",
      '"one phrase"',
      "single",
    ]) {
      expect(economise(q).after).toBeLessThanOrEqual(economise(q).before);
    }
  });
});
