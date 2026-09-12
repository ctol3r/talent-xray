/**
 * The hill chart, after Shape Up chapter 13.
 *
 * A search is not a list of tasks that get ticked. It is a handful of separate
 * problems, each of which is first unknown and then merely unfinished, and the
 * difference between those two states is the only thing worth reporting. A
 * shortlist you have not built yet because you do not know where these people
 * are is nothing like a shortlist you have not built yet because you have the
 * names and have not written the messages. A task list calls both "not done"
 * and a percentage calls both 40%.
 *
 * So each scope is a dot on a hill. Uphill is figuring it out; the crest is the
 * moment the unknowns are gone; downhill is execution, where what remains is
 * known and the only question is doing it. This repo already bans
 * percent-complete, and this is what the ban was waiting for.
 *
 * Three rules hold the whole thing up, and every one of them is a refusal:
 *
 * 1. **Nothing here moves a dot.** Not the number of candidates, not the stage
 *    counts, not elapsed time. A position is a person's judgement about how
 *    much they still do not know, and there is no measurement of that. A hill
 *    chart the software fills in is percent-complete wearing a picture, which
 *    is the exact thing the chapter is arguing against. The app may show what
 *    it knows beside a scope; it may never convert that into a position.
 *
 * 2. **The trail is the evidence, not the dot.** One dot is an opinion. A
 *    fortnight of dots is a fact about the work: what moved, what did not, and
 *    what went backwards. So every move is kept, with who made it and why.
 *
 * 3. **A dot that has not moved is a raised hand, not a failing grade.** The
 *    question it asks is what could be solved to get it over the hill — about
 *    the work, not about the person.
 *
 * Nothing in this file imports anything but the clock, so the same chart draws
 * in the browser-only artifact and in the app.
 */
import { onClock, type JobClock } from "./clock";

/** Where a scope sits, from the left foot (0) over the crest (0.5) to done (1). */
export type HillPosition = number;

export interface HillScope {
  id: string;
  name: string;
  position: HillPosition;
  /**
   * What is still unknown, in the scope-holder's own words. Only meaningful
   * uphill: past the crest there is nothing left to say but "doing it".
   */
  unknown: string;
  /** Set when the scope leaves the hill. A finished scope is not a dot at 1. */
  doneAt: string | null;
  colour: string;
}

/** One saved state of the whole chart. The history is the point. */
export interface HillSnapshot {
  at: string;
  /** Who moved it. A chart with no author is a chart nobody will argue with. */
  by: string;
  positions: Record<string, HillPosition>;
  /** Names, unknowns and completion state as recorded then; absent in legacy history. */
  scopes?: HillScope[];
  note: string;
}

export interface HillChart {
  scopes: HillScope[];
  /** Oldest first. */
  history: HillSnapshot[];
}

// ---------------------------------------------------------------------------
// the shape

/**
 * The hill itself: up from the left foot, over at the middle, down to the
 * right. `(1 - cos 2πp) / 2` because it is flat at both feet and at the crest,
 * which is what makes the middle read as a place you arrive at rather than a
 * point you cross — and the flat feet mean a dot near the start or the end
 * moves along the ground rather than falling off an edge.
 */
export function hillHeight(p: HillPosition): number {
  return (1 - Math.cos(2 * Math.PI * clampPosition(p))) / 2;
}

export function clampPosition(p: number): HillPosition {
  if (!Number.isFinite(p)) return 0;
  return Math.min(1, Math.max(0, p));
}

