import { defineConfig } from "@playwright/test";

/**
 * E2E runs against a production server (`pnpm build` first) with the mock
 * provider and a throwaway database — no secrets, no network, no fake data
 * presented as real (mock output is watermarked in-product).
 * If the environment provides a system Chromium, point
 * PLAYWRIGHT_CHROMIUM_EXE at it.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results/standalone",
  timeout: 180_000,
  workers: 1,
  use: {
    baseURL: "http://localhost:3999",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXE }
      : {},
  },
  globalSetup: "./tests/e2e/global-setup.ts",
  webServer: {
    command: "pnpm start --port 3999",
    port: 3999,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      TALENTOS_MODEL_PROVIDER: "mock",
      TALENTOS_DISCOVERY_PROVIDER: "mock",
      TALENTOS_REGISTRY_NPPES: "mock",
      TALENTOS_DATABASE_PATH: "./data/e2e.db",
      TALENTOS_DOCUMENT_DIR: "/tmp/talentos-e2e-documents",
    },
  },
});
