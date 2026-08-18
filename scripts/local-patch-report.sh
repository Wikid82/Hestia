#!/usr/bin/env bash
set -euo pipefail

# Local patch-coverage preflight. Reports the same "patch coverage" number
# Codecov's `patch` gate computes (coverage.status.patch in codecov.yml) —
# coverage of only the lines changed in your diff, not the whole project —
# so a real gap shows up before a CI round-trip instead of after.
# Simplified single-module port of Charon's local-patch-report.sh +
# cmd/localpatchreport: Charon's backend+frontend+agent multi-report
# plumbing doesn't apply here (one backend module, one frontend package).
# See docs/current_spec.md and CLAUDE.md's Definition of Done section.
#
# Usage: scripts/local-patch-report.sh [--base <ref>]
# Env:   HESTIA_MIN_COVERAGE (default 85) — minimum patch coverage percent.
#        HESTIA_PATCH_ADVISORY=1 — report only, don't fail on a gap below
#        the minimum (still prints PASS/FAIL either way).

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

BASE_REF="origin/development"
if [ "${1:-}" = "--base" ]; then
	BASE_REF="$2"
fi

MIN_COVERAGE="${HESTIA_MIN_COVERAGE:-85}"
ADVISORY="${HESTIA_PATCH_ADVISORY:-0}"

MERGE_BASE="$(git merge-base "$BASE_REF" HEAD)"
echo "Diffing HEAD against ${BASE_REF} (merge-base ${MERGE_BASE:0:12})"
echo ""

# Same exclusions as codecov.yml's ignore: list — test files, e2e, docs,
# CI/config, build artifacts, and the two backend packages excluded from
# the coverage gate. Keep in sync with codecov.yml manually, same as
# scripts/go-test-coverage.sh's EXCLUDE_PACKAGES already does.
DIFF_FILE="$(mktemp)"
trap 'rm -f "$DIFF_FILE"' EXIT

git diff --unified=0 "$MERGE_BASE"...HEAD -- \
	'backend/**/*.go' 'frontend/src/**/*.ts' 'frontend/src/**/*.tsx' \
	':(exclude)**/*_test.go' \
	':(exclude)**/*.test.ts' ':(exclude)**/*.test.tsx' \
	':(exclude)backend/cmd/api/**' ':(exclude)backend/internal/testutil/**' \
	':(exclude)frontend/e2e/**' ':(exclude)frontend/src/test/**' \
	':(exclude)**/*.d.ts' \
	>"$DIFF_FILE"

if [ ! -s "$DIFF_FILE" ]; then
	echo "No coverable changed lines in the diff — nothing to report."
	exit 0
fi

CHANGED_BACKEND=0
CHANGED_FRONTEND=0
grep -q '^+++ b/backend/' "$DIFF_FILE" && CHANGED_BACKEND=1 || true
grep -q '^+++ b/frontend/src/' "$DIFF_FILE" && CHANGED_FRONTEND=1 || true

# Regenerate fresh coverage profiles. Shell out to the existing gate
# scripts rather than reimplementing test invocation — but their exit
# code reflects the *project-wide* gate, which can differ from the patch
# gate this script computes, so don't let a project-gate failure abort
# this script; only a real test failure (no profile produced at all)
# should.
if [ "$CHANGED_BACKEND" -eq 1 ]; then
	echo "--- Regenerating backend coverage profile ---"
	HESTIA_MIN_COVERAGE=0 "$ROOT_DIR/scripts/go-test-coverage.sh" || true
	if [ ! -f "$ROOT_DIR/backend/coverage.txt" ]; then
		echo "FAIL: backend tests did not produce a coverage profile" >&2
		exit 1
	fi
fi

if [ "$CHANGED_FRONTEND" -eq 1 ]; then
	echo "--- Regenerating frontend coverage profile ---"
	HESTIA_MIN_COVERAGE=0 "$ROOT_DIR/scripts/frontend-test-coverage.sh" || true
	if [ ! -f "$ROOT_DIR/frontend/coverage/lcov.info" ]; then
		echo "FAIL: frontend tests did not produce a coverage profile" >&2
		exit 1
	fi
fi

echo ""
echo "--- Patch coverage ---"

python3 - "$DIFF_FILE" "$ROOT_DIR" "$MIN_COVERAGE" "$ADVISORY" <<'PY'
import re
import sys

diff_file, root_dir, min_coverage_raw, advisory_raw = sys.argv[1:5]
min_coverage = float(min_coverage_raw)
advisory = advisory_raw == "1"


