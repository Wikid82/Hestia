#!/bin/bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

NPM_MODULES=(
    "$REPO_ROOT/docs-site"
)

for MODULE in "${NPM_MODULES[@]}"; do
    echo "============================================================================"
    echo "Updating: $MODULE"
    echo "============================================================================"

    cd "$MODULE" || exit 1

    # `npm pkg get` prints "{}" when the key is absent, so test for that rather than empty output.
    if [ "$(npm pkg get overrides.serialize-javascript)" != "{}" ]; then
        LATEST="$(npm view serialize-javascript version)"
        npm pkg set "overrides.serialize-javascript=^${LATEST}"
        npm install
    else
        npm update serialize-javascript
    fi
done
