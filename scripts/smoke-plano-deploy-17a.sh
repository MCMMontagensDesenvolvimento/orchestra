#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK_17A="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PLANO_DEPLOY_HOMOLOGADO_17A.md"
RUNBOOK_16Z="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PREPARACAO_PUBLICACAO_HTTPS_16Z.md"
PREFLIGHT="$ROOT_DIR/scripts/preflight-plano-deploy-17a.sh"
SMOKE="$ROOT_DIR/scripts/smoke-plano-deploy-17a.sh"
PREFLIGHT_16Z="$ROOT_DIR/scripts/preflight-publicacao-https-16z.sh"
SMOKE_16Z="$ROOT_DIR/scripts/smoke-publicacao-https-16z.sh"
CI="$ROOT_DIR/.github/workflows/ci.yml"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
FRONTEND_ENV="$ROOT_DIR/frontend/.env.example"
RUNTIME_ENV="$ROOT_DIR/runtime/agno-bridge/.env.example"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
DOC_INDEX="$ROOT_DIR/docs/ai-orchestration/README.md"
STATE_DOC="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_ESTADO_ATUAL_PROJETO.md"
DOC_16Y="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_READINESS_HTTPS_TOOL_STATUS_16Y.md"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-plano-deploy-17a.sh [--dry-run|--help]

The dry-run validates only versioned/local state and invokes offline regression gates.
It does not call DNS/network or curl, start Docker Compose, deploy, migrate a database,
execute MCP/provider code, resolve a secret, test UI/CRUD, or change a file.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n17A deployment-plan smoke summary: PASS=%d FAIL=1 deployment=false realExecution=false\n' \
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

reject_executable_network_or_mutation() {
  local file="$1"
  local label="$2"

  reject_pattern "$file" \
    '^[[:space:]]*(command[[:space:]]+)?(/[^[:space:]]*/)?(curl|wget|nc|ncat|telnet|ssh|scp|sftp|dig|nslookup|host|getent)[[:space:]]' \
    "executable network/DNS command in $label"
  reject_pattern "$file" \
    '(/dev/(tcp|udp)|(^|[^[:alnum:]_])(fetch|request|connect|lookup)[[:space:]]*\()' \
    "network API in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(docker[[:space:]]+compose|docker-compose)[[:space:]]+(up|run|start|restart|pull|push|build|exec|create|rm|down)' \
    "executable Docker Compose live command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(az|azd|kubectl|helm|terraform|pulumi)[[:space:]].*(deploy|apply|up|create|delete|destroy)' \
    "executable infrastructure/deployment command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(npm|npx|pnpm|yarn)[[:space:]].*(prisma:)?migrat(e|ion)' \
    "executable migration command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(npm|npx|node|python|python3)[[:space:]].*(mcp|provider|openai)' \
    "executable MCP/provider command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(rm|mv|cp|install|touch|mkdir|rmdir|chmod|chown|truncate|tee)[[:space:]]' \
    "executable filesystem mutation in $label"
}

case "$MODE" in
  --dry-run) ;;
  --help|-h) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac
[ "$#" -le 1 ] || fail 'only one mode can be selected'

for file in \
  "$RUNBOOK_17A" "$RUNBOOK_16Z" "$SMOKE" "$CI" \
  "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV" \
  "$PROD_COMPOSE" "$DOC_INDEX" "$STATE_DOC" "$DOC_16Y"
do
  require_file "$file"
done
require_executable "$PREFLIGHT"
require_executable "$SMOKE"
require_executable "$PREFLIGHT_16Z"
require_executable "$SMOKE_16Z"

HELP_OUTPUT="$("$PREFLIGHT" --help)"
for mode in \
  --dry-run --check-local-readiness --template --go-no-go-template --help
do
  grep -Fq -- "$mode" <<<"$HELP_OUTPUT" || fail "preflight mode $mode"
  pass "preflight mode $mode"
done

reject_executable_network_or_mutation "$PREFLIGHT" '17A preflight'
reject_executable_network_or_mutation "$SMOKE" '17A smoke'

DRY_RUN_BODY="$(sed -n '/^run_dry_run() {$/,/^}$/p' "$PREFLIGHT")"
if grep -Eiq -- \
  '^[[:space:]]*(curl|wget|nc|ncat|telnet|ssh|dig|nslookup|host|getent|docker[[:space:]]+compose|docker-compose|azd|kubectl|helm|terraform)[[:space:]]' \
  <<<"$DRY_RUN_BODY"
then
  fail 'preflight dry-run body contains a network, DNS, container or deployment command'
fi
pass 'preflight dry-run body is static and offline'

