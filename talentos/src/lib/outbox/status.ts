/**
 * What the outbox looks like right now, for the page that reports it.
 *
 * The failure this answers is a specific one, recorded as D-036: a request
 * sitting unanswered looked exactly like a crash, so a working feature was
 * reported broken. `pnpm outbox` fixed that at the terminal. This is the same
 * answer inside the workspace, and it adds the question the watcher makes it
 * possible to ask at all — is anything actually working through the queue, or
 * is it just sitting there.
 */
import {
  type CompletedRecord,
  type Heartbeat,
  type WatcherPresence,
  describeRequest,
  watcherPresence,
} from "./protocol";
import {
  type QueueEntry,
  outboxDir,
  readFailure,
  readHeartbeat,
  readRequest,
  scanQueue,
} from "./queue";

/**
 * Three heartbeats' grace. The watcher beats every 5s, so a watcher that is
 * merely busy is never reported as gone, and one that was killed is reported
 * within about fifteen seconds.
 */
export const HEARTBEAT_STALE_MS = 20_000;

export interface OutboxItem {
  base: string;
  kind: string;
  about: string;
  writtenAt: string;
  state: "waiting" | "in-flight" | "failed" | "answered";
  claimedBy?: string;
  claimedAt?: string;
  lastError?: string;
}

export interface OutboxStatus {
  dir: string;
  exists: boolean;
  presence: WatcherPresence;
  lastCompleted: CompletedRecord | null;
  counts: {
    waiting: number;
    inFlight: number;
    failed: number;
    answered: number;
  };
  waiting: OutboxItem[];
  failed: OutboxItem[];
}

function safeDescribe(entry: QueueEntry): { kind: string; about: string } {
  try {
    return describeRequest(readRequest(entry.requestPath));
  } catch {
    return { kind: "unreadable", about: "" };
  }
}

export function getOutboxStatus(
  options: { dir?: string; now?: number } = {},
): OutboxStatus {
  const dir = options.dir ?? outboxDir();
  const now = options.now ?? Date.now();
  const heartbeat: Heartbeat | null = readHeartbeat(dir);
  const entries = scanQueue(dir);

  const waiting: OutboxItem[] = [];
  const failed: OutboxItem[] = [];
  let answered = 0;
  let inFlight = 0;

  for (const entry of entries) {
    if (entry.answered) {
      answered += 1;
      continue;
    }
    const { kind, about } = safeDescribe(entry);
    const writtenAt = entry.writtenAt.toISOString();
    if (entry.failed) {
      failed.push({
        base: entry.base,
        kind,
        about,
        writtenAt,
        state: "failed",
        lastError: readFailure(entry)?.lastError,
      });
      continue;
    }
    if (entry.claim) {
      inFlight += 1;
      waiting.push({
        base: entry.base,
        kind,
        about,
        writtenAt,
        state: "in-flight",
        claimedBy: entry.claim.owner,
        claimedAt: entry.claim.startedAt,
      });
      continue;
    }
    waiting.push({
      base: entry.base,
      kind,
      about,
      writtenAt,
      state: "waiting",
    });
  }

  return {
    dir,
    exists: entries.length > 0 || heartbeat !== null,
    presence: watcherPresence(heartbeat, now, HEARTBEAT_STALE_MS),
    lastCompleted: heartbeat?.lastCompleted ?? null,
    counts: {
      waiting: waiting.length - inFlight,
      inFlight,
      failed: failed.length,
      answered,
    },
    waiting,
    failed,
  };
}
