/**
 * Tags read off the evidence.
 *
 * The two properties worth pinning: every tag can say where it came from, and
 * the fair-hiring gate runs before anything is offered. An auto-tagger that
 * reads pages is exactly where a protected characteristic would otherwise walk
 * in unnoticed.
 */
import { describe, expect, it } from "vitest";
import type { Claim, SourcedPerson } from "@/lib/sourcing/evidence";
import { suggestTagsFromEvidence, tagsAsText } from "@/lib/sourcing/auto-tags";

let seq = 0;
function claim(partial: Partial<Claim> & Pick<Claim, "kind" | "claim">): Claim {
  seq += 1;
  return {
    id: `c${seq}`,
    normalized: partial.normalized ?? partial.claim.toLowerCase(),
    sourceUrl: partial.sourceUrl ?? "https://vantagecell.invalid/team",
    sourceTitle: partial.sourceTitle ?? "team page",
    confidence: partial.confidence ?? 0.8,
    ...partial,
  } as Claim;
}

function person(claims: Claim[]): SourcedPerson {
  return { id: "p1", name: "Ingrid Falk", claims };
}

describe("what it reads", () => {
  it("tags a capability the evidence states, in the ontology's words", () => {
    const tags = suggestTagsFromEvidence(
      person([
        claim({
          kind: "capability",
          claim: "Leads work on battery pack thermal runaway and propagation",
        }),
      ]),
    );
    expect(tags.map((t) => t.display)).toContain("Battery Systems");
  });

  it("tags a place named anywhere in the evidence", () => {
    const tags = suggestTagsFromEvidence(
      person([
        claim({
          kind: "location",
          claim: "Based in Gothenburg, Sweden",
        }),
      ]),
    );
    expect(tags.map((t) => t.display)).toContain("Gothenburg");
  });

  it("tags the employer the page names", () => {
    const tags = suggestTagsFromEvidence(
      person([
        claim({
          kind: "employment",
          claim: "Principal Engineer at Vantage Cell Systems",
          organization: "Vantage Cell Systems",
        }),
      ]),
    );
    expect(tags.map((t) => t.display)).toContain("Vantage Cell Systems");
  });

  it("tags the SHAPE of the evidence, which the ontology cannot", () => {
    // "Who here has a patent" is a different question from "who does materials
    // science", and it is the one a sourcer actually filters on.
    const tags = suggestTagsFromEvidence(
      person([
        claim({
          kind: "artifact",
          claim: "A cell venting arrangement",
          artifactType: "patent",
        }),
        claim({
          kind: "artifact",
          claim: "Propagation limits in prismatic packs",
          artifactType: "publication",
        }),
      ]),
    );
    expect(tags.map((t) => t.display)).toEqual(
      expect.arrayContaining(["patent-holder", "published"]),
    );
  });
});

describe("what it refuses", () => {
  it("never offers a tag it cannot source", () => {
    for (const tag of suggestTagsFromEvidence(
      person([
        claim({
          kind: "capability",
          claim: "battery systems and thermal management",
        }),
        claim({ kind: "location", claim: "Gothenburg" }),
      ]),
    )) {
      expect(tag.evidence.length).toBeGreaterThan(0);
      for (const e of tag.evidence) {
        expect(e.quote.length).toBeGreaterThan(0);
        expect(e.sourceUrl.length).toBeGreaterThan(0);
      }
    }
  });

  it("does not tag a capability the source only mentions in passing", () => {
    // "hiring for robotics" is support, not a tag. Tagging it would put the
    // word on the person as though they did the work.
    const tags = suggestTagsFromEvidence(
      person([
        claim({
          kind: "capability",
          claim: "Talent partner hiring for robotics",
          derived: true,
        }),
      ]),
    );
    expect(tags.map((t) => t.display)).not.toContain("Robotics");
  });

  it("runs the fair-hiring gate before anything is offered", () => {
    const tags = suggestTagsFromEvidence(
      person([
        claim({
          kind: "employment",
          claim: "Officer at the Veteran Support Trust",
          organization: "Veteran Support Trust",
        }),
      ]),
    );
    expect(tags.map((t) => t.slug)).not.toContain("veteran-support-trust");
  });

  it("does not offer a tag the person already carries", () => {
    const evidence = [
      claim({ kind: "capability", claim: "battery systems work" }),
    ];
    const all = suggestTagsFromEvidence(person(evidence));
    const filtered = suggestTagsFromEvidence(person(evidence), {
      already: all.map((t) => t.slug),
    });
    expect(filtered).toEqual([]);
  });
});

describe("confidence", () => {
  it("puts a tag two independent sources agree on above one that only one does", () => {
    const tags = suggestTagsFromEvidence(
      person([
        claim({
          kind: "capability",
          claim: "battery systems",
          sourceUrl: "https://vantagecell.invalid/team",
        }),
        claim({
          kind: "capability",
          claim: "battery systems",
          sourceUrl: "https://batteryconf.invalid/speakers",
        }),
        claim({
          kind: "capability",
          claim: "thermal management",
          sourceUrl: "https://vantagecell.invalid/team",
        }),
      ]),
    );
    const battery = tags.find((t) => t.display === "Battery Systems")!;
    const thermal = tags.find((t) => t.display === "Thermal Engineering")!;
    expect(battery.confidence).toBeGreaterThan(thermal.confidence);
    expect(battery.evidence.length).toBe(2);
  });
});

describe("accepting a suggestion", () => {
  it("writes the words the tag syntax expects", () => {
    const text = tagsAsText([
      {
        slug: "robotics",
        display: "Robotics",
        kind: "capability",
        confidence: 1,
        evidence: [],
      },
      {
        slug: "battery-systems",
        display: "Battery Systems",
        kind: "capability",
        confidence: 1,
        evidence: [],
      },
    ]);
    expect(text).toBe("#Robotics [[Battery Systems]]");
  });
});
