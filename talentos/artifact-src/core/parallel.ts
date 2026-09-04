/**
 * Parallel pages (W20.4): the pasted source on one side, the dossier on the
 * other, and a ribbon between a verified quote and the claim it supports.
 *
 * The evidence check (`quoteAppearsIn`) is a normalized substring test. To
 * mark the quote IN THE ORIGINAL TEXT we need the same normalization with a
 * map back to raw offsets — otherwise a quote that differs only in case,
 * spacing or curly quotes would verify but not be locatable. A quote that
 * verifies is located here by the same rules, so a ribbon exists exactly
 * where the check passed. Nothing here fetches anything.
 */
import { normalize } from "./evidence";

export interface Span {
  /** Raw offsets into the source text; end is exclusive. */
  start: number;
  end: number;
}

export interface Normalized {
  norm: string;
  /** Raw index of the source character behind each normalized character. */
  map: number[];
}

/**
 * The same transform as `evidence.normalize`, character by character, so
 * every normalized index maps to a raw one: lowercase, straighten quotes,
 * collapse runs of whitespace to one space, trim.
 */
export function normalizeWithMap(text: string): Normalized {
  const norm: string[] = [];
  const map: number[] = [];
  let pendingSpace = -1; // raw index of the first whitespace in a pending run
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (pendingSpace < 0) pendingSpace = i;
      continue;
    }
    if (pendingSpace >= 0) {
      if (norm.length > 0) {
        norm.push(" ");
        map.push(pendingSpace);
      }
      pendingSpace = -1;
    }
    let out = ch.toLowerCase();
    if (out === "‘" || out === "’") out = "'";
    else if (out === "“" || out === "”") out = '"';
    for (const c of out) {
      norm.push(c);
      map.push(i);
    }
  }
  return { norm: norm.join(""), map };
}

/** First occurrence of the quote in the text, as raw offsets; null if absent. */
export function locateQuote(quote: string, text: string): Span | null {
  const q = normalize(quote);
  if (q.length < 8) return null;
  const { norm, map } = normalizeWithMap(text);
  const at = norm.indexOf(q);
  if (at < 0) return null;
  const start = map[at];
  const end = map[at + q.length - 1] + 1;
  return { start, end };
}

export interface Located {
  itemIndex: number;
  span: Span;
}

export interface SourceSegment {
  text: string;
  /** The dossier item this run of text is quoted by, or null for plain text. */
  itemIndex: number | null;
}

/**
 * Cut the source into plain and quoted runs, in order, covering every
 * character once. Overlapping quotes keep the earlier one — two ribbons
 * from one span would be a lie about which claim it supports.
 */
export function segmentSource(
  text: string,
  located: Located[],
): SourceSegment[] {
  const sorted = [...located]
    .filter((l) => l.span.end > l.span.start)
    .sort((a, b) => a.span.start - b.span.start || a.itemIndex - b.itemIndex);
  const out: SourceSegment[] = [];
  let cursor = 0;
  for (const l of sorted) {
    if (l.span.start < cursor) continue; // overlap
    if (l.span.start > cursor) {
      out.push({ text: text.slice(cursor, l.span.start), itemIndex: null });
    }
    out.push({
      text: text.slice(l.span.start, l.span.end),
      itemIndex: l.itemIndex,
    });
    cursor = l.span.end;
  }
  if (cursor < text.length) {
    out.push({ text: text.slice(cursor), itemIndex: null });
  }
  return out;
}

export interface RibbonEnd {
  x: number;
  y: number;
  /** Height of the thing the ribbon attaches to, so the band matches it. */
  height: number;
}

/** A filled band between a mark's right edge and an item's left edge. */
export function ribbonPath(from: RibbonEnd, to: RibbonEnd): string {
  const r = (n: number): number => Math.round(n * 10) / 10;
  const dx = Math.max(24, (to.x - from.x) / 2);
  const ft = from.y - from.height / 2;
  const fb = from.y + from.height / 2;
  const tt = to.y - to.height / 2;
  const tb = to.y + to.height / 2;
  return [
    `M ${r(from.x)} ${r(ft)}`,
    `C ${r(from.x + dx)} ${r(ft)} ${r(to.x - dx)} ${r(tt)} ${r(to.x)} ${r(tt)}`,
    `L ${r(to.x)} ${r(tb)}`,
    `C ${r(to.x - dx)} ${r(tb)} ${r(from.x + dx)} ${r(fb)} ${r(from.x)} ${r(fb)}`,
    "Z",
  ].join(" ");
}
