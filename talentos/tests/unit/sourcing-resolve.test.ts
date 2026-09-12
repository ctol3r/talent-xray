/**
 * Entity resolution. A wrongly merged profile invents a career nobody had, so
 * the margin between "merge" and "review" is asserted here directly.
 */
import { describe, expect, it } from "vitest";
import {
  MERGE_THRESHOLD,
  REVIEW_THRESHOLD,
  clusterProfiles,
  decide,
  decideFor,
  explainMatch,
  mergeThresholdFor,
  nameFrequency,
  resolve,
  scoreMatch,
  type PersonProfile,
  type Sighting,
} from "@/lib/sourcing/resolve";

function sighting(
  partial: Partial<Sighting> & Pick<Sighting, "name">,
): Sighting {
  return {
    organizations: [],
    identities: [],
    capabilities: [],
    locations: [],
    artifactSources: [],
    coauthors: [],
    ...partial,
  };
}

function profile(
  id: string,
  partial: Partial<Sighting> & Pick<Sighting, "name">,
): PersonProfile {
  return { id, ...sighting(partial) };
}

describe("a shared registry identifier settles identity", () => {
  it("merges two spellings under one registry id", () => {
    const held = profile("p1", {
      name: "Amara Okonkwo",
      identities: [{ type: "orcid", value: "0000-0002-1825-0097" }],
    });
    const seen = sighting({
      name: "A. Okonkwo",
      identities: [{ type: "orcid", value: "0000-0002-1825-0097" }],
    });
    expect(decide(scoreMatch(held, seen).score)).toBe("merge");
  });
});

describe("a name can never corroborate itself", () => {
  it("does not merge two strangers who share a common name and a city", () => {
    // The bug this pins: corroboration read off a label prefix meant "shared
    // name variant" matched, so a name corroborated itself and two unrelated
    // people merged at 0.77 against a 0.72 threshold.
    const held = profile("p1", {
      name: "Michael Smith",
      organizations: ["Northforge Engineering"],
      locations: ["Detroit"],
      identities: [{ type: "name_variant", value: "michael smith" }],
    });
    const seen = sighting({
      name: "Michael Smith",
      organizations: ["Marine Institute"],
      locations: ["Detroit"],
      identities: [{ type: "name_variant", value: "michael smith" }],
    });
    const score = scoreMatch(held, seen).score;
    expect(score).toBeLessThan(MERGE_THRESHOLD);
    expect(decide(score)).not.toBe("merge");
  });

  it("keeps a safety margin, not a hairline, on that pair", () => {
    const held = profile("p1", {
      name: "Michael Smith",
      organizations: ["Northforge"],
      locations: ["Detroit"],
    });
    const seen = sighting({
      name: "Michael Smith",
      organizations: ["Marine Institute"],
      locations: ["Detroit"],
    });
    expect(scoreMatch(held, seen).score).toBeLessThan(REVIEW_THRESHOLD);
  });
});

describe("organisations that share a distinctive token are related", () => {
  it("links 'Edinburgh Robotics Group' to 'University of Edinburgh'", () => {
    // Jaccard alone scores these 0.25 and calls them unrelated, when the
    // shared token is the whole point. A shared "University" is not a signal;
    // a shared "Edinburgh" is.
    const held = profile("p1", {
      name: "Iona Fraser",
      organizations: ["University of Edinburgh"],
    });
    const seen = sighting({
      name: "Iona Fraser",
      organizations: ["Edinburgh Robotics Group"],
    });
    const match = scoreMatch(held, seen);
    expect(match.signals.map((s) => s.label).join(" ")).toMatch(
      /share 'edinburgh'/,
    );
    expect(decide(match.score)).toBe("merge");
  });
});

describe("cross-linked evidence carries an identical name over the line", () => {
  it("merges when both sightings point at the same document", () => {
    const held = profile("p1", {
      name: "Sarah Chen",
      artifactSources: ["https://example.invalid/papers/fusion-2023"],
    });
    const seen = sighting({
      name: "Sarah Chen",
      artifactSources: [
        "https://example.invalid/papers/fusion-2023?utm_source=x",
      ],
    });
    expect(decide(scoreMatch(held, seen).score)).toBe("merge");
  });
});

describe("differing surnames are fatal", () => {
  it("refuses to merge across a different surname without a unique identifier", () => {
    const held = profile("p1", { name: "Sarah Chen", organizations: ["Acme"] });
    const seen = sighting({ name: "Sarah Nakamura", organizations: ["Acme"] });
    expect(decide(scoreMatch(held, seen).score)).toBe("new");
  });
});

