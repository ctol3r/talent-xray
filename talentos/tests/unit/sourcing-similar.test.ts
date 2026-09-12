/**
 * Find Similar. "This person is right — get me ten more" is the most valuable
 * move in sourcing, so every suggestion has to arrive with the reason it was
 * suggested, or a recruiter cannot tell a lookalike from a coincidence.
 */
import { describe, expect, it } from "vitest";
import { benchmarkCorpus } from "@/lib/sourcing/benchmark";
import { findSimilar } from "@/lib/sourcing/similar";
import {
  allEvidence,
  buildDossier,
  requirementText,
} from "@/lib/sourcing/dossier";
import { parseQuery } from "@/lib/sourcing/query-language";
import { rankPerson } from "@/lib/sourcing/rank";

const corpus = benchmarkCorpus();
const seed = corpus.find((p) => p.name === "Ingrid Falk")!;

describe("findSimilar", () => {
  it("puts the people who do the same work at the top", () => {
    const neighbours = findSimilar(seed, corpus, 5);
    expect(neighbours[0].name).toBe("Peter Osei-Bonsu");
    expect(neighbours.slice(0, 3).map((n) => n.name)).toContain(
      "Bjorn Halvorsen",
    );
  });

  it("gives every suggestion a reason a recruiter would recognise", () => {
    for (const n of findSimilar(seed, corpus, 8)) {
      expect(n.reasons.length).toBeGreaterThan(0);
      for (const reason of n.reasons) expect(reason.length).toBeGreaterThan(10);
    }
  });

  it("never suggests the person you started from", () => {
    expect(findSimilar(seed, corpus, 20).map((n) => n.personId)).not.toContain(
      seed.id,
    );
  });

  it("counts being named on the same page, not just sharing an employer name", () => {
    const colleague = findSimilar(seed, corpus, 8).find(
      (n) => n.name === "Peter Osei-Bonsu",
    )!;
    expect(colleague.reasons.join(" ")).toMatch(/same page|worked at/);
  });
});

describe("the dossier", () => {
  it("draws a ribbon only from a claim the ranker actually scored", () => {
    const brief = parseQuery('skill:"battery systems" loc:gothenburg');
    const ranked = rankPerson(seed, brief, { now: "2026-09-07" })!;
    const dossier = buildDossier(ranked);

    expect(dossier.claims.length).toBeGreaterThan(0);
    const evidenceIds = new Set(dossier.evidence.map((e) => e.id));
    for (const claim of dossier.claims) {
      expect(claim.evidenceIds.length).toBeGreaterThan(0);
      for (const id of claim.evidenceIds)
        expect(evidenceIds.has(id)).toBe(true);
    }
  });

  it("says each requirement the way a recruiter would", () => {
    expect(requirementText("skill:battery_systems")).toBe(
      "does Battery Systems",
    );
    expect(requirementText("loc:gothenburg")).toBe("is based in gothenburg");
    expect(requirementText("org:acme")).toBe("has worked at acme");
  });

  it("carries the gaps through rather than quietly dropping them", () => {
    const brief = parseQuery('skill:"battery systems" loc:london');
    const ranked = rankPerson(seed, brief, { now: "2026-09-07" })!;
    expect(buildDossier(ranked).unevidenced.join(" ")).toMatch(
      /publicly based in/,
    );
  });
});

describe("a generated address says so wherever it is rendered", () => {
  it("carries its provenance into the dossier, not just the profile form", () => {
    // Product rule 3. The dossier is a surface that renders addresses, so the
    // label has to travel with the claim rather than live on the form that
    // typed it.
    const withContact = {
      ...seed,
      claims: [
        ...seed.claims,
        {
          id: "generated-email",
          kind: "contact" as const,
          claim: "i.falk@vantagecell.invalid",
          normalized: "i.falk@vantagecell.invalid",
          sourceUrl: "https://talentos.local/workspace",
          sourceTitle: "generated — unverified",
          confidence: 0.3,
          contactType: "email",
        },
      ],
    };
    const ranked = rankPerson(
      withContact,
      parseQuery('skill:"battery systems"'),
      {
        now: "2026-09-07",
      },
    )!;
    const rendered = allEvidence(ranked).find(
      (e) => e.id === "generated-email",
    )!;
    expect(rendered.detail).toContain("generated — unverified");
  });
});
