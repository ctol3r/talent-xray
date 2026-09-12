import { defineConfig } from "@playwright/test";

/**
 * End-to-end suite for the HSAL diagnosis loop on a generic search. Needs the
 * sibling HSAL repository (`HSAL_REPO`, default ../../hsal) and `pnpm build`.
 */
export default defineConfig({
  testDir: "./tests/e2e-hsal",
  outputDir: "./test-results/hsal",
  timeout: 240_000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3998",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXE }
      : {},
  },
  webServer: {
    command: "pnpm exec tsx scripts/e2e-hsal-server.mts",
    port: 3998,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