STATUS_BEFORE="$(git -C "$ROOT_DIR" status --short)"

PREFLIGHT_DRY_OUTPUT="$("$PREFLIGHT" --dry-run)" \
  || fail 'preflight dry-run execution'
grep -Fq -- 'deployment=false realExecution=false' <<<"$PREFLIGHT_DRY_OUTPUT" \
  || fail 'preflight dry-run does not record deployment=false and realExecution=false'
pass 'preflight dry-run records no deployment or real execution'

LOCAL_READINESS_OUTPUT="$("$PREFLIGHT" --check-local-readiness)" \
  || fail 'preflight local-readiness execution'
grep -Fq -- 'deployment=false realExecution=false' <<<"$LOCAL_READINESS_OUTPUT" \
  || fail 'local-readiness mode does not record the offline boundary'
pass 'preflight local-readiness validates only local versioned state'

TEMPLATE_TRACE="$(bash -x "$PREFLIGHT" --template 2>&1 >/dev/null)" \
  || fail 'preflight template trace'
if grep -Eq -- \
  '^\+[[:space:]]+(curl|wget|nc|ncat|telnet|ssh|dig|nslookup|host|getent|docker[[:space:]]+compose|docker-compose|azd|kubectl|helm|terraform)[[:space:]]' \
  <<<"$TEMPLATE_TRACE"
then
  fail 'preflight template executed a network, DNS, container or deployment command'
fi
pass 'preflight template trace contains only text-rendering operations'

TEMPLATE_OUTPUT="$("$PREFLIGHT" --template)" || fail 'preflight template generation'
for line in \
  'Production environment template' \
  'Manual deployment command template' \
  'Manual post-deploy check template' \
  'Manual rollback template' \
  'Evidence template' \
  '/health' '/v1/status' '/v1/status/availability' \
  'MCP_REMOTE_ENABLED=false' 'MCP_CORPORATE_READONLY_ENABLED=false'
do
  grep -Fq -- "$line" <<<"$TEMPLATE_OUTPUT" || fail "template line $line"
  pass "template line $line"
done
[ "$(grep -cF -- 'curl -i https://' <<<"$TEMPLATE_OUTPUT")" -eq 3 ] \
  || fail 'template must contain exactly three manual HTTPS curl examples'
pass 'template contains exactly three non-executed endpoint checks'

GO_NO_GO_TRACE="$(bash -x "$PREFLIGHT" --go-no-go-template 2>&1 >/dev/null)" \
  || fail 'preflight go/no-go trace'
if grep -Eq -- \
  '^\+[[:space:]]+(curl|wget|nc|ncat|telnet|ssh|dig|nslookup|host|getent|docker[[:space:]]+compose|docker-compose|azd|kubectl|helm|terraform)[[:space:]]' \
  <<<"$GO_NO_GO_TRACE"
then
  fail 'preflight go/no-go template executed an operational command'
fi
pass 'preflight go/no-go trace contains only text-rendering operations'

GO_NO_GO_OUTPUT="$("$PREFLIGHT" --go-no-go-template)" \
  || fail 'preflight go/no-go template generation'
for heading in 'Item' 'Status esperado' 'Evidência' 'Responsável' 'Decisão'; do
  grep -Fq -- "$heading" <<<"$GO_NO_GO_OUTPUT" \
    || fail "go/no-go heading $heading"
  pass "go/no-go heading $heading"
done
grep -Fq -- 'default decision is NO_GO' <<<"$GO_NO_GO_OUTPUT" \
  || fail 'go/no-go template does not default to NO_GO'
pass 'go/no-go template defaults to NO_GO'

if grep -Eiq -- \
  '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})' \
  <<<"$TEMPLATE_OUTPUT"$'\n'"$GO_NO_GO_OUTPUT"
then
  fail 'preflight templates contain apparent credential material'
fi
pass 'preflight templates contain placeholders and no apparent credential material'

STATUS_AFTER="$(git -C "$ROOT_DIR" status --short)"
[ "$STATUS_BEFORE" = "$STATUS_AFTER" ] \
  || fail '17A preflight modes changed the worktree'
pass 'all exercised preflight modes are read-only'

require_pattern "$CI" 'scripts/smoke-plano-deploy-17a.sh --dry-run' \
  'CI runs the 17A smoke in dry-run mode'
reject_pattern "$CI" 'scripts/preflight-plano-deploy-17a\.sh' \
  'direct 17A preflight execution in CI'
[ "$(grep -Ec -- 'scripts/(preflight|smoke)-plano-deploy-17a\.sh' "$CI")" -eq 1 ] \
  || fail 'CI must contain exactly one 17A script invocation'
