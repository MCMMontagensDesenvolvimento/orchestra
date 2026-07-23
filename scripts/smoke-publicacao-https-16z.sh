#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PREPARACAO_PUBLICACAO_HTTPS_16Z.md"
PREFLIGHT="$ROOT_DIR/scripts/preflight-publicacao-https-16z.sh"
SMOKE="$ROOT_DIR/scripts/smoke-publicacao-https-16z.sh"
CI="$ROOT_DIR/.github/workflows/ci.yml"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
FRONTEND_ENV="$ROOT_DIR/frontend/.env.example"
RUNTIME_ENV="$ROOT_DIR/runtime/agno-bridge/.env.example"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
DOC_INDEX="$ROOT_DIR/docs/ai-orchestration/README.md"
STATE_DOC="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_ESTADO_ATUAL_PROJETO.md"
DOC_16Y="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_READINESS_HTTPS_TOOL_STATUS_16Y.md"
DOC_16X="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_ALINHAMENTO_TOOL_STATUS_ENDPOINT_16X.md"
DOC_16W="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PRIMEIRA_EXECUCAO_REAL_TOOL_STATUS_16W.md"
DOC_16V="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_ENDPOINT_STATUS_READONLY_16V.md"
DOC_16T="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_CONECTOR_CORPORATIVO_READONLY_16T.md"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-publicacao-https-16z.sh [--dry-run|--help]

The dry-run reads versioned files and invokes offline regression gates only. It does not
contact DNS/network, execute curl, start Docker Compose, deploy, resolve a secret, change
Prisma, execute MCP, call a provider, test UI/CRUD or perform a real status request.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n16Z HTTPS publication smoke summary: PASS=%d FAIL=1 publication=false realExecution=false\n' \
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

reject_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -Eq -- "$pattern" "$file"; then
    fail "$label is present"
  fi
  pass "$label is absent"
}

case "$MODE" in
  --dry-run) ;;
  --help|-h) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac
[ "$#" -le 1 ] || fail 'only one mode can be selected'

for file in \
  "$RUNBOOK" "$SMOKE" "$CI" "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" \
  "$RUNTIME_ENV" "$PROD_COMPOSE" "$DOC_INDEX" "$STATE_DOC" "$DOC_16Y" \
  "$DOC_16X" "$DOC_16W" "$DOC_16V" "$DOC_16T"
do
  require_file "$file"
done
require_executable "$PREFLIGHT"
require_executable "$SMOKE"

HELP_OUTPUT="$("$PREFLIGHT" --help)"
for mode in --dry-run --check-local-config --template --help; do
  grep -Fq -- "$mode" <<<"$HELP_OUTPUT" || fail "preflight mode $mode"
  pass "preflight mode $mode"
done

reject_pattern "$PREFLIGHT" \
  '^[[:space:]]*(command[[:space:]]+)?(/[^[:space:]]*/)?(curl|wget|nc|ncat|telnet|ssh)[[:space:]]' \
  'executable network command in preflight'
reject_pattern "$PREFLIGHT" \
  '(/dev/(tcp|udp)|(^|[^[:alnum:]_])(fetch|request|connect|lookup)[[:space:]]*\()' \
  'network API in preflight'
reject_pattern "$PREFLIGHT" \
  '^[[:space:]]*(docker[[:space:]]+compose|docker-compose)[[:space:]]+(up|run|start|restart|pull|push)' \
  'executable Docker Compose mutation in preflight'
reject_pattern "$PREFLIGHT" \
  '^[[:space:]]*(az|azd|kubectl|helm|terraform|pulumi)[[:space:]].*(deploy|apply|up|create)' \
  'executable deployment command in preflight'
reject_pattern "$PREFLIGHT" \
  '^[[:space:]]*(npm|npx|node|python|python3)[[:space:]].*(mcp|provider|openai)' \
  'MCP/provider execution command in preflight'

DRY_RUN_BODY="$(sed -n '/^run_dry_run() {$/,/^}$/p' "$PREFLIGHT")"
if grep -Eiq -- \
  '^[[:space:]]*(curl|wget|nc|ncat|telnet|ssh|docker[[:space:]]+compose|docker-compose|azd|kubectl|helm|terraform)[[:space:]]' \
  <<<"$DRY_RUN_BODY"
then
  fail 'preflight dry-run body contains a network, container-start or deployment command'
fi
pass 'preflight dry-run body is static and offline'

STATUS_BEFORE="$(git -C "$ROOT_DIR" status --short)"
PREFLIGHT_DRY_OUTPUT="$("$PREFLIGHT" --dry-run)" \
  || fail 'preflight dry-run execution'
