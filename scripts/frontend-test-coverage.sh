#!/usr/bin/env bash
set -euo pipefail

# Frontend test + coverage gate. Ported from Charon's
# scripts/frontend-test-coverage.sh, simplified for Hestia: no isolated
# per-run coverage directory (that existed to avoid collisions between
# concurrent CI matrix jobs — Hestia's frontend coverage only ever runs in
# one job at a time), no CHARON_MIN_COVERAGE/CPM_MIN_COVERAGE dual-var
# fallback. See docs/current_spec.md.
#
# Usage: scripts/frontend-test-coverage.sh
# Env:   HESTIA_MIN_COVERAGE (default 85) — minimum percent required.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
MIN_COVERAGE="${HESTIA_MIN_COVERAGE:-85}"

cd "$FRONTEND_DIR"
npm run test:coverage -- --run

SUMMARY_FILE="coverage/coverage-summary.json"
if [ ! -f "$SUMMARY_FILE" ]; then
	echo "Error: coverage summary not found at $SUMMARY_FILE"
	exit 1
fi

python3 - "$SUMMARY_FILE" "$MIN_COVERAGE" <<'PY'
import json
import sys
from decimal import Decimal, InvalidOperation

summary_path, min_coverage_raw = sys.argv[1], sys.argv[2]

with open(summary_path) as f:
    summary = json.load(f)

total = summary.get("total")
if not total or "lines" not in total or "pct" not in total["lines"]:
    print("Error: unexpected coverage-summary.json shape (missing total.lines.pct)", file=sys.stderr)
    sys.exit(1)

for metric in ("statements", "branches", "functions", "lines"):
    m = total.get(metric)
    if m:
        print(f"  {metric.capitalize():<11} {m['pct']}% ({m['covered']}/{m['total']})", file=sys.stderr)

lines_pct = total["lines"]["pct"]
try:
    covered = Decimal(str(lines_pct))
    minimum = Decimal(min_coverage_raw)
except InvalidOperation as e:
    print(f"Error: non-numeric coverage value: {e}", file=sys.stderr)
    sys.exit(1)

status = "PASS" if covered >= minimum else "FAIL"
print(f"Coverage gate: {status} (lines {covered}% vs minimum {minimum}%)")
if covered < minimum:
    sys.exit(1)
PY
