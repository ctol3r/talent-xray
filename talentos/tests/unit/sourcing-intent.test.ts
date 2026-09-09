/**
 * Reading a typed string.
 *
 * The table is the specification: every row is a string somebody could
 * plausibly type into the command bar, and the reading it must get. The rows
 * that matter most are the scour/ask boundary — an instruction describing a
 * population against a question about the work — because that is the pair a
 * classifier gets wrong quietly.
 */
import { describe, expect, it } from "vitest";
import {
  classifyIntent,
  type IndexedRecord,
  type Intent,
} from "@/lib/sourcing/intent";
import { parseQuery, tokenizeQuery } from "@/lib/sourcing/query-language";

/**
 * The workspace as the seed leaves it: one clinical job, one finance job, a
 * person on the first, the hospital behind it, a tag a recruiter typed, and
 * two of the app's own pages.
 */
const INDEX: readonly IndexedRecord[] = [
  {
    kind: "job",
    id: "j1",
    name: "St Pancras — ICU Registered Nurse",
    href: "/searches/j1",
  },
  {
    kind: "job",
    id: "j2",
    name: "Austin — Chief Financial Officer",
    href: "/searches/j2",
  },
  {
    kind: "person",
    id: "p1",
    name: "Priya Raman",
    href: "/searches/j1/candidates/p1",
  },
  {
    kind: "company",
    id: "c1",
    name: "St Pancras University Hospital",
    href: "/companies/c1",
  },
  { kind: "tag", id: "t1", name: "why they left", href: "/tags/why-they-left" },
  {
    kind: "page",
    id: "pg1",
    name: "Settings",
    href: "/settings",
    keywords: "keys billing",
  },
  {
    kind: "page",
    id: "pg2",
    name: "Strings",
    href: "/strings",
    keywords: "boolean x-ray query",
  },
];

interface Row {
  query: string;
  intent: Intent;
  /** The record a jump must land on, when the row is a jump. */
  record?: string;
  why: string;
}

const TABLE: readonly Row[] = [
  // --- the three that were asked for ---------------------------------------
  {
    query: "nurse",
    intent: "jump",
    record: "St Pancras — ICU Registered Nurse",
    why: "one word that names a record on file",
  },
  {
    query: "why is nobody replying",
    intent: "ask",
    why: "a question about the work, naming no population",
  },
  {
    query: 'skill:robotics loc:"united kingdom" has:email',
    intent: "filter",
    why: "three filters spelled out in the grammar",
  },

  // --- jump ----------------------------------------------------------------
  {
    query: "St Pancras",
    intent: "jump",
    record: "St Pancras — ICU Registered Nurse",
    why: "a prefix of two records; the job outranks the company",
  },
  {
    query: "Priya Raman",
    intent: "jump",
    record: "Priya Raman",
    why: "a person's name, exactly",
  },
  {
    query: "settings",
    intent: "jump",
    record: "Settings",
    why: "a page of the app is a record like any other",
  },
  {
    query: "boolean",
    intent: "jump",
    record: "Strings",
    why: "matches a page on its hidden keywords",
  },

  // --- filter --------------------------------------------------------------
  {
    query: "loc:london",
    intent: "filter",
    why: "one filter is still a filter",
  },
  {
    query: "recruiter -closed",
    intent: "filter",
    why: "an exclusion is the grammar's, even with no field named",
  },
  {
    query: 'title:"head of talent" -site:linkedin.com after:2022',
    intent: "filter",
    why: "fields, an exclusion and a date window",
  },

  // --- scour ---------------------------------------------------------------
  {
    query: "find me ICU nurses in london",
    intent: "scour",
    why: "an instruction, a population and a place",
  },
  {
    query: "list every registered nurse with NMC registration",
    intent: "scour",
    why: "an imperative over a described population",
  },
  {
    query: "look for perception engineers who have shipped to production",
    intent: "scour",
    why: "a two-word imperative still opens an instruction",
  },
  {
    query: "can you find me nurses?",
    intent: "scour",
    why: "an instruction wearing a question's clothes; the manners are not the question",
  },

  // --- ask -----------------------------------------------------------------
  {
    query: "how many nurses are in the pipeline",
    intent: "ask",
    why: "counts a population already held; it does not describe one to find",
  },
  {
    query: "should I widen the location",
    intent: "ask",
    why: "asks for a judgement, names nobody",
  },
  {
    query: "what is a good response rate",
    intent: "ask",
    why: "a question about the craft",
  },
  {
    query: "the response rate on this job is bad",
    intent: "ask",
    why: "a sentence with glue, no filter and no population",
  },
];

describe("classifyIntent", () => {
  for (const row of TABLE) {
    it(`reads ${JSON.stringify(row.query)} as ${row.intent} — ${row.why}`, () => {
      const result = classifyIntent(row.query, INDEX);
      expect(result.intent).toBe(row.intent);
      expect(result.candidates[0].intent).toBe(row.intent);
      if (row.record !== undefined) {
        expect(result.candidates[0].records[0]?.record.name).toBe(row.record);
      }
    });
  }
});

/**
 * The boundary the brief called the hard one. Both readings are defensible on
 * these, so both have to come back — the caller offers a choice rather than
 * guessing at one.
 */
