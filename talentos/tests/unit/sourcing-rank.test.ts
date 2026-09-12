/**
 * Evidence ranking. The three rules at the top of `rank.ts` are the product;
 * each has a test here that fails loudly if it is ever softened.
 */
import { describe, expect, it } from "vitest";
import type { Claim, SourcedPerson } from "@/lib/sourcing/evidence";
import { parseQuery } from "@/lib/sourcing/query-language";
import {
  OLDEST_CREDIT,
  STALE_AFTER_DAYS,
  UNDATED_CREDIT,
  freshness,
  rankPeople,
  rankPerson,
} from "@/lib/sourcing/rank";

let seq = 0;
function claim(partial: Partial<Claim> & Pick<Claim, "kind" | "claim">): Claim {
  seq += 1;
  return {
    id: `c${seq}`,
    normalized: partial.normalized ?? partial.claim.toLowerCase(),
    sourceUrl: partial.sourceUrl ?? "https://example.invalid/a",
    confidence: partial.confidence ?? 0.8,
    ...partial,
  } as Claim;
}

function person(
  name: string,
  claims: Claim[],
  extra: Partial<SourcedPerson> = {},
): SourcedPerson {
  return { id: name.toLowerCase().replace(/\s/g, "-"), name, claims, ...extra };
}

const NOW = "2026-09-07";

describe("rule 1 — adjacency supports, it never substitutes", () => {
  it("caps someone with only adjacent evidence below someone with direct evidence", () => {
    const brief = parseQuery("skill:robotics");
    const direct = person("Direct Person", [
      claim({ kind: "capability", claim: "Robotics", normalized: "robotics" }),
    ]);
    const adjacent = person("Adjacent Person", [
      claim({
        kind: "capability",
        claim: "Control Systems",
        normalized: "controls",
      }),
      claim({
        kind: "capability",
        claim: "Computer Vision",
        normalized: "computer_vision",
      }),
      claim({
        kind: "capability",
        claim: "Embedded Systems",
        normalized: "embedded_systems",
      }),
    ]);
    const a = rankPerson(direct, brief, { now: NOW })!;
    const b = rankPerson(adjacent, brief, { now: NOW })!;
    expect(a.components.capability).toBeGreaterThan(b.components.capability);
    expect(b.components.capability).toBeLessThanOrEqual(0.6);
  });

  it("says which capability is adjacent and cites the ontology edge", () => {
    const ranked = rankPerson(
      person("Adjacent Person", [
        claim({
          kind: "capability",
          claim: "Control Systems",
          normalized: "controls",
        }),
      ]),
      parseQuery("skill:robotics"),
      { now: NOW },
    )!;
    const reason = ranked.reasons.find((r) =>
      r.includes("adjacent capability"),
    );
    expect(reason).toBeDefined();
    expect(reason).toMatch(
      /robot motion depends on control-systems engineering/,
    );
  });

  it("names the gap when the capability asked for is not evidenced", () => {
    const ranked = rankPerson(
      person("Adjacent Person", [
        claim({
          kind: "capability",
          claim: "Control Systems",
          normalized: "controls",
        }),
      ]),
      parseQuery("skill:robotics"),
      { now: NOW },
    )!;
    expect(ranked.gaps).toContain("no public evidence of Robotics");
  });
});

describe("rule 2 — hiring for X is never evidence of doing X", () => {
  it("counts a derived claim as support, never as the capability itself", () => {
    const brief = parseQuery("skill:perception");
    const doer = person("Doer", [
      claim({
        kind: "capability",
        claim: "Perception",
        normalized: "perception",
      }),
    ]);
    const hirer = person("Hirer", [
      claim({
        kind: "capability",
        claim: "Perception",
        normalized: "perception",
        derived: true,
      }),
    ]);
    const a = rankPerson(doer, brief, { now: NOW })!;
    const b = rankPerson(hirer, brief, { now: NOW })!;
    expect(a.components.capability).toBeGreaterThan(b.components.capability);
    expect(b.reasons.join(" ")).toMatch(
      /indirect mention, not evidence of doing it/,
    );
  });
});

