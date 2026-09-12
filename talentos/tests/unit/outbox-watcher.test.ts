/**
 * The watcher's invariants, tested where they live.
 *
 * The claims worth testing are the ones a queue is judged on: a response is
 * never observable half-written, two watchers never both work a request, a
 * crashed watcher strands nothing, and a request that could not be fulfilled
 * leaves a record rather than vanishing.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  backoffMs,
  baseFromRequestName,
  describeRequest,
  extractJsonObject,
  isClaimStale,
  outboxPaths,
  watcherPresence,
  type Heartbeat,
} from "@/lib/outbox/protocol";
import {
  claim,
  claimForWork,
  pendingEntries,
  readFailure,
  scanQueue,
  sweepTempFiles,
  writeAtomic,
  writeFailure,
  writeResponse,
} from "@/lib/outbox/queue";

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "outbox-test-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function writeRequest(
  base: string,
  body: Record<string, unknown> = {},
): string {
  const paths = outboxPaths(dir, base);
  fs.writeFileSync(
    paths.request,
    JSON.stringify({
      respondTo: paths.response,
      schemaName: "RoleIntelligence",
      user: "Do the thing",
      ...body,
    }),
  );
  return paths.request;
}

describe("request naming", () => {
  it("derives every sibling path from the request name", () => {
    expect(baseFromRequestName("RoleIntelligence-abc.request.json")).toBe(
      "RoleIntelligence-abc",
    );
    expect(
      baseFromRequestName("RoleIntelligence-abc.response.json"),
    ).toBeNull();
    const paths = outboxPaths("/out", "X-1");
    expect(paths.response).toBe("/out/X-1.response.json");
    expect(paths.claim).toBe("/out/X-1.claim.json");
    expect(paths.failure).toBe("/out/X-1.failure.json");
  });

  it("describes both request shapes", () => {
    expect(
      describeRequest({
        respondTo: "",
        schemaName: "IntakeSession",
        user: "# h\nPlan it",
      }),
    ).toEqual({
      kind: "IntakeSession",
      about: "Plan it",
    });
    expect(
      describeRequest({ respondTo: "", query: "talent venues", limit: 5 }).kind,
    ).toBe("Research(search)");
  });
});

describe("pending selection", () => {
  it("skips answered, failed, and freshly claimed requests", () => {
    writeRequest("A");
    writeRequest("B");
    writeRequest("C");
    writeRequest("D");
    fs.writeFileSync(outboxPaths(dir, "B").response, "{}");
    fs.writeFileSync(outboxPaths(dir, "C").failure, "{}");
    fs.writeFileSync(
      outboxPaths(dir, "D").claim,
      JSON.stringify({
        owner: "other",
        pid: 1,
        host: "h",
        startedAt: new Date().toISOString(),
        attempt: 1,
      }),
    );
    const pending = pendingEntries(dir, { staleClaimMs: 60_000 });
    expect(pending.map((entry) => entry.base)).toEqual(["A"]);
  });

  it("reclaims a request whose claim has gone stale — the crash path", () => {
    writeRequest("A");
    fs.writeFileSync(
      outboxPaths(dir, "A").claim,
      JSON.stringify({
        owner: "killed",
        pid: 999999,
        host: "h",
        startedAt: new Date(Date.now() - 120_000).toISOString(),
        attempt: 1,
      }),
    );
    expect(
      pendingEntries(dir, { staleClaimMs: 60_000 }).map((e) => e.base),
    ).toEqual(["A"]);
    const [entry] = pendingEntries(dir, { staleClaimMs: 60_000 });
    const result = claim(entry, 1, { staleClaimMs: 60_000, owner: "fresh" });
    expect(result.claimed).toBe(true);
    expect(result.stolenFrom?.owner).toBe("killed");
  });
});

describe("claiming", () => {
  it("lets exactly one of two watchers take a request", () => {
    writeRequest("A");
    const [entry] = pendingEntries(dir, { staleClaimMs: 60_000 });
    const first = claim(entry, 1, { staleClaimMs: 60_000, owner: "one" });
    const second = claim(entry, 1, { staleClaimMs: 60_000, owner: "two" });
    expect(first.claimed).toBe(true);
    expect(second.claimed).toBe(false);
  });

  it("declines a request another watcher answered and released — the race that duplicated a generation", () => {
    // Found by running two --once watchers over eight requests: eight
    // responses, nine fulfiller invocations. The claim was free (the first
    // watcher had finished and let go), so the second took it and redid the
    // work. Claiming alone is not enough; the response has to be re-read
    // under the claim.
    writeRequest("A");
    const [entry] = scanQueue(dir);
    fs.writeFileSync(entry.responsePath, '{"done":true}');
    const result = claimForWork(entry, 1, {
      staleClaimMs: 60_000,
      owner: "second",
    });
    expect(result.claimed).toBe(false);
    expect(result.alreadyAnswered).toBe(true);
    // And it does not sit on the claim it briefly held.
    expect(fs.existsSync(entry.claimPath)).toBe(false);
  });

  it("treats an unparseable claim as abandoned rather than as a permanent lock", () => {
    writeRequest("A");
    fs.writeFileSync(outboxPaths(dir, "A").claim, "{ truncated");
    const [entry] = scanQueue(dir);
    expect(
      claim(entry, 1, { staleClaimMs: 60_000, owner: "fresh" }).claimed,
    ).toBe(true);
  });

  it("expires a claim only after the timeout", () => {
    const at = (msAgo: number) => ({
      owner: "o",
      pid: 1,
      host: "h",
      startedAt: new Date(Date.now() - msAgo).toISOString(),
      attempt: 1,
    });
    expect(isClaimStale(at(30_000), Date.now(), 60_000)).toBe(false);
    expect(isClaimStale(at(90_000), Date.now(), 60_000)).toBe(true);
  });
});

describe("atomic writes", () => {
  it("leaves no temp file behind and replaces the target in one step", () => {
    const target = path.join(dir, "thing.json");
    writeAtomic(target, '{"a":1}');
    writeAtomic(target, '{"a":2}');
    expect(JSON.parse(fs.readFileSync(target, "utf8"))).toEqual({ a: 2 });
    expect(fs.readdirSync(dir).filter((n) => n.endsWith(".tmp"))).toEqual([]);
  });

  it("never exposes a partial response: the file is absent or complete", () => {
    writeRequest("A");
    const [entry] = scanQueue(dir);
    const big = { blob: "x".repeat(500_000) };
    expect(fs.existsSync(entry.responsePath)).toBe(false);
    writeResponse(entry, big);
    // Whatever a reader sees at any moment parses, because the name only ever
    // points at a finished file.
    expect(JSON.parse(fs.readFileSync(entry.responsePath, "utf8"))).toEqual(
      big,
    );
  });

  it("sweeps temp files older than the cutoff and spares fresh ones", () => {
    const old = path.join(dir, ".x.json.1-aa.tmp");
    const fresh = path.join(dir, ".y.json.2-bb.tmp");
    fs.writeFileSync(old, "");
    fs.writeFileSync(fresh, "");
    fs.utimesSync(
      old,
      new Date(Date.now() - 600_000),
      new Date(Date.now() - 600_000),
    );
    expect(sweepTempFiles(dir, 60_000)).toBe(1);
    expect(fs.existsSync(old)).toBe(false);
    expect(fs.existsSync(fresh)).toBe(true);
  });
});

describe("giving up", () => {
  it("records the attempts and leaves the request in place", () => {
    const requestPath = writeRequest("A");
    const [entry] = scanQueue(dir);
    writeFailure(entry, {
      base: "A",
      kind: "RoleIntelligence",
      attempts: [
        { attempt: 1, at: new Date().toISOString(), error: "boom" },
        { attempt: 2, at: new Date().toISOString(), error: "boom again" },
      ],
      lastError: "boom again",
      failedAt: new Date().toISOString(),
      note: "still here",
    });
    expect(fs.existsSync(requestPath)).toBe(true);
    expect(fs.existsSync(entry.responsePath)).toBe(false);
    const record = readFailure(entry);
    expect(record?.attempts).toHaveLength(2);
    expect(record?.lastError).toBe("boom again");
    // And it drops out of the queue rather than spinning forever.
    expect(pendingEntries(dir, { staleClaimMs: 60_000 })).toHaveLength(0);
    expect(
      pendingEntries(dir, { staleClaimMs: 60_000, includeFailed: true }),
    ).toHaveLength(1);
  });
});

describe("backoff", () => {
  it("doubles, jitters, and stops at the ceiling", () => {
    expect(backoffMs(1, 1000, 60_000, () => 1)).toBe(1000);
    expect(backoffMs(2, 1000, 60_000, () => 1)).toBe(2000);
    expect(backoffMs(3, 1000, 60_000, () => 1)).toBe(4000);
    expect(backoffMs(99, 1000, 5000, () => 1)).toBe(5000);
    // Full jitter: never longer than the ceiling, never instant.
    expect(backoffMs(3, 1000, 60_000, () => 0)).toBe(2000);
  });
});

describe("reading the model's reply", () => {
  it("takes a bare object", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  it("takes a fenced object", () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it("takes an object after a sentence of preamble", () => {
    expect(extractJsonObject('Here you go:\n\n{"a":{"b":2}}')).toEqual({
      a: { b: 2 },
    });
  });
  it("refuses anything that is not an object, rather than writing it", () => {
    expect(() => extractJsonObject("[1,2]")).toThrow();
    expect(() => extractJsonObject('"just a string"')).toThrow();
    expect(() => extractJsonObject("   ")).toThrow();
    expect(() => extractJsonObject("I could not do that.")).toThrow();
  });
});

describe("watcher presence", () => {
  const beat = (updatedAgoMs: number, stopped?: boolean): Heartbeat => ({
    pid: 1,
    host: "h",
    mode: "watch",
    concurrency: 1,
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    updatedAt: new Date(Date.now() - updatedAgoMs).toISOString(),
    fulfilled: 0,
    failed: 0,
    lastCompleted: null,
    ...(stopped ? { stoppedAt: new Date().toISOString() } : {}),
  });

  it("distinguishes never-run from stopped from gone-quiet", () => {
    expect(watcherPresence(null, Date.now(), 20_000).state).toBe("never");
    expect(watcherPresence(beat(1_000), Date.now(), 20_000).state).toBe(
      "running",
    );
    expect(watcherPresence(beat(90_000), Date.now(), 20_000).state).toBe(
      "stale",
    );
    expect(watcherPresence(beat(1_000, true), Date.now(), 20_000).state).toBe(
      "stopped",
    );
  });
});