describe("resolve", () => {
  it("returns the audit trail, best match first", () => {
    const profiles = [
      profile("p1", { name: "Sarah Chen", organizations: ["Acme"] }),
      profile("p2", { name: "Ingrid Falk", organizations: ["Vantage"] }),
    ];
    const result = resolve(
      profiles,
      sighting({ name: "Sarah Chen", organizations: ["Acme"] }),
    );
    expect(result.best?.personId).toBe("p1");
    expect(result.considered[0].personId).toBe("p1");
    expect(explainMatch(result.best!).join(" ")).toMatch(/identical name/);
  });

  it("says 'new' when there is nobody to match against", () => {
    expect(resolve([], sighting({ name: "Nobody Known" })).decision).toBe(
      "new",
    );
  });
});

describe("shared collaborators are name-independent identity evidence", () => {
  it("carries an abbreviated byline over the line", () => {
    // Two people do not accumulate the same three collaborators by accident,
    // and none of that evidence depends on how the name is spelled — which is
    // exactly what an initialised byline needs.
    const held = profile("p1", {
      name: "Sarah Chen",
      coauthors: ["A. Okonkwo", "Iain Mackenzie", "Nadia Haddad"],
    });
    const seen = sighting({
      name: "S. Chen",
      coauthors: ["Amara Okonkwo", "I. Mackenzie", "N. Haddad"],
    });
    expect(decide(scoreMatch(held, seen).score)).toBe("merge");
  });

  it("treats one shared collaborator as weak, not decisive", () => {
    const held = profile("p1", {
      name: "Michael Smith",
      coauthors: ["Jane Doe"],
    });
    const seen = sighting({ name: "Mike Smith", coauthors: ["Jane Doe"] });
    expect(decide(scoreMatch(held, seen).score)).not.toBe("merge");
  });
});

describe("a common name has to clear a higher bar", () => {
  const frequency = nameFrequency([
    "Michael Smith",
    "Michael Smith",
    "Michael Smith",
    "M. Smith",
    "Ingrid Falk",
  ]);

  it("raises the threshold in proportion to how many people share the name", () => {
    expect(mergeThresholdFor("Ingrid Falk", frequency)).toBe(MERGE_THRESHOLD);
    expect(mergeThresholdFor("Michael Smith", frequency)).toBeGreaterThan(
      MERGE_THRESHOLD,
    );
  });

  it("never raises it without limit", () => {
    const crowded = nameFrequency(
      Array.from({ length: 200 }, () => "Michael Smith"),
    );
    expect(mergeThresholdFor("Michael Smith", crowded)).toBeLessThanOrEqual(
      MERGE_THRESHOLD + 0.16,
    );
  });

  it("holds a pair for review that a rare name would have merged", () => {
    const score = MERGE_THRESHOLD + 0.02;
    expect(decideFor(score, "Ingrid Falk", frequency)).toBe("merge");
    expect(decideFor(score, "Michael Smith", frequency)).toBe("review");
  });
});

describe("transitive closure", () => {
  // A and B are settled by a shared registry id. B and C are settled by a
  // shared work address and employer. A and C share neither — only the name.
  // Pairwise scoring never asks about A↔C, so without closure one person stays
  // split in two forever.
  const chain = () => [
    profile("a", {
      name: "Amara Okonkwo",
      identities: [{ type: "orcid", value: "0000-0002-1825-0097" }],
    }),
    profile("b", {
      name: "Amara Okonkwo",
      identities: [
        { type: "orcid", value: "0000-0002-1825-0097" },
        { type: "professional_email", value: "amara@wayline.invalid" },
      ],
      organizations: ["Wayline Autonomy"],
    }),
    profile("c", {
      name: "Amara Okonkwo",
      identities: [
        { type: "professional_email", value: "a.okonkwo@wayline.invalid" },
      ],
      organizations: ["Wayline Autonomy"],
    }),
  ];

  it("joins the two halves of one person", () => {
    const clusters = clusterProfiles(chain());
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members).toEqual(["a", "b", "c"]);
  });

  it("holds the cluster for review, because inference is not evidence", () => {
    const cluster = clusterProfiles(chain())[0];
    expect(cluster.direct).toBe(false);
    expect(cluster.decision).toBe("review");
    expect(cluster.inferred).toContainEqual(["a", "c"]);
  });

  it("merges outright when every pair was directly established", () => {
    const clusters = clusterProfiles([
      profile("a", {
        name: "Ingrid Falk",
        identities: [{ type: "orcid", value: "0000-1" }],
        organizations: ["Vantage Cell Systems"],
      }),
      profile("b", {
        name: "Ingrid Falk",
        identities: [{ type: "orcid", value: "0000-1" }],
        organizations: ["Vantage Cell Systems"],
      }),
    ]);
    expect(clusters[0].direct).toBe(true);
    expect(clusters[0].decision).toBe("merge");
  });

  it("leaves strangers alone", () => {
    const clusters = clusterProfiles([
      profile("a", { name: "Ingrid Falk", organizations: ["Vantage"] }),
      profile("b", { name: "Bjorn Halvorsen", organizations: ["Orbital"] }),
    ]);
    expect(clusters).toEqual([]);
  });
});