grep -Fq -- 'realExecution=false' <<<"$PREFLIGHT_DRY_OUTPUT" \
  || fail 'preflight dry-run does not record realExecution=false'
pass 'preflight dry-run executed offline and records no real execution'

TEMPLATE_TRACE="$(bash -x "$PREFLIGHT" --template 2>&1 >/dev/null)" \
  || fail 'preflight template trace'
if grep -Eq -- \
  '^\+[[:space:]]+(curl|wget|nc|ncat|telnet|ssh|docker[[:space:]]+compose|docker-compose|azd|kubectl|helm|terraform)[[:space:]]' \
  <<<"$TEMPLATE_TRACE"
then
  fail 'preflight template executed a network, container-start or deployment command'
fi
pass 'preflight template trace contains only rendering operations'

TEMPLATE_OUTPUT="$("$PREFLIGHT" --template)" || fail 'preflight template generation'
for line in \
  'Expected DNS records:' \
  'Production environment template' \
  'Manual Docker Compose examples' \
  'Manual post-deploy checks' \
  '/health' '/v1/status' '/v1/status/availability' \
  'MCP_REMOTE_ENABLED=false' 'MCP_CORPORATE_READONLY_ENABLED=false'
do
  grep -Fq -- "$line" <<<"$TEMPLATE_OUTPUT" || fail "template line $line"
done
[ "$(grep -cF -- 'curl -i https://' <<<"$TEMPLATE_OUTPUT")" -eq 3 ] \
  || fail 'template must contain exactly three manual HTTPS curl examples'
pass 'template contains the three required manual endpoint checks'
if grep -Eq -- \
  '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})' \
  <<<"$TEMPLATE_OUTPUT"
then
  fail 'template output contains apparent credential material'
fi
pass 'template prints placeholders and no apparent credential material'

STATUS_AFTER="$(git -C "$ROOT_DIR" status --short)"
[ "$STATUS_BEFORE" = "$STATUS_AFTER" ] \
  || fail 'preflight dry-run or template changed the worktree'
pass 'preflight dry-run and template do not change files'

require_pattern "$CI" 'scripts/smoke-publicacao-https-16z.sh --dry-run' \
  'CI runs the 16Z smoke only in dry-run mode'
reject_pattern "$CI" 'scripts/preflight-publicacao-https-16z\.sh' \
  'direct 16Z preflight execution in CI'
reject_pattern "$CI" \
  'smoke-publicacao-https-16z\.sh[[:space:]]+--(template|check-local-config|live|run)' \
  'non-dry 16Z smoke mode in CI'
reject_pattern "$CI" '^[[:space:]]*(curl|wget)[[:space:]]' 'curl/wget command in CI'
reject_pattern "$CI" \
  '^[[:space:]]*(docker[[:space:]]+compose|docker-compose)[[:space:]]+(up|run|start|restart|pull|push)' \
  'Docker Compose live command in CI'
reject_pattern "$CI" \
  '^[[:space:]]*(az|azd|kubectl|helm|terraform|pulumi)[[:space:]].*(deploy|apply|up|create)' \
  'deployment command in CI'

CI_16Z_STEP="$(
  awk '
    /name: Run 16Z HTTPS publication preparation static gate/ { capture = 1 }
    capture { print }
    capture && /^[[:space:]]*-[[:space:]]+name:/ \
      && !/Run 16Z HTTPS publication preparation static gate/ { exit }
  ' "$CI"
)"
[ -n "$CI_16Z_STEP" ] || fail 'CI 16Z step is missing'
if grep -Eiq -- \
  'curl|wget|docker[[:space:]]+(compose|run|exec)|deploy|openai|provider|mcp[[:space:]]+(run|execute)|https?://' \
  <<<"$CI_16Z_STEP"
then
  fail 'CI 16Z step contains a live, provider, MCP or deployment command'
fi
pass 'CI 16Z step is dry-run-only, offline and provider-free'

