/**
 * The outbox, fulfilled by a local Claude Code session instead of by hand.
 *
 * This install has no model key (D-008). A generation writes a request file
 * and throws "pending"; a session writes the response; the app is re-run. That
 * works, and it made the backlog a queue of manual chores — eight open jobs
 * meant opening eight files. This turns the queue into a batch job: the same
 * files, the same schema, fulfilled by `claude -p` running on this machine
 * under the owner's own subscription.
 *
 *   pnpm outbox:watch              → watch the directory until stopped
 *   pnpm outbox:watch --once       → drain what is waiting now, then exit
 *   pnpm outbox:watch --concurrency 3
 *
 * It is opt-in. No dev script starts it, because a process that spends the
 * owner's model budget should be one they chose to start.
 *
 * What it guarantees, and why each one is here:
 *   - A response file is written to a temp name and renamed, so the app never
 *     reads a half-written generation.
 *   - A request is claimed before work starts, so two watchers cannot both
 *     spend a generation on it. A claim older than --stale-claim-ms is
 *     reclaimable, so a watcher killed mid-request strands nothing.
 *   - Failure is a file, never a silence: after --attempts tries a
 *     `.failure.json` lands beside the request, and the request stays put.
 *   - Killing it is safe at any point. Restarting resumes.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import {
  type FailureRecord,
  type Heartbeat,
  type OutboxRequest,
  backoffMs,
  describeRequest,
  extractJsonObject,
} from "../src/lib/outbox/protocol";
import {
  type QueueEntry,
  claimForWork,
  clearFailure,
  outboxDir,
  pendingEntries,
  readRequest,
  releaseClaim,
  sweepTempFiles,
  writeFailure,
  writeHeartbeat,
  writeResponse,
} from "../src/lib/outbox/queue";

// ---------------------------------------------------------------- options

interface Options {
  dir: string;
  once: boolean;
  concurrency: number;
  attempts: number;
  backoffMs: number;
  maxBackoffMs: number;
  staleClaimMs: number;
  pollMs: number;
  timeoutMs: number;
  model: string;
  cmd: string;
  retryFailed: boolean;
  dryRun: boolean;
  preflight: boolean;
}

function parseOptions(argv: string[]): Options {
  const options: Options = {
    dir: outboxDir(),
    once: false,
    concurrency: 1,
    attempts: 3,
    backoffMs: 2_000,
    maxBackoffMs: 60_000,
    staleClaimMs: 15 * 60_000,
    pollMs: 2_000,
    timeoutMs: 10 * 60_000,
    model: process.env.TALENTOS_OUTBOX_MODEL ?? "opus",
    // Configurable because the fulfiller is a contract, not a hard-coded
    // binary: the tests point it at a script, and an owner who authenticates
    // differently can point it at their own wrapper.
    cmd: process.env.TALENTOS_OUTBOX_CMD ?? "claude",
    retryFailed: false,
    dryRun: false,
    preflight: true,
  };
  const number = (raw: string | undefined, flag: string): number => {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      fail(`${flag} needs a positive number, got ${raw ?? "nothing"}`);
    }
    return value;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = (): string | undefined => argv[(i += 1)];
    switch (arg) {
      case "--once":
        options.once = true;
        break;
      case "--retry-failed":
        options.retryFailed = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--no-preflight":
        options.preflight = false;
        break;
      case "--concurrency":
        options.concurrency = number(next(), "--concurrency");
        break;
      case "--attempts":
        options.attempts = number(next(), "--attempts");
        break;
      case "--backoff-ms":
        options.backoffMs = number(next(), "--backoff-ms");
        break;
      case "--max-backoff-ms":
        options.maxBackoffMs = number(next(), "--max-backoff-ms");
        break;
      case "--stale-claim-ms":
        options.staleClaimMs = number(next(), "--stale-claim-ms");
        break;
      case "--poll-ms":
        options.pollMs = number(next(), "--poll-ms");
        break;
      case "--timeout-ms":
        options.timeoutMs = number(next(), "--timeout-ms");
        break;
      case "--model": {
        const value = next();
        if (!value) fail("--model needs a value");
        options.model = value;
        break;
      }
      case "--cmd": {
        const value = next();
        if (!value) fail("--cmd needs a value");
        options.cmd = value;
        break;
      }
      case "--dir": {
        const value = next();
        if (!value) fail("--dir needs a value");
        options.dir = path.resolve(value);
        break;
      }
      case "--help":
      case "-h":
        console.log(USAGE);
        process.exit(0);
        break;
      default:
        fail(`unknown option ${arg}\n\n${USAGE}`);
    }
  }
  return options;
}

const USAGE = `usage: pnpm outbox:watch [options]

  --once                drain what is waiting now, then exit
  --concurrency N       requests in flight at once (default 1)
  --attempts N          tries per request before giving up (default 3)
  --backoff-ms N        first retry delay, doubling with jitter (default 2000)
  --max-backoff-ms N    ceiling on that delay (default 60000)
  --stale-claim-ms N    when another watcher's claim is reclaimable (default 900000)
  --poll-ms N           directory poll interval in watch mode (default 2000)
  --timeout-ms N        per-attempt limit on the fulfiller (default 600000)
  --model NAME          model to fulfil with (default opus)
  --cmd PATH            fulfiller command (default claude)
  --retry-failed        also retry requests that have a .failure.json
  --dir PATH            outbox directory (default $TALENTOS_SESSION_OUTBOX)
  --dry-run             report what would be fulfilled, write nothing
  --no-preflight        skip the "is the fulfiller logged in" check`;

function fail(message: string): never {
  console.error(`outbox:watch: ${message}`);
  process.exit(2);
}

// ------------------------------------------------------------- fulfilment

/**
 * The contract we put in front of the model. The request's own `system` is
 * the role; this adds only the output discipline, because a response file
 * that is prose is a response file the app rejects.
 */
