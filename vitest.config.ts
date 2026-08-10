import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const MIN_COVERAGE = Number.parseFloat(process.env.HESTIA_MIN_COVERAGE ?? "85");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next's server webpack config aliases this marker package to a
      // no-op so server-only code can import it freely; Vite doesn't know
      // that trick, so without this alias every import throws in tests.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    // Server/action/lib tests run in plain Node — jose's Uint8Array checks
    // break under jsdom's separate realm. Component tests opt into jsdom
    // per-file with a `// @vitest-environment jsdom` docblock instead.
    environment: "node",
    env: {
      DATABASE_PATH: ":memory:",
      AUTH_SECRET: "vitest-only-secret-do-not-use-in-production-32chars",
    },
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["**/node_modules/**", "e2e/**", ".next/**", ".claude/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/test/**",
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        // Route entrypoints (Server Component pages/layouts): thin
        // composition + data-fetching wired straight into requireActiveUser()
        // and the db — exercised by Playwright e2e (e2e/household-flow.spec.ts)
        // rather than unit tests.
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        // Declarative schema (no branching logic) and process bootstrap.
        "src/db/schema.ts",
        "src/db/index.ts",
        "src/instrumentation.ts",
      ],
      thresholds: {
        lines: MIN_COVERAGE,
      },
    },
  },
});