/** The curve as an SVG path, sampled finely enough that it reads as smooth. */
export function hillPath(width: number, height: number, steps = 64): string {
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const x = p * width;
    const y = height - hillHeight(p) * height;
    points.push(`${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return points.join(" ");
}

/** Where a dot is drawn, in the same coordinates as the path. */
export function hillPoint(
  p: HillPosition,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: clampPosition(p) * width,
    y: height - hillHeight(p) * height,
  };
}

// ---------------------------------------------------------------------------
// what a position means

export type HillPhase =
  "not started" | "uphill" | "at the crest" | "downhill" | "as good as done";

/**
 * Bands rather than exact comparisons, because a dot is dragged by hand and
 * nobody lands on 0.5. The crest is a place, not a line.
 */
export function phaseOf(p: HillPosition): HillPhase {
  const at = clampPosition(p);
  if (at <= 0.02) return "not started";
  if (at < 0.45) return "uphill";
  if (at <= 0.55) return "at the crest";
  if (at < 0.98) return "downhill";
  return "as good as done";
}

/** The phase said as the thing it tells you, for a status line. */
export function phaseMeaning(phase: HillPhase): string {
  switch (phase) {
    case "not started":
      return "nobody has looked at this yet";
    case "uphill":
      return "still working out what to do";
    case "at the crest":
      return "the unknowns are gone; what is left is doing it";
    case "downhill":
      return "known work, just not finished";
    case "as good as done":
      return "finished bar the recording";
  }
}

// ---------------------------------------------------------------------------
// what the trail says

/**
 * How long a scope may sit still before it counts as a raised hand.
 *
 * A week on a search of ordinary length, because a week is the unit a search
 * runs on — the manager catch-up, the pipeline review, the weekly numbers. A
 * scope that survives one of those untouched has been passed over once, which
 * is the first moment worth mentioning it.
 *
 * But only on a search of ordinary length. Both of these are scaled by the
 * job's own clock (`onClock`), because a week of silence on a two-week search
 * is most of the search and a week on a two-year one is nothing. A fixed
 * threshold nags on the slow jobs and stays silent on the fast ones, which is
 * the worst of both.
 */
export const STILL_AFTER_DAYS = 7;

/** And how long before it stops being worth mentioning and starts being the point. */
export const STUCK_AFTER_DAYS = 14;

export type HillSignal = "moving" | "still" | "stuck" | "backslid" | "done";

export interface ScopeReading {
  scope: HillScope;
  phase: HillPhase;
  signal: HillSignal;
  /** Days since this scope's position last changed. Null if it never has. */
  stillForDays: number | null;
  /** The furthest it ever got, when that is further than it is now. */
  retreatedFrom: HillPosition | null;
  /** One line, said plainly, for the row beside the chart. */
  says: string;
}

const DAY_MS = 86_400_000;

function daysBetween(from: string, to: string): number {
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, (b - a) / DAY_MS);
}

/**
 * When this scope last actually moved, and how far it ever got.
 *
 * Walks the history rather than trusting the current position, because the
 * whole reason the history exists is that the current position cannot tell you
 * whether it arrived last week or an hour ago.
 */
function trailOf(
  scope: HillScope,
  history: HillSnapshot[],
): { lastMovedAt: string | null; everReached: HillPosition } {
  let lastMovedAt: string | null = null;
  let everReached = 0;
  let previous: number | null = null;
  for (const snapshot of history) {
    const at = snapshot.positions[scope.id];
    if (at === undefined) continue;
    everReached = Math.max(everReached, at);
    if (previous === null || Math.abs(at - previous) > 0.005) {
      if (previous !== null) lastMovedAt = snapshot.at;
      previous = at;
    }
  }
  everReached = Math.max(everReached, scope.position);
  return { lastMovedAt, everReached };
}

/**
 * Read one scope: where it is, whether it is moving, and what to say about it.
 *
 * A scope nobody has started is reported as not started rather than as stuck.
 * They are different situations and only one of them is a raised hand — the
 * chapter's signal is about work somebody is doing, and calling every untouched
 * scope stuck on day eight would bury the one that matters.
 */
export function readScope(
  scope: HillScope,
  history: HillSnapshot[],
  now: string,
  clock?: JobClock,
): ScopeReading {
  const stillAfter = clock
    ? onClock(STILL_AFTER_DAYS, clock)
    : STILL_AFTER_DAYS;
  const stuckAfter = clock
    ? onClock(STUCK_AFTER_DAYS, clock)
    : STUCK_AFTER_DAYS;
  const phase = phaseOf(scope.position);
  const { lastMovedAt, everReached } = trailOf(scope, history);
  const stillForDays = lastMovedAt ? daysBetween(lastMovedAt, now) : null;
  const days = stillForDays === null ? null : Math.floor(stillForDays);

  if (scope.doneAt) {
    return {
      scope,
      phase,
      signal: "done",
      stillForDays: days,
      retreatedFrom: null,
      says: "done",
    };
  }

  // Backsliding first, because it outranks everything else the trail can say.
  // A scope that crossed the crest and came back is the chapter's loudest
  // signal: the uphill work was done in somebody's head rather than their
  // hands, and the unknown was still there all along.
  if (everReached > 0.55 && scope.position < 0.45) {
    return {
      scope,
      phase,
      signal: "backslid",
      stillForDays: days,
      retreatedFrom: everReached,
      says: "was over the crest and is back below it — something that looked solved was not",
    };
  }

  if (phase === "not started") {
    return {
      scope,
      phase,
      signal: "moving",
      stillForDays: days,
      retreatedFrom: null,
      says: "not started",
    };
  }

  if (days !== null && stillForDays !== null && stillForDays >= stuckAfter) {
    return {
      scope,
      phase,
      signal: "stuck",
      stillForDays: days,
      retreatedFrom: null,
      says: `has not moved in ${days} days — what could be solved to get it over the hill?`,
    };
  }

  if (days !== null && stillForDays !== null && stillForDays >= stillAfter) {
    return {
      scope,
      phase,
      signal: "still",
      stillForDays: days,
      retreatedFrom: null,
      says: `${days} days in the same place`,
    };
  }

  return {
    scope,
    phase,
    signal: "moving",
    stillForDays: days,
    retreatedFrom: null,
    says: phaseMeaning(phase),
  };
}

export function readChart(
  chart: HillChart,
  now: string,
  clock?: JobClock,
): ScopeReading[] {
  return chart.scopes.map((scope) =>
    readScope(scope, chart.history, now, clock),
  );
}

/**
 * The line at the top of the chart.
 *
 * Deliberately not a number. It counts the things a person would count if they
 * looked at the picture — what is still unknown, and what has raised a hand.
 */
export function summariseChart(readings: ScopeReading[]): string {
  const live = readings.filter((r) => r.signal !== "done");
  if (live.length === 0) return "every scope is done";
  const uphill = live.filter(
    (r) => r.phase === "uphill" || r.phase === "not started",
  ).length;
  const raised = live.filter(
    (r) => r.signal === "stuck" || r.signal === "backslid",
  ).length;
  const parts: string[] = [];
  parts.push(
    uphill === 0
      ? "everything left is downhill"
      : `${uphill} of ${live.length} still has unknowns in it`,
  );
  if (raised > 0) {
    parts.push(`${raised} ${raised === 1 ? "has" : "have"} raised a hand`);
  }
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------
// the scopes a search starts with

/**
 * Colours that stay apart on both grounds. Never the only carrier of anything:
 * every dot is labelled, and every signal is also a word.
 */
export const HILL_COLOURS = [
  "#7dd3fc",
  "#5eead4",
  "#fcd34d",
  "#f0abfc",
  "#fdba74",
  "#a5b4fc",
  "#86efac",
] as const;

/**
 * What every search has to resolve, whoever is running it.
 *
 * Chosen so each one can genuinely go over its own hill without the others —
 * a scope that cannot move independently is not a scope, it is a stage, and
 * stages are what the pipeline board is already for. Each is phrased as the
 * question it answers, because the uphill half of any of these is exactly the
 * period where nobody can say what it is.
 *
 * They are a starting point, not a schema. Rename them, split one that turns
 * out to be two, delete one that does not apply to this job.
 */
export const DEFAULT_SCOPES: readonly { name: string; unknown: string }[] = [
  {
    name: "What the job is",
    unknown: "what good looks like, in terms the manager and the market share",
  },
  {
    name: "What it pays",
    unknown: "whether the band buys the person the brief describes",
  },
  {
    name: "Where these people are",
    unknown: "which surfaces hold them, and roughly how many there are",
  },
  {
    name: "Reaching them",
    unknown:
      "strings and channels that return the right people, not merely people",
  },
  {
    name: "A pipeline that stands up",
    unknown:
      "enough people who are qualified, interested and available at once",
  },
  {
    name: "The manager and I agree",
    unknown:
      "what a yes looks like, tested against real people rather than the brief",
  },
  {
    name: "Getting to a signature",
    unknown:
      "what else they are considering, and what would actually move them",
  },
];

export function defaultChart(): HillChart {
  return {
    scopes: DEFAULT_SCOPES.map((scope, index) => ({
      id: `s${index + 1}`,
      name: scope.name,
      position: 0,
      unknown: scope.unknown,
      doneAt: null,
      colour: HILL_COLOURS[index % HILL_COLOURS.length],
    })),
    history: [],
  };
}

// ---------------------------------------------------------------------------
// changing it

/** Move one scope. Returns a new chart; nothing here mutates. */
export function moveScope(
  chart: HillChart,
  scopeId: string,
  to: HillPosition,
): HillChart {
  return {
    ...chart,
    scopes: chart.scopes.map((scope) =>
      scope.id === scopeId ? { ...scope, position: clampPosition(to) } : scope,
    ),
  };
}

/**
 * Write down where everything is right now.
 *
 * Skipped when nothing has changed since the last one, so the trail stays a
 * record of movement rather than a record of the page being opened. Two
 * snapshots a minute apart saying the same thing make a stuck scope look busy,
 * which is the one lie this chart could tell.
 */
export function snapshot(
  chart: HillChart,
  by: string,
  note: string,
  at: string,
): HillChart {
  const positions: Record<string, HillPosition> = {};
  for (const scope of chart.scopes) positions[scope.id] = scope.position;

  const last = chart.history[chart.history.length - 1];
  if (
    last &&
    !note.trim() &&
    samePositions(last.positions, positions) &&
    JSON.stringify(last.scopes) === JSON.stringify(chart.scopes)
  ) {
    return chart;
  }
  return {
    ...chart,
    history: [
      ...chart.history,
      {
        at,
        by,
        positions,
        note,
        scopes: chart.scopes.map((scope) => ({ ...scope })),
      },
    ],
  };
}

function samePositions(
  a: Record<string, number>,
  b: Record<string, number>,
): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const left = a[key];
    const right = b[key];
    if (left === undefined || right === undefined) return false;
    if (Math.abs(left - right) > 0.005) return false;
  }
  return true;
}

export function addScope(
  chart: HillChart,
  name: string,
  unknown = "",
): HillChart {
  const taken = new Set(chart.scopes.map((s) => s.id));
  let n = chart.scopes.length + 1;
  while (taken.has(`s${n}`)) n++;
  return {
    ...chart,
    scopes: [
      ...chart.scopes,
      {
        id: `s${n}`,
        name: name.trim() || "New scope",
        position: 0,
        unknown,
        doneAt: null,
        colour: HILL_COLOURS[chart.scopes.length % HILL_COLOURS.length],
      },
    ],
  };
}

/**
 * Split a scope in two.
 *
 * The chapter's own remedy for a dot that will not move: look at what is
 * inside it, and if it is two problems, make it two dots so they can move
 * independently. Both halves start where the original was, because splitting a
 * scope does not tell you anything new about how far along it is — and the
 * original keeps its id so its trail is not orphaned.
 */
export function splitScope(
  chart: HillChart,
  scopeId: string,
  firstName: string,
  secondName: string,
): HillChart {
  const original = chart.scopes.find((scope) => scope.id === scopeId);
  if (!original) return chart;
  const withRename = {
    ...chart,
    scopes: chart.scopes.map((scope) =>
      scope.id === scopeId
        ? { ...scope, name: firstName.trim() || scope.name }
        : scope,
    ),
  };
  const added = addScope(withRename, secondName, original.unknown);
  return {
    ...added,
    scopes: added.scopes.map((scope, index) =>
      index === added.scopes.length - 1
        ? { ...scope, position: original.position }
        : scope,
    ),
  };
}

export function renameScope(
  chart: HillChart,
  scopeId: string,
  name: string,
  unknown?: string,
): HillChart {
  return {
    ...chart,
    scopes: chart.scopes.map((scope) =>
      scope.id === scopeId
        ? {
            ...scope,
            name: name.trim() || scope.name,
            unknown: unknown ?? scope.unknown,
          }
        : scope,
    ),
  };
}

/** Take a scope off the hill, or put it back on. */
export function finishScope(
  chart: HillChart,
  scopeId: string,
  at: string | null,
): HillChart {
  return {
    ...chart,
    scopes: chart.scopes.map((scope) =>
      scope.id === scopeId
        ? { ...scope, doneAt: at, position: at ? 1 : scope.position }
        : scope,
    ),
  };
}

/**
 * Drop a scope entirely.
 *
 * Its positions stay in the history: a snapshot is a record of what the chart
 * said on a day, and editing the past to match the present is how a trail
 * stops being evidence.
 */
export function removeScope(chart: HillChart, scopeId: string): HillChart {
  return { ...chart, scopes: chart.scopes.filter((s) => s.id !== scopeId) };
}
