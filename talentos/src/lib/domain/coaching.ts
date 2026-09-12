/**
 * Why a move matters, in a sentence a recruiter can learn from.
 *
 * The rules engine already says what to do next. This says why it is the
 * next thing, in craft terms rather than software terms — the difference
 * between "you have 3 unanswered intake questions" and "an unanswered intake
 * question becomes a sourcing assumption, and you will not find out it was
 * wrong until the hiring manager rejects your third shortlist."
 *
 * That is the product's stated purpose: someone who has never run a search
 * should be able to run a good one by following it. A list of tasks does not
 * teach anyone anything; a list of tasks that each explain themselves does.
 *
 * Keyed by the action id from `next-best-action.ts`. An action with no entry
 * simply shows without a note, which is why adding a rule never breaks this.
 */
export const COACHING: Record<string, { why: string; good: string }> = {
  add_jd: {
    why: "Everything downstream is derived from this text. A search started without it is a search run on memory, and memory drifts between the first conversation and the fifth shortlist.",
    good: "The real posting, pasted whole. Including the parts you disagree with — those are the ones worth arguing about at intake.",
  },
  run_role_intel: {
    why: "A job description is written to attract people. Turning it into requirements forces the vague parts into the open, where you can see which ones you actually cannot assess.",
    good: "Every requirement has evidence you could look for, and the ones that do not are marked as questions rather than quietly kept.",
  },
  generate_intake: {
    why: "The job description cannot tell you what the hiring manager will actually say yes to. Almost every failed search failed here, months earlier, and looked like a sourcing problem at the time.",
    good: "Questions that would change what you do if answered differently. A question whose answer changes nothing is a question you are asking to look thorough.",
  },
  capture_intake: {
    why: "An unanswered intake question does not stay unanswered. It becomes an assumption, and you find out it was wrong when the third shortlist is rejected.",
    good: "The manager's own words, recorded verbatim. Your paraphrase of their answer is your interpretation, and it will not survive the argument later.",
  },
  resolve_questions: {
    why: "These are the places the role contradicts itself. Every one you leave open is a place a good candidate gets rejected for a reason nobody wrote down.",
    good: "Each one either answered by the manager or explicitly recorded as an assumption you are making on purpose.",
  },
  compile_profile: {
    why: "A success profile is what makes a rejection explainable. Without it, 'not quite right' is the whole of your feedback, and you cannot calibrate on it.",
    good: "Each criterion says what evidence would satisfy it and what would falsely look like satisfying it.",
  },
  generate_strategy: {
    why: "Sourcing without a strategy is sourcing whichever channel you used last time. The population determines the channel, not your habits.",
    good: "You can say who you are looking for, where those people are, and what would make them answer — before you write a single string.",
  },
  map_channels: {
    why: "Most searches use two channels and blame the market. The channel a population actually lives on is often not the one that has a recruiter product attached.",
    good: "At least one channel you have never used for this kind of role, with a reason it should work.",
  },
  build_queries: {
    why: "A string is a hypothesis about how people describe themselves. Writing several tests several hypotheses; writing one tests your vocabulary.",
    good: "Each string names the segment it targets, and you can say what a false positive from it would look like.",
  },
  add_candidates: {
    why: "A pipeline of nobody is not a pipeline. Volume early is not the goal, but zero is information: it usually means the strings encode the job title rather than the work.",
    good: "The first few come from different channels, so you learn which one is worth the next hour.",
  },
  review_candidates: {
    why: "Evidence you have not reviewed is not evidence. A profile sitting unread is indistinguishable from a profile that does not exist, and it is the cheapest work in the whole search.",
    good: "Every review either advances the person or records why not, in words a hiring manager could read.",
  },
  follow_up: {
    why: "The second message gets more replies than the first, and most recruiters never send it. This is the single highest-yield habit in outreach and it costs nothing.",
    good: "It adds something the first did not, rather than asking again.",
  },
  send_outreach: {
    why: "A researched pipeline nobody has contacted is a spreadsheet. The work only becomes a search when someone answers.",
    good: "Each message says something true about that person that could not be said about anyone else on the list.",
  },
  unstick_stalled: {
    why: "A candidate who has not moved in two weeks is usually a decision nobody made rather than a person who said no. Silence in a pipeline is almost always yours, not theirs.",
    good: "Every stalled person is either moved, closed, or has a dated reason for waiting.",
  },
  hm_brief: {
    why: "The hiring manager sees your shortlist and not your reasoning. A brief is where the reasoning goes, and it is what turns a rejection into calibration.",
    good: "It states what you looked for, what you found, and what you could not find — including the last one.",
  },
  hm_review: {
    why: "Feedback you do not chase does not arrive. A shortlist sitting unreviewed costs you the market, because the people on it are talking to someone else this week.",
    good: "You have a date, not a promise.",
  },
  close_plan: {
    why: "Offers are lost in the week between yes and signature. A close plan is the difference between hoping and knowing what happens next.",
    good: "It names who else they are talking to, what would make them say no, and who calls them if it wobbles.",
  },
  interview_prep: {
    why: "An interview without a plan tests interviewing, not the candidate. The panel will ask what occurs to them, and what occurs to them is not the success profile.",
    good: "Each interviewer knows which criterion they own and what evidence would satisfy it.",
  },
  record_learnings: {
    why: "A search you do not write up teaches you nothing, and you will run a similar one within the year. This is where a recruiter compounds.",
    good: "One thing that surprised you, written before you forget it felt surprising.",
  },
};

/** Something worth knowing, shown one at a time, whatever the day holds. */
export const CRAFT_NOTES: string[] = [
  "A requirement you cannot describe evidence for is a preference. Say so out loud at intake and it stops silently rejecting people.",
  "The best sourcing string usually contains a noun the job description does not: what the work is called by the people who do it.",
  "If a channel produces nobody twice, the channel is not the problem the second time. The string is.",
  "Reply rate is a message quality signal. Open rate is a subject line signal. Confusing them means editing the wrong thing.",
  "When a hiring manager says 'I'll know it when I see it', the search has no success profile yet, whatever the document says.",
  "A candidate who withdraws late almost always signalled it early. The signal is usually a question you answered too quickly.",
  "Passive candidates do not respond to opportunity. They respond to a specific, accurate observation about their own work.",
  "The second follow-up outperforms the first. Most recruiters stop at one, which is why it still works.",
  "A shortlist of five identical profiles is one profile. Diversity of evidence is what makes a comparison possible.",
  "If you cannot say why the last hire in this team succeeded, you are sourcing against a job description rather than a role.",
  "Time-to-fill is mostly waiting on decisions, not on candidates. Measure where the days actually go before optimising sourcing.",
  "Recording why you rejected someone is worth more than recording why you advanced them. The rejections are where the calibration is.",
];

/** Deterministic, so the note changes daily and never mid-session. */
export function craftNoteFor(day: string): string {
  let hash = 0;
  for (let i = 0; i < day.length; i += 1) {
    hash = (hash * 31 + day.charCodeAt(i)) >>> 0;
  }
  return CRAFT_NOTES[hash % CRAFT_NOTES.length];
}
