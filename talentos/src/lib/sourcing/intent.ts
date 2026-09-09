/**
 * What a typed string is asking the workspace to do.
 *
 * One pure function: no model call, no network, no clock, no database. The
 * same string always reads the same way, which is what makes the command bar
 * learnable rather than something a recruiter has to watch.
 *
 * Four readings:
 *   jump   — it names a record that exists
 *   filter — it uses the grammar's own filters
 *   scour  — it is an instruction describing a population to go and find
 *   ask    — it is a question
 *
 * Where a string reads two ways this says so and ranks both. A silent guess
 * between "jump to the tag" and "answer the question" is the one failure the
 * reader cannot see and so cannot correct.
 *
 * The parse comes back attached. Nothing downstream should call `parseQuery`
 * on the same string again — there is one reading of a query, not two.
 */
import { normalizeText } from "@/lib/sourcing/normalize";
import {
  parseQuery,
  tokenizeQuery,
  QUERY_STOPWORDS,
  type QueryToken,
  type SourcingBrief,
} from "@/lib/sourcing/query-language";

export type Intent = "jump" | "filter" | "scour" | "ask";

/** Fixed order, used to break a score tie so the result never wobbles. */
const INTENT_ORDER: readonly Intent[] = ["jump", "filter", "scour", "ask"];

export type RecordKind = "job" | "person" | "company" | "tag" | "page";

/** Kind order, likewise for tie-breaking. */
const KIND_ORDER: readonly RecordKind[] = [
  "job",
  "person",
  "company",
  "tag",
  "page",
];

/**
 * One addressable thing, as the caller already knows it.
 *
 * The index is passed in rather than read here, so this module stays pure and
 * bundles into the browser artifact unchanged.
 */
export interface IndexedRecord {
  kind: RecordKind;
  id: string;
  /** As it is shown to the reader. */
  name: string;
  href: string;
  /** Extra words that should match but are not displayed. */
  keywords?: string;
}

/** How a record's name met the query, strongest first. */
export type MatchHow = "exact" | "prefix" | "word" | "substring" | "keyword";

const MATCH_SCORE: Readonly<Record<MatchHow, number>> = {
  exact: 0.95,
  prefix: 0.8,
  word: 0.72,
  substring: 0.55,
  keyword: 0.4,
};

export interface RecordMatch {
  record: IndexedRecord;
  how: MatchHow;
  score: number;
}

export interface IntentCandidate {
  intent: Intent;
  /** 0..1. Not a probability — a rank with a floor under it. */
  confidence: number;
  /** Why, in the words of the evidence, for the reader to agree or disagree with. */
  why: string;
  /** The records a jump would offer, best first. Empty for every other intent. */
  records: RecordMatch[];
}

export interface Classification {
  raw: string;
  /** The parse, so the caller does not repeat it. */
  brief: SourcingBrief;
  /** The token stream behind that parse, ditto. */
  tokens: QueryToken[];
  /** The leading reading. Always `candidates[0].intent`. */
  intent: Intent;
  /** Every reading worth offering, ranked. Never empty. */
  candidates: IntentCandidate[];
  /** True when the runner-up is close enough that the caller must not hide it. */
  ambiguous: boolean;
}

/**
 * Verbs that open an instruction to go and find people.
 *
 * The grammar's own QUERY_STOPWORDS already discards most of these as noise,
 * and rightly — they say nothing about *who* is wanted. They say a great deal
 * about what the recruiter wants done, which is a different question and the
 * one this module answers.
 */
export const SOURCING_IMPERATIVES: ReadonlySet<string> = new Set([
  "find",
  "get",
  "source",
  "scour",
  "search",
  "pull",
  "show",
  "list",
  "give",
  "fetch",
  "surface",
  "hunt",
  "identify",
  "gather",
  "bring",
  "sourcing",
  "shortlist",
  "map",
]);

/** The same instruction spelled in two words. Matched before the single verbs. */
export const SOURCING_IMPERATIVE_PHRASES: readonly string[] = [
  "look for",
  "looking for",
  "dig up",
  "dig out",
  "round up",
  "track down",
  "come up with",
];

