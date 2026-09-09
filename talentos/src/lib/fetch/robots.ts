/**
 * robots.txt, to RFC 9309, as a pure function of the file's text.
 *
 * Two halves on purpose. This one takes a string and answers questions about
 * paths; the network half lives in `http.ts`. Splitting them is what lets the
 * whole rule set be tested against a table of files rather than a server, and
 * lets the browser build explain a refusal it cannot itself perform.
 *
 * One product token, not a list. The RFC's rule is that every group matching
 * the crawler is combined, so declaring both a specific token and a general
 * one means a site that writes a permissive rule for the specific one still
 * gets the general one's restrictions unioned on top — the opposite of what
 * whoever wrote the file intended. Declaring exactly one token removes the
 * question.
 */
import { PRODUCT_NAME } from "@/lib/product";

/**
 * The name a site writes to address this fetcher. Letters and hyphens only:
 * the RFC's product token has no room for a version or a slash, and a token
 * nobody can write in a robots file is a token nobody can address.
 */
export const PRODUCT_TOKEN = `${PRODUCT_NAME.toLowerCase().replace(/[^a-z]/gu, "")}-reader`;

export interface RobotsRule {
  allow: boolean;
  /** The pattern as canonicalised, which is also what its length is measured on. */
  pattern: string;
  /** The line as written, capped, so a refusal can quote the site's own words. */
  source: string;
}

export interface RobotsPolicy {
  /** True when a group naming this fetcher was found (not the `*` fallback). */
  named: boolean;
  rules: RobotsRule[];
  /** Seconds. Non-standard, widely deployed, and honoured here. */
  crawlDelaySeconds: number | null;
  /** Lines that could not be read. Reported, never repaired. */
  unreadable: number;
}

export const EMPTY_POLICY: RobotsPolicy = {
  named: false,
  rules: [],
  crawlDelaySeconds: null,
  unreadable: 0,
};

const MAX_SOURCE_LINE = 200;

/**
 * Caps on a remote file's ability to make us work.
 *
 * The matcher costs roughly one pass per wildcard per path character, so the
 * wildcard count is the number that matters — a pattern of forty stars against
 * a two-kilobyte path is eighty thousand comparisons on its own.
 *
 * A rule past a cap is not simply dropped, because dropping a `Disallow` would
 * fail open — a site that wrote a very long rule would find it ignored. So the
 * two directions are treated differently, and both err toward reading less: a
 * `Disallow` is truncated, which only makes it match more, and an `Allow` is
 * dropped, which only makes it permit less.
 */
export const MAX_PATTERN_LENGTH = 500;
export const MAX_WILDCARDS = 20;
export const MAX_RULES = 2000;

function boundPattern(pattern: string, allow: boolean): string | null {
  let out = pattern;
  let stars = 0;
  let cut = -1;
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== "*") continue;
    stars++;
    if (stars > MAX_WILDCARDS && cut === -1) cut = i;
  }
  if (cut !== -1) {
    if (allow) return null;
    out = out.slice(0, cut);
  }
  if (out.length > MAX_PATTERN_LENGTH) {
    if (allow) return null;
    out = out.slice(0, MAX_PATTERN_LENGTH);
  }
  return out;
}

/**
 * Percent-encode everything outside printable ASCII, and uppercase the hex of
 * escapes that are already there. Decodes nothing: `%2F` is not `/`, and
 * treating it as one lets a path walk through a rule that names it.
 *
 * Applied identically to the pattern and to the path, because comparing a
 * canonicalised path against a raw pattern is how `/café/` stops matching
 * `Disallow: /café/`.
 */
export function canonicalisePattern(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "%" && /^[0-9a-fA-F]{2}$/.test(value.slice(i + 1, i + 3))) {
      out += "%" + value.slice(i + 1, i + 3).toUpperCase();
      i += 2;
      continue;
    }
    const code = value.codePointAt(i) ?? 0;
    if (code > 0x20 && code < 0x7f) {
      out += ch;
      continue;
    }
    const encoded = encodeURIComponent(
      String.fromCodePoint(code),
    ).toUpperCase();
    out += /^%[0-9A-F]{2}/.test(encoded)
      ? encoded
      : encodeURIComponent(ch).toUpperCase();
    if (code > 0xffff) i++;
  }
  return out;
}

/**
 * Anchored wildcard match with `*` and a terminal `$`, by carrying the set of
 * path positions still reachable. Cost is bounded by pattern length times path
 * length; translating the pattern to a regular expression is not, and the
 * input is a remote file.
 */
export function patternMatches(pattern: string, path: string): boolean {
  let positions = [0];
  for (let p = 0; p < pattern.length; p++) {
    const ch = pattern[p];
    if (ch === "$" && p === pattern.length - 1) {
      return positions.includes(path.length);
    }
    if (ch === "*") {
      const from = positions[0];
      const next: number[] = [];
      for (let i = from; i <= path.length; i++) next.push(i);
      positions = next;
      continue;
    }
    const next: number[] = [];
    for (const pos of positions) {
      if (pos < path.length && path[pos] === ch) next.push(pos + 1);
    }
    if (next.length === 0) return false;
    positions = next;
  }
  return true;
}

interface Group {
  tokens: string[];
  rules: RobotsRule[];
  crawlDelaySeconds: number | null;
  /** True as soon as a rule line is seen, which is what closes the group. */
  open: boolean;
}

/**
 * A robots-side user-agent value is not always a bare token: files carry
 * `Some-Reader/1.0`, `Some Bot`, `* baiduspider`. Truncate at the first
 * character outside the token charset and compare that, case-insensitively
 * and whole — never as a substring, or `User-agent: reader` would capture a
 * fetcher the site never named.
 */
