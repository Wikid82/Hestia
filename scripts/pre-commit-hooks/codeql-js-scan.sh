#!/usr/bin/env bash
# Manual CodeQL JavaScript/TypeScript scan, CI-aligned (mirrors
# .github/workflows/codeql.yml: security-and-quality suite). Source root is
# the repo root so SARIF paths match CI's.
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! command -v codeql >/dev/null 2>&1; then
  echo "ERROR: codeql CLI is not installed or not in PATH" >&2
  exit 127
fi

# Generated artifacts create noisy/false findings if present during analysis.
# Best-effort: root-owned leftovers (e.g. from a Docker-run Playwright job)
# can't be removed without sudo and shouldn't abort the scan.
rm -rf frontend/coverage frontend/dist frontend/playwright-report frontend/test-results docs-site/build 2>/dev/null \
  || echo "WARNING: could not remove some generated artifacts (permissions); continuing" >&2

rm -rf codeql-db-js

echo "Creating CodeQL JavaScript/TypeScript database..."
codeql database create codeql-db-js \
  --language=javascript \
  --build-mode=none \
  --source-root=. \
  --threads=0 \
  --overwrite

echo "Analyzing with javascript-security-and-quality suite..."
codeql database analyze codeql-db-js \
  codeql/javascript-queries:codeql-suites/javascript-security-and-quality.qls \
  --format=sarif-latest \
  --output=codeql-results-js.sarif \
  --sarif-add-baseline-file-info \
  --threads=0

echo "CodeQL JS/TS scan complete. Results: codeql-results-js.sarif"