function systemPrompt(request: OutboxRequest): string {
  const schema = request.outputJsonSchema ?? request.responseSchema;
  const parts = [
    request.system ??
      "You are answering a structured request from the TalentOS outbox.",
    "",
    "## Output contract",
    request.instructions ??
      "Compose the highest-quality output satisfying the request.",
    "Reply with a single JSON object and nothing else: no prose before or " +
      "after it, no markdown fences, no commentary. The entire reply must " +
      "parse as one JSON object.",
  ];
  if (schema !== undefined) {
    parts.push(
      "",
      "## The object must satisfy this JSON schema",
      JSON.stringify(schema),
    );
  }
  return parts.join("\n");
}

/** Research asks a different question, so it gets a different prompt. */
function userPrompt(request: OutboxRequest): string {
  if (request.query !== undefined) {
    return [
      `Search the web for: ${request.query}`,
      "",
      `Return at most ${request.limit ?? 8} results.`,
      "Public, audience-level information only — never a specific person's",
      "profile page. Include only results a search actually returned; never",
      "invent a URL.",
    ].join("\n");
  }
  return request.user ?? "";
}

/**
 * Tools are off for a generation: it is a composition task over a prompt that
 * already carries its context, and a generator that can read this repository
 * is a generator that can wander into it. Research is the exception, because
 * a research answer with no search behind it is a fabricated one.
 */
const NO_TOOLS = [
  "Bash",
  "Read",
  "Write",
  "Edit",
  "Glob",
  "Grep",
  "Task",
  "WebSearch",
  "WebFetch",
  "NotebookEdit",
  "TodoWrite",
];

function fulfillerArgs(request: OutboxRequest, options: Options): string[] {
  const isResearch = request.query !== undefined;
  const denied = isResearch
    ? NO_TOOLS.filter((t) => t !== "WebSearch" && t !== "WebFetch")
    : NO_TOOLS;
  return [
    "-p",
    "--output-format",
    "json",
    "--model",
    options.model,
    "--system-prompt",
    systemPrompt(request),
    "--disallowedTools",
    denied.join(","),
  ];
}

interface FulfillerOutput {
  text: string;
}

/**
 * Run the fulfiller once. The user prompt goes on stdin because it reaches
 * 100KB on a real generation, and argv is not the place for that.
 */
function runFulfiller(
  request: OutboxRequest,
  options: Options,
  signal: AbortSignal,
): Promise<FulfillerOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.cmd, fulfillerArgs(request, options), {
      stdio: ["pipe", "pipe", "pipe"],
      signal,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      reject(
        error.code === "ABORT_ERR"
          ? new Error(`timed out after ${options.timeoutMs}ms`)
          : new Error(`could not run ${options.cmd}: ${error.message}`),
      );
    });
    child.on("close", (code) => {
      if (signal.aborted) {
        reject(new Error(`timed out after ${options.timeoutMs}ms`));
        return;
      }
      if (code !== 0) {
        const detail = (stderr || stdout).trim().slice(0, 400);
        reject(new Error(`${options.cmd} exited ${code}: ${detail}`));
        return;
      }
      resolve({ text: stdout });
    });
    child.stdin.end(userPrompt(request), "utf8");
  });
}