describe("rule 3 — a wrong location costs, an unknown one does not", () => {
  const brief = parseQuery('skill:robotics loc:"united kingdom"');
  const capability = () =>
    claim({ kind: "capability", claim: "Robotics", normalized: "robotics" });

  it("ranks an unstated location above a contradicted one", () => {
    const silent = rankPerson(person("Silent", [capability()]), brief, {
      now: NOW,
    })!;
    const elsewhere = rankPerson(
      person("Elsewhere", [
        capability(),
        claim({
          kind: "location",
          claim: "Tokyo, Japan",
          normalized: "tokyo japan",
        }),
      ]),
      brief,
      { now: NOW },
    )!;
    expect(silent.score).toBeGreaterThan(elsewhere.score);
  });

  it("still shows the contradicted person, with the contradiction named", () => {
    const elsewhere = rankPerson(
      person("Elsewhere", [
        capability(),
        claim({
          kind: "location",
          claim: "Tokyo, Japan",
          normalized: "tokyo japan",
        }),
      ]),
      brief,
      { now: NOW },
    )!;
    expect(elsewhere).not.toBeNull();
    expect(elsewhere.gaps.join(" ")).toMatch(/publicly based in Tokyo, Japan/);
  });

  it("reads a city as an answer to its country", () => {
    const ranked = rankPerson(
      person("Londoner", [
        capability(),
        claim({
          kind: "location",
          claim: "London, United Kingdom",
          normalized: "london united kingdom",
        }),
      ]),
      brief,
      { now: NOW },
    )!;
    expect(ranked.components.location).toBeGreaterThanOrEqual(0.95);
  });
});

describe("multi-word capabilities", () => {
  it("credits evidence stored under the ontology key, not just the alias", () => {
    // The bug this pins: evidence stores "technical_recruiting" while the
    // ontology lists "technical recruiting", so only single-word capabilities
    // matched — and TalentOS reported "no public evidence of Technical
    // Recruiting" beside the evidence for it.
    const ranked = rankPerson(
      person("Recruiter", [
        claim({
          kind: "capability",
          claim: "Technical Recruiting",
          normalized: "technical_recruiting",
        }),
      ]),
      parseQuery("technical recruiters"),
      { now: NOW },
    )!;
    // Full credit for an undated claim: unknown age is not old age.
    expect(ranked.components.capability).toBeCloseTo(UNDATED_CREDIT, 5);
    expect(ranked.gaps).not.toContain(
      "no public evidence of Technical Recruiting",
    );
  });
});

describe("filters", () => {
  it("drops anyone missing a has: flag the brief demanded", () => {
    const withEmail = person("Reachable", [
      claim({ kind: "capability", claim: "Robotics", normalized: "robotics" }),
      claim({ kind: "contact", claim: "a@b.invalid", contactType: "email" }),
    ]);
    const without = person("Unreachable", [
      claim({ kind: "capability", claim: "Robotics", normalized: "robotics" }),
    ]);
    const brief = parseQuery("skill:robotics has:email");
    expect(rankPerson(withEmail, brief, { now: NOW })).not.toBeNull();
    expect(rankPerson(without, brief, { now: NOW })).toBeNull();
  });

  it("drops anyone whose evidence contains a negated term", () => {
    const brief = parseQuery("skill:robotics -recruiter");
    const p = person("Robotics Recruiter", [
      claim({ kind: "capability", claim: "Robotics", normalized: "robotics" }),
      claim({
        kind: "employment",
        claim: "Recruiter at Acme",
        title: "Recruiter",
        organization: "Acme",
      }),
    ]);
    expect(rankPerson(p, brief, { now: NOW })).toBeNull();
  });

  it("honours -site: without touching the page", () => {
    const brief = parseQuery("skill:robotics -site:example.invalid");
    const p = person("Only There", [
      claim({ kind: "capability", claim: "Robotics", normalized: "robotics" }),
    ]);
    expect(rankPerson(p, brief, { now: NOW })).toBeNull();
  });
});

