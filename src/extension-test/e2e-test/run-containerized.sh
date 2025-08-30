#!/bin/bash

# Containerized VS Code Integration Test Runner
# Forwards all arguments to npm run integration-test inside Docker container

set -e

# Change to the directory containing docker-compose.yml
cd "$(dirname "$0")"

# Build the command with proper argument escaping
ARGS=""
for arg in "$@"; do
    # Escape the argument and add it to the command
    ARGS="$ARGS \"$(printf '%s\n' "$arg" | sed 's/"/\\"/g')\""
done

docker compose run --rm --entrypoint bash vscode-testing -c "
    # Start virtual display in background
    Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &

    # Wait a moment for X server to start
    sleep 2

    # Run the tests
    npm run integration-test -- $ARGS
"