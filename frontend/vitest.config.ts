import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Dynamic coverage threshold so a local override (env var) and CI (same
// env var, set in the workflow) can never drift from each other.
const coverageThreshold = Number.parseFloat(process.env.HESTIA_MIN_COVERAGE ?? "85");
const resolvedCoverageThreshold = Number.isNaN(coverageThreshold) ? 85 : coverageThreshold;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    exclude: [
      "node_modules/**",
      "dist/**",
      "e2e/**", // Playwright E2E tests (added in a later PR) — run separately
    ],
    coverage: {
      // istanbul, not v8: v8's coverage-remap step (via rolldown, Vite 8's
      // default bundler) fails to parse `import type { ... }` in any .tsx
      // file that `all`+`include` pulls in but that no test actually
      // imported — istanbul instruments via Vite's normal transform
      // pipeline instead, which already handles TS/JSX fine for real
      // test runs, so it doesn't hit that gap.
      provider: "istanbul",
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      reportOnFailure: true,
      reporter: ["text", "json", "html", "lcov", "json-summary"],
      exclude: [
        "node_modules/",
        "src/test/",
        "**/*.d.ts",
        "**/*.config.*",
        "dist/",
        "e2e/",
        // Entrypoint — bootstrap code only, no logic worth unit testing.
        // Keep in sync with codecov.yml's ignore: list (added in PR4).
        "src/main.tsx",
      ],
      thresholds: {
        lines: resolvedCoverageThreshold,
      },
    },
  },
});
