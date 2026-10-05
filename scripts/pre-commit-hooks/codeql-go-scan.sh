#!/usr/bin/env bash
# Manual CodeQL Go scan, CI-aligned (mirrors .github/workflows/codeql.yml:
# security-and-quality suite). Source root is the repo root so SARIF paths
# match CI's, which is what scripts/security/codeql-findings-gate.sh expects.
set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if ! command -v codeql >/dev/null 2>&1; then
  echo "ERROR: codeql CLI is not installed or not in PATH" >&2
  exit 127
fi

rm -rf codeql-db-go

echo "Creating CodeQL Go database..."
codeql database create codeql-db-go \
  --language=go \
  --source-root=. \
  --command="go build ./backend/..." \
  --threads=0 \
  --overwrite

echo "Analyzing with go-security-and-quality suite..."
codeql database analyze codeql-db-go \
  codeql/go-queries:codeql-suites/go-security-and-quality.qls \
  --format=sarif-latest \
  --output=codeql-results-go.sarif \
  --sarif-add-baseline-file-info \
  --threads=0

echo "CodeQL Go scan complete. Results: codeql-results-go.sarif"