describe("the scour / ask boundary", () => {
  const AMBIGUOUS: readonly { query: string; leader: Intent; also: Intent }[] =
    [
      // A question whose answer is a population.
      {
        query: "who has hired robotics engineers",
        leader: "scour",
        also: "ask",
      },
      {
        query: "where are the robotics engineers",
        leader: "scour",
        also: "ask",
      },
    ];

  for (const row of AMBIGUOUS) {
    it(`offers both readings of ${JSON.stringify(row.query)}`, () => {
      const result = classifyIntent(row.query, INDEX);
      expect(result.intent).toBe(row.leader);
      expect(result.ambiguous).toBe(true);
      expect(result.candidates.map((c) => c.intent)).toContain(row.also);
    });
  }

  const DECIDED: readonly { query: string; intent: Intent; not: Intent }[] = [
    // An imperative settles it even though a population is named.
    { query: "find me ICU nurses in london", intent: "scour", not: "ask" },
    // An interrogative settles it when no population is named.
    { query: "why is nobody replying", intent: "ask", not: "scour" },
    {
      query: "how many nurses are in the pipeline",
      intent: "ask",
      not: "scour",
    },
  ];

  for (const row of DECIDED) {
    it(`does not hedge on ${JSON.stringify(row.query)}`, () => {
      const result = classifyIntent(row.query, INDEX);
      expect(result.intent).toBe(row.intent);
      expect(result.ambiguous).toBe(false);
      expect(result.candidates.map((c) => c.intent)).not.toContain(row.not);
    });
  }
});

describe("ambiguity", () => {
  it("returns both readings when a string is a record name and a question", () => {
    const result = classifyIntent("why they left", INDEX);
    expect(result.intent).toBe("jump");
    expect(result.ambiguous).toBe(true);
    const intents = result.candidates.map((c) => c.intent);
    expect(intents).toContain("jump");
    expect(intents).toContain("ask");
    expect(result.candidates[0].records[0]?.record.kind).toBe("tag");
  });

  it("ranks candidates by confidence, highest first", () => {
    for (const row of TABLE) {
      const { candidates } = classifyIntent(row.query, INDEX);
      for (let i = 1; i < candidates.length; i += 1) {
        expect(candidates[i - 1].confidence).toBeGreaterThanOrEqual(
          candidates[i].confidence,
        );
      }
    }
  });

  it("always returns at least one reading, and the leader is the intent", () => {
    for (const row of [...TABLE, { query: "zzzznotathinganywhere" }]) {
      const result = classifyIntent(row.query, INDEX);
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.intent).toBe(result.candidates[0].intent);
    }
  });

  it("says why, in the words of the evidence", () => {
    const result = classifyIntent('skill:robotics loc:"london"', INDEX);
    expect(result.candidates[0].why).toContain("skill:");
    expect(result.candidates[0].why).toContain("loc:");
  });
});

describe("the parse comes back attached", () => {
  it("hands over the same brief parseQuery would give, so nobody parses twice", () => {
    for (const row of TABLE) {
      const result = classifyIntent(row.query, INDEX);
      expect(result.brief).toEqual(parseQuery(row.query, { expand: false }));
    }
  });

  it("hands over the token stream too", () => {
    const result = classifyIntent("skill:robotics -closed", INDEX);
    expect(result.tokens).toEqual(tokenizeQuery("skill:robotics -closed"));
    expect(result.tokens[0].canonicalField).toBe("skill");
    expect(result.tokens[1].negated).toBe(true);
  });

  it("reads an unknown field as a keyword, not as a filter", () => {
    const result = classifyIntent("wibble:robotics", INDEX);
    expect(result.intent).not.toBe("filter");
    expect(result.brief.warnings.join(" ")).toContain("unknown filter");
  });
});

describe("determinism", () => {
  const QUERIES = [
    ...TABLE.map((r) => r.query),
    "why they left",
    "who has hired robotics engineers",
    "",
  ];

  it("gives the same answer every time", () => {
    for (const query of QUERIES) {
      const first = JSON.stringify(classifyIntent(query, INDEX));
      for (let i = 0; i < 25; i += 1) {
        expect(JSON.stringify(classifyIntent(query, INDEX))).toBe(first);
      }
    }
  });

  it("does not depend on the order the index arrives in", () => {
    const reversed = [...INDEX].reverse();
    for (const query of QUERIES) {
      expect(classifyIntent(query, reversed)).toEqual(
        classifyIntent(query, INDEX),
      );
    }
  });

  it("touches the network for nothing", () => {
    const real = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = ((): never => {
      calls += 1;
      throw new Error("the classifier must not reach the network");
    }) as typeof fetch;
    try {
      for (const query of QUERIES) classifyIntent(query, INDEX);
    } finally {
      globalThis.fetch = real;
    }
    expect(calls).toBe(0);
  });
});

describe("edges", () => {
  it("reads an empty string as nothing, at zero confidence", () => {
    const result = classifyIntent("   ", INDEX);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].confidence).toBe(0);
    expect(result.candidates[0].why).toBe("nothing typed");
  });

  it("never offers a jump when no index is passed", () => {
    const result = classifyIntent("nurse");
    expect(result.candidates.map((c) => c.intent)).not.toContain("jump");
  });

  it("does not hunt for records inside a filter expression", () => {
    const result = classifyIntent("loc:london skill:nurse", INDEX);
    expect(result.intent).toBe("filter");
    for (const candidate of result.candidates) {
      expect(candidate.records).toEqual([]);
    }
  });

  it("keeps every confidence inside 0..1", () => {
    for (const query of [...TABLE.map((r) => r.query), "find find find"]) {
      for (const c of classifyIntent(query, INDEX).candidates) {
        expect(c.confidence).toBeGreaterThanOrEqual(0);
        expect(c.confidence).toBeLessThanOrEqual(1);
      }
    }
  });
});
