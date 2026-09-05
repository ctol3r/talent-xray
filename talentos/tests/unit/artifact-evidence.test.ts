/**
 * Candidate evidence dossiers (spec §12). A model claim about a real
 * person is only evidence when it quotes something a human supplied, and
 * that quote is checked. Nothing here fetches anything.
 */
import { describe, expect, it } from "vitest";
import {
  QUOTE_LABELS,
  buildDossier,
  criteriaFromProfile,
  quoteAppearsIn,
  sourcesFor,
  verifyEvidence,
  type CandidateSource,
} from "../../artifact-src/core/evidence";
import type { StoredCandidate } from "../../artifact-src/core/store";

const NOW = "2026-09-04T00:00:00.000Z";
const PASTED =
  "SYNTHETIC PROFILE — not a real person.\nBuilt the distributed evaluation harness used across the lab (PyTorch, Ray, 256-GPU runs).\nTwo first-author workshop papers on adversarial robustness.";

const candidate: StoredCandidate = {
  id: "c1",
  name: "Synthetic Benchmark Candidate",
  currentTitle: "Member of Technical Staff",
  profileUrls: ["https://example.com/synthetic-profile"],
  notes: "Referred by the hiring manager.",
  pastedText: PASTED,
  createdAt: NOW,
};

const sources = (): CandidateSource[] => sourcesFor(candidate);

describe("sources are only ever what a human supplied", () => {
  it("turns the pasted text, the links and the notes into identified sources", () => {
    const list = sources();
    expect(list.map((s) => s.kind)).toEqual([
      "pasted_text",
      "link",
      "recruiter_note",
    ]);
    expect(list[0].id).toBe("c1:pasted");
    expect(list[1].url).toBe("https://example.com/synthetic-profile");
    // A link carries no text: nothing on this page ever fetched it.
    expect(list[1].text).toBe("");
  });

  it("a candidate with nothing attached has no sources at all", () => {
    expect(
      sourcesFor({ id: "x", name: "Nobody", profileUrls: [], createdAt: NOW }),
    ).toEqual([]);
  });
});

describe("quote matching", () => {
  it("ignores wrapping, case and smart quotes", () => {
    expect(
      quoteAppearsIn("BUILT   the distributed\nevaluation harness", PASTED),
    ).toBe(true);
    expect(quoteAppearsIn("first-author workshop papers", PASTED)).toBe(true);
    expect(quoteAppearsIn("led a team of twelve", PASTED)).toBe(false);
  });

  it("refuses to attribute a span too short to mean anything", () => {
    expect(quoteAppearsIn("Ray", PASTED)).toBe(false);
  });
});

