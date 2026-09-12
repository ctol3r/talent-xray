/**
 * robots.txt as a table: one row per rule, each chosen to pin a behaviour a
 * naive implementation gets wrong.
 */
import { describe, expect, it } from "vitest";
import {
  canonicalisePattern,
  MAX_RULES,
  MAX_WILDCARDS,
  parseRobots,
  patternMatches,
  PRODUCT_TOKEN,
  robotsAllows,
} from "@/lib/fetch/robots";

const ME = PRODUCT_TOKEN;

function allows(body: string, path: string, token = ME): boolean {
  return robotsAllows(
    parseRobots(body, token),
    new URL(`https://h.example${path}`),
  ).allowed;
}

describe("the product token", () => {
  it("is writable in a robots file: letters and hyphens only", () => {
    expect(ME).toMatch(/^[a-z-]+$/u);
  });
});

describe("group selection", () => {
  it("a file with no groups allows everything", () => {
    expect(allows("# nothing here\n", "/team")).toBe(true);
  });

  it("uses the star group when nothing names us", () => {
    expect(allows("User-agent: *\nDisallow: /team\n", "/team")).toBe(false);
  });

  it("prefers a group that names us, and does not union the star group", () => {
    const body = `User-agent: *\nDisallow: /\n\nUser-agent: ${ME}\nDisallow: /admin\n`;
    expect(allows(body, "/team")).toBe(true);
    expect(allows(body, "/admin")).toBe(false);
  });

  it("a group naming us AND the star still counts as naming us", () => {
    const body = `User-agent: *\nUser-agent: ${ME}\nDisallow: /x\n\nUser-agent: *\nDisallow: /\n`;
    expect(allows(body, "/team")).toBe(true);
  });

  it("a named group with no rules still suppresses the star fallback", () => {
    const body = `User-agent: *\nDisallow: /\n\nUser-agent: ${ME}\nDisallow:\n`;
    expect(allows(body, "/anything")).toBe(true);
  });

  it("matches the token whole, never as a substring", () => {
    expect(allows("User-agent: reader\nDisallow: /\n", "/team")).toBe(true);
    expect(allows("User-agent: some-other-bot\nDisallow: /\n", "/team")).toBe(
      true,
    );
  });

  it("truncates a robots-side value carrying a version or trailing words", () => {
    expect(allows(`User-agent: ${ME}/1.0\nDisallow: /team\n`, "/team")).toBe(
      false,
    );
    expect(
      allows(
        `User-agent: ${ME.toUpperCase()} Reader\nDisallow: /team\n`,
        "/team",
      ),
    ).toBe(false);
  });

  it("merges every group carrying our token", () => {
    const body = `User-agent: ${ME}\nDisallow: /a\n\nUser-agent: ${ME}\nDisallow: /b\n`;
    expect(allows(body, "/a")).toBe(false);
    expect(allows(body, "/b")).toBe(false);
  });

  it("discards allow and disallow lines that precede any user-agent line", () => {
    expect(
      allows("Disallow: /team\nUser-agent: *\nDisallow: /x\n", "/team"),
    ).toBe(true);
  });
});

describe("parsing", () => {
  it("reads field names case-insensitively, with loose whitespace", () => {
    expect(allows("USER-AGENT :*\n  DISALLOW:/team\n", "/team")).toBe(false);
  });

  it("strips a comment anywhere on the line", () => {
    expect(
      allows("User-agent: * # everyone\nDisallow: /team # private\n", "/team"),
    ).toBe(false);
    // A literal # in a path therefore has to be written %23.
    expect(
      parseRobots("User-agent: *\nDisallow: /team # private\n").rules[0]
        .pattern,
    ).toBe("/team");
  });

  it("strips a byte-order mark rather than losing the first group", () => {
    expect(allows("﻿User-agent: *\nDisallow: /team\n", "/team")).toBe(false);
  });

  it("accepts CR, LF and CRLF", () => {
    expect(allows("User-agent: *\r\nDisallow: /team\r\n", "/team")).toBe(false);
    expect(allows("User-agent: *\rDisallow: /team\r", "/team")).toBe(false);
  });

  it("skips a bad line and keeps the file", () => {
    const policy = parseRobots("User-agent: *\n!!!\nDisallow: /team\n");
    expect(policy.unreadable).toBe(1);
    expect(
      robotsAllows(policy, new URL("https://h.example/team")).allowed,
    ).toBe(false);
  });

  it("does not repair a misspelt directive", () => {
    expect(allows("User-agent: *\nDisalow: /team\n", "/team")).toBe(true);
  });

  it("does not let a non-group record close a group", () => {
    const body =
      "User-agent: *\nCrawl-delay: 5\nSitemap: https://h.example/s.xml\nDisallow: /team\n";
    expect(allows(body, "/team")).toBe(false);
    expect(parseRobots(body).crawlDelaySeconds).toBe(5);
  });

  it("reads Request-rate as an interval, not a count", () => {
    // Five documents a minute is a twelve-second gap.
    expect(
      parseRobots("User-agent: *\nRequest-rate: 5/1m\n").crawlDelaySeconds,
    ).toBe(12);
  });
});