/**
 * `--output-format json` wraps the reply in a result envelope. Unwrap it when
 * it is there, and fall back to the raw text when the fulfiller is something
 * simpler — a test stub, or an owner's own wrapper script.
 */
function replyText(raw: string): string {
  try {
    const envelope: unknown = JSON.parse(raw);
    if (envelope && typeof envelope === "object" && "result" in envelope) {
      const record = envelope as { result?: unknown; is_error?: unknown };
      if (record.is_error === true) {
        throw new Error(
          `fulfiller reported an error: ${String(record.result ?? "unknown")}`,
        );
      }
      if (typeof record.result === "string") return record.result;
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("fulfiller reported")
    )
      throw error;
  }
  return raw;
}

/**
 * Ask the fulfiller whether it can actually reach a model, before spending a
 * queue on finding out.
 *
 * Worth the extra process: `claude` is authenticated per-machine, and an
 * install that has never run `claude auth login` answers every request with
 * "Not logged in". Without this, one unattended run over eight jobs is
 * twenty-four failed attempts and eight failure files, and the reason is
 * buried in the last line of each. Skipped for a custom --cmd, which has no
 * obligation to implement `auth status`.
 */
function preflight(options: Options): void {
  if (!options.preflight) return;
  if (path.basename(options.cmd) !== "claude") return;
  const probe = spawnSync(options.cmd, ["auth", "status"], {
    encoding: "utf8",
    timeout: 30_000,
  });
  if (probe.error || probe.status !== 0) return; // Older CLI, or no such command — let the work decide.
  try {
    const status = JSON.parse(probe.stdout) as { loggedIn?: boolean };
    if (status.loggedIn === false) {
      fail(
        `${options.cmd} is not logged in on this machine, so every request would fail.\n` +
          "  Fix it once, in a terminal:  claude auth login\n" +
          "  Then run this again. Nothing in the outbox has been touched.",
      );
    }
  } catch {
    // Unparseable status is not evidence of anything. Carry on.
  }
}

// ------------------------------------------------------------------ state

const startedAt = new Date().toISOString();
const owner = `${os.hostname()}:${process.pid}:${randomBytes(3).toString("hex")}`;
let fulfilled = 0;
let failedCount = 0;
let lastCompleted: Heartbeat["lastCompleted"] = null;
let stopping = false;

function beat(options: Options, stoppedAt?: string): void {
  const heartbeat: Heartbeat = {
    pid: process.pid,
    host: os.hostname(),
    mode: options.once ? "once" : "watch",
    concurrency: options.concurrency,
    startedAt,
    updatedAt: new Date().toISOString(),
    fulfilled,
    failed: failedCount,
    lastCompleted,
    ...(stoppedAt ? { stoppedAt } : {}),
  };
  try {
    writeHeartbeat(options.dir, heartbeat);
  } catch (error) {
    console.error(`  heartbeat could not be written: ${String(error)}`);
  }
}

