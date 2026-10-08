#!/bin/sh
# Chunk sidecars may ship without Node/npm/pnpm on PATH. Bootstrap Node 20.18.1
# under .chunk-node/ (synced with the repo), then run the given command.
#
# Also implements an optional SNAKE.md check (`--gate-cost-of-a-green-pr-snake`).
# This repo's `.chunk/config.json` does not call it.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

case "${1:-}" in
  --gate-cost-of-a-green-pr-snake)
    set -eu
    cd "$ROOT" || exit 1
    RUNS_ROOT="experiments/cost-of-a-green-pr/runs"
    REQUIRED="🐍🕹️"
    if [ ! -d "$RUNS_ROOT" ]; then
      echo "No cost-of-a-green-pr runs yet; skip SNAKE.md check."
      exit 0
    fi
    src_dirs=$(find "$RUNS_ROOT" -type d -name src 2>/dev/null || true)
    if [ -z "$src_dirs" ]; then
      echo "No run src/ folders yet; skip SNAKE.md check."
      exit 0
    fi
    checked=0
    ALL_PASS=true
    for dir in $src_dirs; do
      if [ -z "$(find "$dir" -maxdepth 1 -type f 2>/dev/null | head -n 1)" ]; then
        continue
      fi
      checked=1
      marker="$dir/SNAKE.md"
      if [ ! -f "$marker" ]; then
        echo "ERROR: $marker not found"
        ALL_PASS=false
        continue
      fi
      CONTENT=$(cat "$marker")
      if echo "$CONTENT" | grep -qF "$REQUIRED"; then
        echo "✓ $marker verified (contains required marker)"
      else
        echo "ERROR: $marker does not contain the required marker"
        echo "Expected substring: $REQUIRED"
        echo "Got: $CONTENT"
        ALL_PASS=false
      fi
    done
    if [ "$checked" -eq 0 ]; then
      echo "Run src/ folders empty; skip SNAKE.md check."
      exit 0
    fi
    if [ "$ALL_PASS" = false ]; then
      echo "Add SNAKE.md with the required marker in each active run src/."
      exit 1
    fi
    exit 0
    ;;
esac

# When RalphCI scopes Review Gate tests to an experiment/feature folder, it writes
# .ralphci/review-gate-test-filter before Chunk sync so remote `pnpm test:run`
# matches the local Vitest filter.
if [ "$1" = "pnpm" ] && [ "$2" = "test:run" ]; then
  FILTER_FILE="$ROOT/.ralphci/review-gate-test-filter"
  if [ -f "$FILTER_FILE" ]; then
    FILTER=$(tr -d '\n\r' < "$FILTER_FILE")
    if [ -n "$FILTER" ]; then
      set -- "$@" "$FILTER" --passWithNoTests
    fi
  fi
fi

# Sidecar is Linux; on macOS dev machines just run the command with your existing PATH.
if [ "$(uname -s)" != "Linux" ]; then
  exec "$@"
fi

CACHE="$ROOT/.chunk-node"
NODE_VER="20.18.1"

U=$(uname -m)
case "$U" in
  x86_64) NARCH="x64" ;;
  aarch64 | arm64) NARCH="arm64" ;;
  *) NARCH="x64" ;;
esac

NODE_DIR="$CACHE/node-v${NODE_VER}-linux-${NARCH}"
if [ ! -x "$NODE_DIR/bin/node" ]; then
  mkdir -p "$CACHE"
  TGZ="$CACHE/node-v${NODE_VER}-linux-${NARCH}.tar.gz"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VER}/node-v${NODE_VER}-linux-${NARCH}.tar.gz" -o "$TGZ"
  tar -xzf "$TGZ" -C "$CACHE"
fi

export PATH="$NODE_DIR/bin:$PATH"
if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm@9.15.6
fi

# Do not `exec` into the child: some sidecar/SSH stacks omit `exit-status` on the
# channel when the session leader is replaced, and Chunk surfaces that as
# "remote command exited without exit status or exit signal".
"$@"
