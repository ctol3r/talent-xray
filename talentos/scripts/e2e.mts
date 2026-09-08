import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// A port conflict is never permission to stop its existing listener.
const probe = createServer();
await new Promise<void>((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", resolve);
});
const address = probe.address();
if (!address || typeof address === "string")
  throw new Error("No test port allocated.");
const port = address.port;
await new Promise<void>((resolve, reject) =>
  probe.close((error) => (error ? reject(error) : resolve())),
);

const runDir = mkdtempSync(path.join(tmpdir(), "talentos-browser-"));
const env = {
  ...process.env,
  TALENTOS_E2E_PORT: String(port),
  TALENTOS_E2E_DIR: runDir,
  TALENTOS_MODEL_PROVIDER: "mock",
  TALENTOS_DISCOVERY_PROVIDER: "mock",
  TALENTOS_REGISTRY_NPPES: "mock",
  TALENTOS_DATABASE_PATH: path.join(runDir, "test.db"),
  TALENTOS_DOCUMENT_DIR: path.join(runDir, "documents"),
  TALENTOS_SESSION_OUTBOX: path.join(runDir, "session-outbox"),
};
let runner: ChildProcess | undefined;
let server: ChildProcess | undefined;
let serverClosed: Promise<void> | undefined;
let serverError: Error | undefined;
let interrupted = false;
function stopRun() {
  interrupted = true;
  runner?.kill("SIGINT");
}
process.once("SIGINT", stopRun);
process.once("SIGTERM", stopRun);

try {
  console.log(
    `Browser tests: isolated port ${port}, disposable data ${runDir}`,
  );
  if (!process.argv.includes("--list")) {
    // Own the actual server process rather than a shell/package-manager
    // ancestor that can exit while leaving the server alive.
    server = spawn(
      process.execPath,
      [
        fileURLToPath(import.meta.resolve("next/dist/bin/next")),
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(port),
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
        env,
      },
    );
    server.stdout?.on("data", (chunk: Buffer) => process.stdout.write(chunk));
    server.stderr?.on("data", (chunk: Buffer) => process.stderr.write(chunk));
    serverClosed = new Promise<void>((resolve) => {
      server!.once("error", (error) => {
        serverError = error;
        resolve();
      });
      server!.once("close", resolve);
    });
    const deadline = Date.now() + 60_000;
    while (true) {
      if (interrupted)
        throw new Error("Browser run interrupted during startup.");
      if (serverError) throw serverError;
      if (server.exitCode !== null || server.signalCode !== null)
        throw new Error("The isolated test server exited before it was ready.");
      if (Date.now() > deadline)
        throw new Error(
          "The isolated test server did not become ready within 60 seconds.",
        );
      try {
        const response = await fetch(`http://127.0.0.1:${port}`, {
          signal: AbortSignal.timeout(1000),
        });
        if (response.ok && server.exitCode === null) break;
      } catch {
        /* The owned server is still starting. */
      }
      await delay(100);
    }
  }
  if (interrupted) throw new Error("Browser run interrupted.");
  runner = spawn(
    process.execPath,
    [
      fileURLToPath(import.meta.resolve("@playwright/test/cli")),
      "test",
      ...process.argv.slice(2),
    ],
    { stdio: "inherit", env },
  );
  process.exitCode = await new Promise<number>((resolve, reject) => {
    runner!.once("error", reject);
    runner!.once("exit", (code, signal) =>
      resolve(code ?? (signal === "SIGINT" ? 130 : 1)),
    );
  });
} finally {
  process.removeListener("SIGINT", stopRun);
  process.removeListener("SIGTERM", stopRun);
  if (server?.pid && server.exitCode === null && server.signalCode === null) {
    // Signal only the group this run created, never a PID found by its port.
    const signal = (kind: NodeJS.Signals) => {
      try {
        if (process.platform === "win32") server!.kill(kind);
        else process.kill(-server!.pid!, kind);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    };
    signal("SIGTERM");
    await Promise.race([serverClosed, delay(5000)]);
    if (server.exitCode === null && server.signalCode === null)
      signal("SIGKILL");
  }
  await serverClosed;
  // Do not remove a live server's files, or anything outside this run.
  rmSync(runDir, { recursive: true, force: true });
}
