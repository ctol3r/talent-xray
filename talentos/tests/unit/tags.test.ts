/**
 * Tags are parsed, never stored, so these tests are the specification.
 *
 * The properties that matter: the three ways of writing a tag reach one
 * page; an address or a piece of code is not a tag; a word naming a
 * protected characteristic never becomes a page whoever types it; and the
 * offsets are exact, because the editor writes back into the same string.
 */
import { describe, expect, it } from "vitest";
import {
  activeTagTrigger,
  applyTagTrigger,
  bracketKey,
  parseTagRefs,
  segmentTagText,
  tagIsAllowed,
  tagSlug,
  tagTitle,
  tagsIn,
} from "@/lib/core/tags";

describe("one page, three ways to write it", () => {
  it("reads all three forms to the same slug", () => {
    const refs = parseTagRefs(
      "#ai-safety and [[AI Safety]] and #[[ai safety]]",
    );
    expect(refs.map((r) => r.slug)).toEqual([
      "ai-safety",
      "ai-safety",
      "ai-safety",
    ]);
    expect(refs.map((r) => r.form)).toEqual(["hash", "bracket", "hash"]);
  });

  it("keeps the first written form for display", () => {
    expect(tagsIn("[[AI Safety]] then #ai-safety")).toEqual([
      { slug: "ai-safety", display: "AI Safety" },
    ]);
  });

  it("does not read a hash tag out of a longer bracket form", () => {
    const refs = parseTagRefs("#[[research engineering]]");
    expect(refs).toHaveLength(1);
    expect(refs[0].display).toBe("research engineering");
  });
});

describe("what a slug does to the words people actually use", () => {
  it("keeps the punctuation that is part of a name", () => {
    expect(tagSlug("C++")).toBe("c++");
    expect(tagSlug("Node.js")).toBe("node.js");
    expect(tagSlug("machine learning")).toBe("machine-learning");
  });

  it("turns a sharp into a word, because a hash cannot be written back", () => {
    expect(tagSlug("C#")).toBe("c-sharp");
    expect(parseTagRefs("[[C#]]")[0].slug).toBe("c-sharp");
  });

  it("refuses a tag with no letter in it", () => {
    expect(tagSlug("2026")).toBeNull();
    expect(parseTagRefs("#2026")).toEqual([]);
  });

  it("titles a slug nobody wrote out, in sentence case", () => {
    expect(tagTitle("ai-safety")).toBe("Ai safety");
    expect(tagTitle("passive-sourcing")).toBe("Passive sourcing");
  });
});

describe("things that look like tags and are not", () => {
  it("ignores a fragment in an address", () => {
    expect(parseTagRefs("see https://example.com/docs#install")).toEqual([]);
    expect(parseTagRefs("www.example.com/#top")).toEqual([]);
  });

  it("ignores anything inside inline code", () => {
    expect(parseTagRefs("run `git commit -m #1` now")).toEqual([]);
  });

  it("still reads a tag beside an address", () => {
    const refs = parseTagRefs("https://example.com and #python");
    expect(refs.map((r) => r.slug)).toEqual(["python"]);
  });
});

describe("a protected characteristic never becomes a page", () => {
  it("refuses the words the fair-hiring rules exclude", () => {
    // Spelled through the identifiers the fair-hiring module owns, so this
    // file does not become the place those words live.
    for (const written of ["#Race", "[[ethnicity]]", "#veteran-status"]) {
      expect(`${written} → ${parseTagRefs(written).length}`).toBe(
        `${written} → 0`,
      );
    }
  });

  it("refuses them however they are spaced or cased", () => {
    expect(tagIsAllowed("marital-status")).toBe(false);
    expect(tagIsAllowed("MARITAL_STATUS".toLowerCase())).toBe(false);
  });

  it("allows an ordinary professional word", () => {
    expect(tagIsAllowed("ai-safety")).toBe(true);
    expect(tagIsAllowed("greenhouse")).toBe(true);
    expect(tagIsAllowed("passive-sourcing")).toBe(true);
  });
});

describe("offsets, because the editor writes back into the same string", () => {
  it("reports exact positions", () => {
    const text = "before #python after";
    const [ref] = parseTagRefs(text);
    expect(text.slice(ref.start, ref.end)).toBe("#python");
  });

  it("segments text losslessly", () => {
    const text = "a #one b [[two words]] c";
    const rejoined = segmentTagText(text)
      .map((segment) => segment.text)
      .join("");
    expect(rejoined).toBe(text);
    expect(
      segmentTagText(text)
        .filter((s) => s.kind === "tag")
        .map((s) => s.slug),
    ).toEqual(["one", "two-words"]);
  });
});

