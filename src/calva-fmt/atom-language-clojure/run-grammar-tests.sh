#!/bin/sh

ATOM_SCRIPT_PATH="apm"

echo "Running specs..."
"${ATOM_SCRIPT_PATH}" test spec

exit