function tokenOf(value: string): string {
  const match = /^[A-Za-z-]+/u.exec(value.trim());
  return (match?.[0] ?? "").toLowerCase();
}

export function parseRobots(body: string, token = PRODUCT_TOKEN): RobotsPolicy {
  const text = body.replace(/^﻿/u, "");
  const groups: Group[] = [];
  let current: Group | null = null;
  let unreadable = 0;
  let rules = 0;
  const wanted = token.toLowerCase();

  for (const rawLine of text.split(/\r\n|\r|\n/u)) {
    const hash = rawLine.indexOf("#");
    const line = (hash === -1 ? rawLine : rawLine.slice(0, hash)).trim();
    if (!line) continue;

    const parsed = /^([A-Za-z-]+)\s*:\s*(.*)$/u.exec(line);
    if (!parsed) {
      unreadable++;
      continue;
    }
    const field = parsed[1].toLowerCase();
    const value = parsed[2].trim();

    if (field === "user-agent") {
      // Consecutive user-agent lines name one group. A user-agent line after
      // a rule opens a new one.
      if (!current || current.open) {
        current = {
          tokens: [],
          rules: [],
          crawlDelaySeconds: null,
          open: false,
        };
        groups.push(current);
      }
      // A star line is often written with trailing words. Recognising it only
      // on exact equality drops the group entirely, which turns a site-wide
      // `Disallow: /` into no rules at all.
      const named = /^\*(?:\s|$)/u.test(value) ? "*" : tokenOf(value);
      if (named) current.tokens.push(named);
      continue;
    }

    if (field === "allow" || field === "disallow") {
      // Rules before any user-agent line belong to no group. Attaching them
      // to the next one applies them to a token the site did not name.
      if (!current) continue;
      current.open = true;
      // An empty Disallow is the idiomatic "nothing is disallowed" and an
      // empty Allow says nothing at all. Neither is a pattern.
      if (!value) continue;
      const allow = field === "allow";
      if (rules >= MAX_RULES * 2) {
        unreadable++;
        continue;
      }
      // Past the rule cap only refusals are still read, for the same reason
      // the length caps treat the two directions differently.
      if (rules >= MAX_RULES && allow) {
        unreadable++;
        continue;
      }
      const pattern = boundPattern(canonicalisePattern(value), allow);
      if (pattern === null) {
        unreadable++;
        continue;
      }
      rules++;
      current.rules.push({
        allow,
        pattern,
        source: line.slice(0, MAX_SOURCE_LINE),
      });
      continue;
    }

    // Anything that is not a user-agent line closes the group to further
    // user-agent lines. Without this, `User-agent: *` / `Crawl-delay: 10` /
    // `User-agent: SomeBot` / `Disallow: /` reads as ONE group naming both
    // tokens, so a block written for one crawler becomes a site-wide one and a
    // site that meant to exclude somebody else excludes us.
    if (current) current.open = true;

    if (field === "crawl-delay" && current) {
      const seconds = Number.parseFloat(value);
      if (Number.isFinite(seconds) && seconds >= 0) {
        // H: the stricter of the two directives wins, whichever came first.
        current.crawlDelaySeconds = Math.max(
          current.crawlDelaySeconds ?? 0,
          seconds,
        );
      } else {
        unreadable++;
      }
      continue;
    }

    if (field === "request-rate" && current) {
      // `<documents>/<period><unit>`: five a minute is a twelve-second gap.
      const rate = /^(\d+)\s*\/\s*(\d+)\s*([smh])?$/u.exec(value);
      if (rate) {
        const count = Number(rate[1]);
        const unit = rate[3] === "h" ? 3600 : rate[3] === "m" ? 60 : 1;
        const period = Number(rate[2]) * unit;
        if (count > 0 && period > 0) {
          const interval = period / count;
          current.crawlDelaySeconds = Math.max(
            current.crawlDelaySeconds ?? 0,
            interval,
          );
        }
      }
      continue;
    }
    // Sitemap and anything unrecognised: neither opens nor closes a group,
    // and is not repaired. `Disalow:` is ignored, not read as `Disallow:`.
  }

  // A group naming this fetcher is a matching group even when it also names
  // `*`. Only a group whose tokens are all `*` is the fallback.
  const named = groups.filter((g) => g.tokens.includes(wanted));
  const chosen =
    named.length > 0 ? named : groups.filter((g) => g.tokens.includes("*"));

  return {
    named: named.length > 0,
    rules: chosen.flatMap((g) => g.rules),
    crawlDelaySeconds: chosen.reduce<number | null>(
      (acc, g) =>
        g.crawlDelaySeconds === null
          ? acc
          : Math.max(acc ?? 0, g.crawlDelaySeconds),
      null,
    ),
    unreadable,
  };
}

export interface RobotsDecision {
  allowed: boolean;
  /** The rule that decided it, as the site wrote it. Null when none applied. */
  rule: string | null;
}

/**
 * The string a pattern is matched against is the path plus the query, with the
 * fragment gone — sites write `Disallow: /*?` and mean it.
 */
export function pathAndQuery(url: URL): string {
  const path = url.pathname || "/";
  return canonicalisePattern(path + url.search);
}

export function robotsAllows(policy: RobotsPolicy, url: URL): RobotsDecision {
  const target = pathAndQuery(url);
  let winner: RobotsRule | null = null;
  for (const rule of policy.rules) {
    if (!patternMatches(rule.pattern, target)) continue;
    if (
      !winner ||
      rule.pattern.length > winner.pattern.length ||
      // A tie goes to the permission: the RFC says the least restrictive wins.
      (rule.pattern.length === winner.pattern.length &&
        rule.allow &&
        !winner.allow)
    ) {
      winner = rule;
    }
  }
  if (!winner) return { allowed: true, rule: null };
  return { allowed: winner.allow, rule: winner.source };
}
