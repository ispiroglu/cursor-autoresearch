#!/usr/bin/env bash
# Install cursor-autoresearch: install deps, build, symlink skills, register MCP in ~/.cursor/mcp.json
# Run from repo root: ./scripts/install.sh
# Or: bash scripts/install.sh /path/to/cursor-autoresearch

set -euo pipefail

ROOT="${1:-}"
if [[ -z "${ROOT}" ]]; then
  ROOT="$(cd "$(dirname "$0")/.." && pwd)"
else
  ROOT="$(cd "$ROOT" && pwd)"
fi

SKIP_MCP="${SKIP_MCP:-0}"
SKIP_SKILLS="${SKIP_SKILLS:-0}"

if [[ ! -f "${ROOT}/package.json" ]] || ! grep -q '"name": "cursor-autoresearch"' "${ROOT}/package.json" 2>/dev/null; then
  echo "error: ${ROOT} does not look like the cursor-autoresearch repo root." >&2
  exit 1
fi

cd "${ROOT}"

if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm@9.15.4 --activate
  else
    echo "error: pnpm not found. Install Node.js 18+ and enable corepack, or install pnpm: https://pnpm.io/installation" >&2
    exit 1
  fi
fi

echo "==> pnpm install && pnpm build (${ROOT})"
pnpm install
pnpm build

MCP_JS="${ROOT}/packages/mcp-server/dist/index.js"
if [[ ! -f "${MCP_JS}" ]]; then
  echo "error: MCP bundle missing: ${MCP_JS}" >&2
  exit 1
fi

if [[ "${SKIP_MCP}" != "1" ]]; then
  echo "==> merge MCP config into ~/.cursor/mcp.json"
  node "${ROOT}/scripts/merge-mcp.mjs" "${MCP_JS}"
else
  echo "==> SKIP_MCP=1 — not updating ~/.cursor/mcp.json"
fi

if [[ "${SKIP_SKILLS}" != "1" ]]; then
  echo "==> symlink skills -> ~/.agents/skills/"
  mkdir -p "${HOME}/.agents/skills"
  ln -sfn "${ROOT}/skills/autoresearch-create" "${HOME}/.agents/skills/autoresearch-create"
  ln -sfn "${ROOT}/skills/autoresearch-finalize" "${HOME}/.agents/skills/autoresearch-finalize"
else
  echo "==> SKIP_SKILLS=1 — not updating ~/.agents/skills"
fi

echo ""
echo "Done. Restart Cursor so it picks up MCP changes."
echo "Optional: install the VS Code extension with: pnpm package:extension"
