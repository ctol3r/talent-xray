/**
 * Web server for the HSAL end-to-end suite: a real HSAL gateway (sibling
 * repo, temp database, fresh `talentos` token) plus `next start` wired to it.
 * Used by playwright.hsal.config.ts; run `pnpm build` first.
 */
import { spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { startHSAL } from "./lib/hsal-gateway";

const port = process.env["PORT"] ?? "3998";
const DB = "./data/e2e-hsal.db";
// Fresh throwaway workstation database for every run (Playwright's globalSetup
// would run after this server is up, so the reset lives here).
for (const suffix of ["", "-wal", "-shm"])
  rmSync(`${DB}${suffix}`, { force: true });
rmSync("/tmp/talentos-e2e-hsal-documents", { recursive: true, force: true });
const hsal = await startHSAL();
console.log(`[e2e-hsal] gateway ${hsal.url}`);
// SP104 (the seeded walkthrough) lives in the throwaway workstation database too.
const seeded = spawnSync("pnpm", ["-s", "seed:sp104"], {
  stdio: "inherit",
  env: {
    ...process.env,
    TALENTOS_DATABASE_PATH: DB,
    TALENTOS_ALLOW_MIGRATIONS: "1",
  },
});
if (seeded.status !== 0) {
  await hsal.stop();
  process.exit(seeded.status ?? 1);
}
const next = spawn(
  "pnpm",
  ["exec", "next", "start", "--hostname", "127.0.0.1", "--port", port],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      HSAL_GATEWAY_URL: hsal.url,
      HSAL_TOKEN: hsal.token,
      TALENTOS_MODEL_PROVIDER: "mock",
      TALENTOS_DISCOVERY_PROVIDER: "mock",
      TALENTOS_REGISTRY_NPPES: "mock",
      TALENTOS_DATABASE_PATH: DB,
      TALENTOS_DOCUMENT_DIR: "/tmp/talentos-e2e-hsal-documents",
    },
  },
);
const stop = async () => {
  next.kill("SIGTERM");
  await hsal.stop();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
next.on("exit", (code) => {
  void hsal.stop().then(() => process.exit(code ?? 0));
});
