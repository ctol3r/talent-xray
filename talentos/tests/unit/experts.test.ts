/**
 * Who a question goes to.
 *
 * The routing has to be arithmetic rather than judgement: a model choosing
 * its own specialist is a second model call before the first, and it is wrong
 * in ways nobody can see. These are the routes somebody would actually type,
 * and the property that keeps the table honest — every specialist's own
 * vocabulary must reach that specialist.
 */
import { describe, expect, it } from "vitest";
import {
  EXPERTS,
  expertById,
  routeQuestion,
} from "../../artifact-src/core/experts";

const to = (question: string) => routeQuestion(question).expert.id;

describe("routing a question", () => {
  it("sends the obvious ones where they belong", () => {
    expect(to("what should I ask the hiring manager at intake?")).toBe(
      "intake",
    );
    expect(to("my boolean search string returns nothing")).toBe("sourcing");
    expect(to("nobody replies to my first message")).toBe("outreach");
    expect(to("what interview question shows real evidence of this?")).toBe(
      "screening",
    );
    expect(to("what is the salary band for this in Berlin?")).toBe("market");
    expect(to("they got a counter-offer, what now?")).toBe("close");
    expect(to("can I take this into account lawfully?")).toBe("fair-hiring");
  });

  it("falls to the generalist rather than guessing", () => {
    // A real answer, not a failure: most typed questions are not about one
    // specialism, and pretending otherwise puts the wrong name on the reply.
    expect(to("how is this week going?")).toBe("generalist");
    expect(routeQuestion("how is this week going?").because).toEqual([]);
  });

  it("says which words decided it", () => {
    const routed = routeQuestion("what should the offer look like?");
    expect(routed.expert.id).toBe("close");
    expect(routed.because).toContain("offer");
  });

  it("prefers the phrase over the word inside it", () => {
    // "counter-offer" is the close; "offer" alone often is not.
    expect(to("what do I do about a counter-offer")).toBe("close");
  });

  it("reaches every specialist through its own vocabulary", () => {
    for (const expert of EXPERTS) {
      for (const phrase of expert.knows) {
        const routed = routeQuestion(`I have a question about ${phrase}`);
        // Another specialist may legitimately win on a longer overlapping
        // phrase; what must never happen is falling through to nobody.
        expect(routed.expert.id, `${expert.id}: ${phrase}`).not.toBe(
          "generalist",
        );
      }
    }
  });

  it("has a generalist with no vocabulary of its own", () => {
    expect(expertById("generalist").knows).toEqual([]);
    expect(expertById("nobody").id).toBe("generalist");
  });
});

describe("a phrase is a word, not a substring", () => {
  it("does not send a computational biology role to the pay specialist", () => {
    // The real one, from the owner's own first question. "comp" is a
    // substring of "computational", so plain `includes` routed a general
    // "can you help me recruit for this" to the market specialist.
    expect(
      to(
        "im recruiting for a ML Research Scientist - Computational Biophysics-- can you help",
      ),
    ).toBe("generalist");
  });

  it("does not find hidden stems inside longer words", () => {
    // "hm" inside "rhythm", "rate" inside "corporate", "comp" inside
    // "company" — the short stems are the useful ones and are exactly the
    // ones that hide.
    expect(routeQuestion("is there a rhythm to this").expert.id).not.toBe(
      "intake",
    );
    expect(
      routeQuestion("this is a corporate environment").because,
    ).not.toContain("rate");
    expect(to("what is the company like")).toBe("generalist");
  });

  it("still matches a word by its stem", () => {
    // "sourcing" has to answer to "source" and "closing" to "close", which is
    // why this is a prefix match rather than a whole word.
    expect(to("where do I go sourcing for these people")).toBe("sourcing");
    expect(to("what happens at closing")).toBe("close");
    expect(to("how should I be screening these")).toBe("screening");
  });
});
