#!/bin/bash

# Containerized e2e test runner
# Runs `npm run e2e-test` on a virtual display, passing on the arguments (a file filter).
# The tests run from out/, which the host's watchers keep current. The container doesn't compile.

set -e

cd "$(dirname "$0")"
CALVA_REPO="$(cd ../../.. && pwd)"
export CALVA_REPO

docker compose run --rm e2e \
    xvfb-run --auto-servernum --server-args="-screen 0 1280x1024x24" \
    npm run e2e-test -- "$@"
