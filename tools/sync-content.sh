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

# Copy only the files build.mjs actually publishes. This repo is public; a doc
# that lives in canonical's docs/website/ without a PAGES entry is internal
# (site audits, IP clearance research) and must not be vendored here.
#
# --list-sources runs as a process substitution below, so its exit status is
# not visible to `set -e` or to pipefail (pipefail only covers `|` pipes, not
# `<(...)`). A build.mjs that prints some entries and then dies would let the
# loop copy a partial set and fall through as if nothing were wrong. Capture
# the output to a file first and check the exit status explicitly so a
# mid-list failure fails the sync instead of silently under-copying.
manifest_file="$(mktemp)"
trap 'rm -f "$manifest_file"' EXIT

if ! node "$REPO_ROOT/tools/build.mjs" --list-sources > "$manifest_file"; then
  echo "sync-content: build.mjs --list-sources failed" >&2
  exit 1
fi

copied=0
while IFS= read -r name; do
  [[ -z "$name" ]] && continue
  src="$SRC_DIR/$name"
  if [[ ! -f "$src" ]]; then
    echo "sync-content: published page missing from canonical: $src" >&2
    exit 1
  fi
  cp "$src" "$REPO_ROOT/content/$name"
  echo "synced content/$name  <-  $src"
  copied=$((copied + 1))
done < "$manifest_file"

if [[ "$copied" -eq 0 ]]; then
  echo "sync-content: no .md files in $SRC_DIR" >&2
  exit 1
fi

echo "rebuilding..."
node "$REPO_ROOT/tools/build.mjs"
