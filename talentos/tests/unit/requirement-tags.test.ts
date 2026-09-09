import { describe, expect, it } from "vitest";
import {
  matchCriterionToRequirement,
  requirementsOf,
  tagsForAssessment,
  tagsForRequirements,
  type RequirementItem,
} from "@/lib/sourcing/requirement-tags";
import { tagsIn } from "@/lib/core/tags";
import { appendTagToNotes } from "@/lib/services/tags";

/** Requirement text taken verbatim from the CAIS role intelligence artifact. */
const CAIS: RequirementItem[] = [
  {
    text: "Demonstrated ability to design sourcing strategies and hiring processes from scratch, not just operate existing ones",
    weight: "hard",
  },
  {
    text: "Comfort with ATS and sourcing tools (Greenhouse, LinkedIn Recruiter or similar)",
    weight: "hard",
  },
  {
    text: "Full-time, on-site in San Francisco; local candidates only",
    weight: "hard",
  },
  {
    text: "Experience recruiting for technical or research-heavy organizations (ML research, academic labs, deep-tech startups)",
    weight: "preference",
  },
  {
    text: "Has configured an ATS from empty (pipelines, stages, reporting) rather than inheriting one",
    weight: "signal",
  },
];

describe("tagsForRequirements", () => {
  it("proposes words from the shared vocabulary, with the requirement that produced each", () => {
    const proposals = tagsForRequirements(CAIS);
    const slugs = proposals.map((p) => p.slug);
    expect(slugs).toContain("talent-sourcing");
    for (const proposal of proposals) {
      expect(proposal.from.length).toBeGreaterThan(0);
      // A proposal that cannot say which requirement it came from is not
      // reviewable, and an unreviewable tag is the thing this avoids.
      expect(proposal.from[0].requirement).toBeTruthy();
      expect(proposal.from[0].matched).toBeTruthy();
    }
  });

  it("gathers one word from several requirements rather than offering it twice", () => {
    const proposals = tagsForRequirements(CAIS);
    const sourcing = proposals.find((p) => p.slug === "talent-sourcing");
    expect(sourcing).toBeDefined();
    expect(sourcing!.from.length).toBeGreaterThan(1);
    expect(proposals.filter((p) => p.slug === "talent-sourcing")).toHaveLength(
      1,
    );
  });

  it("never offers a word the job's prose already says", () => {
    const first = tagsForRequirements(CAIS);
    const already = first.map((p) => p.slug);
    expect(tagsForRequirements(CAIS, { already })).toHaveLength(0);
  });

  /**
   * The finding that decided the design. Naming each requirement individually
   * was measured against the workspace's 50 requirement items and produced 50
   * distinct phrases — none recurring — which would add nodes and edges while
   * connecting nothing. A tag has to be capable of being written twice, so
   * this pins that proposals are drawn from a vocabulary that repeats.
   */
  it("proposes fewer words than there are requirements, because tags must recur", () => {
    const proposals = tagsForRequirements(CAIS);
    expect(proposals.length).toBeLessThan(CAIS.length);
  });

  it("yields nothing for a requirement the vocabulary cannot name", () => {
    const proposals = tagsForRequirements([
      {
        text: "Has configured an ATS from empty (pipelines, stages, reporting)",
        weight: "signal",
      },
    ]);
    // Better to leave it to the recruiter than to mint a word used once.
    expect(proposals).toHaveLength(0);
  });
});

describe("matchCriterionToRequirement", () => {
  it("matches a restated criterion back to the requirement it assesses", () => {
    const matched = matchCriterionToRequirement(
      "Evidence of designing sourcing strategies and hiring processes from scratch",
      CAIS,
    );
    expect(matched?.text).toBe(CAIS[0].text);
  });

  it("returns nothing rather than forcing an unrelated criterion onto the nearest", () => {
    expect(
      matchCriterionToRequirement("Holds a commercial pilot licence", CAIS),
    ).toBeNull();
  });
});

describe("tagsForAssessment", () => {
  const jobTags = [{ slug: "talent-sourcing", display: "Talent Sourcing" }];

  it("only ever offers words the job itself carries", () => {
    const proposals = tagsForAssessment(
      [
        {
          criterion: "Has designed sourcing strategies from scratch",
          status: "strong",
        },
        // Real, well-evidenced, and not a word this job uses: not offered,
        // because keeping it would connect nothing.
        {
          criterion: "Deep machine learning research background",
          status: "strong",
        },
      ],
      jobTags,
      CAIS,
    );
    expect(proposals.map((p) => p.slug)).toEqual(["talent-sourcing"]);
  });

  it("refuses to write a word onto a person the evidence did not support", () => {
    for (const status of ["missing", "contradictory", "unknown"] as const) {
      const proposals = tagsForAssessment(
        [{ criterion: "Has designed sourcing strategies", status }],
        jobTags,
        CAIS,
      );
      expect(proposals).toHaveLength(0);
    }
  });

  it("offers partial evidence, and says that it is partial", () => {
    const proposals = tagsForAssessment(
      [{ criterion: "Has designed sourcing strategies", status: "partial" }],
      jobTags,
      CAIS,
    );
    expect(proposals).toHaveLength(1);
    expect(proposals[0].from[0].status).toBe("partial");
  });

  it("offers nothing when the job has no tags yet", () => {
    expect(
      tagsForAssessment(
        [{ criterion: "Has designed sourcing strategies", status: "strong" }],
        [],
        CAIS,
      ),
    ).toHaveLength(0);
  });

  it("cites the criterion that supports each word", () => {
    const proposals = tagsForAssessment(
      [
        {
          criterion: "Has designed sourcing strategies from scratch",
          status: "strong",
        },
      ],
      jobTags,
      CAIS,
    );
    expect(proposals[0].from[0].criterion).toContain("sourcing strategies");
    expect(proposals[0].from[0].requirement).toBe(CAIS[0].text);
  });
});

describe("the edge a kept pair actually makes", () => {
  /**
   * The end-to-end claim, at the level the graph cares about: a word kept on
   * the job and the same word kept on the person are one tag in both texts.
   * That identity is the edge — nothing else records it.
   */
  it("puts one identical tag in the job's prose and the person's prose", () => {
    const proposal = tagsForRequirements(CAIS).find(
      (p) => p.slug === "talent-sourcing",
    );
    expect(proposal).toBeDefined();

    const jobNotes = appendTagToNotes("Turns on closing senior sourcers.", {
      slug: proposal!.slug,
      display: proposal!.display,
    });

    const onPerson = tagsForAssessment(
      [
        {
          criterion: "Has designed sourcing strategies from scratch",
          status: "strong",
        },
      ],
      tagsIn(jobNotes),
      CAIS,
    );
    expect(onPerson).toHaveLength(1);

    const personNotes = appendTagToNotes("Founded a sourcing function.", {
      slug: onPerson[0].slug,
      display: onPerson[0].display,
    });

    const shared = tagsIn(jobNotes)
      .map((t) => t.slug)
      .filter((slug) => tagsIn(personNotes).some((t) => t.slug === slug));
    expect(shared).toEqual(["talent-sourcing"]);
  });
});

describe("requirementsOf", () => {
  it("keeps which list each requirement came from", () => {
    const items = requirementsOf({
      hardRequirements: [{ text: "A" }],
      preferences: [{ text: "B" }],
      signals: [{ text: "C" }],
    });
    expect(items).toEqual([
      { text: "A", weight: "hard" },
      { text: "B", weight: "preference" },
      { text: "C", weight: "signal" },
    ]);
  });
});
