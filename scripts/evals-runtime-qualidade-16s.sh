#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VALIDATOR="$ROOT_DIR/runtime/evals/16s/validate.mjs"

usage() {
  cat <<'EOF'
Usage: scripts/evals-runtime-qualidade-16s.sh [MODE]

Modes:
  --dry-run     Validate case structure, safety, coverage and governed source contracts (default).
  --run-offline Add deterministic local case decisions to all dry-run gates.
  --report      Print only safe suite counts and gate names.
  --help        Print this help.

Every mode is local and provider-free. The runner never loads .env files, opens a database,
starts services, calls a provider or corporate system, invokes a tool, or prints case inputs.
EOF
}

case "$MODE" in
  --dry-run|--run-offline|--report) ;;
  --help|-h) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac

[ "$#" -le 1 ] || { usage >&2; exit 2; }
[ -f "$VALIDATOR" ] || { printf 'FAIL 16S validator is missing\n' >&2; exit 1; }

exec node "$VALIDATOR" "$MODE"
