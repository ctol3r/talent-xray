/**
 * One picture per kind of record.
 *
 * Headings have carried a mark for a while (`tests/unit/headings.test.ts`
 * enforces it) and the records under them did not, which is the wrong way
 * round: you read a heading once and then scan fifty rows, and it is the rows
 * that need to be told apart at a glance. A list of names and a list of tags
 * and a list of documents all look identical when they are all plain text.
 *
 * The rule is one mark per kind, everywhere, forever. A person is 👤 on the
 * people list, in the command bar, in the connected strip, in the graph and
 * in a note's autocomplete — the moment the same thing wears two marks the
 * marks stop being information and become decoration.
 *
 * Nothing here imports anything, so the artifact marks records the same way.
 */

/** Every kind of thing this product keeps, by the name the code calls it. */
export const MARKS = {
  // The graph's kinds, which are the record types proper.
  search: "💼",
  candidate: "👤",
  requirement: "📌",
  document: "📄",
  comparison: "⚖️",
  channel: "📡",
  source: "🔗",
  tag: "🏷️",

  // Everything else that gets listed somewhere.
  company: "🏢",
  task: "✅",
  note: "📝",
  day: "📅",
  query: "🔎",
  learning: "📚",
  stage: "🪜",
  outreach: "✉️",
  offer: "📜",
  interview: "🗣️",
  scorecard: "🧮",
  page: "🏷️",
  job: "💼",
  person: "👤",
} as const;

export type MarkName = keyof typeof MARKS;

/**
 * The mark for a kind, or a neutral one for a kind nobody has named yet.
 *
 * A dot rather than nothing, because a row with no mark beside rows that have
 * one reads as a rendering fault rather than as an unknown type.
 */
export function markFor(kind: string): string {
  return (MARKS as Record<string, string>)[kind] ?? "•";
}

/** The mark and the words, for the many places that want one string. */
export function marked(kind: string, text: string): string {
  return `${markFor(kind)} ${text}`;
}
