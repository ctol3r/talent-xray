/**
 * The TalentOS Lite artifact carries its own copy of the W12 deterministic
 * backstops, because a single-file page cannot import from `src/`. A copy
 * rots silently, so these tests extract the block straight out of the HTML
 * and run the same cases as `intake-hygiene.test.ts` against it.
 *
 * If the app's backstops change and the artifact's do not, this fails.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface Req {
  label: string;
  statement: string;
  definition: string;
  kind: string;
  origin: string;
  assertedBy?: string;
  evidenceSpec: string[];
  falseSignals: string[];
  status: string;
  linkedUncertaintyIds: string[];
}
interface Unc {
  id: string;
  about: string;
  kind: string;
  consequence: string;
  consequential: boolean;
  status: string;
  resolution?: string;
}

interface Contra {
  claimA: { text: string; provenance: string };
  claimB: { text: string; provenance: string };
  note?: string;
  status: string;
  resolution?: string;
}

interface Hygiene {
  reconcileRequirementOrigins: (
    requirements: Req[],
    jdText: string | undefined,
    statements: { speaker: string; text: string }[],
  ) => Req[];
  dropWithdrawnRequirements: (requirements: Req[]) => Req[];
  narrowSharedStatements: (requirements: Req[]) => Req[];
  keepMarketComparisonsOpen: (uncertainties: Unc[], before: Unc[]) => Unc[];
  preserveContradictions: (next: Contra[], before: Contra[]) => Contra[];
  applyIntakeHygiene: (
    next: {
      requirements: Req[];
      uncertainties: Unc[];
      contradictions: Contra[];
    },
    before: { uncertainties: Unc[]; contradictions: Contra[] },
    jdText: string | undefined,
    statements: { speaker: string; text: string }[],
  ) => { requirements: Req[]; uncertainties: Unc[]; contradictions: Contra[] };
}

function loadArtifactHygiene(): Hygiene {
  const html = fs.readFileSync(
    path.resolve(process.cwd(), "artifact/talentos-lite.html"),
    "utf8",
  );
  const start = html.indexOf("/* ── Canonical IR hygiene");
  const end = html.indexOf("/* ── Deterministic composer");
  expect(start, "hygiene block not found in the artifact").toBeGreaterThan(-1);
  expect(end, "composer marker not found in the artifact").toBeGreaterThan(
    start,
  );
  const block = html.slice(start, end);
  return new Function(
    `${block}\nreturn { reconcileRequirementOrigins, dropWithdrawnRequirements, narrowSharedStatements, keepMarketComparisonsOpen, preserveContradictions, applyIntakeHygiene };`,
  )() as Hygiene;
}

const h = loadArtifactHygiene();

const req = (over: Partial<Req>): Req => ({
  label: "Manage a brigade of 22",
  statement: "Manage a brigade of 22.",
  definition: "Runs the kitchen's line.",
  kind: "must_have",
  origin: "jd",
  evidenceSpec: [],
  falseSignals: [],
  status: "explicit",
  linkedUncertaintyIds: [],
  ...over,
});

const unc = (over: Partial<Unc>): Unc => ({
  id: "unc-rate",
  about: "The rate, and how it compares with the Northern Virginia market",
  kind: "missing_information",
  consequence: "Outreach cannot be priced honestly.",
  consequential: true,
  status: "open",
  ...over,
});

const JD = "Executive Chef — Telluride. Manage a brigade of 22.";
const said = {
  speaker: "board_president",
  text: "A brigade of twenty-two here is really two brigades, restaurant and banquet.",
};

describe("artifact · S-4 withdrawn requirements are removed", () => {
  it("removes a withdrawn requirement and keeps the live one", () => {
    const out = h.dropWithdrawnRequirements([
      req({ label: "BSEE (withdrawn)", kind: "preferred" }),
      req({ label: "Virginia journeyman electrician license" }),
    ]);
    expect(out.map((r) => r.label)).toEqual([
      "Virginia journeyman electrician license",
    ]);
  });

  it("keeps a live requirement that merely discusses a withdrawal", () => {
    expect(
      h.dropWithdrawnRequirements([
        req({
          label: "Texas Licensed Court Interpreter (Master level)",
          definition: "the withdrawn 'native speaker' line was gesturing at it",
        }),
      ]),
    ).toHaveLength(1);
  });
});

describe("artifact · S-2 origin follows the statement", () => {
  it("flips a JD origin to the speaker who actually said it", () => {
    const [out] = h.reconcileRequirementOrigins(
      [req({ statement: said.text })],
      JD,
      [said],
    );
    expect(out.origin).toBe("manager_statement");
    expect(out.assertedBy).toBe("board_president");
  });

  it("leaves a genuinely JD-sourced requirement alone", () => {
    expect(h.reconcileRequirementOrigins([req({})], JD, [said])[0].origin).toBe(
      "jd",
    );
  });

  it("does not guess when the statement matches no source", () => {
    expect(
      h.reconcileRequirementOrigins(
        [req({ statement: "Something nobody in this search ever said." })],
        JD,
        [said],
      )[0].origin,
    ).toBe("jd");
  });
});

describe("artifact · S-10 one requirement, one source phrase", () => {
  const turn =
    "The credential is state law, done. Five years as AP is a guide, not a bar. Instructional leader means they have coached teachers through observation cycles.";

  it("narrows a shared statement to the sentence that asserts each", () => {
    const out = h.narrowSharedStatements([
      req({ label: "Administrative Services Credential", statement: turn }),
      req({ label: "Instructional leader", statement: turn }),
    ]);
    expect(out[0].statement).toBe("The credential is state law, done.");
    expect(out[1].statement).toMatch(/^Instructional leader means/);
    for (const r of out) expect(turn).toContain(r.statement);
  });

  it("leaves a statement only one requirement carries", () => {
    expect(
      h.narrowSharedStatements([req({ statement: turn })])[0].statement,
    ).toBe(turn);
  });

  it("leaves a shared statement alone when no sentence clearly wins", () => {
    const vague = "We need someone good. They should be good.";
    const out = h.narrowSharedStatements([
      req({ label: "Excellence", statement: vague }),
      req({ label: "Quality", statement: vague }),
    ]);
    expect(out.every((r) => r.statement === vague)).toBe(true);
  });
});

describe("artifact · S-3 market comparisons stay open", () => {
  it("reverts a comparison closed by the manager's own figure", () => {
    const resolved = unc({
      status: "resolved",
      resolution: "Forty-two an hour.",
    });
    const [out] = h.keepMarketComparisonsOpen([resolved], [unc({})]);
    expect(out.status).toBe("open");
    expect(out.resolution).toBeUndefined();
    expect(out.consequence).toContain("Forty-two an hour.");
  });

  it("leaves an ordinary resolved uncertainty alone", () => {
    const plain = unc({
      id: "unc-shift",
      about: "Whether the post is nights or a rotating pattern",
      status: "resolved",
      resolution: "Nights, fixed.",
    });
    expect(
      h.keepMarketComparisonsOpen([plain], [{ ...plain, status: "open" }])[0]
        .status,
    ).toBe("resolved");
  });

  it("leaves one that was already resolved before this turn", () => {
    const already = unc({ status: "resolved", resolution: "Benchmarked." });
    expect(h.keepMarketComparisonsOpen([already], [already])[0].status).toBe(
      "resolved",
    );
  });
});

const contra = (over: Partial<Contra>): Contra => ({
  claimA: {
    text: "Mission alignment is a must-have for me.",
    provenance: "manager_statement",
  },
  claimB: {
    text: "Mission alignment is nice-to-have; we've been flexible.",
    provenance: "manager_statement",
  },
  note: "Two stakeholders, unreconciled.",
  status: "open",
  ...over,
});

describe("artifact · S-11 a contradiction never leaves by omission", () => {
  it("carries a prior contradiction the reasoner stopped emitting", () => {
    const out = h.preserveContradictions([], [contra({})]);
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("open");
    expect(out[0].note).toContain("Carried forward");
  });

  it("does not duplicate one whose claims were reworded on resolution", () => {
    const out = h.preserveContradictions(
      [
        contra({
          claimB: {
            text: "Mission alignment is nice-to-have.",
            provenance: "manager_statement",
          },
          status: "resolved",
          resolution: "It stays a must-have.",
        }),
      ],
      [contra({})],
    );
    expect(out).toHaveLength(1);
    expect(out[0].status).toBe("resolved");
  });

  it("matches the same disagreement with its sides swapped", () => {
    const prior = contra({});
    expect(
      h.preserveContradictions(
        [
          contra({
            claimA: prior.claimB,
            claimB: prior.claimA,
            status: "resolved",
          }),
        ],
        [prior],
      ),
    ).toHaveLength(1);
  });

  it("keeps a genuinely different contradiction alongside the carried one", () => {
    expect(
      h.preserveContradictions(
        [
          contra({
            claimA: {
              text: "The board sees finalists before I choose.",
              provenance: "manager_statement",
            },
            claimB: {
              text: "Hiring is entirely my decision.",
              provenance: "jd",
            },
          }),
        ],
        [contra({})],
      ),
    ).toHaveLength(2);
  });

  it("does not append the carried note twice across turns", () => {
    const once = h.preserveContradictions([], [contra({})]);
    expect(
      h.preserveContradictions([], once)[0].note?.match(/Carried forward/g),
    ).toHaveLength(1);
  });
});

describe("artifact · all five compose on one turn", () => {
  it("drops, reattributes, reopens and carries in a single pass", () => {
    const out = h.applyIntakeHygiene(
      {
        requirements: [
          req({ label: "BSEE (withdrawn)", kind: "preferred" }),
          req({ statement: said.text }),
        ],
        uncertainties: [
          unc({ status: "resolved", resolution: "Forty-two an hour." }),
        ],
        contradictions: [],
      },
      { uncertainties: [unc({})], contradictions: [contra({})] },
      JD,
      [said],
    );
    expect(out.requirements).toHaveLength(1);
    expect(out.requirements[0].origin).toBe("manager_statement");
    expect(out.uncertainties[0].status).toBe("open");
    expect(out.contradictions).toHaveLength(1);
    expect(out.contradictions[0].note).toContain("Carried forward");
  });
});

describe("artifact · the W12 rules reached the prompts", () => {
  const html = fs.readFileSync(
    path.resolve(process.cwd(), "artifact/talentos-lite.html"),
    "utf8",
  );

  it("carries the shared rule block into both canonical-IR tasks", () => {
    expect(html).toContain("const IR_RULES =");
    // The derivation task and the intake reasoner both interpolate it —
    // five of the W12 failures were at the derivation step, which
    // originally had none of these rules.
    expect(html.match(/\$\{IR_RULES\}/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("makes the canonical IR the source of truth in assembled context", () => {
    expect(html).toContain("SOURCE OF TRUTH");
    expect(html).toContain("do NOT re-derive requirements from the job");
  });

  it("states each fix the corpus proved", () => {
    for (const rule of [
      "ONE REQUIREMENT, ONE SOURCE PHRASE",
      "FALSE SIGNALS ARE NOT OPTIONAL",
      "PROXIES BY NAME",
      "STATUS IS ABOUT DEFINITION",
      "WITHDRAWN REQUIREMENTS LEAVE THE SET",
      "PROVENANCE MOVES TOGETHER",
      "A CONTRADICTION NEVER LEAVES BY OMISSION",
    ]) {
      expect(html, `missing rule: ${rule}`).toContain(rule);
    }
  });
});
