#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---------------------------------------------------------------------------
# npm modules
# ---------------------------------------------------------------------------
# Hestia is a single full-stack Next.js app (no separate frontend/backend
# split), so there's just one npm module today. Kept as an array so a future
# service split (e.g. a standalone API) is a one-line addition, not a rewrite.

NPM_MODULES=(
    "$REPO_ROOT"
)

for MODULE in "${NPM_MODULES[@]}"; do
    echo "============================================================================"
    echo "Updating: $MODULE"
    echo "============================================================================"

    cd "$MODULE" || exit 1

    # Update prod, dev, optional, and peer dependencies to latest.
    # Exclude typescript: v7 is a from-scratch rewrite (the "tsgo"/native
    # compiler) with no typescript-eslint support yet, which breaks `npm run
    # lint` outright. Keep pinned to ^6.0.3 until upstream catches up:
    # https://github.com/typescript-eslint/typescript-eslint/issues/10940
    # Exclude eslint: v10 changed the rule-context API (e.g. getFilename())
    # in a way eslint-config-next's bundled eslint-plugin-react doesn't
    # support yet, which crashes `npm run lint`. Keep pinned to ^9 until
    # eslint-config-next ships a compatible eslint-plugin-react.
    npx --yes npm-check-updates -u --reject typescript,eslint

    rm -rf node_modules package-lock.json
    npm install
    npm dedupe
    npm run build
    npm run lint
    # Fails on high/critical findings; moderate/low are allowed through (see
    # audit-ci.json). Add a documented allowlist entry there if a
    # high/critical finding turns out to be unfixable upstream.
    npm run audit:ci
    npm audit fix || true
    npm outdated || true

    echo "Done: $MODULE"
done

echo ""
echo "All npm dependencies updated successfully."
