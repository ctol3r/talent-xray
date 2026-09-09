/**
 * One mark per kind, and the same one everywhere.
 *
 * The value of a mark is entirely in its consistency: two kinds sharing one
 * picture is worse than no pictures, because the reader has learned to trust
 * it by then. `page`/`tag` and `job`/`search` and `person`/`candidate` are
 * deliberate aliases — the same thing under the name each part of the code
 * happens to use — so those pairs must agree rather than differ.
 */
import { describe, expect, it } from "vitest";
import { MARKS, markFor, marked } from "../../artifact-src/core/marks";

describe("record marks", () => {
  it("gives every kind a mark", () => {
    for (const [kind, mark] of Object.entries(MARKS)) {
      expect(mark.length, kind).toBeGreaterThan(0);
      expect(markFor(kind)).toBe(mark);
    }
  });

  it("keeps the aliases in step with what they alias", () => {
    expect(MARKS.page).toBe(MARKS.tag);
    expect(MARKS.job).toBe(MARKS.search);
    expect(MARKS.person).toBe(MARKS.candidate);
  });

  it("gives two different kinds two different marks", () => {
    // Aliases excepted: those are one kind under two names.
    const alias = new Set(["page", "job", "person"]);
    const seen = new Map<string, string>();
    for (const [kind, mark] of Object.entries(MARKS)) {
      if (alias.has(kind)) continue;
      expect(
        seen.get(mark),
        `${kind} shares a mark with ${seen.get(mark)}`,
      ).toBe(undefined);
      seen.set(mark, kind);
    }
  });

  it("marks an unknown kind rather than leaving a gap", () => {
    expect(markFor("something-new")).toBe("•");
    expect(marked("candidate", "Ada")).toBe("👤 Ada");
  });
});