for file in "$ROOT_ENV" "$BACKEND_ENV"; do
  require_pattern "$file" 'MCP_REMOTE_ENABLED=false' \
    "${file#"$ROOT_DIR/"} remote MCP disabled"
  require_pattern "$file" 'MCP_REMOTE_EXECUTION_ENABLED=false' \
    "${file#"$ROOT_DIR/"} remote execution disabled"
  require_pattern "$file" 'MCP_REMOTE_DISCOVERY_ENABLED=false' \
    "${file#"$ROOT_DIR/"} remote discovery disabled"
  require_pattern "$file" 'MCP_REMOTE_READONLY_ENABLED=false' \
    "${file#"$ROOT_DIR/"} remote read-only disabled"
  require_pattern "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' \
    "${file#"$ROOT_DIR/"} remote allowlist empty"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_ENABLED=false' \
    "${file#"$ROOT_DIR/"} corporate adapter disabled"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' \
    "${file#"$ROOT_DIR/"} corporate origin empty"
  if grep -En \
    '^(MCP_REMOTE_EGRESS_ALLOWLIST|MCP_CORPORATE_READONLY_ALLOWED_ORIGIN)=.+$' \
    "$file" >/dev/null
  then
    fail "${file#"$ROOT_DIR/"} versions a remote/corporate origin"
  fi
  pass "${file#"$ROOT_DIR/"} versions no remote/corporate origin"
done

for file in "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV"; do
  reject_pattern "$file" \
    '(https://)?(api\.)?orchestra\.mcm\.eng\.br|/v1/status(/availability)?' \
    "planned Orchestra endpoint in ${file#"$ROOT_DIR/"}"
done

for pattern in \
  'MCP_REMOTE_ENABLED: "false"' \
  'MCP_REMOTE_EXECUTION_ENABLED: "false"' \
  'MCP_REMOTE_DISCOVERY_ENABLED: "false"' \
  'MCP_REMOTE_READONLY_ENABLED: "false"' \
  'MCP_REMOTE_EGRESS_ALLOWLIST: ""' \
  'MCP_REMOTE_ALLOW_WRITE_TOOLS: "false"' \
  'MCP_CORPORATE_READONLY_ENABLED: "false"' \
  'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: ""'
do
  require_pattern "$PROD_COMPOSE" "$pattern" "production fail-closed setting $pattern"
done
reject_pattern "$PROD_COMPOSE" \
  '(https://)?api\.orchestra\.mcm\.eng\.br|/v1/status(/availability)?' \
  'operational corporate/status endpoint in production Compose'

require_pattern "$RUNBOOK" 'https://orchestra.mcm.eng.br' \
  'runbook planned frontend URL'
require_pattern "$RUNBOOK" 'https://api.orchestra.mcm.eng.br' \
  'runbook planned API URL'
for endpoint in '/health' '/v1/status' '/v1/status/availability'; do
  require_pattern "$RUNBOOK" "$endpoint" "runbook endpoint $endpoint"
done
require_pattern "$RUNBOOK" 'realExecution=false' 'runbook records no real execution'

for file in "$DOC_INDEX" "$STATE_DOC" "$DOC_16Y" "$DOC_16X" "$DOC_16W" "$DOC_16V" "$DOC_16T"; do
  require_pattern "$file" '16Z' "${file#"$ROOT_DIR/"} references phase 16Z"
  require_pattern "$file" 'não executa chamada real' \
    "${file#"$ROOT_DIR/"} records no real call in 16Z"
  require_pattern "$file" 'UI/CRUD MCP' \
    "${file#"$ROOT_DIR/"} keeps MCP UI/CRUD out of scope"
  require_pattern "$file" 'URLs planejadas' \
    "${file#"$ROOT_DIR/"} records planned, inactive URLs"
done

if git -C "$ROOT_DIR" status --short -- \
  backend/prisma/schema.prisma backend/prisma/migrations | grep -q .
then
  fail 'Prisma schema or migrations changed'
fi
pass 'Prisma schema and migrations are unchanged'

if grep -ERn \
  '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})' \
  "$RUNBOOK" "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV" \
  "$PROD_COMPOSE" >/dev/null
then
  fail 'apparent credential material detected in the 16Z publication scope'
fi
pass 'no apparent credential material in the 16Z publication scope'

bash -n "$PREFLIGHT"
bash -n "$SMOKE"
pass '16Z Bash syntax checks passed'

for regression in \
  'smoke-readiness-https-tool-status-16y.sh --dry-run' \
  'readiness-https-tool-status-16y.sh --dry-run' \
  'smoke-alinhamento-tool-status-16x.sh --dry-run' \
  'smoke-primeira-tool-status-16w.sh --dry-run' \
  'smoke-endpoint-status-readonly-16v.sh --dry-run' \
  'smoke-homologacao-conector-readonly-16u.sh --dry-run' \
  'smoke-conector-corporativo-readonly-16t.sh --dry-run' \
  'evals-runtime-qualidade-16s.sh --dry-run' \
  'smoke-evals-qualidade-16s.sh --dry-run'
do
  read -r script argument <<<"$regression"
  require_executable "$ROOT_DIR/scripts/$script"
  "$ROOT_DIR/scripts/$script" "$argument" >/dev/null \
    || fail "regression $script $argument"
  pass "regression $script $argument"
done

printf '\n16Z HTTPS publication smoke summary: PASS=%d FAIL=0 publication=false realExecution=false\n' \
  "$pass_count"
