#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
STRICT_BASELINE=false
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_HOMOLOGACAO_FUNCIONAL_UI_18A.md"
INVENTORY="$ROOT_DIR/docs/ai-orchestration/ui/ORCHESTRA_UI_INVENTARIO_18A.md"
MATRIX="$ROOT_DIR/docs/ai-orchestration/ui/ORCHESTRA_UI_HOMOLOGATION_MATRIX_18A.json"
CHECKLIST="$ROOT_DIR/docs/ai-orchestration/ui/ORCHESTRA_UI_CHECKLIST_MANUAL_18A.md"
BUG_TEMPLATE="$ROOT_DIR/docs/ai-orchestration/ui/ORCHESTRA_UI_BUG_TEMPLATE_18A.md"
PREFLIGHT="$ROOT_DIR/scripts/preflight-homologacao-ui-18a.sh"
SMOKE="$ROOT_DIR/scripts/smoke-homologacao-ui-18a.sh"
CI="$ROOT_DIR/.github/workflows/ci.yml"
SMOKE_17D="$ROOT_DIR/scripts/smoke-release-homologavel-17d.sh"
SMOKE_17C="$ROOT_DIR/scripts/smoke-secrets-variaveis-17c.sh"
SMOKE_17B="$ROOT_DIR/scripts/smoke-hardening-compose-nginx-17b.sh"
SMOKE_17A="$ROOT_DIR/scripts/smoke-plano-deploy-17a.sh"
SMOKE_16Z="$ROOT_DIR/scripts/smoke-publicacao-https-16z.sh"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-homologacao-ui-18a.sh [--dry-run|--strict-baseline|--help]

The dry-run validates only local/versioned 18A preparation and offline regressions.
It does not call network or planned production URLs, deploy, start Docker Compose,
migrate, execute MCP/provider/embeddings, open a browser, test UI, collect secrets,
or change files.

The default dry-run accepts governed functional changes made after 18A.
Use --strict-baseline to enforce the historical 18A source fingerprints.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n18A UI smoke summary: PASS=%d FAIL=1 uiHomologation=true deployment=false productionTest=false realMcpExecution=false realProviderExecution=false bugFixing=false manualBrowserTestingPrepared=true\n' \
    "$pass_count" >&2
  exit 1
}

require_file() {
  [ -f "$1" ] || fail "${1#"$ROOT_DIR/"} is missing"
  pass "${1#"$ROOT_DIR/"} exists"
}

require_executable() {
  require_file "$1"
  [ -x "$1" ] || fail "${1#"$ROOT_DIR/"} is not executable"
  pass "${1#"$ROOT_DIR/"} is executable"
}

require_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  grep -Fq -- "$pattern" "$file" || fail "$label is missing"
  pass "$label"
}

require_exact_line() {
  local file="$1"
  local line="$2"
  local label="$3"
  grep -Fxq -- "$line" "$file" || fail "$label is missing or changed"
  pass "$label"
}

reject_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -Eq -- "$pattern" "$file"; then
    fail "$label is present"
  fi
  pass "$label is absent"
}

reject_executable_operations() {
  local file="$1"
  local label="$2"

  reject_pattern "$file" \
    '^[[:space:]]*(command[[:space:]]+)?(/[^[:space:]]*/)?(curl|wget|nc|ncat|telnet|ssh|scp|sftp|dig|nslookup|host|getent)[[:space:]]' \
    "executable network/DNS command in $label"
  reject_pattern "$file" \
    '(/dev/(tcp|udp)|^[[:space:]]*(node|python|python3)[[:space:]].*(fetch|request|connect|lookup)[[:space:]]*\()' \
    "executable network API in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(docker[[:space:]]+compose|docker-compose)[[:space:]]+(up|run|start|restart|pull|push|build|exec|create|rm|down|config)' \
    "executable Docker Compose command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(az|azd|kubectl|helm|terraform|pulumi)[[:space:]].*(deploy|apply|up|create|delete|destroy)' \
    "executable infrastructure/deployment command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(npm|npx|pnpm|yarn)[[:space:]].*(prisma:)?migrat(e|ion)' \
    "executable migration command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(npm|npx|node|python|python3)[[:space:]].*(smoke-agno-real|smoke-chat-provider-real|mcp.*run-real|provider.*run-real)' \
    "executable real MCP/provider command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(npx|npm|pnpm|yarn)[[:space:]].*(playwright|cypress|test:e2e|test:visual)' \
    "executable UI/browser command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(xdg-open|open|start)[[:space:]]' \
    "executable browser opener in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(rm|mv|cp|install|touch|mkdir|rmdir|chmod|chown|truncate|tee)[[:space:]]' \
    "executable filesystem mutation in $label"
}

[ "$#" -le 1 ] || fail 'only one mode can be selected'

case "$MODE" in
  --dry-run)
    ;;
  --strict-baseline)
    STRICT_BASELINE=true
    ;;
  --help|-h)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

for file in "$RUNBOOK" "$INVENTORY" "$MATRIX" "$CHECKLIST" "$BUG_TEMPLATE" "$CI"; do
  require_file "$file"
done
for script in "$PREFLIGHT" "$SMOKE" "$SMOKE_17D" "$SMOKE_17C" "$SMOKE_17B" "$SMOKE_17A" "$SMOKE_16Z"; do
  require_executable "$script"
done

