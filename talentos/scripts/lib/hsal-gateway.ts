/**
 * Spawns the real HSAL gateway from the sibling repository with a temporary
 * database on a free port, and issues a `talentos` capability token.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";

export const HSAL_REPO =
  process.env["HSAL_REPO"] ?? resolve(process.cwd(), "..", "..", "hsal");

/** True when a gateway already answers at `url` (e.g. `pnpm dev` in the HSAL repo). */
export async function gatewayReachable(url: string): Promise<boolean> {
  try {
    const r = await fetch(`${url}/health`);
    return r.ok;
  } catch {
    return false;
  }
}

export interface RunningHSAL {
  url: string;
  token: string;
  dbPath: string;
  stop: () => Promise<void>;
}

async function freePort(): Promise<number> {
  return new Promise((res, rej) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const addr = s.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      s.close(() => res(port));
    });
    s.on("error", rej);
  });
}

function run(
  cmd: string,
  args: string[],
  env: Record<string, string>,
): Promise<string> {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, {
      cwd: HSAL_REPO,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += String(d)));
    p.stderr.on("data", (d) => (err += String(d)));
    p.on("exit", (code) =>
      code === 0
        ? res(out)
        : rej(
            new Error(`${cmd} ${args.join(" ")} exited ${code}: ${err || out}`),
          ),
    );
  });
}

export async function startHSAL(): Promise<RunningHSAL> {
  if (!existsSync(join(HSAL_REPO, "package.json"))) {
    throw new Error(`HSAL repository not found at ${HSAL_REPO}; set HSAL_REPO`);
  }
  const dir = mkdtempSync(join(tmpdir(), "talentos-hsal-"));
  const dbPath = join(dir, "hsal.db");
  const port = await freePort();
  const env = { HSAL_DB_PATH: dbPath, HSAL_PORT: String(port) };
  const tsx = join(HSAL_REPO, "node_modules", ".bin", "tsx");
  await run(tsx, ["--conditions=source", "scripts/hsal.ts", "migrate"], env);
  const issued = await run(
    tsx,
    [
      "--conditions=source",
      "scripts/hsal.ts",
      "auth",
      "issue",
      "talentos",
      "--json",
    ],
    env,
  );
  const token = (JSON.parse(issued) as { token: string }).token;
  const child: ChildProcess = spawn(
    tsx,
    ["--conditions=source", "apps/gateway/src/index.ts"],
    {
      cwd: HSAL_REPO,
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${url}/health`);
      if (r.ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return {
    url,
    token,
    dbPath,
    stop: async () => {
      child.kill("SIGTERM");
      await new Promise((r) => setTimeout(r, 200));
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