def parse_diff_changed_lines(path):
    """Return {file_path: set(added_line_numbers)} from a unified=0 diff."""
    changed = {}
    current_file = None
    current_line = None
    hunk_re = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")

    with open(path) as f:
        for line in f:
            if line.startswith("+++ b/"):
                current_file = line[6:].rstrip("\n")
                changed.setdefault(current_file, set())
                current_line = None
                continue
            if line.startswith("--- ") or line.startswith("diff --git"):
                continue
            m = hunk_re.match(line)
            if m:
                current_line = int(m.group(1))
                continue
            if current_file is None or current_line is None:
                continue
            if line.startswith("+") and not line.startswith("+++"):
                changed[current_file].add(current_line)
                current_line += 1
            elif line.startswith("-") and not line.startswith("---"):
                # Deletion only — doesn't advance the new-file line counter.
                continue
            else:
                current_line += 1
    return {f: lines for f, lines in changed.items() if lines}


def parse_go_coverage(path):
    """Return {file_path: {line: hit_count}} from a `mode: set` cover profile.

    Profile lines: path:startLine.startCol,endLine.endCol numStmt count
    Every line in [startLine, endLine] is treated as covered by that block
    (count > 0) or not (count == 0) — good enough for a preflight; ties
    break toward "covered" if any overlapping block for that line has a
    positive count.
    """
    result = {}
    line_re = re.compile(r"^(.+):(\d+)\.\d+,(\d+)\.\d+ \d+ (\d+)$")
    try:
        with open(path) as f:
            for line in f:
                if line.startswith("mode:"):
                    continue
                m = line_re.match(line.strip())
                if not m:
                    continue
                file_path, start, end, count = m.groups()
                # Profile paths are module-qualified (hestia/backend/...);
                # normalize to the repo-relative path used by git diff.
                rel = re.sub(r"^hestia/", "", file_path)
                per_line = result.setdefault(rel, {})
                hit = int(count)
                for ln in range(int(start), int(end) + 1):
                    per_line[ln] = per_line.get(ln, 0) or hit
    except FileNotFoundError:
        pass
    return result


def parse_lcov(path):
    """Return {file_path: {line: hit_count}} from an lcov.info file."""
    result = {}
    current = None
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("SF:"):
                    raw = line[3:]
                    # lcov's SF: paths are relative to frontend/ (e.g.
                    # "src/utils/recurrence.ts") — normalize to the
                    # repo-relative path git diff uses.
                    if "frontend/src/" in raw:
                        current = "frontend/" + raw.split("frontend/", 1)[1]
                    elif raw.startswith("src/"):
                        current = "frontend/" + raw
                    else:
                        current = raw
                    result.setdefault(current, {})
                elif line.startswith("DA:") and current is not None:
                    parts = line[3:].split(",")
                    ln, hits = int(parts[0]), int(parts[1])
                    per_line = result[current]
                    per_line[ln] = per_line.get(ln, 0) or hits
                elif line == "end_of_record":
                    current = None
    except FileNotFoundError:
        pass
    return result


changed = parse_diff_changed_lines(diff_file)
go_cov = parse_go_coverage(f"{root_dir}/backend/coverage.txt")
lcov = parse_lcov(f"{root_dir}/frontend/coverage/lcov.info")

total_coverable = 0
total_covered = 0
rows = []

for file_path, lines in sorted(changed.items()):
    if file_path.startswith("backend/"):
        # go_cov keys already have the "hestia/" module prefix stripped,
        # leaving "backend/..." — matches file_path directly, no further
        # stripping needed.
        per_line = go_cov.get(file_path, {})
    elif file_path.startswith("frontend/src/"):
        per_line = lcov.get(file_path, {})
    else:
        continue

    coverable = [ln for ln in sorted(lines) if ln in per_line]
    if not coverable:
        continue
    covered = [ln for ln in coverable if per_line[ln] > 0]
    total_coverable += len(coverable)
    total_covered += len(covered)
    pct = 100.0 * len(covered) / len(coverable)
    rows.append((file_path, len(covered), len(coverable), pct))

for file_path, covered, coverable, pct in rows:
    uncovered_note = "" if covered == coverable else "  <-- gap"
    print(f"  {pct:6.1f}%  ({covered}/{coverable})  {file_path}{uncovered_note}")

if total_coverable == 0:
    print("\nNo changed lines overlapped with coverage data (e.g. non-statement lines only).")
    sys.exit(0)

overall = 100.0 * total_covered / total_coverable
print(f"\nPatch coverage: {overall:.1f}% ({total_covered}/{total_coverable}) — minimum {min_coverage}%")

if overall < min_coverage:
    print("FAIL: patch coverage below minimum" + (" (advisory — not failing)" if advisory else ""))
    sys.exit(0 if advisory else 1)

print("PASS: patch coverage meets the minimum")
PY
