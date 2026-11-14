#!/bin/bash
# Download third-party assets (listed in cdn-assets.txt) from CDNs into public/
# and verify them against cdn-assets.sha256. Already downloaded files are kept.
#
# Usage:
#   scripts/fetch-cdn-assets.sh                  # download + verify
#   scripts/fetch-cdn-assets.sh --update-hashes  # re-download all, rewrite checksums
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MANIFEST="$SCRIPT_DIR/cdn-assets.txt"
CHECKSUMS="$SCRIPT_DIR/cdn-assets.sha256"
TARGET="$SCRIPT_DIR/../public"

UPDATE=0
if [ "${1:-}" = "--update-hashes" ]; then UPDATE=1; fi

cd "$TARGET"
dests=()
while read -r dest url; do
  case "$dest" in ''|'#'*) continue ;; esac
  dests+=("$dest")
  if [ "$UPDATE" = 1 ] || [ ! -f "$dest" ]; then
    echo "Downloading $url"
    mkdir -p "$(dirname "$dest")"
    curl -sSfL --retry 3 -o "$dest.tmp" "$url"
    mv "$dest.tmp" "$dest"
  fi
done < "$MANIFEST"

if [ "$UPDATE" = 1 ]; then
  sha256sum "${dests[@]}" > "$CHECKSUMS"
  echo "Wrote $CHECKSUMS"
else
  sha256sum --quiet --strict -c "$CHECKSUMS"
  echo "CDN assets OK"
fi