describe("corroboration", () => {
  it("warns when everything known comes from one domain", () => {
    const ranked = rankPerson(
      person("Single Source", [
        claim({
          kind: "capability",
          claim: "Robotics",
          normalized: "robotics",
        }),
      ]),
      parseQuery("skill:robotics"),
      { now: NOW },
    )!;
    expect(ranked.gaps.join(" ")).toMatch(/comes from one domain/);
  });

  it("scores a person seen on several domains above one seen on a single domain", () => {
    const brief = parseQuery("skill:robotics");
    const one = person("One Domain", [
      claim({
        kind: "capability",
        claim: "Robotics",
        normalized: "robotics",
        sourceUrl: "https://a.invalid/x",
      }),
    ]);
    const many = person("Many Domains", [
      claim({
        kind: "capability",
        claim: "Robotics",
        normalized: "robotics",
        sourceUrl: "https://a.invalid/x",
      }),
      claim({
        kind: "artifact",
        claim: "Paper",
        artifactType: "publication",
        sourceUrl: "https://b.invalid/y",
      }),
      claim({
        kind: "artifact",
        claim: "Talk",
        artifactType: "talk",
        sourceUrl: "https://c.invalid/z",
      }),
    ]);
    expect(rankPerson(many, brief, { now: NOW })!.score).toBeGreaterThan(
      rankPerson(one, brief, { now: NOW })!.score,
    );
  });
});

describe("rankPeople", () => {
  it("orders by score and reports how many were filtered out", () => {
    const brief = parseQuery("skill:robotics has:email");
    const result = rankPeople(
      [
        person("Has Email", [
          claim({
            kind: "capability",
            claim: "Robotics",
            normalized: "robotics",
          }),
          claim({
            kind: "contact",
            claim: "a@b.invalid",
            contactType: "email",
          }),
        ]),
        person("No Email", [
          claim({
            kind: "capability",
            claim: "Robotics",
            normalized: "robotics",
          }),
        ]),
      ],
      brief,
      { now: NOW },
    );
    expect(result.people.map((p) => p.name)).toEqual(["Has Email"]);
    expect(result.poolSize).toBe(2);
    expect(result.filteredOut.excluded).toBe(1);
  });
});