/** Words that open a question. */
export const INTERROGATIVES: ReadonlySet<string> = new Set([
  "who",
  "whom",
  "whose",
  "what",
  "when",
  "where",
  "why",
  "how",
  "which",
]);

/** Auxiliaries that open a question when they lead the sentence. */
export const AUXILIARY_OPENERS: ReadonlySet<string> = new Set([
  "is",
  "are",
  "was",
  "were",
  "do",
  "does",
  "did",
  "can",
  "could",
  "should",
  "would",
  "will",
  "shall",
  "have",
  "has",
  "had",
  "am",
  "may",
  "might",
]);

/**
 * Grammatical glue.
 *
 * A sentence joins its words; a keyword list does not. "the response rate is
 * bad" has glue, "recruiter -closed" has none, and that is most of what
 * separates something said from something typed at an index.
 */
export const SENTENCE_GLUE: ReadonlySet<string> = new Set([
  "a",
  "an",
  "the",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "from",
  "by",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "do",
  "does",
  "did",
  "has",
  "have",
  "had",
  "can",
  "could",
  "would",
  "should",
  "will",
  "it",
  "its",
  "they",
  "them",
  "their",
  "there",
  "here",
  "this",
  "that",
  "these",
  "those",
  "my",
  "our",
  "your",
  "we",
  "i",
  "you",
  "me",
  "us",
  "and",
  "or",
  "not",
  "no",
  "nobody",
  "anyone",
  "someone",
  "why",
  "how",
  "what",
]);

/**
 * Openers that wrap an instruction in manners.
 *
 * "can you find me nurses" is an instruction wearing a question's clothes.
 * Stripping these before reading the head is what stops the politeness from
 * deciding the intent.
 */
export const POLITE_PREFIXES: readonly string[] = [
  "can you",
  "could you",
  "would you",
  "will you",
  "please",
  "i need",
  "i want",
  "i'd like",
  "id like",
  "we need",
  "we want",
  "help me",
  "let's",
  "lets",
  "go and",
  "go",
];

/** A candidate below this is not worth offering as an alternative reading. */
const OFFER_FLOOR = 0.15;

/** The runner-up is shown when it reaches this share of the leader. */
const AMBIGUITY_RATIO = 0.6;

/** Codepoint order. `localeCompare` varies by locale; this does not. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Strip the manners off the front, as many layers as there are. */
function instructionHead(words: readonly string[]): string[] {
  let rest = [...words];
  let stripped = true;
  while (stripped && rest.length > 0) {
    stripped = false;
    for (const prefix of POLITE_PREFIXES) {
      const parts = prefix.split(" ");
      if (
        rest.length > parts.length &&
        parts.every((p, i) => rest[i] === p.replace("'", "'"))
      ) {
        rest = rest.slice(parts.length);
        stripped = true;
        break;
      }
    }
  }
  return rest;
}

function opensWithImperative(words: readonly string[]): string | null {
  const head = instructionHead(words);
  if (head.length === 0) return null;
  const two = head.slice(0, 3).join(" ");
  for (const phrase of SOURCING_IMPERATIVE_PHRASES) {
    if (two === phrase || two.startsWith(`${phrase} `)) return phrase;
  }
  return SOURCING_IMPERATIVES.has(head[0]) ? head[0] : null;
}

/** Match one record against the normalised query. Null when nothing matched. */
function matchRecord(record: IndexedRecord, query: string): RecordMatch | null {
  const name = normalizeText(record.name);
  if (!name || !query) return null;

  const how = ((): MatchHow | null => {
    if (name === query) return "exact";
    if (name.startsWith(`${query} `)) return "prefix";
    if (name.endsWith(` ${query}`) || name.includes(` ${query} `))
      return "word";
    if (name.includes(query)) return "substring";
    const keywords = normalizeText(record.keywords ?? "");
    if (
      keywords === query ||
      keywords.startsWith(`${query} `) ||
      keywords.endsWith(` ${query}`) ||
      keywords.includes(` ${query} `)
    )
      return "keyword";
    return null;
  })();

  if (how === null) return null;
  return { record, how, score: MATCH_SCORE[how] };
}

