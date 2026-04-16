#!/usr/bin/env bash
# One-shot: clone (or update) the repo, then run scripts/install.sh
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ergenekonyigit/cursor-autoresearch/main/scripts/bootstrap.sh | bash
# Env:
#   INSTALL_DIR  — clone target (default: $HOME/.local/share/cursor-autoresearch)
#   REPO_URL     — git remote (default: https://github.com/ergenekonyigit/cursor-autoresearch.git)

set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-${HOME}/.local/share/cursor-autoresearch}"
REPO_URL="${REPO_URL:-https://github.com/ergenekonyigit/cursor-autoresearch.git}"

if ! command -v git >/dev/null 2>&1; then
  echo "error: git is required." >&2
  exit 1
fi

mkdir -p "$(dirname "${INSTALL_DIR}")"

if [[ -d "${INSTALL_DIR}/.git" ]]; then
  echo "==> updating ${INSTALL_DIR}"
  git -C "${INSTALL_DIR}" pull --ff-only
else
  echo "==> cloning ${REPO_URL} -> ${INSTALL_DIR}"
  git clone --depth 1 "${REPO_URL}" "${INSTALL_DIR}"
fi

exec bash "${INSTALL_DIR}/scripts/install.sh" "${INSTALL_DIR}"
