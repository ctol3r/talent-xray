/**
 * Wave H2 acceptance: the per-candidate profile sweep.
 *
 * The properties that matter: a string never leaves over budget (Google
 * silently drops the tail, including the site restriction — proved in the
 * Wave P pilot), a string is always syntactically valid, no URL is ever
 * generated, exclusions follow the search's own surface policy, and a handle
 * is only searched for when it is distinctive enough to be worth it.
 */
import { describe, expect, it } from "vitest";
import {
  buildProfileSweep,
  familyExclusions,
  geographyTerms,
  handleFromLinks,
  handleIsPivotable,
  handleSpellings,
  sweepMentionsOffFamily,
} from "@/lib/domain/profile-sweep";
import {
  countTerms,
  GOOGLE_TERM_BUDGET,
  qaQuery,
} from "@/lib/domain/query-normalization";

const jordan = {
  name: "Jordan Rivera",
  employer: "Acme Robotics",
  geography: "Austin, TX",
  links: [{ url: "https://github.com/jrivera-dev" }],
  optIns: null,
};

describe("the strings themselves", () => {
  const sweep = buildProfileSweep(jordan);

  it("composes every template that has the inputs it needs", () => {
    expect(sweep.map((q) => q.key)).toEqual([
      "T1",
      "T1L",
      "T2",
      "T3",
      "T4",
      "T5",
    ]);
  });

  it("never emits a string over the term budget, and reports what it dropped", () => {
    for (const q of sweep) {
      expect(`${q.key} → ${countTerms(q.query) <= GOOGLE_TERM_BUDGET}`).toBe(
        `${q.key} → true`,
      );
      expect(q.terms).toBe(countTerms(q.query));
    }
    // T1 carries the full exclusion list and still fits, so nothing is
    // dropped; a longer name would push some out and they would be named.
    const t1 = sweep.find((q) => q.key === "T1")!;
    expect(t1.omittedExclusions).toEqual([]);
  });

  it("emits only syntactically valid strings", () => {
    for (const q of sweep) {
      const problems = qaQuery(q.query, "Google (open web)").filter(
        (w) => w.code !== "over_budget",
      );
      expect(`${q.key} → ${problems.map((p) => p.code).join(",")}`).toBe(
        `${q.key} → `,
      );
    }
  });

  it("never generates a profile URL — a sweep produces searches, nothing else", () => {
    for (const q of sweep) {
      expect(q.query).not.toMatch(/https?:\/\//);
    }
  });

  it("quotes the name and searches the employer both ways", () => {
    const t1 = sweep.find((q) => q.key === "T1")!;
    expect(t1.query).toContain('"Jordan Rivera"');
    expect(t1.query).toContain('("Acme Robotics" OR Acme)');
    expect(t1.query).toContain("(Austin OR TX)");
  });

  it("sends registry and roster searches to the second engine", () => {
    expect(sweep.find((q) => q.key === "T3")?.engine).toBe("reach");
    expect(sweep.find((q) => q.key === "T5")?.engine).toBe("reach");
    expect(sweep.find((q) => q.key === "T1")?.engine).toBe("core");
  });

  it("keeps the LinkedIn search restricted to profile paths", () => {
    const t1l = sweep.find((q) => q.key === "T1L")!;
    expect(t1l.query).toContain(
      "(site:linkedin.com/in OR site:linkedin.com/pub)",
    );
    // No exclusions on a string already restricted to one host.
    expect(t1l.query).not.toContain("-site:");
  });
});

describe("the search's surface policy travels into the search", () => {
  it("excludes off surfaces, in a fixed order, most useful first", () => {
    const exclusions = familyExclusions(null);
    expect(exclusions[0]).toBe("-site:scribd.com");
    expect(exclusions).toContain("-site:facebook.com");
    expect(exclusions).toContain("-site:zoominfo.com");
    expect(exclusions).toContain("-site:x.com");
  });

  it("stops excluding a surface the search has turned on", () => {
    const optIns = {
      mixed_broadcast: {
        reason: "public writing matters here",
        at: "2026-09-07",
      },
    };
    const exclusions = familyExclusions(optIns);
    expect(exclusions).not.toContain("-site:x.com");
    expect(exclusions).toContain("-site:facebook.com");
    const sweep = buildProfileSweep({ ...jordan, optIns });
    expect(sweep.find((q) => q.key === "T1")!.query).not.toContain(
      "-site:x.com",
    );
  });

  it("notices when a string would search a surface this search has off", () => {
    expect(
      sweepMentionsOffFamily('"Jordan Rivera" site:facebook.com', null),
    ).toBe(true);
    expect(
      sweepMentionsOffFamily('"Jordan Rivera" -site:facebook.com', null),
    ).toBe(false);
    expect(
      sweepMentionsOffFamily('"Jordan Rivera" site:linkedin.com/in', null),
    ).toBe(false);
  });
});

describe("handles", () => {
  it("searches for a handle only when it is not just the person's name", () => {
    expect(handleIsPivotable("jrivera-dev", "Jordan Rivera")).toBe(true);
    expect(handleIsPivotable("jordanrivera", "Jordan Rivera")).toBe(false);
    expect(handleIsPivotable("jrivera", "Jordan Rivera")).toBe(false);
    expect(handleIsPivotable("jordan.rivera", "Jordan Rivera")).toBe(false);
    expect(handleIsPivotable("rivera", "Jordan Rivera")).toBe(false);
    expect(handleIsPivotable("dev", "Jordan Rivera")).toBe(false);
    expect(handleIsPivotable("admin", "Jordan Rivera")).toBe(false);
    expect(handleIsPivotable("zx9", "Jordan Rivera")).toBe(false);
  });

  it("takes a handle from a platform where people choose one, never from a LinkedIn slug", () => {
    expect(
      handleFromLinks(
        [{ url: "https://www.linkedin.com/in/jordan-rivera-1a2b" }],
        "Jordan Rivera",
      ),
    ).toBeNull();
    expect(
      handleFromLinks(
        [{ url: "https://github.com/jrivera-dev" }],
        "Jordan Rivera",
      ),
    ).toEqual({ handle: "jrivera-dev", originHost: "github.com" });
  });

  it("searches the spellings a person actually uses, as text", () => {
    expect(handleSpellings("jrivera-dev")).toEqual([
      "jrivera-dev",
      "jrivera_dev",
      "jriveradev",
    ]);
  });

  it("omits the handle search when there is no distinctive handle", () => {
    const sweep = buildProfileSweep({
      ...jordan,
      links: [{ url: "https://github.com/jordanrivera" }],
    });
    expect(sweep.map((q) => q.key)).not.toContain("T2");
  });

  it("excludes the platform the handle came from, so the search finds somewhere new", () => {
    const t2 = buildProfileSweep(jordan).find((q) => q.key === "T2")!;
    expect(t2.query).toContain("-site:github.com");
    expect(t2.query).toContain('"jrivera-dev"');
  });
});

describe("thin inputs", () => {
  it("still composes what it can with no employer and no place", () => {
    const sweep = buildProfileSweep({
      name: "Jordan Rivera",
      optIns: null,
    });
    expect(sweep.map((q) => q.key)).toEqual(["T1", "T1L", "T3", "T4", "T5"]);
    expect(sweep.every((q) => q.query.includes('"Jordan Rivera"'))).toBe(true);
  });

  it("refuses to compose anything for an empty name", () => {
    expect(buildProfileSweep({ name: "", optIns: null })).toEqual([]);
  });

  it("reads at most two place words, quoting the ones with spaces", () => {
    expect(geographyTerms("San Francisco, CA, USA")).toEqual([
      '"San Francisco"',
      "CA",
    ]);
    expect(geographyTerms(null)).toEqual([]);
  });
});