pass 'CI contains exactly one 17A invocation'
reject_pattern "$CI" \
  'smoke-plano-deploy-17a\.sh[[:space:]]+--(template|go-no-go-template|check-local-readiness|live|run|deploy)' \
  'non-dry 17A smoke mode in CI'
reject_pattern "$CI" \
  '^[[:space:]]*(curl|wget|dig|nslookup|host|getent)[[:space:]]' \
  'network/DNS command in CI'
reject_pattern "$CI" \
  '^[[:space:]]*(docker[[:space:]]+compose|docker-compose)[[:space:]]+(up|run|start|restart|pull|push|build|exec)' \
  'Docker Compose live command in CI'
reject_pattern "$CI" \
  '^[[:space:]]*(az|azd|kubectl|helm|terraform|pulumi)[[:space:]].*(deploy|apply|up|create)' \
  'deployment command in CI'
reject_pattern "$CI" \
  '^[[:space:]].*(prisma[[:space:]]+migrate|prisma:migrate:deploy)' \
  'live migration command in CI'

CI_17A_STEP="$(
  awk '
    /name: Run 17A homologated HTTPS plan static gate/ { capture = 1 }
    capture { print }
    capture && /^[[:space:]]*-[[:space:]]+name:/ \
      && !/Run 17A homologated HTTPS plan static gate/ { exit }
  ' "$CI"
)"
[ -n "$CI_17A_STEP" ] || fail 'CI 17A step is missing'
[ "$(grep -Ec -- '^[[:space:]]+run:' <<<"$CI_17A_STEP")" -eq 1 ] \
  || fail 'CI 17A step must contain exactly one run instruction'
grep -Fxq -- '        run: scripts/smoke-plano-deploy-17a.sh --dry-run' \
  <<<"$CI_17A_STEP" || fail 'CI 17A step is not the exact dry-run smoke command'
if grep -Eiq -- \
  'run:.*(curl|wget|docker[[:space:]]+compose|docker-compose|migrat(e|ion)|openai|provider|mcp[[:space:]]+(run|execute)|playwright)' \
  <<<"$CI_17A_STEP"
then
  fail 'CI 17A step contains a live, migration, provider, MCP or visual command'
fi
pass 'CI 17A step is dry-run-only, offline and non-visual'