HELP_OUTPUT="$("$PREFLIGHT" --help)"
for required_mode in --dry-run --strict-baseline --check-matrix --template --help; do
  grep -Fq -- "$required_mode" <<<"$HELP_OUTPUT" || fail "preflight mode $required_mode"
  pass "preflight mode $required_mode"
done

reject_executable_operations "$PREFLIGHT" '18A preflight'
reject_executable_operations "$SMOKE" '18A smoke'
reject_pattern "$PREFLIGHT" \
  'https://(api\.)?orchestra\.mcm\.eng\.br' \
  'planned production URL in 18A preflight'
reject_pattern "$SMOKE" \
  'https://(api\.)?orchestra\.mcm\.eng\.br' \
  'planned production URL in 18A smoke'

STATUS_BEFORE="$(git -C "$ROOT_DIR" status --short)"

MATRIX_OUTPUT="$("$PREFLIGHT" --check-matrix)" \
  || fail '18A matrix validation'
for marker in \
  'phase=18A' \
  'uiHomologation=true' \
  'deployment=false' \
  'productionTest=false' \
  'realMcpExecution=false' \
  'realProviderExecution=false' \
  'bugFixing=false' \
  'manualBrowserTestingPrepared=true' \
  'status=not-tested'
do
  grep -Fq -- "$marker" <<<"$MATRIX_OUTPUT" || fail "matrix marker $marker"
  pass "matrix marker $marker"
done

TEMPLATE_TRACE="$(bash -x "$PREFLIGHT" --template 2>&1 >/dev/null)" \
  || fail '18A template trace'
if grep -Eq -- \
  '^\+[[:space:]]+(curl|wget|nc|ncat|telnet|ssh|dig|nslookup|host|getent|docker[[:space:]]+compose|docker-compose|az|azd|kubectl|helm|terraform|pulumi|npm|npx|node|python|python3|xdg-open|open|start)[[:space:]]' \
  <<<"$TEMPLATE_TRACE"
then
  fail '18A template executed a network, container, deployment, migration, MCP/provider or browser-capable command'
fi
pass 'template mode only renders text'

TEMPLATE_OUTPUT="$("$PREFLIGHT" --template)" \
  || fail '18A template generation'
for line in \
  '18A suggested manual homologation order' \
  'Short bug template' \
  'Short approved-evidence template' \
  '18A GO/NO-GO template' \
  'Bug fixing: NO-GO' \
  'UI_HOMOLOGATION=true'
do
  grep -Fq -- "$line" <<<"$TEMPLATE_OUTPUT" || fail "template line $line"
  pass "template line $line"
done

PREFLIGHT_OUTPUT="$("$PREFLIGHT" "$MODE")" \
  || fail '18A preflight dry-run execution'
for marker in \
  'uiHomologation=true' \
  'deployment=false' \
  'productionTest=false' \
  'realMcpExecution=false' \
  'realProviderExecution=false' \
  'bugFixing=false' \
  'manualBrowserTestingPrepared=true'
do
  grep -Fq -- "$marker" <<<"$PREFLIGHT_OUTPUT" || fail "preflight marker $marker"
  pass "preflight marker $marker"
done

STATUS_AFTER="$(git -C "$ROOT_DIR" status --short)"
[ "$STATUS_BEFORE" = "$STATUS_AFTER" ] \
  || fail '18A preflight modes changed the worktree'
pass 'all exercised 18A preflight modes are read-only'

require_pattern "$CI" \
  'scripts/smoke-homologacao-ui-18a.sh --dry-run' \
  'CI runs only the 18A dry-run smoke for phase 18A'
require_exact_line "$CI" \
  '        run: scripts/smoke-homologacao-ui-18a.sh --dry-run' \
  'CI 18A invocation is exact'
reject_pattern "$CI" \
  'scripts/preflight-homologacao-ui-18a\.sh' \
  '18A preflight execution in CI'
reject_pattern "$CI" \
  '(playwright|cypress|test:e2e|test:visual)' \
  'UI/browser execution in CI'
reject_pattern "$CI" \
  '^[[:space:]]*(run:[[:space:]]*)?(docker[[:space:]]+compose|docker-compose)[[:space:]]+(up|run|start|restart|pull|push|build|exec|config)' \
  'live Docker Compose in CI'
reject_pattern "$CI" \
  '^[[:space:]]*(run:[[:space:]]*)?(npm|npx|pnpm|yarn)[[:space:]].*(prisma:)?migrat(e|ion)' \
  'migration in CI'

for regression in "$SMOKE_17D" "$SMOKE_17C" "$SMOKE_17B" "$SMOKE_17A" "$SMOKE_16Z"; do
  regression_mode=--dry-run
  if [ "$regression" = "$SMOKE_17D" ] && [ "$STRICT_BASELINE" = true ]; then
    regression_mode=--strict-baseline
  fi
  "$regression" "$regression_mode" >/dev/null \
    || fail "offline regression ${regression#"$ROOT_DIR/"}"
  pass "offline regression ${regression#"$ROOT_DIR/"}"
done

printf '\n18A UI smoke summary: PASS=%d FAIL=0 strictBaseline=%s uiHomologation=true deployment=false productionTest=false realMcpExecution=false realProviderExecution=false bugFixing=false manualBrowserTestingPrepared=true regressions=17D,17C,17B,17A,16Z\n' \
  "$pass_count" "$STRICT_BASELINE"
