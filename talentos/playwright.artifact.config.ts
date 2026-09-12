import { defineConfig } from "@playwright/test";

/**
 * E2E for the published single-file artifact. No web server and no app
 * build: the test serves the committed HTML from a routed origin (so the
 * page has a real localStorage) and injects a stub `window.claude`, which
 * is the only runtime the artifact talks to.
 */
export default defineConfig({
  outputDir: "./test-results/artifact",
  testDir: "./tests/e2e-artifact",
  timeout: 60_000,
  workers: 1,
  use: {
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXE }
      : {},
  },
});
