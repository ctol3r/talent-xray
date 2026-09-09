/**
 * How one typed string becomes blocks in the command menu.
 *
 * The classification itself is tested where it lives. What is tested here is
 * the promise made to somebody the classifier got wrong: the alternatives are
 * always on screen, always in a fixed order under the guess, and always one
 * Tab away.
 */
import { describe, expect, it } from "vitest";
import {
  INTENT_FALLBACK,
  flatten,
  intentGroups,
  nextIntentIndex,
  orderIntents,
  searchHref,
  sourcingHref,
  type CommandIntent,
  type IntentRow,
} from "@/lib/domain/command-intents";

const JUMPS: IntentRow[] = [
  { id: "p1", label: "St Pancras ICU RN", hint: "Nurse hiring", href: "/a" },
  { id: "p2", label: "Nursing lead", hint: "Nurse hiring", href: "/b" },
];

const SPECIALIST = { name: "Sourcer", does: "where people are", mark: "🔭" };

function build(ranked: CommandIntent[], query = "nurse") {
  return intentGroups({ ranked, query, jumps: JUMPS, specialist: SPECIALIST });
}

describe("the order the blocks come in", () => {
  it("puts the classifier's strongest intent first", () => {
    expect(build(["scour"]).map((g) => g.intent)).toEqual([
      "scour",
      "jump",
      "filter",
      "ask",
    ]);
    expect(build(["ask", "jump"]).map((g) => g.intent)).toEqual([
      "ask",
      "jump",
      "filter",
      "scour",
    ]);
  });

  it("keeps every other intent, because that is how a wrong guess is undone", () => {
    // The whole point: a classification you disagree with costs a Tab, not a
    // retype. So nothing is dropped for being unlikely.
    for (const ranked of [[], ["jump"], ["filter"]] as CommandIntent[][]) {
      expect(
        build(ranked)
          .map((g) => g.intent)
          .sort(),
      ).toEqual([...INTENT_FALLBACK].sort());
    }
  });

  it("ignores a repeated or unknown intent rather than trusting it", () => {
    expect(orderIntents(["ask", "ask"])).toEqual([
      "ask",
      "jump",
      "filter",
      "scour",
    ]);
    expect(orderIntents(["nonsense" as CommandIntent, "scour"])[0]).toBe(
      "scour",
    );
  });

  it("leaves out a block with nothing in it", () => {
    const groups = intentGroups({
      ranked: ["jump"],
      query: "nobody by that name",
      jumps: [],
      specialist: SPECIALIST,
    });
    expect(groups.map((g) => g.intent)).toEqual(["filter", "scour", "ask"]);
  });

  it("has nothing to offer an empty string", () => {
    expect(build([], "   ")).toEqual([]);
  });
});

describe("what each block does with the string", () => {
  it("sends a filter and a brief to their own result view, as typed", () => {
    const groups = build(["filter"], 'skill:robotics loc:"united kingdom"');
    const filter = groups.find((g) => g.intent === "filter")!;
    const scour = groups.find((g) => g.intent === "scour")!;
    expect(filter.rows[0].href).toBe(
      searchHref('skill:robotics loc:"united kingdom"'),
    );
    expect(scour.rows[0].href).toBe(
      sourcingHref('skill:robotics loc:"united kingdom"'),
    );
    expect(filter.rows[0].href).toContain("%3A");
  });

  it("names the specialist a question would reach, and runs rather than goes", () => {
    const ask = build(["ask"], "why is nobody replying").find(
      (g) => g.intent === "ask",
    )!;
    expect(ask.rows[0].action).toBe("ask");
    expect(ask.rows[0].href).toBeUndefined();
    expect(ask.rows[0].hint).toContain("Sourcer");
  });

  it("counts the matches when the caller counted them", () => {
    const groups = intentGroups({
      ranked: ["filter"],
      query: "recruiter",
      jumps: JUMPS,
      specialist: SPECIALIST,
      matchCount: 12,
    });
    expect(groups[0].rows[0].hint).toBe("12 in the workspace");
  });

  it("drops the question when nothing would answer it", () => {
    const groups = intentGroups({
      ranked: ["ask"],
      query: "why is nobody replying",
      jumps: [],
    });
    expect(groups.map((g) => g.intent)).toEqual(["filter", "scour"]);
  });

  it("caps the jump block so the menu stays one screen", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      id: `p${i}`,
      label: `Person ${i}`,
      href: `/p/${i}`,
    }));
    const groups = intentGroups({
      ranked: ["jump"],
      query: "person",
      jumps: many,
      specialist: SPECIALIST,
    });
    expect(groups[0].rows).toHaveLength(8);
  });
});

describe("moving by intent rather than by row", () => {
  const groups = build(["jump"]);

  it("goes to the top of the next block, wherever it started in this one", () => {
    // jump has two rows, then filter, scour, ask have one each.
    expect(flatten(groups)).toHaveLength(5);
    expect(nextIntentIndex(groups, 0)).toBe(2);
    expect(nextIntentIndex(groups, 1)).toBe(2);
    expect(nextIntentIndex(groups, 2)).toBe(3);
  });

  it("wraps in both directions, so no block is unreachable", () => {
    expect(nextIntentIndex(groups, 4)).toBe(0);
    expect(nextIntentIndex(groups, 0, -1)).toBe(4);
    expect(nextIntentIndex(groups, 3, -1)).toBe(2);
  });

  it("survives an empty menu and an index that is nowhere", () => {
    expect(nextIntentIndex([], 3)).toBe(0);
    expect(nextIntentIndex(groups, -1)).toBe(2);
  });
});
