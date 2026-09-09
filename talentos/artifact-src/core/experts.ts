/**
 * The talent expert, and the team behind them.
 *
 * You talk to one person. Behind that person is a small team of specialists,
 * and the question goes to whichever of them it is about — the same division
 * of labour the crew already runs per job (W7), brought forward to the place
 * where somebody types a sentence instead of pressing Generate.
 *
 * **The routing is arithmetic, not judgement.** A model choosing its own
 * specialist would be a second model call before the first, and it would be
 * wrong in ways nobody could see. This scores the words in the question
 * against each specialist's own vocabulary and says which one won and why, so
 * a wrong route is a visible wrong route you can correct by naming the
 * specialist yourself.
 *
 * What the answer may contain is the harder constraint and it does not live
 * here: no specialist may assert anything about a named person that the
 * recruiter did not write down. See `src/lib/ai/tasks/expert.ts`.
 *
 * Nothing here imports anything, so the roster runs in the artifact.
 */

export interface Expert {
  id: string;
  /** What to call them in the transcript. */
  name: string;
  mark: string;
  /** One line, shown when the answer says who wrote it. */
  does: string;
  /** Words that mean this question is theirs. Lowercase, matched on stems. */
  knows: readonly string[];
}

export const EXPERTS: readonly Expert[] = [
  {
    id: "intake",
    name: "Intake",
    mark: "🧭",
    does: "what the job actually needs, and what to ask the hiring manager",
    knows: [
      "intake",
      "hiring manager",
      "hm",
      "brief",
      "requirement",
      "must have",
      "nice to have",
      "scorecard",
      "success profile",
      "kick off",
      "kickoff",
      "calibrat",
      "job description",
      "jd",
      "role",
      "seniority",
      "headcount",
    ],
  },
  {
    id: "sourcing",
    name: "Sourcing",
    mark: "🔭",
    does: "where these people are, and the strings and channels that find them",
    knows: [
      "source",
      "sourcing",
      "search string",
      "boolean",
      "x-ray",
      "xray",
      "channel",
      "pipeline is empty",
      "find",
      "candidates from",
      "talent pool",
      "market map",
      "github",
      "linkedin",
      "conference",
      "community",
      "keyword",
      "query",
    ],
  },
  {
    id: "outreach",
    name: "Outreach",
    mark: "✉️",
    does: "what to say first, and what to say when nobody replies",
    knows: [
      "outreach",
      "message",
      "email",
      "inmail",
      "subject line",
      "reply",
      "response rate",
      "follow up",
      "followup",
      "cold",
      "sequence",
      "ghost",
      "no reply",
      "reach out",
      "contact",
    ],
  },
  {
    id: "screening",
    name: "Screening",
    mark: "🎤",
    does: "what to ask, and what an answer is actually evidence of",
    knows: [
      "screen",
      "interview",
      "question",
      "ask them",
      "probe",
      "signal",
      "evidence",
      "assess",
      "take home",
      "panel",
      "debrief",
      "reference",
      "red flag",
      "competenc",
    ],
  },
  {
    id: "market",
    name: "Market",
    mark: "📊",
    does: "pay, supply, and who else is hiring for this",
    knows: [
      "salary",
      "compensation",
      "pay",
      "band",
      "equity",
      "benchmark",
      "market",
      "supply",
      "competitor",
      "who else is hiring",
      "cost of",
      "rate",
      "budget",
    ],
  },
  {
    id: "close",
    name: "Offer and close",
    mark: "🤝",
    does: "getting to yes, and what to do when the counter-offer lands",
    knows: [
      "offer",
      "close",
      "closing",
      "negotiat",
      "counter",
      "counter-offer",
      "counteroffer",
      "decline",
      "accept",
      "notice period",
      "start date",
      "resign",
      "onboard",
    ],
  },
  {
    id: "fair-hiring",
    name: "Fair hiring",
    mark: "⚖️",
    does: "what may and may not be taken into account, and how to say so",
    knows: [
      "legal",
      "lawful",
      "gdpr",
      "discriminat",
      "protected",
      "bias",
      "adverse impact",
      "accommodat",
      "right to work",
      "sponsorship",
      "privacy",
      "consent",
      "data request",
      "article 14",
    ],
  },
  {
    id: "generalist",
    name: "Generalist",
    mark: "🧠",
    does: "everything else, and knowing which of the others to bring in",
    knows: [],
  },
];

export const GENERALIST = "generalist";

export function expertById(id: string): Expert {
  return (
    EXPERTS.find((expert) => expert.id === id) ?? EXPERTS[EXPERTS.length - 1]
  );
}

export interface Routing {
  expert: Expert;
  /** The words that decided it, for showing the reader why. */
  because: string[];
}

/**
 * Whether a question uses this phrase.
 *
 * At the start of a word, never inside one. Plain `includes` sent "I'm
 * recruiting for an ML Research Scientist — Computational Biophysics" to the
 * **market** specialist, because "comp" is a substring of "computational".
 * The same bug had "hm" matching inside "rhythm" and "rate" inside
 * "corporate": short stems are the useful ones and they are exactly the ones
 * that hide inside longer words.
 *
 * A prefix rather than a whole word, because "sourcing" has to answer to
 * "source" and "closing" to "close". That is why "comp" had to go from the
 * vocabulary as well: every word it should match is spelled out instead.
 */
function uses(text: string, phrase: string): boolean {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}`, "u").test(text);
}

/**
 * Which specialist a question belongs to.
 *
 * Longest match wins per phrase, and a phrase is worth more than a word,
 * because "counter-offer" belongs to the close and "offer" alone is often
 * somebody talking about what they are offering the market. Nothing matching
 * anything is the generalist, which is a real answer rather than a fallback:
 * most questions somebody types are not about one specialism.
 */
export function routeQuestion(question: string): Routing {
  const text = ` ${question
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/gu, " ")} `;

  let best: { routing: Routing; score: number } | null = null;
  for (const expert of EXPERTS) {
    const hits = expert.knows.filter((phrase) => uses(text, phrase));
    if (hits.length === 0) continue;
    // A phrase of two words is a much stronger signal than a stem, and a
    // longer stem is stronger than a short one.
    const score = hits.reduce(
      (total, phrase) =>
        total + (phrase.includes(" ") ? phrase.length * 2 : phrase.length),
      0,
    );
    if (best && score <= best.score) continue;
    best = {
      score,
      routing: {
        expert,
        because: [...hits].sort((a, b) => b.length - a.length).slice(0, 3),
      },
    };
  }

  return best?.routing ?? { expert: expertById(GENERALIST), because: [] };
}
