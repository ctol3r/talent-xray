/**
 * The outbox as a queue: scanning, claiming, and writing — the half of the
 * watcher that touches the disk.
 *
 * Three properties are load-bearing, and each one is a line of code you can
 * point at:
 *
 *   Atomic  — every write goes to a temp file in the same directory and is
 *             renamed into place. `rename(2)` within a filesystem is atomic,
 *             so a reader sees the old file or the new one and never a
 *             half-written one. The app's own check is `existsSync(response)`
 *             followed by `JSON.parse`, so a partial response would read as a
 *             corrupt generation.
 *   Claimed — `open(..., "wx")` fails if the file exists, which is an atomic
 *             test-and-set. That is the whole mutual exclusion; no lock file
 *             protocol, no lease renewal, no coordination between watchers.
 *   Bounded — a claim is a lease that expires, so a watcher killed mid-request
 *             does not strand that request forever.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  CLAIM_SUFFIX,
  FAILURE_SUFFIX,
  HEARTBEAT_NAME,
  REQUEST_SUFFIX,
  RESPONSE_SUFFIX,
  type Claim,
  type FailureRecord,
  type Heartbeat,
  type OutboxRequest,
  baseFromRequestName,
  isClaimStale,
  isTempName,
  outboxPaths,
  tempName,
} from "./protocol";

export function outboxDir(): string {
  const configured =
    process.env.TALENTOS_SESSION_OUTBOX ?? "./data/session-outbox";
  return path.isAbsolute(configured)
    ? configured
    : path.join(process.cwd(), configured);
}

export interface QueueEntry {
  base: string;
  requestPath: string;
  responsePath: string;
  claimPath: string;
  failurePath: string;
  answered: boolean;
  failed: boolean;
  claim: Claim | null;
  writtenAt: Date;
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

/** Everything in the directory, in the order it was written. */
export function scanQueue(dir: string): QueueEntry[] {
  if (!fs.existsSync(dir)) return [];
  const entries: QueueEntry[] = [];
  for (const name of fs.readdirSync(dir)) {
    const base = baseFromRequestName(name);
    if (base === null) continue;
    const paths = outboxPaths(dir, base);
    let writtenAt = new Date(0);
    try {
      writtenAt = fs.statSync(paths.request).mtime;
    } catch {
      // Vanished between readdir and stat; the filters below drop it.
      continue;
    }
    entries.push({
      base,
      requestPath: paths.request,
      responsePath: paths.response,
      claimPath: paths.claim,
      failurePath: paths.failure,
      answered: fs.existsSync(paths.response),
      failed: fs.existsSync(paths.failure),
      claim: readJson<Claim>(paths.claim),
      writtenAt,
    });
  }
  return entries.sort((a, b) => a.writtenAt.getTime() - b.writtenAt.getTime());
}

/**
 * What a watcher should try next: unanswered, not already given up on, and
 * not held by a live claim. A request whose claim has gone stale is included
 * — reclaiming it is the crash-recovery path.
 */
export function pendingEntries(
  dir: string,
  options: { now?: number; staleClaimMs: number; includeFailed?: boolean },
): QueueEntry[] {
  const now = options.now ?? Date.now();
  return scanQueue(dir).filter((entry) => {
    if (entry.answered) return false;
    if (entry.failed && !options.includeFailed) return false;
    if (entry.claim && !isClaimStale(entry.claim, now, options.staleClaimMs))
      return false;
    return true;
  });
}

export function readRequest(file: string): OutboxRequest {
  return JSON.parse(fs.readFileSync(file, "utf8")) as OutboxRequest;
}

function token(): string {
  return `${process.pid}-${randomBytes(4).toString("hex")}`;
}

/**
 * Write a file that is never observed half-written.
 *
 * The temp file lives beside its target so the rename stays within one
 * filesystem, and `rename` replaces the destination in a single step.
 */