/** One line per request, which is the whole log format. */
function log(
  base: string,
  kind: string,
  outcome: string,
  durationMs: number,
  detail?: string,
): void {
  const line = `${new Date().toISOString()}  ${base}  ${kind}  ${outcome}  ${(durationMs / 1000).toFixed(1)}s`;
  console.log(detail ? `${line}  ${detail}` : line);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ----------------------------------------------------------------- worker

async function processEntry(
  entry: QueueEntry,
  options: Options,
): Promise<void> {
  const started = Date.now();
  let request: OutboxRequest;
  try {
    request = readRequest(entry.requestPath);
  } catch (error) {
    log(
      entry.base,
      "unreadable",
      "skipped",
      Date.now() - started,
      String(error),
    );
    return;
  }
  const { kind } = describeRequest(request);

  if (options.retryFailed && entry.failed) clearFailure(entry);

  const taken = claimForWork(entry, 1, {
    staleClaimMs: options.staleClaimMs,
    owner,
  });
  if (!taken.claimed) return;
  if (taken.stolenFrom) {
    console.log(
      `  reclaimed ${entry.base} from ${taken.stolenFrom.owner} (claimed ${taken.stolenFrom.startedAt})`,
    );
  }

  const attempts: FailureRecord["attempts"] = [];
  try {
    for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
      if (stopping) {
        log(
          entry.base,
          kind,
          "abandoned",
          Date.now() - started,
          "watcher stopping",
        );
        return;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.timeoutMs);
      try {
        const { text } = await runFulfiller(
          request,
          options,
          controller.signal,
        );
        const body = extractJsonObject(replyText(text));
        writeResponse(entry, body);
        fulfilled += 1;
        const durationMs = Date.now() - started;
        lastCompleted = {
          id: entry.base,
          kind,
          outcome: "fulfilled",
          durationMs,
          at: new Date().toISOString(),
        };
        log(
          entry.base,
          kind,
          "fulfilled",
          durationMs,
          attempt > 1 ? `on attempt ${attempt}` : undefined,
        );
        beat(options);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        attempts.push({
          attempt,
          at: new Date().toISOString(),
          error: message,
        });
        if (attempt < options.attempts && !stopping) {
          const wait = backoffMs(
            attempt,
            options.backoffMs,
            options.maxBackoffMs,
          );
          console.log(
            `  ${entry.base} attempt ${attempt}/${options.attempts} failed: ${message.slice(0, 200)} — retrying in ${(wait / 1000).toFixed(1)}s`,
          );
          await sleep(wait);
        }
      } finally {
        clearTimeout(timer);
      }
    }

    const durationMs = Date.now() - started;
    const lastError = attempts[attempts.length - 1]?.error ?? "unknown";
    writeFailure(entry, {
      base: entry.base,
      kind,
      attempts,
      lastError,
      failedAt: new Date().toISOString(),
      note:
        `The request is still here and still unanswered. Nothing was deleted. ` +
        `Fulfil it by hand (\`pnpm outbox ${entry.base}.request.json\`), or delete ` +
        `this file and run the watcher again with --retry-failed.`,
    });
    failedCount += 1;
    lastCompleted = {
      id: entry.base,
      kind,
      outcome: "failed",
      durationMs,
      at: new Date().toISOString(),
    };
    log(entry.base, kind, "failed", durationMs, lastError.slice(0, 200));
    beat(options);
  } finally {
    releaseClaim(entry);
  }
}

// ------------------------------------------------------------------- main

async function drain(options: Options): Promise<number> {
  let handled = 0;
  for (;;) {
    if (stopping) return handled;
    const pending = pendingEntries(options.dir, {
      staleClaimMs: options.staleClaimMs,
      includeFailed: options.retryFailed,
    });
    if (pending.length === 0) return handled;

    // A simple pool: `concurrency` workers pulling from one shared cursor,
    // so a slow request never holds back the ones behind it.
    let cursor = 0;
    const workers = Array.from(
      { length: Math.min(options.concurrency, pending.length) },
      async () => {
        for (;;) {
          const index = cursor;
          cursor += 1;
          if (index >= pending.length || stopping) return;
          await processEntry(pending[index], options);
          handled += 1;
        }
      },
    );
    await Promise.all(workers);
    // Loop again: the app may have written more while this pass ran, and
    // anything that failed now carries a .failure.json so it drops out.
  }
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  fs.mkdirSync(options.dir, { recursive: true });

  const swept = sweepTempFiles(options.dir, options.staleClaimMs);
  if (swept > 0) console.log(`Swept ${swept} abandoned temp file(s).`);

  if (options.dryRun) {
    const pending = pendingEntries(options.dir, {
      staleClaimMs: options.staleClaimMs,
      includeFailed: options.retryFailed,
    });
    console.log(
      `${pending.length} request(s) would be fulfilled from ${options.dir}:`,
    );
    for (const entry of pending) {
      const { kind, about } = describeRequest(readRequest(entry.requestPath));
      console.log(`  ${entry.base}  ${kind}  ${about.slice(0, 80)}`);
    }
    return;
  }

  preflight(options);

  console.log(
    `outbox:watch  dir=${options.dir}  model=${options.model}  concurrency=${options.concurrency}  ` +
      `attempts=${options.attempts}  mode=${options.once ? "once" : "watch"}`,
  );

  const stop = (signal: string) => {
    if (stopping) return;
    stopping = true;
    console.log(`\n${signal} — finishing in-flight work, then stopping.`);
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  beat(options);
  const ticker = setInterval(() => beat(options), 5_000);
  // A heartbeat is a status signal, not a reason to keep the process alive.
  ticker.unref();

  try {
    if (options.once) {
      const handled = await drain(options);
      console.log(
        handled === 0
          ? "Nothing was waiting."
          : `Drained ${handled} request(s): ${fulfilled} fulfilled, ${failedCount} failed.`,
      );
      return;
    }
    console.log("Watching. Ctrl-C to stop.");
    while (!stopping) {
      await drain(options);
      await sleep(options.pollMs);
    }
    console.log(`Stopped. ${fulfilled} fulfilled, ${failedCount} failed.`);
  } finally {
    beat(options, new Date().toISOString());
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