describe("matching", () => {
  it("is a prefix match, anchored at the start", () => {
    expect(allows("User-agent: *\nDisallow: /team\n", "/teams/list")).toBe(
      false,
    );
    expect(allows("User-agent: *\nDisallow: /team\n", "/our/team")).toBe(true);
  });

  it("honours * and a terminal $", () => {
    expect(allows("User-agent: *\nDisallow: /*/private\n", "/a/private")).toBe(
      false,
    );
    expect(allows("User-agent: *\nDisallow: /*.pdf$\n", "/cv.pdf")).toBe(false);
    expect(allows("User-agent: *\nDisallow: /*.pdf$\n", "/cv.pdf?x=1")).toBe(
      true,
    );
  });

  it("matches against the query as well as the path", () => {
    expect(allows("User-agent: *\nDisallow: /*?\n", "/search?q=a")).toBe(false);
    expect(allows("User-agent: *\nDisallow: /*?\n", "/search")).toBe(true);
  });

  it("gives the longest pattern the decision, and a tie to Allow", () => {
    const body = "User-agent: *\nDisallow: /team\nAllow: /team/people\n";
    expect(allows(body, "/team/people")).toBe(true);
    expect(allows(body, "/team/other")).toBe(false);
    expect(allows("User-agent: *\nDisallow: /x\nAllow: /x\n", "/x")).toBe(true);
  });

  it("measures length on the canonicalised pattern", () => {
    // `/café/x` is longer than `/caf%C3%A9/` only after both are encoded.
    const body = "User-agent: *\nDisallow: /café/x\nAllow: /caf%C3%A9/\n";
    expect(allows(body, "/caf%C3%A9/x")).toBe(false);
  });

  it("canonicalises the pattern and the path identically", () => {
    expect(allows("User-agent: *\nDisallow: /café/\n", "/caf%C3%A9/x")).toBe(
      false,
    );
    expect(canonicalisePattern("/a%2fb")).toBe("/a%2Fb");
    // %2F is not a slash, and treating it as one walks through the rule.
    expect(allows("User-agent: *\nDisallow: /a/b\n", "/a%2Fb")).toBe(true);
  });

  it("resolves dot segments before matching, as the URL parse does", () => {
    const url = new URL("https://h.example/a/../team");
    expect(
      robotsAllows(parseRobots("User-agent: *\nDisallow: /team\n"), url)
        .allowed,
    ).toBe(false);
  });

  it("an empty Disallow disallows nothing", () => {
    expect(allows("User-agent: *\nDisallow:\n", "/anything")).toBe(true);
  });

  it("quotes the line that decided it", () => {
    const decision = robotsAllows(
      parseRobots("User-agent: *\nDisallow: /team\n"),
      new URL("https://h.example/team"),
    );
    expect(decision.rule).toBe("Disallow: /team");
  });
});

describe("what a hostile or careless file cannot do", () => {
  it("a star line with trailing words is still the star group", () => {
    // Recognising `*` only on exact equality drops the group entirely, which
    // turns a site-wide block into no rules at all.
    expect(
      allows("User-agent: * baiduspider\nDisallow: /team\n", "/team"),
    ).toBe(false);
    expect(allows("User-agent: *\t\nDisallow: /team\n", "/team")).toBe(false);
  });

  it("a non-user-agent line closes the group, so a per-bot block stays per-bot", () => {
    const body =
      "User-agent: *\nCrawl-delay: 10\nUser-agent: some-other-bot\nDisallow: /\n";
    expect(allows(body, "/team")).toBe(true);
    expect(parseRobots(body).crawlDelaySeconds).toBe(10);
    const withSitemap =
      "User-agent: *\nSitemap: https://h.example/s.xml\nUser-agent: some-other-bot\nDisallow: /\n";
    expect(allows(withSitemap, "/team")).toBe(true);
  });

  it("keeps the stricter of Crawl-delay and Request-rate, whichever came first", () => {
    expect(
      parseRobots("User-agent: *\nRequest-rate: 1/30s\nCrawl-delay: 5\n")
        .crawlDelaySeconds,
    ).toBe(30);
    expect(
      parseRobots("User-agent: *\nCrawl-delay: 30\nRequest-rate: 1/5s\n")
        .crawlDelaySeconds,
    ).toBe(30);
  });

  it("truncates an over-wild refusal and drops an over-wild permission", () => {
    // Both directions err toward reading less: a truncated Disallow matches
    // more, and a dropped Allow permits less.
    const wild = "*x".repeat(MAX_WILDCARDS + 5);
    // The full pattern needs 25 x's; truncated at the cap it needs 20, so a
    // path with 22 is refused by the truncation and would not have been by the
    // pattern as written. That is the safe direction.
    const path = "/" + "x".repeat(MAX_WILDCARDS + 2);
    expect(allows(`User-agent: *\nDisallow: /${wild}\n`, path)).toBe(false);
    const policy = parseRobots(`User-agent: *\nDisallow: /\nAllow: /${wild}\n`);
    expect(policy.rules.filter((r) => r.allow)).toHaveLength(0);
    expect(policy.unreadable).toBe(1);
  });

  it("stops reading permissions past the rule cap, and refusals past twice it", () => {
    const many = (kind: string, n: number) =>
      Array.from({ length: n }, (_, i) => `${kind}: /p${i}`).join("\n");
    const policy = parseRobots(
      `User-agent: *\n${many("Allow", MAX_RULES + 50)}\n`,
    );
    expect(policy.rules.length).toBe(MAX_RULES);
    const refusals = parseRobots(
      `User-agent: *\n${many("Disallow", MAX_RULES * 2 + 50)}\n`,
    );
    expect(refusals.rules.length).toBe(MAX_RULES * 2);
  });

  it("answers a pathological pattern correctly, and quickly", () => {
    const pattern = "/" + "*a".repeat(MAX_WILDCARDS);
    const path = "/" + "a".repeat(2000);
    const started = performance.now();
    expect(patternMatches(pattern, path)).toBe(true);
    expect(patternMatches(pattern, "/" + "a".repeat(5))).toBe(false);
    expect(performance.now() - started).toBeLessThan(250);
  });
});
