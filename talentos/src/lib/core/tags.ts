/**
 * Tags, in the Roam sense: a word wrapped in `[[double brackets]]` or
 * prefixed with `#` is a page. Writing it anywhere creates it; the page is
 * the list of every place it was written.
 *
 * Nothing here stores anything. A tag exists because some text says it does,
 * so removing the word removes the tag, and there is never an index to fall
 * out of step with the writing. That is the whole reason this is parsing and
 * not a table.
 *
 * Three ways to write one, all the same page:
 *   #ai-safety            a single word
 *   [[AI safety]]         several words
 *   #[[AI safety]]        several words, hash form
 *
 * Two things are deliberately not tags. Anything inside a URL, because
 * `example.com/#section` is a fragment and `[[x]]` inside a link is a link.
 * And anything the fair-hiring rules exclude: a word that names a protected
 * characteristic never becomes a page, so the product cannot grow a field
 * for one by the side door of someone typing it. `tagIsAllowed` is the only
 * gate, and it reads its patterns from the fair-hiring module rather than
 * spelling any of them here.
 */
import {
  BLOCKED_FIELD_PATTERNS,
  BLOCKED_IMPORT_HEADER_PATTERNS,
} from "@/lib/domain/fair-hiring";

export interface TagRef {
  /** Canonical id. `[[AI Safety]]` and `#ai-safety` share one. */
  slug: string;
  /** As written, without the syntax. Used for display the first time seen. */
  display: string;
  form: "hash" | "bracket";
  /** Character offsets of the whole reference, syntax included. */
  start: number;
  end: number;
}

