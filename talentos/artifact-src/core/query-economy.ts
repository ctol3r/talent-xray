/**
 * Spending the 32 terms well.
 *
 * Google ignores everything past the 32nd word of a query and says so in a
 * line above the results that nobody reads. This product has measured that
 * happening to its own strings: two that differed only in their tail came back
 * with identical counts, which is what silent truncation looks like from the
 * outside. So the budget is not a style question. A term wasted is a term the
 * end of the query does not get.
 *
 * Four rewrites, each of which either saves a term or wins a match, and none
 * of which changes what the query means. Every one is reported rather than
 * applied quietly: the composed query is the user's (product rule 6), so an
 * economiser that silently rewrote it would be the one thing this must not do.
 *
 * **What this deliberately does not do** is the thing that looks like the
 * obvious saving: turning a phrase into its words. `"talent sourcer"` and
 * `talent|sourcer` are not the same search and not even close — the first
 * wants those two words adjacent, the second wants *either* word anywhere, and
 * on a corpus of profiles the second matches almost everybody. Alternatives
 * for one slot are what OR is for; words that must appear together are what
 * the space between them is for. Confusing the two is how a boolean string
 * ends up returning the whole index.
 *
 * Nothing here imports anything, so the artifact economises the same way.
 */

export interface Saving {
  was: string;
  now: string;
  /** Said in the second person, because somebody is going to read it. */
  why: string;
  /** Terms given back to the budget. Zero for a rewrite that wins recall. */
  terms: number;
}

export interface Economised {
  query: string;
  before: number;
  after: number;
  savings: Saving[];
}

/**
 * Count the way Google counts, as far as anyone outside Google can.
 *
 * Words and operators count; the parentheses do not. `OR` is a word and is
 * counted. **`|` is counted too**, and that is a deliberate over-estimate:
 * whether Google charges for it is not documented anywhere I could verify, and
 * a counter that guesses low lets a query truncate silently, which is the
 * exact failure this whole module exists to prevent. `pnpm probe:search` is
 * where that gets settled, and it needs a key nobody has yet.
 */
export function countGoogleTerms(query: string): number {
  return (
    query
      .replace(/[()]/g, " ")
      // `|` is a token of its own, not a separator to be thrown away: it is
      // an operator, and operators are charged.
      .replace(/\|/g, " | ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean).length
  );
}

/** The pieces of `(a OR b OR "c d")`, or null if this is not a group. */
function groupParts(group: string): string[] | null {
  const inner = group.slice(1, -1).trim();
  if (!inner) return null;
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (depth === 0 && ch === "|") {
      parts.push(current.trim());
      current = "";
      continue;
    }
    if (depth === 0 && inner.startsWith(" OR ", i)) {
      parts.push(current.trim());
      current = "";
      i += 3;
      continue;
    }
    current += ch;
  }
  parts.push(current.trim());
  return parts.every(Boolean) ? parts : null;
}

/** The words inside a term, lowercased, without its quotes. */
function wordsOf(term: string): string[] {
  return term
    .replace(/^-/, "")
    .replace(/"/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Whether `wide` already matches everything `narrow` would, inside an OR.
 *
 * A single word subsumes any phrase containing it: anything matching
 * `"technical recruiter"` matches `recruiter`, so listing both in one group
 * spends a term on nothing. Only true **within an OR** — as separate required
 * terms they mean different things and neither is redundant.
 */
function subsumes(wide: string, narrow: string): boolean {
  const a = wordsOf(wide);
  const b = wordsOf(narrow);
  if (a.length === 0 || a.length >= b.length) return false;
  // Every word of the wider term appears in the narrower one.
  return a.every((word) => b.includes(word));
}

function isOperator(term: string): boolean {
  return /^[a-z]+:/i.test(term) || term.startsWith("-");
}

/**
 * Rewrite a query to cost less and match more, and say what changed.
 *
 * Untouched: anything outside an OR group. A required term, an exclusion and a
 * `site:` clause each mean exactly what they say, and there is no version of
 * them that is shorter and the same.
 */
export function economise(query: string): Economised {
  const before = countGoogleTerms(query);
  const savings: Saving[] = [];

  // Groups are the only place any of this is safe, so they are the only place
  // it happens. A group is a parenthesised run with no nested parentheses.
  const rewritten = query.replace(/\([^()]*\)/g, (group) => {
    const parts = groupParts(group);
    if (!parts || parts.length < 2) return group;

    const kept: string[] = [];
    for (const part of parts) {
      if (isOperator(part)) {
        kept.push(part);
        continue;
      }
      // The same alternative twice, spelled the same or not.
      const already = kept.find(
        (each) => wordsOf(each).join(" ") === wordsOf(part).join(" "),
      );
      if (already) {
        savings.push({
          was: part,
          now: "",
          why: `Dropped: “${wordsOf(part).join(" ")}” is already in this group.`,
          terms: wordsOf(part).length,
        });
        continue;
      }
      kept.push(part);
    }

    // A phrase whose words are all covered by a shorter alternative in the
    // same group can never match anything the shorter one misses.
    const survivors: string[] = [];
    for (const part of kept) {
      const wider = kept.find(
        (each) => each !== part && !isOperator(each) && subsumes(each, part),
      );
      if (wider) {
        savings.push({
          was: part,
          now: "",
          why: `Dropped: anything matching ${part} already matches ${wider}, which is in the same group.`,
          terms: wordsOf(part).length,
        });
        continue;
      }
      survivors.push(part);
    }

    const unquoted = survivors.map((part) => {
      const single = /^"([^"\s]+)"$/.exec(part);
      if (!single) return part;
      savings.push({
        was: part,
        now: single[1],
        why: `Unquoted: quotes around one word turn off Google's stemming, so ${part} misses “${single[1]}s” and “${single[1]}ing”.`,
        terms: 0,
      });
      return single[1];
    });

    if (unquoted.length === 1) return unquoted[0];
    return `(${unquoted.join("|")})`;
  });

  // `|` for `OR` everywhere it survived outside a group we rebuilt. Documented
  // as the same operator, and shorter, which matters on the platforms that cap
  // characters rather than words.
  const piped = rewritten.replace(/\s+OR\s+/g, "|");
  if (piped !== rewritten) {
    savings.push({
      was: "OR",
      now: "|",
      why: "Google reads | as OR, and it is shorter — which is what counts where a platform caps the query's characters.",
      terms: 0,
    });
  }

  const query2 = piped.replace(/\s+/g, " ").trim();
  return {
    query: query2,
    before,
    after: countGoogleTerms(query2),
    savings,
  };
}
