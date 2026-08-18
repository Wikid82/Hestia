#!/usr/bin/env bash
set -euo pipefail

# Backend test + coverage gate. Ported from Charon's
# scripts/go-test-coverage.sh, simplified for Hestia: single Go module (no
# backend+agent loop, no cross-process coverage merge for a subprocess
# test harness Hestia doesn't have), no encryption-key bootstrap or
# perf-assertion env vars (Charon-specific). Uses go tool cover's own
# aggregate statement-coverage percentage rather than reimplementing
# Charon's hand-rolled line-coverage awk parse — Codecov computes its own
# authoritative number from the uploaded profile regardless, so this
# script only needs to be a good-enough local gate. See
# docs/current_spec.md.
#
# Usage: scripts/go-test-coverage.sh
# Env:   HESTIA_MIN_COVERAGE (default 85) — minimum percent required.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/backend"

MIN_COVERAGE="${HESTIA_MIN_COVERAGE:-85}"
COVERAGE_FILE="coverage.txt"

# Packages excluded from the coverage gate — entrypoint (bootstrap code
# only, no business logic worth unit-testing) and any thin infrastructure
# wrapper added later. Keep in sync with codecov.yml's ignore: list.
EXCLUDE_PACKAGES=(
	"hestia/backend/cmd/api"
	"hestia/backend/internal/testutil"
)

if command -v gotestsum >/dev/null 2>&1; then
	TEST_CMD=(gotestsum --format pkgname --)
else
	TEST_CMD=(go test -v)
fi

TEST_EXIT=0
"${TEST_CMD[@]}" -race -coverpkg=./... -coverprofile="$COVERAGE_FILE" ./... || TEST_EXIT=$?

COVERAGE_EXIT=1
if [ -f "$COVERAGE_FILE" ]; then
	for pkg in "${EXCLUDE_PACKAGES[@]}"; do
		sed -i.bak "\#^${pkg//\//\\/}#d" "$COVERAGE_FILE"
		rm -f "$COVERAGE_FILE.bak"
	done

	echo ""
	echo "--- Coverage summary ---"
	go tool cover -func="$COVERAGE_FILE" | tail -1

	TOTAL_PCT="$(go tool cover -func="$COVERAGE_FILE" | tail -1 | awk '{print $3}' | tr -d '%')"
	echo "Total coverage: ${TOTAL_PCT}%  (minimum: ${MIN_COVERAGE}%)"

	if awk -v cov="$TOTAL_PCT" -v min="$MIN_COVERAGE" 'BEGIN { exit !(cov + 0 < min + 0) }'; then
		echo "FAIL: coverage ${TOTAL_PCT}% is below the ${MIN_COVERAGE}% minimum"
	else
		echo "PASS: coverage meets the ${MIN_COVERAGE}% minimum"
		COVERAGE_EXIT=0
	fi
else
	echo "No coverage file produced — tests likely failed to run at all"
fi

# Real test failures take priority over the coverage verdict — a build/
# test failure should never be masked as "just a coverage problem."
if [ "$TEST_EXIT" -ne 0 ]; then
	exit "$TEST_EXIT"
fi
exit "$COVERAGE_EXIT"
