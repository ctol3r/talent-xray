/**
 * The outbox protocol, as pure functions.
 *
 * This install has no model key (D-008): a generation writes
 * `<base>.request.json` and waits for a session to write
 * `<base>.response.json`. Until now a human was the session, so eight jobs
 * meant eight hand-fulfilled requests. The watcher makes it a batch job.
 *
 * Everything here is decision-making with no filesystem in it — which file a
 * name implies, whether a claim has gone stale, how long to wait before the
 * next attempt, and how to get a JSON object out of whatever a model actually
 * printed. `queue.ts` does the I/O and calls these; the tests call these
 * directly, which is the point of the split.
 *
 * Two rules the file names encode, because a queue that loses work is worse
 * than no queue: a response only ever appears complete (written to a temp
 * file and renamed), and a request that could not be fulfilled leaves a
 * `.failure.json` beside it rather than disappearing.
 */

/** Suffixes are the whole protocol. Nothing else in the directory is ours. */
export const REQUEST_SUFFIX = ".request.json";
export const RESPONSE_SUFFIX = ".response.json";
export const CLAIM_SUFFIX = ".claim.json";
export const FAILURE_SUFFIX = ".failure.json";

/** Dot-prefixed so `pnpm outbox` and a directory listing stay readable. */
export const HEARTBEAT_NAME = ".watcher.json";

export interface OutboxPaths {
  base: string;
  request: string;
  response: string;
  claim: string;
  failure: string;
}

function join(dir: string, name: string): string {
  return dir.endsWith("/") ? `${dir}${name}` : `${dir}/${name}`;
}

export function outboxPaths(dir: string, base: string): OutboxPaths {
  return {
    base,
    request: join(dir, base + REQUEST_SUFFIX),
    response: join(dir, base + RESPONSE_SUFFIX),
    claim: join(dir, base + CLAIM_SUFFIX),
    failure: join(dir, base + FAILURE_SUFFIX),
  };
}

/** `HiringNeed-a06f723d1232.request.json` → `HiringNeed-a06f723d1232`. */
export function baseFromRequestName(name: string): string | null {
  return name.endsWith(REQUEST_SUFFIX)
    ? name.slice(0, -REQUEST_SUFFIX.length)
    : null;
}

/**
 * A temp name that no other watcher can collide with, in the same directory
 * as its target so the rename is atomic — a rename across filesystems is a
 * copy, and a copy is exactly the half-written file this avoids.
 */
export function tempName(base: string, suffix: string, token: string): string {
  return `.${base}${suffix}.${token}.tmp`;
}

export function isTempName(name: string): boolean {
  return name.startsWith(".") && name.endsWith(".tmp");
}

/** The two shapes that land in the outbox: a generation and a research call. */
export interface OutboxRequest {
  respondTo: string;
  instructions?: string;
  schemaName?: string;
  system?: string;
  user?: string;
  kind?: string;
  query?: string;
  limit?: number;
  /** Generations carry `outputJsonSchema`; research carries `responseSchema`. */
  outputJsonSchema?: unknown;
  responseSchema?: unknown;
}

export interface Claim {
  owner: string;
  pid: number;
  host: string;
  startedAt: string;
  attempt: number;
}

export interface FailureRecord {
  base: string;
  kind: string;
  attempts: { attempt: number; at: string; error: string }[];
  lastError: string;
  failedAt: string;
  /** Said plainly, because a failure file is read by someone who is stuck. */
  note: string;
}

export interface CompletedRecord {
  id: string;
  kind: string;
  outcome: string;
  durationMs: number;
  at: string;
}

export interface Heartbeat {
  pid: number;
  host: string;
  mode: "watch" | "once";
  concurrency: number;
  startedAt: string;
  updatedAt: string;
  fulfilled: number;
  failed: number;
  lastCompleted: CompletedRecord | null;
  stoppedAt?: string;
}

/** One line's worth of what a request is for, whichever kind it is. */
export function describeRequest(request: OutboxRequest): {
  kind: string;
  about: string;
} {
  if (request.query !== undefined) {
    return {
      kind: `Research(${request.kind ?? "search"})`,
      about: request.query,
    };
  }
  const firstLine =
    (request.user ?? "")
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith("#")) ?? "";
  return { kind: request.schemaName ?? "unknown", about: firstLine };
}

/**
 * Exponential with full jitter. Jitter matters here because two watchers that
 * fail on the same overloaded model would otherwise retry in lockstep for as
 * long as the overload lasts.
 */
export function backoffMs(
  attempt: number,
  baseMs: number,
  maxMs: number,
  random: () => number = Math.random,
): number {
  const ceiling = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  return Math.round(ceiling * (0.5 + 0.5 * random()));
}

/**
 * A claim is a lease, not a lock. A watcher killed mid-request leaves its
 * claim behind; without an expiry that request would be unreachable forever,
 * which is the failure mode this whole design exists to avoid.
 */
export function isClaimStale(
  claim: Claim,
  now: number,
  staleMs: number,
): boolean {
  const started = Date.parse(claim.startedAt);
  if (Number.isNaN(started)) return true;
  return now - started > staleMs;
}

export type WatcherPresence =
  | { state: "running"; heartbeat: Heartbeat; ageMs: number }
  | { state: "stale"; heartbeat: Heartbeat; ageMs: number }
  | { state: "stopped"; heartbeat: Heartbeat; ageMs: number }
  | { state: "never" };

/**
 * Whether anyone is minding the queue. `stale` is the honest answer when a
 * heartbeat exists but has stopped moving — the process was killed, or the
 * machine slept — and it reads differently from "no watcher has ever run",
 * so the status surface can say which without guessing.
 */
export function watcherPresence(
  heartbeat: Heartbeat | null,
  now: number,
  staleMs: number,
): WatcherPresence {
  if (!heartbeat) return { state: "never" };
  const updated = Date.parse(heartbeat.updatedAt);
  const ageMs = Number.isNaN(updated)
    ? Number.POSITIVE_INFINITY
    : now - updated;
  if (heartbeat.stoppedAt) return { state: "stopped", heartbeat, ageMs };
  return { state: ageMs <= staleMs ? "running" : "stale", heartbeat, ageMs };
}

export class ResponseShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResponseShapeError";
  }
}

/**
 * Get the output object out of whatever the fulfiller printed.
 *
 * The request asks for bare JSON, and a model mostly complies, but "mostly"
 * is not a contract. Rather than fail a whole generation on a stray fence or
 * a sentence of preamble, this recovers the object — and still refuses
 * anything that is not a JSON object, because writing a string or an array
 * into the response file would only move the error downstream into zod.
 */
export function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new ResponseShapeError("the fulfiller printed nothing");
  }
  for (const candidate of jsonCandidates(trimmed)) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next candidate; the last throw below reports the failure.
    }
  }
  throw new ResponseShapeError(
    `no JSON object found in ${trimmed.length} characters of output ` +
      `(starts: ${JSON.stringify(trimmed.slice(0, 120))})`,
  );
}

/** Whole string, then any fenced block, then the outermost braces. */
function* jsonCandidates(text: string): Generator<string> {
  yield text;
  const fence = /```(?:json)?\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(text)) !== null) yield match[1];
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) yield text.slice(first, last + 1);
}
