/**
 * Reading the session outbox, without touching a disk.
 *
 * This install has no model key (D-008). Every generation is a file a Claude
 * session answers, and until now the only way to see the queue was to run
 * `pnpm outbox` in a terminal. A queue you can only see from a terminal is a
 * queue the person using the app cannot see, which is how a waiting request
 * came to look like a broken feature (D-036).
 *
 * Everything here is arithmetic on a parsed request: what it asks for, what
 * it belongs to, how long it has been sitting there. The filesystem lives in
 * `src/lib/services/outbox.ts`, so this half can be tested without one and
 * shared with the browser-only build, which has no filesystem at all.
 */

/**
 * A request file, as it is on disk. Two kinds land in the outbox — a
 * generation carries a schema name and two prompts, a research call carries a
 * query and a limit — and every field below is optional because a reader must
 * not assume it got the kind it was expecting.
 */
export interface OutboxRequest {
  respondTo?: string;
  instructions?: string;
  schemaName?: string;
  system?: string;
  user?: string;
  kind?: string;
  query?: string;
  limit?: number;
  outputJsonSchema?: unknown;
  responseSchema?: unknown;
}

/** What a request belongs to: a job, the conversation on the home page, or a query. */
export interface OutboxSubject {
  kind: "job" | "conversation" | "query" | "unknown";
  /** The job's title, the question asked, or the search query. */
  label: string;
}

/**
 * Names the schemas whose CamelCase does not survive being spaced out, or
 * whose real name is longer than the schema's. Everything else is derived,
 * so a task added tomorrow gets a readable label without being listed here.
 */
const KIND_LABELS: Record<string, string> = {
  AskAnswer: "Answer to a question in a note",
  ExpertReply: "Expert reply",
  HmBrief: "Hiring manager brief",
  MarketResearch: "Market intelligence",
  Research: "Web research",
  ScreenGuide: "Screen guide",
  StringExpansion: "String expansion",
};

/**
 * "RoleIntelligence" → "Role intelligence". A schema name is written for a
 * compiler; this is the same name written for somebody reading a list.
 */
export function kindLabel(schemaName: string): string {
  const named = KIND_LABELS[schemaName];
  if (named) return named;
  const spaced = schemaName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

/**
 * The schema a request is asking to be answered against.
 *
 * A generation says so in `schemaName`. A research call does not carry one —
 * its shape is fixed — so it is identified by the `Research-` stem its
 * provider writes, and the filename is the fallback for both.
 */
export function schemaNameOf(request: OutboxRequest, file: string): string {
  if (request.schemaName) return request.schemaName;
  if (request.query !== undefined || request.kind === "research")
    return "Research";
  const stem = file.replace(/\.request\.json$/, "");
  const dash = stem.lastIndexOf("-");
  return dash > 0 ? stem.slice(0, dash) : stem;
}

/**
 * What this request is about.
 *
 * A job-bound generation opens with a `## Search project` block whose first
 * line is the job's title, which is unique (D-049) and therefore enough to
 * name the job and to find it again. A chat turn is the question itself. A
 * research call is its query. Nothing here guesses: when the prompt says
 * nothing, the subject is unknown and says so.
 */
export function subjectOf(
  request: OutboxRequest,
  schemaName: string,
): OutboxSubject {
  if (request.query !== undefined)
    return { kind: "query", label: request.query };

  const user = request.user ?? "";
  const job = /^Search:[ \t]*(.+)$/m.exec(user);
  if (job) return { kind: "job", label: job[1].trim() };

  if (schemaName === "ExpertReply" || schemaName === "AskAnswer") {
    const asked = lastAsked(user);
    if (asked) return { kind: "conversation", label: asked };
  }

  const firstLine = user
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("#"));
  return firstLine
    ? { kind: "unknown", label: firstLine }
    : { kind: "unknown", label: "" };
}

/**
 * The question, out of an expert prompt that may carry the conversation
 * before it. The provider prefixes history with a fixed sentence, so the
 * question is whatever follows it; with no history the prompt is the
 * question and nothing needs unwrapping.
 */
function lastAsked(user: string): string {
  const marker = "The recruiter now asks:";
  const at = user.lastIndexOf(marker);
  if (at >= 0) return user.slice(at + marker.length).trim();
  return user.trim();
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * How long something has been waiting, in the largest unit that is still
 * true. Rounded down: a request written 47 hours ago has been waiting a day,
 * not two, and overstating the wait on the one screen whose job is to show
 * the wait would be a strange place to start rounding up.
 */
export function formatWaited(ms: number): string {
  if (ms < MINUTE) return "under a minute";
  const plural = (n: number, unit: string) =>
    `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (ms < HOUR) return plural(Math.floor(ms / MINUTE), "minute");
  if (ms < DAY) return plural(Math.floor(ms / HOUR), "hour");
  return plural(Math.floor(ms / DAY), "day");
}

/**
 * The filename stem the outbox is keyed on: a schema name and twelve hex
 * digits of the prompt hash. Anything else is not a request this app wrote,
 * and is refused before a path is built from it.
 */
export const REQUEST_ID = /^[A-Za-z][A-Za-z0-9]*-[0-9a-f]{12}$/;

export function isRequestId(value: string): boolean {
  return REQUEST_ID.test(value);
}