describe("three ways to recall, one syntax", () => {
  it("offers people on @", () => {
    expect(activeTagTrigger("notes: @ai", 10)).toEqual({
      kind: "candidate",
      query: "ai",
      start: 7,
    });
  });

  it("offers jobs on jj, and only at a word boundary", () => {
    expect(activeTagTrigger("worked on jj CAIS", 17)).toEqual({
      kind: "job",
      query: " CAIS",
      start: 10,
    });
    // Inside a word it is just letters: "hajj" must not open a menu.
    expect(activeTagTrigger("hajj", 4)).toBeNull();
  });

  it("offers every page on # and on an open bracket pair", () => {
    expect(activeTagTrigger("#py", 3)?.kind).toBe("page");
    expect(activeTagTrigger("some [[AI saf", 13)).toEqual({
      kind: "page",
      query: "AI saf",
      start: 5,
    });
  });

  it("does not fire on an address or mid-word", () => {
    expect(activeTagTrigger("mail me at a@b", 14)).toBeNull();
    expect(activeTagTrigger("nothing here", 12)).toBeNull();
  });

  it("writes a person and a job in bracket form, whichever key opened it", () => {
    const at = activeTagTrigger("spoke to @chris", 15)!;
    expect(
      applyTagTrigger("spoke to @chris", at, 15, {
        slug: "christopher-toler",
        display: "Christopher Toler",
        kind: "candidate",
      }),
    ).toEqual({ text: "spoke to [[Christopher Toler]] ", caret: 31 });

    const jj = activeTagTrigger("for jjCAIS", 10)!;
    expect(
      applyTagTrigger("for jjCAIS", jj, 10, {
        slug: "cais-founding-recruiter",
        display: "CAIS — Founding Recruiter",
        kind: "job",
      }).text,
    ).toBe("for [[CAIS — Founding Recruiter]] ");
  });

  it("keeps a single-word tag in hash form", () => {
    const hash = activeTagTrigger("notes: #py", 10)!;
    expect(
      applyTagTrigger("notes: #py", hash, 10, {
        slug: "python",
        display: "python",
      }).text,
    ).toBe("notes: #python ");
  });
});

describe("typing brackets is a command, not punctuation", () => {
  it("closes the pair on the second bracket and puts the caret inside", () => {
    // "foo[" then "[" → "foo[[]]" with the caret between the pairs.
    expect(bracketKey("foo[", 4, "[")).toEqual({
      text: "foo[[]]",
      caret: 5,
    });
  });

  it("leaves a single bracket alone", () => {
    expect(bracketKey("foo", 3, "[")).toBeNull();
  });

  it("steps over a closing bracket instead of doubling it", () => {
    expect(bracketKey("a[[b]]", 4, "]")).toEqual({ text: "a[[b]]", caret: 5 });
  });

  it("removes the whole empty pair on backspace, so nothing is littered", () => {
    expect(bracketKey("note [[]]", 7, "Backspace")).toEqual({
      text: "note ",
      caret: 5,
    });
  });

  it("does nothing when text is selected", () => {
    expect(bracketKey("foo[", 4, "[", 6)).toBeNull();
  });

  it("consumes the waiting brackets when a page is chosen", () => {
    // The caret sits inside an auto-closed pair: "note [[res|]]".
    const text = "note [[res]]";
    const trigger = activeTagTrigger(text, 10)!;
    expect(trigger.kind).toBe("page");
    expect(
      applyTagTrigger(text, trigger, 10, {
        slug: "research-engineers",
        display: "research engineers",
      }),
    ).toEqual({ text: "note [[research engineers]] ", caret: 28 });
  });
});

describe("# creates a page too", () => {
  it("opens the same every-page menu that [[ does", () => {
    expect(activeTagTrigger("about #ai-saf", 13)?.kind).toBe("page");
    expect(activeTagTrigger("about [[ai saf", 14)?.kind).toBe("page");
  });

  it("writes a brand-new single word as a hash tag", () => {
    const trigger = activeTagTrigger("about #newthing", 15)!;
    expect(
      applyTagTrigger("about #newthing", trigger, 15, {
        slug: "newthing",
        display: "newthing",
      }).text,
    ).toBe("about #newthing ");
  });

  it("writes a brand-new phrase in brackets, because a hash cannot hold a space", () => {
    const trigger = activeTagTrigger("about #new thing", 16)!;
    expect(
      applyTagTrigger("about #new thing", trigger, 16, {
        slug: "new-thing",
        display: "new thing",
      }).text,
    ).toBe("about [[new thing]] ");
  });
});