for file in "$ROOT_ENV" "$BACKEND_ENV"; do
  for setting in \
    'MCP_REMOTE_ENABLED=false' \
    'MCP_REMOTE_EXECUTION_ENABLED=false' \
    'MCP_REMOTE_DISCOVERY_ENABLED=false' \
    'MCP_REMOTE_READONLY_ENABLED=false' \
    'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' \
    'MCP_CORPORATE_READONLY_ENABLED=false'
  do
    require_pattern "$file" "$setting" \
      "${file#"$ROOT_DIR/"} fail-closed setting $setting"
  done
  require_pattern "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' \
    "${file#"$ROOT_DIR/"} remote allowlist is present"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' \
    "${file#"$ROOT_DIR/"} corporate origin is present"
  if grep -En \
    '^(MCP_REMOTE_EGRESS_ALLOWLIST|MCP_CORPORATE_READONLY_ALLOWED_ORIGIN)=.+$' \
    "$file" >/dev/null
  then
    fail "${file#"$ROOT_DIR/"} versions a remote/corporate origin"
  fi
  pass "${file#"$ROOT_DIR/"} keeps remote/corporate origins empty"
done

for file in "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV"; do
  reject_pattern "$file" \
    '(https://)?(api\.)?orchestra\.mcm\.eng\.br' \
    "planned Orchestra URL in ${file#"$ROOT_DIR/"}"
done
reject_pattern "$PROD_COMPOSE" \
  '(https://)?(api\.)?orchestra\.mcm\.eng\.br|/v1/status(/availability)?' \
  'planned URL or status endpoint in production Compose'
reject_pattern "$CI" \
  '(https://)?(api\.)?orchestra\.mcm\.eng\.br' \
  'planned Orchestra URL in CI'
if grep -ERn \
  '(https://)?(api\.)?orchestra\.mcm\.eng\.br' \
  "$ROOT_DIR/backend/src" "$ROOT_DIR/frontend/src" >/dev/null
then
  fail 'planned Orchestra URL is materialized in functional source'
fi
pass 'planned Orchestra URLs are absent from functional source'

for url in \
  'https://orchestra.mcm.eng.br' \
  'https://api.orchestra.mcm.eng.br'
do
  require_pattern "$RUNBOOK_17A" "$url" "runbook planned URL $url"
done
grep -Fq -- 'https://api.orchestra.mcm.eng.br/health' <<<"$TEMPLATE_OUTPUT" \
  || fail 'template does not contain the planned passive API check'
pass 'planned URLs remain limited to documentation/static templates'

for setting in \
  'RUNTIME_ALLOW_EXTERNAL_TOOLS: "false"' \
  'AGNO_RUNTIME_HTTP_TOOLS_ENABLED: "false"' \
  'AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS: "0"' \
  'MCP_REMOTE_ENABLED: "false"' \
  'MCP_REMOTE_EXECUTION_ENABLED: "false"' \
  'MCP_REMOTE_DISCOVERY_ENABLED: "false"' \
  'MCP_REMOTE_READONLY_ENABLED: "false"' \
  'MCP_REMOTE_EGRESS_ALLOWLIST: ""' \
  'MCP_REMOTE_ALLOW_WRITE_TOOLS: "false"' \
  'MCP_CORPORATE_READONLY_ENABLED: "false"' \
  'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: ""' \
  'LLM_EXECUTION_ENABLED: "false"' \
  'OPENAI_EXECUTION_ENABLED: "false"'
do
  require_pattern "$PROD_COMPOSE" "$setting" \
    "production fail-closed setting $setting"
done

for section in \
  '## Pré-requisitos' \
  '## Matriz go/no-go' \
  '## Checklist antes do deploy' \
  '## Checklist durante o deploy' \
  '## Checklist após deploy' \
  '## Rollback' \
  '## Pós-rollback' \
  '## Evidências esperadas'
do
  require_pattern "$RUNBOOK_17A" "$section" "runbook section $section"
done
require_pattern "$RUNBOOK_17A" 'A 17A é plano, não deploy.' \
  'runbook plan-not-deploy boundary'
require_pattern "$RUNBOOK_17A" 'O ambiente continua totalmente local.' \
  'runbook local-state boundary'
require_pattern "$RUNBOOK_17A" \
  'A primeira execução real da tool só pode ocorrer após a API HTTPS estar publicada e validada' \
  'runbook tool prerequisite'
require_pattern "$RUNBOOK_17A" 'UI/CRUD MCP continua fora de escopo' \
  'runbook excludes MCP UI/CRUD'
require_pattern "$RUNBOOK_17A" 'O usuário será avisado explicitamente' \
  'runbook direct-test notice'

for file in "$DOC_INDEX" "$STATE_DOC" "$RUNBOOK_16Z" "$DOC_16Y"; do
  require_pattern "$file" '17A' "${file#"$ROOT_DIR/"} references phase 17A"
  require_pattern "$file" 'plano' "${file#"$ROOT_DIR/"} records the plan boundary"
  require_pattern "$file" 'não ocorreu' \
    "${file#"$ROOT_DIR/"} records that real deployment did not occur"
done

if git -C "$ROOT_DIR" status --short -- \
  backend/prisma/schema.prisma backend/prisma/migrations | grep -q .
then
  fail 'Prisma schema or migrations changed'
fi
pass 'Prisma schema and migrations are unchanged'

if grep -ERn \
  '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})' \
  "$RUNBOOK_17A" "$RUNBOOK_16Z" "$PREFLIGHT" "$SMOKE" \
  "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV" "$PROD_COMPOSE" \
  >/dev/null
then
  fail 'apparent credential material detected in the 17A plan scope'
fi
pass 'no apparent credential material in the 17A plan scope'

reject_executable_network_or_mutation "$PREFLIGHT_16Z" '16Z preflight'
reject_executable_network_or_mutation "$SMOKE_16Z" '16Z smoke'
reject_pattern "$PREFLIGHT_16Z" \
  '^[[:space:]]*(docker[[:space:]]+compose|docker-compose)[[:space:]]+(up|run|start|restart)' \
  'Docker Compose live command in 16Z preflight'
pass '16Z preflight and smoke remain offline'

bash -n "$PREFLIGHT"
bash -n "$SMOKE"
bash -n "$PREFLIGHT_16Z"
bash -n "$SMOKE_16Z"
pass '17A and 16Z Bash syntax checks passed'

REGRESSION_16Z_OUTPUT="$("$SMOKE_16Z" --dry-run)" \
  || fail '16Z regression dry-run'
grep -Fq -- 'publication=false realExecution=false' <<<"$REGRESSION_16Z_OUTPUT" \
  || fail '16Z regression does not preserve offline boundary'
pass '16Z regression passed offline and transitively preserves 16Y, 16X, 16W, 16V, 16U, 16T and 16S'

printf '\n17A deployment-plan smoke summary: PASS=%d FAIL=0 deployment=false realExecution=false\n' \
  "$pass_count"
