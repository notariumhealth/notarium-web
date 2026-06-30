#!/usr/bin/env bash
# Pull the canonical prose docs into content/, then rebuild the served HTML.
#
# Source of truth lives in the canonical app repo:
#   notarium/docs/website/*.md
# This copies the current version into notarium-web/content/ (vendored so the
# site repo is self-contained) and regenerates web/*.html via tools/build.mjs.
#
# Override the canonical repo path with NOTARIUM_REPO if it isn't the default.
#
# Usage: tools/sync-content.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NOTARIUM_REPO="${NOTARIUM_REPO:-$HOME/projects/notarium}"
SRC_DIR="$NOTARIUM_REPO/docs/website"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "sync-content: canonical docs not found at $SRC_DIR" >&2
  echo "  set NOTARIUM_REPO to your notarium checkout, e.g.:" >&2
  echo "  NOTARIUM_REPO=/path/to/notarium tools/sync-content.sh" >&2
  exit 1
fi

shopt -s nullglob
copied=0
for md in "$SRC_DIR"/*.md; do
  name="$(basename "$md")"
  cp "$md" "$REPO_ROOT/content/$name"
  echo "synced content/$name  <-  $md"
  copied=$((copied + 1))
done

if [[ "$copied" -eq 0 ]]; then
  echo "sync-content: no .md files in $SRC_DIR" >&2
  exit 1
fi

echo "rebuilding..."
node "$REPO_ROOT/tools/build.mjs"
