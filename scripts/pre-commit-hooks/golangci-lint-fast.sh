#!/usr/bin/env bash
set -euo pipefail

# Wrapper script for golangci-lint's fast rule set in lefthook's pre-commit
# hook — resolves a v2 binary (installing one via `go install` if none is
# found), auto-fixes what it can, then reports whatever's left in lines
# changed since the last commit. Ported from Charon's
# scripts/pre-commit-hooks/golangci-lint-fast.sh, simplified for Hestia's
# single Go module (Charon loops over backend+agent; Hestia only has
# backend).

preferred_bin="${GOBIN:-${GOPATH:-$HOME/go}/bin}/golangci-lint"

lint_major_version() {
	local binary_path="$1"
	"$binary_path" version 2>/dev/null | sed -nE 's/.*version[[:space:]]+([0-9]+)\..*/\1/p' | sed -n '1p'
}

install_v2_linter() {
	echo "Installing golangci-lint v2 with current Go toolchain..." >&2
	go install github.com/golangci/golangci-lint/v2/cmd/golangci-lint@latest >&2
}

resolve_v2_linter() {
	local candidates=()
	local path_linter=""

	if path_linter=$(command -v golangci-lint 2>/dev/null); then
		candidates+=("$path_linter")
	fi

	candidates+=(
		"$preferred_bin"
		"$HOME/go/bin/golangci-lint"
		"/usr/local/bin/golangci-lint"
		"/usr/bin/golangci-lint"
	)

	for candidate in "${candidates[@]}"; do
		if [[ -x "$candidate" && "$(lint_major_version "$candidate")" == "2" ]]; then
			printf '%s\n' "$candidate"
			return 0
		fi
	done

	install_v2_linter

	if [[ -x "$preferred_bin" && "$(lint_major_version "$preferred_bin")" == "2" ]]; then
		printf '%s\n' "$preferred_bin"
		return 0
	fi

	return 1
}

if ! GOLANGCI_LINT="$(resolve_v2_linter)"; then
	echo "ERROR: failed to resolve golangci-lint v2"
	echo "PATH: $PATH"
	echo "Expected v2 binary at: $preferred_bin"
	exit 1
fi

echo "Using golangci-lint: $GOLANGCI_LINT"
echo "Version: $($GOLANGCI_LINT version)"

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CONFIG="$ROOT_DIR/.golangci-fast.yml"

cd "$ROOT_DIR/backend" || exit 1

# Pass 1: auto-fix (gocritic simplifications, etc.). Errors are
# intentionally swallowed; the reporting pass below is the gate.
"$GOLANGCI_LINT" run --config "$CONFIG" --fix --new-from-rev HEAD ./... 2>/dev/null || true

# Re-stage anything the auto-fix pass touched so the commit includes it.
(cd "$ROOT_DIR" && git add -u -- 'backend/*.go' 2>/dev/null || true)

# Pass 2: report remaining issues in changed lines only. This is the gate.
"$GOLANGCI_LINT" run --config "$CONFIG" --new-from-rev HEAD ./...