/** Longest first, so `#[[a b]]` is not read as `#` followed by `[[a b]]`. */
const PATTERNS: { form: "hash" | "bracket"; pattern: RegExp }[] = [
  { form: "hash", pattern: /#\[\[([^\]\n]{1,80})\]\]/gu },
  { form: "bracket", pattern: /\[\[([^\]\n]{1,80})\]\]/gu },
  { form: "hash", pattern: /#([\p{L}\p{N}][\p{L}\p{N}+#._/-]{0,79})/gu },
];

/** Regions that look like tags but are not: addresses and inline code. */
const MASKED = [/https?:\/\/\S+/gu, /`[^`\n]*`/gu, /\bwww\.\S+/gu];

/**
 * Blank out the regions a tag may not come from, keeping every offset, so
 * the positions this returns still index into the caller's own string.
 */
function maskNonTagRegions(text: string): string {
  let masked = text;
  for (const pattern of MASKED) {
    masked = masked.replace(new RegExp(pattern.source, pattern.flags), (hit) =>
      " ".repeat(hit.length),
    );
  }
  return masked;
}

/**
 * Canonical form. Case and punctuation are not meaningful, spacing is not
 * meaningful, but the characters people actually use in skill names are:
 * `c++` stays `c++`, `node.js` stays `node.js`, and `C#` becomes `c-sharp`
 * because a bare `#` cannot survive being written back into `#tag` form.
 */
export function tagSlug(raw: string): string | null {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/#/gu, "-sharp")
    .replace(/[^\p{L}\p{N}+._-]+/gu, "-")
    .replace(/-{2,}/gu, "-")
    .replace(/^[-._]+|[-._]+$/gu, "");
  if (!slug) return null;
  if (slug.length > 80) return null;
  // A tag has to carry a letter. A bare number is a number.
  if (!/\p{L}/u.test(slug)) return null;
  return slug;
}

/**
 * Human form for a slug nobody ever wrote out in full. Sentence case, not
 * title case: the tag `ai-safety` reads as "Ai safety", and the moment
 * someone writes `[[AI safety]]` their spelling replaces this guess.
 */
export function tagTitle(slug: string): string {
  const words = slug.replace(/-/gu, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * False for anything the fair-hiring rules keep out of this product. Both
 * pattern lists are read from the module that owns them; this file never
 * spells one, which is what keeps the source-wide check honest.
 */
export function tagIsAllowed(slug: string): boolean {
  const spaced = slug.replace(/[-._]+/gu, " ");
  for (const pattern of [
    ...BLOCKED_FIELD_PATTERNS,
    ...BLOCKED_IMPORT_HEADER_PATTERNS,
  ]) {
    const test = new RegExp(pattern.source, pattern.flags.replace("g", ""));
    if (test.test(slug) || test.test(spaced)) return false;
  }
  return true;
}

/** Every tag written in this text, in the order written, no duplicates removed. */
export function parseTagRefs(text: string): TagRef[] {
  if (!text) return [];
  const masked = maskNonTagRegions(text);
  const taken: [number, number][] = [];
  const refs: TagRef[] = [];
  for (const { form, pattern } of PATTERNS) {
    const scanner = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = scanner.exec(masked)) !== null) {
      const start = match.index;
      const end = start + match[0].length;
      // A longer form already claimed these characters.
      if (taken.some(([a, b]) => start < b && end > a)) continue;
      const display = match[1].trim();
      const slug = tagSlug(display);
      if (!slug || !tagIsAllowed(slug)) continue;
      taken.push([start, end]);
      refs.push({ slug, display, form, start, end });
    }
  }
  return refs.sort((a, b) => a.start - b.start);
}

/** The distinct tags in a text, first written form kept for display. */
export function tagsIn(text: string): { slug: string; display: string }[] {
  const seen = new Map<string, string>();
  for (const ref of parseTagRefs(text)) {
    if (!seen.has(ref.slug)) seen.set(ref.slug, ref.display);
  }
  return [...seen].map(([slug, display]) => ({ slug, display }));
}

export type TagSegment =
  | { kind: "text"; text: string }
  | {
      kind: "tag";
      text: string;
      slug: string;
      display: string;
      form: "hash" | "bracket";
    };

/** Split text for rendering, so a tag can be drawn as a link in place. */
export function segmentTagText(text: string): TagSegment[] {
  const refs = parseTagRefs(text);
  const out: TagSegment[] = [];
  let cursor = 0;
  for (const ref of refs) {
    if (ref.start > cursor) {
      out.push({ kind: "text", text: text.slice(cursor, ref.start) });
    }
    out.push({
      kind: "tag",
      text: text.slice(ref.start, ref.end),
      slug: ref.slug,
      display: ref.display,
      form: ref.form,
    });
    cursor = ref.end;
  }
  if (cursor < text.length)
    out.push({ kind: "text", text: text.slice(cursor) });
  return out;
}

export function tagHref(slug: string): string {
  return `/tags/${encodeURIComponent(slug)}`;
}

/**
 * What the caret is in the middle of typing, so an editor can offer what
 * already exists.
 *
 * One syntax, three ways in. Everything written in `[[double brackets]]` is
 * a page, whether that page turns out to be a tag, a person or a job — which
 * is the Roam property worth keeping, because it means a note does not have
 * to know what kind of thing it is naming. The trigger only decides what the
 * menu offers:
 *
 *   #  or [[   every page
 *   @          people only
 *   jj         jobs only
 *
 * `@` recalls rather than writes: the chosen name comes back in bracket
 * form, so an address typed as `a@b` can never turn into a reference. `jj`
 * is two letters because it has to be typeable mid-sentence without a
 * modifier, and no English word starts with it.
 */
export type RecallKind = "page" | "candidate" | "job";

export interface TagTrigger {
  /** Which key opened the menu, and therefore what it offers. */
  kind: RecallKind;
  /** What has been typed after the trigger, to filter on. */
  query: string;
  /** Offset of the trigger itself. */
  start: number;
}

export function activeTagTrigger(
  text: string,
  caret: number,
): TagTrigger | null {
  const before = text.slice(0, caret);

  const bracket = /\[\[([^\]\n]{0,80})$/u.exec(before);
  if (bracket) {
    return { kind: "page", query: bracket[1], start: bracket.index };
  }

  // Jobs. Two letters, so it must not fire inside a word ("jjust", "hajj").
  const job = /(^|[\s(,;:])jj([\p{L}\p{N}\s+._/-]{0,80})$/u.exec(before);
  if (job) {
    return {
      kind: "job",
      query: job[2],
      start: job.index + job[1].length,
    };
  }

  const simple = /(^|[\s(,;:])([@#])([\p{L}\p{N}\s+._/-]{0,80})$/u.exec(before);
  if (simple) {
    return {
      kind: simple[2] === "@" ? "candidate" : "page",
      query: simple[3],
      start: simple.index + simple[1].length,
    };
  }
  return null;
}

/**
 * Replace the half-typed trigger with a finished reference.
 *
 * A person or a job always comes back in bracket form: their names have
 * spaces and punctuation that a hash cannot carry, and a name is a page like
 * any other. A tag keeps the hash when it is a single word, because that is
 * how people write tags.
 */
export function applyTagTrigger(
  text: string,
  trigger: TagTrigger,
  caret: number,
  chosen: { slug: string; display: string; kind?: RecallKind },
): { text: string; caret: number } {
  const label = chosen.display.trim() || chosen.slug;
  const isRecord =
    trigger.kind !== "page" ||
    chosen.kind === "candidate" ||
    chosen.kind === "job";
  const needsBrackets = isRecord || /\s/u.test(label);
  const written = needsBrackets ? `[[${label}]]` : `#${label}`;
  // Typing "[[" auto-closes, so the caret usually has "]]" waiting in front
  // of it. The finished reference carries its own, so those are consumed
  // rather than left behind as "[[name]]]]".
  const tailFrom = text.startsWith("]]", caret) ? caret + 2 : caret;
  const next = `${text.slice(0, trigger.start)}${written}${text.slice(tailFrom)} `;
  return { text: next, caret: trigger.start + written.length + 1 };
}

/**
 * What typing a bracket should do.
 *
 * Roam's behaviour, and the reason it feels like a command rather than
 * punctuation: the second `[` closes itself, so `[[` puts you inside a page
 * reference with the caret between the pairs. Typing the closing bracket
 * yourself steps over the one already there instead of doubling it, and
 * backspacing out of an empty reference removes all four characters, so an
 * abandoned `[[` never litters the note.
 *
 * Returns null when the key should behave normally.
 */
export function bracketKey(
  text: string,
  caret: number,
  key: string,
  selectionEnd = caret,
): { text: string; caret: number } | null {
  // Only when nothing is selected: typing over a selection is its own act.
  if (caret !== selectionEnd) return null;
  const before = text.slice(0, caret);
  const after = text.slice(caret);

  if (key === "[" && before.endsWith("[")) {
    return { text: `${before}[]]${after}`, caret: caret + 1 };
  }
  if (key === "]" && after.startsWith("]")) {
    return { text, caret: caret + 1 };
  }
  if (key === "Backspace" && before.endsWith("[[") && after.startsWith("]]")) {
    return {
      text: `${before.slice(0, -2)}${after.slice(2)}`,
      caret: caret - 2,
    };
  }
  return null;
}
