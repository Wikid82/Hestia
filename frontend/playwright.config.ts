import { defineConfig, devices } from "@playwright/test";

// Runs against the real Docker image (docker-compose.yml +
// docker-compose.e2e.yml), not a dev server — see docs/current_spec.md
// Decision 4. workers: 1 always: specs share one running container/database,
// so they must run serially, locally and in CI alike (Decision, research
// notes on Charon's e2e setup).
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  timeout: process.env.CI ? 60_000 : 30_000,
  expect: { timeout: 5_000 },
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:8080",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // Chromium only for now — the app has no browser-specific rendering paths
  // (no canvas/WebGL, plain forms + fetch), and this is a chore chart, not
  // a compatibility-sensitive product. Add firefox/webkit projects here if
  // that assumption ever stops holding.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
