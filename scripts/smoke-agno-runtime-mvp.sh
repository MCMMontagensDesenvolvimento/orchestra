#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_SRC="$ROOT_DIR/frontend/src"

echo "==> Agno runtime MVP smoke: minimal runtime contract"
"$ROOT_DIR/scripts/smoke-agno-runtime-contract.sh"

echo "==> Agno runtime MVP smoke: frontend boundary"
if [ -d "$FRONTEND_SRC" ]; then
  if grep -RInE 'AGNO_RUNTIME_HTTP|127\.0\.0\.1:8091|localhost:8091|/execute\b' "$FRONTEND_SRC"; then
    echo "FAIL frontend source contains direct Agno runtime references"
    exit 1
  fi
fi

echo "OK Agno runtime MVP smoke completed"
