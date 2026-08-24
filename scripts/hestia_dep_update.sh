#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---------------------------------------------------------------------------
# Go modules
# ---------------------------------------------------------------------------

GOPATH_BIN="$(go env GOPATH)/bin"
export PATH="$GOPATH_BIN:$PATH"
command -v govulncheck >/dev/null || go install golang.org/x/vuln/cmd/govulncheck@latest

# Hestia is a single Go module (backend/) wired into go.work
GO_MODULES=(
    "$REPO_ROOT/backend"
)

for MODULE in "${GO_MODULES[@]}"; do
    echo "============================================================================"
    echo "Updating: $MODULE"
    echo "============================================================================"

    cd "$MODULE" || exit 1

    # Update go/toolchain directives so Renovate's golang updates have nothing to do
    go get go@latest toolchain@latest
    # -t includes test-only dependencies, which Renovate also tracks
    go get -u -t ./...
    go mod tidy
    go mod verify
    go vet ./...
    go build ./...
    go test ./...
    govulncheck ./...

    echo "Done: $MODULE"
done

cd "$REPO_ROOT" || exit 1
go work sync

echo ""
echo "All Go module dependencies updated successfully."

# ---------------------------------------------------------------------------
# npm modules
# ---------------------------------------------------------------------------

echo "============================================================================"
echo "Updating Global npm Environment"
echo "============================================================================"

echo "Current local versions (npm / npx):"
npm -v && npx -v

echo "Latest available npm version on registry: "
npm view npm version

echo "Installing latest global npm..."
npm install -g npm@latest
echo ""

export PATH="/usr/share/nodejs/corepack/shims:$PATH"

# Hestia has a single npm workspace: the Vite frontend. The Go backend has
# no package.json (see the Go modules section above), and there's no root
# package.json anymore since the Next.js app was removed.
NPM_MODULES=(
    "$REPO_ROOT/frontend"
)

for MODULE in "${NPM_MODULES[@]}"; do
    echo "============================================================================"
    echo "Updating: $MODULE"
    echo "============================================================================"

    cd "$MODULE" || exit 1

    # Update prod, dev, and peer dependencies.
    # Exclude typescript: v7 crashes @typescript-eslint until upstream
    # catches up; keep pinned to the ^5.x line until that's resolved.
    npx --yes npm-check-updates -u --reject typescript

    rm -rf node_modules package-lock.json
    npm install
    npm dedupe
    npm run --if-present build
    npm run --if-present type-check
    npm run --if-present lint

    # No audit-ci.json here (yet) — see Charon's scripts/charon_dep_update.sh
    # for the allowlist pattern if Hestia ever needs to carve out a specific
    # known-unfixable finding. For now, any high/critical finding fails the
    # script outright.
    npm run audit:ci
    npm audit --audit-level=high
    npm audit fix || true
    npm outdated || true

    echo "Done: $MODULE"
done

echo ""
echo "All npm dependencies updated successfully."
