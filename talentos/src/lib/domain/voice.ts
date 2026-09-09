/**
 * How the product talks.
 *
 * The character: quiet, funny, and a nerd about the craft. Someone who has
 * run a lot of searches, is not trying to impress you, and will tell you the
 * awkward thing because they would rather be useful than liked. They sell by
 * being right about a specific detail, not by being enthusiastic.
 *
 * Five rules, in priority order. When they conflict, the earlier one wins.
 *
 *  1. Candid before charming. If the honest sentence is dull, ship the dull
 *     one. A product whose whole value is not overclaiming cannot buy a laugh
 *     with an exaggeration.
 *  2. Specific before general. The nerd part is knowing that the second
 *     follow-up outperforms the first, not saying "outreach matters".
 *  3. Dry, and rarely. Wit is seasoning. Every screen being funny is a
 *     personality disorder, not a personality.
 *  4. Never at anyone's expense. Not the candidate, not the hiring manager,
 *     not the user. Punch at the work, or at the software.
 *  5. Silent when it is serious. Anything about a person's data, a legal
 *     duty, a refusal or a failure is written plainly, with no joke in it.
 *     `SERIOUS_SURFACES` names those, and a test holds the line.
 *
 * Never: exclamation marks, "oops", "uh oh", "let's", "awesome", "magic",
 * "supercharge", emoji as punchline. The voice is understated; it does not
 * need punctuation to carry it.
 */

/**
 * Surfaces where the voice stays entirely flat. Listed so the rule is
 * checkable rather than a matter of taste.
 */
export const SERIOUS_SURFACES = [
  "a person's own data",
  "the duty to tell someone their details are held",
  "a refusal or a guardrail",
  "an error or a failed action",
  "anything a candidate could read",
  "legal or licence text",
] as const;

/** Words that would make this product sound like every other one. */
export const BANNED_WORDS = [
  "!",
  "oops",
  "uh oh",
  "awesome",
  "supercharge",
  "seamless",
  "effortless",
  "unleash",
  "revolutionise",
  "revolutionize",
  "game-changer",
  "rockstar",
  "ninja",
  "10x",
] as const;

export function violatesVoice(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_WORDS.filter((word) => lower.includes(word));
}

/**
 * Empty states.
 *
 * The place a personality either exists or does not, because an empty screen
 * is the product with nothing to hide behind. Each one says what is true,
 * then what to do, and only then allows itself a dry aside.
 */
export const EMPTY_STATES = {
  noSearches: {
    title: "No searches yet",
    detail:
      "Start one and paste in the job description. Everything else — the requirements, the strings, the shortlist — is derived from that text, which is a polite way of saying a vague job description produces a vague search.",
  },
  allJobsClosed: {
    title: "Every job is closed or on hold",
    detail:
      "Nothing is deleted and nothing is lost — a closed job keeps its whole trail, which is what makes it the most useful record on the desk. Reopen one from its own page, or start the next.",
  },
  noCandidates: {
    title: "Nobody in this search yet",
    detail:
      "Add someone by hand, or open Discover and run one of your strings. Zero is information, not failure: it usually means the strings describe the job title rather than the work.",
  },
  noTags: {
    title: "No pages yet",
    detail:
      "Write [[a phrase]] or #a-word anywhere you write prose and it becomes a page listing everywhere it appears. Write the same one on a job and on a person and you have connected them, which is the entire trick.",
  },
  noReminders: {
    title: "Nothing is due",
    detail:
      "A real state, not an empty one. Worth using the time on the search you have been avoiding.",
  },
  noSuggestions: {
    title: "Every open search is up to date",
    detail:
      "Genuinely rare. Either you are on top of it or something is not being recorded, and it is worth knowing which.",
  },
  noEvents: {
    title: "Nothing recorded on this day",
    detail:
      "Quiet days happen, and they are only a problem in a row. If this one was not quiet, something you did is not being recorded, which is worth more of your attention than the gap.",
  },
  noOpenIndexResults: {
    title: "No source returned anyone",
    detail:
      "Usually the terms are too specific for a public index rather than too broad. Try the field rather than the job title: these sources know what people publish about, not what their business card says.",
  },
  nothingWaiting: {
    title: "Nothing is waiting",
    detail:
      "Every request in the outbox has an answer. Something lands here whenever the app needs the model and there is no key for one — asking the expert on the home page, or generating anything on a job — so the queue fills up by using the product, not by being opened.",
  },
  noGraphNearby: {
    title: "Nothing sits two links from here",
    detail:
      "A tag written on two records is the usual way something appears here. One word in two notes and this fills up.",
  },
} as const;

/**
 * The line under the product name. Understated on purpose: the claim is
 * narrow and true, which is the only kind this product is allowed to make.
 */
export const TAGLINE = "Sourcing that shows its working.";
