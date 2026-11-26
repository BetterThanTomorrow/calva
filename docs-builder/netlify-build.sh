#!/usr/bin/env bash
# Netlify's build command: installs the Clojure CLI when the image has none, then builds into ../site.
set -euo pipefail

if ! command -v clojure >/dev/null 2>&1; then
  curl -fsSL https://download.clojure.org/install/linux-install-1.12.6.1673.sh | bash -s -- --prefix "$HOME/.local"
  export PATH="$HOME/.local/bin:$PATH"
fi

cd "$(dirname "$0")"
clojure -M:build
