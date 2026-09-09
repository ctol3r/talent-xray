/**
 * The product's voice, held to its own rules.
 *
 * A personality is only worth having if it cannot cost anything. These tests
 * are the "cannot": the wit is allowed in empty states and coaching, and is
 * banned everywhere a person's data, a legal duty, a refusal or a failure is
 * on screen. A voice nobody checks becomes an exclamation mark in an error
 * message within a month.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BANNED_WORDS,
  EMPTY_STATES,
  SERIOUS_SURFACES,
  TAGLINE,
  violatesVoice,
} from "@/lib/domain/voice";
import { COACHING, CRAFT_NOTES } from "@/lib/domain/coaching";

describe("the words this product does not use", () => {
  it("catches the ones that would make it sound like everything else", () => {
    expect(violatesVoice("This is awesome!")).toContain("awesome");
    expect(violatesVoice("Supercharge your pipeline")).toContain("supercharge");
    expect(violatesVoice("A calm, specific sentence.")).toEqual([]);
  });

  it("keeps its own copy clean", () => {
    for (const [key, state] of Object.entries(EMPTY_STATES)) {
      const found = violatesVoice(`${state.title} ${state.detail}`);
      expect(`${key} → ${found.join(",")}`).toBe(`${key} → `);
    }
    for (const [id, entry] of Object.entries(COACHING)) {
      const found = violatesVoice(`${entry.why} ${entry.good}`);
      expect(`${id} → ${found.join(",")}`).toBe(`${id} → `);
    }
    for (const note of CRAFT_NOTES) {
      expect(`${note.slice(0, 24)} → ${violatesVoice(note).join(",")}`).toBe(
        `${note.slice(0, 24)} → `,
      );
    }
    expect(violatesVoice(TAGLINE)).toEqual([]);
  });
});

describe("serious surfaces stay flat", () => {
  /**
   * The modules that speak about a person's data, a legal duty or a refusal.
   * Their user-facing strings are scanned for the same banned words, because
   * this is exactly where a joke would be worst.
   */
  const SERIOUS_FILES = [
    "src/lib/services/profile-confirmations.ts",
    "src/lib/domain/profile-links.ts",
    "src/lib/domain/surface-families.ts",
    "src/lib/domain/fair-hiring.ts",
    "src/lib/services/profile-links.ts",
  ];

  it("names what counts as serious, so the rule is checkable", () => {
    expect(SERIOUS_SURFACES.length).toBeGreaterThan(4);
  });

  it("has no salesman words in them", () => {
    // Word-level only. Extracting string literals from TypeScript with a
    // regex is not reliable — a quote inside a comment swallows the code
    // after it — and an exclamation mark in these files is a non-null
    // assertion, not a tone of voice. Prose is checked directly above,
    // against the copy itself rather than against source.
    const words = BANNED_WORDS.filter((word) => word !== "!");
    for (const file of SERIOUS_FILES) {
      const full = path.resolve(file);
      if (!fs.existsSync(full)) continue;
      const source = fs.readFileSync(full, "utf8").toLowerCase();
      const found = words.filter((word) => source.includes(word));
      expect(`${file} → ${found.join(",")}`).toBe(`${file} → `);
    }
  });
});

describe("the voice is specific, not just cheerful", () => {
  it("says something concrete in every empty state", () => {
    for (const [key, state] of Object.entries(EMPTY_STATES)) {
      // An empty state that only apologises has taught nobody anything.
      expect(`${key} → ${state.detail.length > 70}`).toBe(`${key} → true`);
    }
  });

  it("keeps the tagline a narrow claim", () => {
    expect(TAGLINE.length).toBeLessThan(60);
    expect(TAGLINE.toLowerCase()).not.toContain("best");
    expect(TAGLINE.toLowerCase()).not.toContain("ai");
  });
});
