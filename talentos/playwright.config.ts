import { defineConfig } from "@playwright/test";
import path from "node:path";

const port = Number(process.env.TALENTOS_E2E_PORT);
const runDir = process.env.TALENTOS_E2E_DIR;
if (
  !Number.isInteger(port) ||
  port < 1024 ||
  port > 65535 ||
  !runDir ||
  !path.isAbsolute(runDir)
) {
  throw new Error(
    "Run pnpm e2e so each browser run gets its own port and disposable data.",
  );
}
const baseURL = `http://127.0.0.1:${port}`;

/**
 * E2E runs against a production server (`pnpm build` first) with the mock
 * provider and a throwaway database — no secrets, no network, no fake data
 * presented as real (mock output is watermarked in-product).
 * If the environment provides a system Chromium, point
 * PLAYWRIGHT_CHROMIUM_EXE at it.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: `./test-results/standalone/${path.basename(runDir)}`,
  timeout: 180_000,
  workers: 1,
  use: {
    baseURL,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXE }
      : {},
  },
});
