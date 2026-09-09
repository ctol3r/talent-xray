/**
 * Turning a public-API row into a person the ranker can score.
 *
 * The load-bearing behaviour is what it REFUSES to do: a row whose title is not
 * a person's name has to become nothing, because a candidate nobody can contact
 * or corroborate is worse than no candidate at all.
 */
import { describe, expect, it } from "vitest";
import type { DiscoveryResult } from "@/lib/research/discovery-provider";
import {
  peopleFromDiscovery,
  personFromDiscovery,
} from "@/lib/sourcing/from-open-index";
import { looksLikePersonName } from "@/lib/sourcing/person-name";
import { parseQuery } from "@/lib/sourcing/query-language";
import { rankPerson } from "@/lib/sourcing/rank";

function row(partial: Partial<DiscoveryResult>): DiscoveryResult {
  return {
    url: "https://www.wikidata.org/wiki/Q1",
    title: "Amara Okonkwo",
    snippet: "Robotics researcher · University of Edinburgh",
    provider: "open-index",
    engine: "wikidata",
    query: "robotics",
    retrievedAt: "2026-09-07T00:00:00.000Z",
    providerRank: 1,
    ...partial,
  };
}

describe("looksLikePersonName", () => {
  it("accepts ordinary names, including particles and hyphens", () => {
    for (const name of [
      "Amara Okonkwo",
      "Sarah Chen",
      "Jean-Luc Picard",
      "Ingrid Falk",
      "Ludwig van Beethoven",
      "Peter Osei-Bonsu",
      "Yuki Tanaka",
    ]) {
      expect(looksLikePersonName(name)).toBe(true);
    }
  });

  it("rejects page furniture, bodies and identifiers", () => {
    for (const notName of [
      "Our Team",
      "Field Robotics Summit",
      "Q7259",
      "Leadership Team",
      "Acme Technologies Ltd",
      "Smith, John",
      "Staff Directory",
      "Proceedings of the 2024 Conference",
      "Robotics",
      "",
    ]) {
      expect(looksLikePersonName(notName)).toBe(false);
    }
  });
});

describe("personFromDiscovery", () => {
  it("reads the source's own line as claims that carry its URL", () => {
    const person = personFromDiscovery(row({}))!;
    expect(person.name).toBe("Amara Okonkwo");
    expect(person.claims.length).toBeGreaterThan(1);
    for (const claim of person.claims) {
      expect(claim.sourceUrl).toBe("https://www.wikidata.org/wiki/Q1");
    }
    expect(
      person.claims.some(
        (c) => c.kind === "capability" && c.normalized === "robotics",
      ),
    ).toBe(true);
    expect(person.claims.some((c) => c.kind === "employment")).toBe(true);
    expect(person.claims.some((c) => c.kind === "location")).toBe(true);
  });

  it("scores a one-line description below a full record, without denying it", () => {
    const brief = parseQuery("skill:robotics");
    const ranked = rankPerson(personFromDiscovery(row({}))!, brief, {
      now: "2026-09-07",
    })!;
    expect(ranked.components.capability).toBeGreaterThan(0);
    expect(ranked.components.capability).toBeLessThan(1);
    expect(ranked.reasons.join(" ")).toMatch(/evidenced capability: Robotics/);
  });

  it("marks a capability named after a sourcing verb as support, not evidence", () => {
    const person = personFromDiscovery(
      row({
        snippet: "Talent partner hiring for robotics and machine learning",
      }),
    )!;
    const robotics = person.claims.find((c) => c.normalized === "robotics")!;
    expect(robotics.derived).toBe(true);
  });

  it("refuses to invent a person from a row that does not name one", () => {
    expect(
      personFromDiscovery(row({ title: "Field Robotics Summit" })),
    ).toBeNull();
    expect(personFromDiscovery(row({ title: "Q7259" }))).toBeNull();
  });
});

describe("peopleFromDiscovery", () => {
  it("reports what it discarded rather than dropping it silently", () => {
    const { people, discarded } = peopleFromDiscovery([
      row({}),
      row({ url: "https://www.wikidata.org/wiki/Q2", title: "Our Team" }),
    ]);
    expect(people).toHaveLength(1);
    expect(discarded).toHaveLength(1);
    expect(discarded[0].title).toBe("Our Team");
    expect(discarded[0].domain).toBe("www.wikidata.org");
  });

  it("does not return the same row twice", () => {
    expect(peopleFromDiscovery([row({}), row({})]).people).toHaveLength(1);
  });
});
