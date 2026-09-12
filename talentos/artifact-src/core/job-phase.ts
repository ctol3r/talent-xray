/**
 * Which phase a job is actually in, read off the hill chart.
 *
 * The workspace shows four phase names — Understand, Find, Engage, Decide.
 * They used to be a row of links, which made them a second copy of the module
 * tabs underneath: "Understand" and "Overview" resolved to the same URL, and
 * the other three were shortcuts to the first tab of their group. A row that
 * only repeats the row below it is worth its space only if it says something
 * the other row cannot, so it now says where the job is rather than offering
 * to take you somewhere.
 *
 * Where it is comes from the hill, because the hill is the only place in this
 * product that records a judgement about how much is still unknown. Nothing
 * here writes a position — the ban in `hill.ts` is on the software moving a
 * dot, not on the software reading one — and nothing here is a percentage. It
 * is a name, and the name of the scope that chose it.
 *
 * **The rule: a job is in the earliest phase that still has unknowns in it.**
 *
 * Not the furthest phase it has touched, which is the tempting one. You can be
 * interviewing people while the pay band is still a question, and a row that
 * said "Engage" then would be agreeing with the calendar instead of the work.
 * The hill's whole argument is that a scope past the crest is a different kind
 * of not-done from one still uphill; this applies that argument to the job.
 *
 * Not to be confused with `phases.ts`, which is the artifact's own five-phase
 * information architecture (Define/Research/Plan/Execute/Learn) over the module
 * state machine. That one describes what the software can do next. This one
 * describes what the recruiter still does not know.
 */
import type { ScopeReading } from "./hill";

/** In the order a job passes through them. The order is the derivation. */
export const JOB_PHASES = ["understand", "find", "engage", "decide"] as const;
export type JobPhaseId = (typeof JOB_PHASES)[number];

/**
 * Which phase each of the seven default scopes belongs to.
 *
 * Keyed by scope id rather than by name or position, because an id is the one
 * thing that survives what people actually do to a chart: `renameScope` keeps
 * it, so a scope renamed into the owner's own words still reports its phase,
 * and `removeScope` takes it away cleanly rather than shifting every scope
 * after it onto the wrong phase, which is what an index would do.
 *
 * A scope the owner added, or the second half of one they split, has an id
 * that is not in here and is deliberately left unplaced: it counts towards no
 * phase. Guessing which phase somebody's own scope belongs to would be a
 * worse answer than not having one, and it would be invisibly wrong.
 */
export const DEFAULT_SCOPE_PHASE: Readonly<Record<string, JobPhaseId>> = {
  s1: "understand", // What the job is
  s2: "understand", // What it pays
  s3: "find", // Where these people are
  s4: "find", // Reaching them
  s5: "engage", // A pipeline that stands up
  s6: "engage", // The manager and I agree
  s7: "decide", // Getting to a signature
};

export interface JobPhaseReading {
  phase: JobPhaseId;
  /** The scope that put the job here. Null when nothing is left uphill. */
  because: ScopeReading | null;
  /**
   * Phases the job is past: earlier than the current one, and with scopes of
   * their own to have finished.
   *
   * Deliberately not "every phase with nothing uphill in it". One of the real
   * pilot charts has the first five scopes untouched at zero and the last two
   * dragged along, which by that reading would tick Decide as settled while
   * the job sits in Understand — a mark that says the end is finished and the
   * beginning is not. Behind you is a thing a phase can be; ahead of you and
   * incidentally downhill is not.
   */
  settled: JobPhaseId[];
  /**
   * True when no scope has been touched, so the phase below is where a job
   * starts rather than something anybody has said. The difference matters:
   * one is a reading and the other is a default wearing a reading's clothes.
   */
  unread: boolean;
  /** One line, for the row. Says the phase and why. */
  says: string;
}

/**
 * Uphill, or never started: the two states where something is still unknown.
 * The crest is where the unknowns are gone, so it counts as settled — that is
 * what `phaseMeaning` already says the crest means.
 */
function hasUnknowns(reading: ScopeReading): boolean {
  if (reading.signal === "done") return false;
  return reading.phase === "not started" || reading.phase === "uphill";
}

/** A raised hand is the more useful explanation, so it is preferred. */
function pickReason(open: ScopeReading[]): ScopeReading | null {
  return (
    open.find((r) => r.signal === "backslid") ??
    open.find((r) => r.signal === "stuck") ??
    open.find((r) => r.signal === "still") ??
    open[0] ??
    null
  );
}

export function jobPhase(readings: ScopeReading[]): JobPhaseReading {
  const placed = readings.filter(
    (reading) => DEFAULT_SCOPE_PHASE[reading.scope.id] !== undefined,
  );
  const openIn = (phase: JobPhaseId) =>
    placed.filter(
      (reading) =>
        DEFAULT_SCOPE_PHASE[reading.scope.id] === phase && hasUnknowns(reading),
    );

  // The last phase is the fallback: nothing uphill anywhere means the only
  // thing left is getting to a signature.
  const phase =
    JOB_PHASES.find((candidate) => openIn(candidate).length > 0) ??
    JOB_PHASES[JOB_PHASES.length - 1];

  const settled = JOB_PHASES.slice(0, JOB_PHASES.indexOf(phase)).filter(
    (candidate) =>
      placed.some(
        (reading) => DEFAULT_SCOPE_PHASE[reading.scope.id] === candidate,
      ) && openIn(candidate).length === 0,
  );

  const because = pickReason(openIn(phase));
  const unread =
    placed.length === 0 ||
    placed.every(
      (reading) => reading.phase === "not started" && reading.signal !== "done",
    );

  return { phase, because, settled, unread, says: say(phase, because, unread) };
}

function say(
  phase: JobPhaseId,
  because: ScopeReading | null,
  unread: boolean,
): string {
  if (unread) return "nothing on the hill has moved yet";
  if (!because) return "nothing left uphill";
  return `${because.scope.name} — ${because.says}`;
}
