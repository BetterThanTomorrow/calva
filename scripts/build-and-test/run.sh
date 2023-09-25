#!/usr/bin/env bash

set -euo pipefail # sane error handling

TARGET="${1:-}"

if [ -z "$TARGET" ]; then
    echo 'Must run as ./run.sh <TARGET> where target is one of the steps in the Dockerfile.
For example ./run.sh step-test-integration' 1>&2
    exit 1
fi

set -x # Show commands as they are run

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
CONTEXT_DIR="$SCRIPT_DIR/../../"
DISPLAY="${DISPLAY:-:0}" # default to ":0"
DOCKER_IMG_NAME="calva-ci-$TARGET"

echo "Building image: $DOCKER_IMG_NAME"

DOCKER_BUILDKIT=1 docker build \
--tag "$DOCKER_IMG_NAME" \
--target "$TARGET" \
--file "$SCRIPT_DIR/Dockerfile" \
"$CONTEXT_DIR"

docker run -ti --net host -e DISPLAY="$DISPLAY" --rm --ipc=host "$DOCKER_IMG_NAME"