describe("rule 6 — old evidence counts less, undated evidence counts as unknown", () => {
  it("gives full credit inside the freshness window and never zero outside it", () => {
    expect(freshness("2026-06-01", NOW)).toBe(1);
    expect(freshness(null, NOW)).toBe(UNDATED_CREDIT);
    expect(freshness("2010-01-01", NOW)).toBe(OLDEST_CREDIT);
    expect(freshness("2026-09-06", NOW)).toBeGreaterThan(
      freshness("2018-01-01", NOW),
    );
  });

  it("decays smoothly rather than falling off a cliff at the window's edge", () => {
    const justInside = new Date(
      Date.parse(NOW) - (STALE_AFTER_DAYS - 1) * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
    const justOutside = new Date(
      Date.parse(NOW) - (STALE_AFTER_DAYS + 1) * 86_400_000,
    )
      .toISOString()
      .slice(0, 10);
    expect(freshness(justInside, NOW)).toBe(1);
    expect(freshness(justOutside, NOW)).toBeGreaterThan(0.99);
  });

  it("ranks a recent claim above the same claim made years ago", () => {
    const brief = parseQuery("skill:robotics");
    const recent = person("Recent", [
      claim({
        kind: "capability",
        claim: "Robotics",
        normalized: "robotics",
        date: "2026-01-01",
      }),
    ]);
    const ancient = person("Ancient", [
      claim({
        kind: "capability",
        claim: "Robotics",
        normalized: "robotics",
        date: "2009-01-01",
      }),
    ]);
    expect(
      rankPerson(recent, brief, { now: NOW })!.components.capability,
    ).toBeGreaterThan(
      rankPerson(ancient, brief, { now: NOW })!.components.capability,
    );
  });

  it("keeps stale evidence as evidence — an old CV still says what it says", () => {
    const brief = parseQuery("skill:robotics");
    const ancient = person("Ancient", [
      claim({
        kind: "capability",
        claim: "Robotics",
        normalized: "robotics",
        date: "2009-01-01",
      }),
    ]);
    const ranked = rankPerson(ancient, brief, { now: NOW })!;
    expect(ranked.components.capability).toBeGreaterThanOrEqual(OLDEST_CREDIT);
    expect(ranked.gaps).not.toContain("no public evidence of Robotics");
  });
});

describe("rule 7 — the relevance floor is a results-list concern", () => {
  const brief = parseQuery("skill:robotics");
  const unrelated = () =>
    person("Unrelated", [
      claim({ kind: "capability", claim: "Culinary", normalized: "culinary" }),
      claim({ kind: "location", claim: "London", normalized: "london" }),
    ]);

  it("drops somebody the brief does not touch, rather than padding the list", () => {
    expect(rankPerson(unrelated(), brief, { now: NOW })).toBeNull();
  });

  it("still shows them when the recruiter opened them deliberately", () => {
    // A dossier somebody asked for should show what is held, not an empty page.
    const ranked = rankPerson(unrelated(), brief, {
      now: NOW,
      relevanceFloor: false,
    });
    expect(ranked).not.toBeNull();
    expect(ranked!.gaps).toContain("no public evidence of Robotics");
  });

  it("never drops anybody when the brief names no capability", () => {
    expect(
      rankPerson(unrelated(), parseQuery("loc:london"), { now: NOW }),
    ).not.toBeNull();
  });
});

describe("ties are broken on something a recruiter would use", () => {
  it("puts the better-corroborated person first when scores match", () => {
    const brief = parseQuery("skill:robotics");
    const thin = person("Aaa Thin", [
      claim({
        kind: "capability",
        claim: "Robotics",
        normalized: "robotics",
        sourceUrl: "https://a.invalid/1",
      }),
    ]);
    const corroborated = person("Zzz Corroborated", [
      claim({
        kind: "capability",
        claim: "Robotics",
        normalized: "robotics",
        sourceUrl: "https://a.invalid/1",
      }),
      claim({
        kind: "identity",
        claim: "profile",
        normalized: "p",
        sourceUrl: "https://b.invalid/2",
      }),
    ]);
    const result = rankPeople([thin, corroborated], brief, { now: NOW });
    // Alphabetically "Aaa" wins; on evidence it does not.
    expect(result.people[0].name).toBe("Zzz Corroborated");
  });
});

describe("a stated skill only matches what it actually names", () => {
  it("does not credit a one-letter skill with an unrelated profession", () => {
    // Found on the rendered page after the ontology grew: a Principal Engineer
    // whose stated skill was "C++" was shown as "evidenced capability:
    // Employment Law". "C++" normalises to the single character "c", and the
    // fallback tested plain substring containment, so it matched every alias
    // containing a "c" — here, "civil litigation".
    const engineer = person("Engineer", [
      claim({ kind: "capability", claim: "C++", normalized: "c" }),
      claim({
        kind: "capability",
        claim: "infrastructure",
        normalized: "software_engineering",
      }),
    ]);
    expect(
      rankPerson(engineer, parseQuery("employment lawyer litigation"), {
        now: NOW,
      }),
    ).toBeNull();
  });

  it("still matches a capability named in more words than the alias", () => {
    const engineer = person("Engineer", [
      claim({
        kind: "capability",
        claim: "applied machine learning",
        normalized: "applied machine learning",
      }),
    ]);
    const ranked = rankPerson(engineer, parseQuery("skill:machine_learning"), {
      now: NOW,
    })!;
    expect(ranked.components.capability).toBeGreaterThan(0);
  });

  it("gives the credit to the longest matching alias, not the first one seen", () => {
    const person1 = person("Specific", [
      claim({
        kind: "capability",
        claim: "sensor fusion",
        normalized: "sensor fusion",
      }),
    ]);
    const ranked = rankPerson(person1, parseQuery("skill:perception"), {
      now: NOW,
    })!;
    expect(ranked.reasons.join(" ")).toMatch(/Perception/);
  });
});
