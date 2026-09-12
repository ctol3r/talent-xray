/**
 * Free the port the browser tests use.
 *
 * Playwright starts its own `next start` and refuses to run if the port is
 * taken. When a run is interrupted — a timeout, a Ctrl-C, a killed shell —
 * that server outlives it, and every later run fails with "already used",
 * which reads like a broken test suite and is not one. This clears it first.
 *
 *   pnpm tsx scripts/free-port.mts 3999
 *
 * Only ever kills a process listening on the given port on this machine.
 */
import { execFileSync } from "node:child_process";

const port = Number(process.argv[2] ?? 3999);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error("Usage: free-port.mts <port between 1024 and 65535>");
  process.exit(1);
}

function pidsOn(target: number): number[] {
  try {
    return execFileSync(
      "lsof",
      ["-nP", `-iTCP:${target}`, "-sTCP:LISTEN", "-t"],
      { encoding: "utf8" },
    )
      .split("\n")
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0);
  } catch {
    // lsof exits non-zero when nothing is listening, which is the good case.
    return [];
  }
}

const found = pidsOn(port);
for (const pid of found) {
  try {
    process.kill(pid, "SIGTERM");
    console.log(`freed port ${port} (was pid ${pid})`);
  } catch {
    console.warn(`could not stop pid ${pid} on port ${port}`);
  }
}
if (found.length === 0) process.exit(0);

// Give it a moment, then insist.
setTimeout(() => {
  for (const pid of pidsOn(port)) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Already gone.
    }
  }
}, 1500);
