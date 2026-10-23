#!/bin/bash

# Containerized e2e test runner, the default for `npm run e2e-test`
# Runs `npm run e2e-test -- --local` on a virtual display, passing on the arguments (a file filter).
# The tests run from out/, which the host's watchers keep current. The container doesn't compile.

set -e

if ! command -v docker > /dev/null; then
    echo "Docker not found. To run the e2e tests on this machine instead: npm run e2e-test -- --local" >&2
    exit 1
fi

cd "$(dirname "$0")"
CALVA_REPO="$(cd ../../.. && pwd)"
export CALVA_REPO

docker compose run --rm e2e \
    xvfb-run --auto-servernum --server-args="-screen 0 1280x1024x24" \
    npm run e2e-test -- --local "$@"