describe("verification", () => {
  it("accepts a real quote and leaves its status alone", () => {
    const { items, downgraded } = verifyEvidence(
      [
        {
          criterion: "Built evaluation infrastructure",
          status: "strong",
          evidenceText: "They built the harness.",
          quote: "Built the distributed evaluation harness used across the lab",
          sourceId: "c1:pasted",
        },
      ],
      sources(),
    );
    expect(downgraded).toBe(0);
    expect(items[0].supported).toBe(true);
    expect(items[0].status).toBe("strong");
    expect(items[0].check).toBe("verified_in_source");
    expect(items[0].note).toContain("found there verbatim");
  });

  it("downgrades a quote that is not in the source it cites, and says so plainly", () => {
    const { items, downgraded } = verifyEvidence(
      [
        {
          criterion: "Led a large team",
          status: "strong",
          evidenceText: "They led twelve engineers.",
          quote: "Led a team of twelve engineers across three sites.",
          sourceId: "c1:pasted",
        },
      ],
      sources(),
    );
    expect(downgraded).toBe(1);
    expect(items[0].supported).toBe(false);
    expect(items[0].status).toBe("unknown");
    expect(items[0].check).toBe("not_found_in_source");
    expect(items[0].note).toContain("not in");
    expect(items[0].note).toContain("do not use it");
  });

  it("will not let a claim rest on a link, because the page never read it", () => {
    const { items } = verifyEvidence(
      [
        {
          criterion: "Published at NeurIPS",
          status: "strong",
          evidenceText: "Their profile lists papers.",
          quote: "First-author NeurIPS paper",
          sourceId: "c1:link:0",
        },
      ],
      sources(),
    );
    expect(items[0].check).toBe("source_is_a_link");
    expect(items[0].status).toBe("partial");
    expect(items[0].supported).toBe(false);
    expect(items[0].note).toContain("never fetches a page");
  });

  it("treats an unsourced claim as a model inference, not as evidence", () => {
    const { items } = verifyEvidence(
      [
        {
          criterion: "Strong communicator",
          status: "strong",
          evidenceText: "Reads that way.",
        },
      ],
      sources(),
    );
    expect(items[0].check).toBe("no_quote_given");
    expect(items[0].status).toBe("partial");
    expect(items[0].note).toContain("nothing can be checked");

    const noSource = verifyEvidence(
      [
        {
          criterion: "X",
          status: "strong",
          quote: "some quoted span here",
          sourceId: "nope",
        },
      ],
      sources(),
    ).items[0];
    expect(noSource.check).toBe("no_source_named");
    expect(noSource.status).toBe("unknown");
    expect(noSource.note).toContain("It is not evidence");
  });

  it("leaves an honest 'missing' alone — absence of evidence is a valid answer", () => {
    const { items, downgraded } = verifyEvidence(
      [
        {
          criterion: "Kubernetes",
          status: "missing",
          evidenceText: "Looked for it; not mentioned.",
        },
      ],
      sources(),
    );
    expect(downgraded).toBe(0);
    expect(items[0].status).toBe("missing");
  });

  it("every check code has copy a recruiter can act on", () => {
    for (const [code, label] of Object.entries(QUOTE_LABELS)) {
      expect(label.length, code).toBeGreaterThan(8);
    }
  });
});

describe("the dossier", () => {
  const profile = {
    mustHave: [
      { text: "Built evaluation infrastructure" },
      { text: "Ships production code" },
    ],
    evidenceSignals: ["Open-source research artifacts"],
  };

  it("pulls its criteria from the success profile's own words", () => {
    expect(criteriaFromProfile(profile)).toEqual([
      "Built evaluation infrastructure",
      "Ships production code",
      "Open-source research artifacts",
    ]);
    expect(criteriaFromProfile(undefined)).toEqual([]);
  });

  it("names the criteria nobody assessed, and says what that does and does not mean", () => {
    const dossier = buildDossier({
      candidate,
      rawItems: [
        {
          criterion: "Built evaluation infrastructure",
          status: "strong",
          quote: "Built the distributed evaluation harness used across the lab",
          sourceId: "c1:pasted",
        },
      ],
      criteria: criteriaFromProfile(profile),
    });
    expect(dossier.supportedCount).toBe(1);
    expect(dossier.uncovered).toEqual([
      "Ships production code",
      "Open-source research artifacts",
    ]);
    expect(dossier.summary).toContain(
      "1 of 1 criteria have a quote found in a source you supplied",
    );
    expect(dossier.summary).toContain("not assessed at all");
  });

  it("counts the downgrades into the summary so the number is never hidden", () => {
    const dossier = buildDossier({
      candidate,
      rawItems: [
        {
          criterion: "A",
          status: "strong",
          quote: "Led a team of twelve engineers",
          sourceId: "c1:pasted",
        },
        {
          criterion: "B",
          status: "strong",
          quote: "Two first-author workshop papers",
          sourceId: "c1:pasted",
        },
      ],
      criteria: [],
    });
    expect(dossier.downgraded).toBe(1);
    expect(dossier.supportedCount).toBe(1);
    expect(dossier.summary).toContain("1 claim was downgraded");
  });

  it("an unassessed candidate says so rather than implying a clean sheet", () => {
    const dossier = buildDossier({ candidate, rawItems: [], criteria: ["A"] });
    expect(dossier.summary).toBe("No evidence assessed yet.");
    expect(dossier.uncovered).toEqual(["A"]);
  });
});