function rankMatches(
  records: readonly IndexedRecord[],
  query: string,
  limit: number,
): RecordMatch[] {
  return records
    .map((record) => matchRecord(record, query))
    .filter((m): m is RecordMatch => m !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        KIND_ORDER.indexOf(a.record.kind) - KIND_ORDER.indexOf(b.record.kind) ||
        compareText(
          normalizeText(a.record.name),
          normalizeText(b.record.name),
        ) ||
        compareText(a.record.id, b.record.id),
    )
    .slice(0, limit);
}

export interface ClassifyOptions {
  /** Ontology expansion on the attached brief. Off by default: intent never uses it. */
  expand?: boolean;
  /** How many records a jump may offer. */
  limit?: number;
}

/**
 * Read one typed string.
 *
 * `records` is the caller's index of everything addressable. Pass none and
 * `jump` simply never wins, which is the right answer for a surface that has
 * nothing to jump to.
 */
export function classifyIntent(
  raw: string,
  records: readonly IndexedRecord[] = [],
  options: ClassifyOptions = {},
): Classification {
  const text = (raw ?? "").trim();
  const brief = parseQuery(text, { expand: options.expand === true });
  const tokens = tokenizeQuery(text);

  if (!text) {
    return {
      raw: text,
      brief,
      tokens,
      intent: "ask",
      candidates: [
        { intent: "ask", confidence: 0, why: "nothing typed", records: [] },
      ],
      ambiguous: false,
    };
  }

  const normalized = normalizeText(text);
  const words = normalized ? normalized.split(" ") : [];
  const questionMark = /\?\s*$/.test(text);

  // --- the evidence, gathered once ------------------------------------------

  /** Filters the recruiter actually spelled out, not ones inferred from prose. */
  const filters = tokens.filter(
    (t) => t.kind === "field" && t.canonicalField !== null,
  );
  const filterNames = [
    ...new Set(filters.map((t) => `${t.canonicalField}:`)),
  ].sort(compareText);
  const operators = tokens.filter(
    (t) =>
      t.negated || t.kind === "or" || t.kind === "open" || t.kind === "close",
  );

  /** A word the reader chose, as opposed to grammar or filler. */
  const proseWords = tokens
    .filter((t) => t.kind === "word" || t.kind === "phrase")
    .map((t) => normalizeText(t.value))
    .filter((w) => w.length > 0 && !QUERY_STOPWORDS.has(w));

  const populationFields = [
    ...brief.skills,
    ...brief.titles,
    ...brief.orgs,
    ...brief.seniority,
    ...brief.industries,
  ];
  /**
   * A population described in words, not assembled out of filters.
   *
   * `skill:robotics loc:london` fills the same fields as "robotics engineers
   * in london", so the fields alone cannot tell a filter expression from a
   * brief. Whether any prose reached them can.
   */
  const describesPopulation =
    populationFields.length > 0 && proseWords.length > 0;

  const imperative = opensWithImperative(words);
  const head = words[0] ?? "";
  const interrogative = INTERROGATIVES.has(head) ? head : null;
  const auxiliary = AUXILIARY_OPENERS.has(head) ? head : null;

  // --- jump -----------------------------------------------------------------

  // A filter expression is never a record's name: no record is called
  // `skill:robotics`. Offering one would be noise on every filtered query.
  const matches =
    filters.length > 0
      ? []
      : rankMatches(records, normalized, options.limit ?? 5);
  const jumpScore = matches.length > 0 ? matches[0].score : 0;
  const jumpWhy =
    matches.length > 0
      ? `${matches[0].how === "exact" ? "is" : "matches"} the ${matches[0].record.kind} "${matches[0].record.name}"${matches.length > 1 ? ` and ${matches.length - 1} more` : ""}`
      : "names no record";

  // --- filter ---------------------------------------------------------------

  let filterScore = 0;
  let filterWhy = "no filter from the grammar";
  if (filters.length > 0) {
    filterScore = 0.55 + 0.15 * (filters.length - 1);
    if (operators.length > 0) filterScore += 0.05;
    filterWhy = `${filters.length} filter${filters.length === 1 ? "" : "s"} from the grammar: ${filterNames.join(" ")}`;
  } else if (operators.length > 0) {
    filterScore = 0.25;
    filterWhy = "uses the grammar's operators but names no filter";
  }

  // --- scour ----------------------------------------------------------------

  let scourScore = 0;
  const scourWhy: string[] = [];
  if (imperative !== null) {
    scourScore += 0.45;
    scourWhy.push(`opens with "${imperative}"`);
  }
  if (describesPopulation) {
    scourScore += 0.35;
    scourWhy.push(`describes a population (${populationFields.join(", ")})`);
    if (brief.locations.length > 0) {
      scourScore += 0.15;
      scourWhy.push(`somewhere (${brief.locations.join(", ")})`);
    }
  }
  if (proseWords.length > 0 && !questionMark && interrogative === null) {
    // A bare keyword nobody asked a question with is, at the very least, a
    // thing to go and look for. Flat and small on purpose: it must never
    // outrank a record match, and length alone is not an instruction.
    scourScore += 0.12;
    if (scourWhy.length === 0) scourWhy.push("a statement, not a question");
  }
  if (questionMark && imperative === null) scourScore -= 0.4;
  if (interrogative !== null && !describesPopulation) scourScore -= 0.25;

  // --- ask ------------------------------------------------------------------

  let askScore = 0;
  const askWhy: string[] = [];
  if (questionMark) {
    askScore += 0.45;
    askWhy.push("ends in a question mark");
  }
  if (interrogative !== null) {
    askScore += 0.4;
    askWhy.push(`opens with "${interrogative}"`);
  } else if (auxiliary !== null && imperative === null) {
    // "can you find me nurses" opens with an auxiliary and is still an
    // instruction. The manners are not the question.
    askScore += 0.3;
    askWhy.push(`opens with "${auxiliary}"`);
  }
  if (
    imperative === null &&
    filters.length === 0 &&
    !describesPopulation &&
    words.length >= 3 &&
    words.some((w) => SENTENCE_GLUE.has(w))
  ) {
    askScore += 0.25;
    askWhy.push("a sentence carrying no filter");
  }
  if (imperative !== null) askScore -= 0.35;
  // A described population pulls towards scour but does not settle it: "who
  // has hired robotics engineers" is a question whose answer is a population,
  // and both readings have to survive to the caller.
  if (describesPopulation) askScore -= 0.1;

  // --- rank -----------------------------------------------------------------

  const readings: IntentCandidate[] = [
    {
      intent: "jump",
      confidence: clamp(jumpScore),
      why: jumpWhy,
      records: matches,
    },
    {
      intent: "filter",
      confidence: clamp(filterScore),
      why: filterWhy,
      records: [],
    },
    {
      intent: "scour",
      confidence: clamp(scourScore),
      why: scourWhy.join("; ") || "no instruction and no population",
      records: [],
    },
    {
      intent: "ask",
      confidence: clamp(askScore),
      why: askWhy.join("; ") || "not shaped like a question",
      records: [],
    },
  ];

  const scored = [...readings].sort(
    (a, b) =>
      b.confidence - a.confidence ||
      INTENT_ORDER.indexOf(a.intent) - INTENT_ORDER.indexOf(b.intent),
  );

  const leader = scored[0];
  const offered = scored.filter(
    (c) => c === leader || c.confidence >= OFFER_FLOOR,
  );
  const ambiguous =
    offered.length > 1 &&
    leader.confidence > 0 &&
    offered[1].confidence >= leader.confidence * AMBIGUITY_RATIO;

  return {
    raw: text,
    brief,
    tokens,
    intent: leader.intent,
    candidates: offered,
    ambiguous,
  };
}
