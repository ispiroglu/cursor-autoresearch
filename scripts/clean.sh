#!/usr/bin/env bash
# Remove build output directories under packages/*/dist
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for pkg in core mcp-server vscode-extension; do
  d="${ROOT}/packages/${pkg}/dist"
  if [[ -d "$d" ]]; then
    rm -rf "$d"
    echo "removed ${d}"
  fi
done

echo "clean done."