export function writeAtomic(target: string, contents: string): void {
  const dir = path.dirname(target);
  const temp = path.join(dir, tempName(path.basename(target), "", token()));
  const handle = fs.openSync(temp, "wx");
  try {
    fs.writeFileSync(handle, contents);
    // Durability before visibility: the rename must not be able to publish a
    // name whose contents are still only in the page cache.
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  try {
    fs.renameSync(temp, target);
  } catch (error) {
    fs.rmSync(temp, { force: true });
    throw error;
  }
}

export interface ClaimResult {
  claimed: boolean;
  stolenFrom?: Claim;
}

/**
 * Take the request, or decline.
 *
 * `wx` is the atomic part: two watchers racing on the same request both call
 * it, exactly one succeeds, and the loser is told so rather than doing the
 * work twice. The steal path is deliberately last-writer-wins — two watchers
 * reclaiming the same abandoned lease is not worth a second protocol, and the
 * worst case is one duplicated generation whose response rename is itself
 * atomic.
 */
export function claim(
  entry: QueueEntry,
  attempt: number,
  options: { now?: number; staleClaimMs: number; owner: string },
): ClaimResult {
  const now = options.now ?? Date.now();
  const record: Claim = {
    owner: options.owner,
    pid: process.pid,
    host: os.hostname(),
    startedAt: new Date(now).toISOString(),
    attempt,
  };
  const body = JSON.stringify(record, null, 2);
  try {
    const handle = fs.openSync(entry.claimPath, "wx");
    try {
      fs.writeFileSync(handle, body);
    } finally {
      fs.closeSync(handle);
    }
    return { claimed: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const existing = readJson<Claim>(entry.claimPath);
  // An unparseable claim is treated as stale: it is either a partial write
  // from a process that died, or junk. Either way nobody is coming back.
  if (existing && !isClaimStale(existing, now, options.staleClaimMs)) {
    return { claimed: false };
  }
  writeAtomic(entry.claimPath, body);
  return { claimed: true, stolenFrom: existing ?? undefined };
}

/**
 * Claim a request and confirm it still needs doing.
 *
 * The pending list is a snapshot, and a claim is released the moment the work
 * behind it finishes — so between that snapshot and this call another watcher
 * may have answered this request and let go of it, leaving the claim free to
 * take and the work already done. Re-reading the response under the claim is
 * what makes two watchers safe. Without it they duplicate a generation
 * whenever one finishes while the other is still queued behind it: eight
 * requests, eight responses, nine invocations.
 */
export function claimForWork(
  entry: QueueEntry,
  attempt: number,
  options: { now?: number; staleClaimMs: number; owner: string },
): ClaimResult & { alreadyAnswered: boolean } {
  const taken = claim(entry, attempt, options);
  if (!taken.claimed) return { ...taken, alreadyAnswered: false };
  if (fs.existsSync(entry.responsePath)) {
    releaseClaim(entry);
    return { claimed: false, alreadyAnswered: true };
  }
  return { ...taken, alreadyAnswered: false };
}

export function releaseClaim(entry: QueueEntry): void {
  fs.rmSync(entry.claimPath, { force: true });
}

/** The response the app is waiting for. Atomic, so it appears whole. */
export function writeResponse(
  entry: QueueEntry,
  body: Record<string, unknown>,
): void {
  writeAtomic(entry.responsePath, JSON.stringify(body, null, 2));
}

/**
 * Give up loudly. The request stays exactly where it is, so `pnpm outbox`
 * still lists it and a later run with --retry-failed can pick it up; the
 * sibling file is the record of why nobody has.
 */
export function writeFailure(entry: QueueEntry, record: FailureRecord): void {
  writeAtomic(entry.failurePath, JSON.stringify(record, null, 2));
}

export function readFailure(entry: QueueEntry): FailureRecord | null {
  return readJson<FailureRecord>(entry.failurePath);
}

export function clearFailure(entry: QueueEntry): void {
  fs.rmSync(entry.failurePath, { force: true });
}

export function heartbeatPath(dir: string): string {
  return path.join(dir, HEARTBEAT_NAME);
}

export function readHeartbeat(dir: string): Heartbeat | null {
  return readJson<Heartbeat>(heartbeatPath(dir));
}

export function writeHeartbeat(dir: string, beat: Heartbeat): void {
  fs.mkdirSync(dir, { recursive: true });
  writeAtomic(heartbeatPath(dir), JSON.stringify(beat, null, 2));
}

/**
 * Sweep temp files left by a process that died between open and rename.
 * They are invisible to every reader by construction, but they accumulate,
 * and an outbox nobody can read at a glance is how this went wrong before.
 */
export function sweepTempFiles(dir: string, olderThanMs: number): number {
  if (!fs.existsSync(dir)) return 0;
  const cutoff = Date.now() - olderThanMs;
  let removed = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!isTempName(name)) continue;
    const full = path.join(dir, name);
    try {
      if (fs.statSync(full).mtimeMs < cutoff) {
        fs.rmSync(full, { force: true });
        removed += 1;
      }
    } catch {
      // Someone else swept it. Fine.
    }
  }
  return removed;
}

export { REQUEST_SUFFIX, RESPONSE_SUFFIX, CLAIM_SUFFIX, FAILURE_SUFFIX };
