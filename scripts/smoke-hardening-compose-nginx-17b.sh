#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK_17B="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_HARDENING_COMPOSE_NGINX_17B.md"
PREFLIGHT="$ROOT_DIR/scripts/preflight-hardening-compose-nginx-17b.sh"
SMOKE="$ROOT_DIR/scripts/smoke-hardening-compose-nginx-17b.sh"
SMOKE_17A="$ROOT_DIR/scripts/smoke-plano-deploy-17a.sh"
CI="$ROOT_DIR/.github/workflows/ci.yml"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
BACKEND_DOCKERFILE="$ROOT_DIR/backend/Dockerfile.prod"
FRONTEND_DOCKERFILE="$ROOT_DIR/frontend/Dockerfile.prod"
NGINX_CONFIG="$ROOT_DIR/frontend/nginx.conf"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
FRONTEND_ENV="$ROOT_DIR/frontend/.env.example"
RUNTIME_ENV="$ROOT_DIR/runtime/agno-bridge/.env.example"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-hardening-compose-nginx-17b.sh [--dry-run|--help]

The dry-run validates only local/versioned state and invokes offline regression gates.
It does not call DNS/network or curl, start or run Docker Compose, deploy, migrate,
execute MCP/provider code, resolve a secret, test UI/CRUD, or change a file.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n17B hardening smoke summary: PASS=%d FAIL=1 deployment=false realExecution=false\n' \
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
  "$RUNBOOK_17B" "$SMOKE" "$CI" "$PROD_COMPOSE" "$BACKEND_DOCKERFILE" \
  "$FRONTEND_DOCKERFILE" "$NGINX_CONFIG" "$ROOT_ENV" "$BACKEND_ENV" \
  "$FRONTEND_ENV" "$RUNTIME_ENV"
do
  require_file "$file"
done
require_executable "$PREFLIGHT"
require_executable "$SMOKE"
require_executable "$SMOKE_17A"

HELP_OUTPUT="$("$PREFLIGHT" --help)"
for mode in --dry-run --check-prod-artifacts --template --help; do
  grep -Fq -- "$mode" <<<"$HELP_OUTPUT" || fail "preflight mode $mode"
  pass "preflight mode $mode"
done

reject_executable_network_or_mutation "$PREFLIGHT" '17B preflight'
reject_executable_network_or_mutation "$SMOKE" '17B smoke'

STATUS_BEFORE="$(git -C "$ROOT_DIR" status --short)"

PREFLIGHT_DRY_OUTPUT="$("$PREFLIGHT" --dry-run)" \
  || fail '17B preflight dry-run execution'
grep -Fq -- 'deployment=false realExecution=false' <<<"$PREFLIGHT_DRY_OUTPUT" \
  || fail 'preflight dry-run does not record the offline boundary'
pass 'preflight dry-run is offline and records no deployment or real execution'

ARTIFACT_OUTPUT="$("$PREFLIGHT" --check-prod-artifacts)" \
  || fail '17B production-artifact static check'
grep -Fq -- 'deployment=false realExecution=false' <<<"$ARTIFACT_OUTPUT" \
  || fail 'artifact check does not record the offline boundary'
pass 'production-artifact mode is static and records no real execution'

TEMPLATE_TRACE="$(bash -x "$PREFLIGHT" --template 2>&1 >/dev/null)" \
  || fail '17B template trace'
if grep -Eq -- \
  '^\+[[:space:]]+(curl|wget|nc|ncat|telnet|ssh|dig|nslookup|host|getent|docker[[:space:]]+compose|docker-compose|azd|kubectl|helm|terraform)[[:space:]]' \
  <<<"$TEMPLATE_TRACE"
then
  fail '17B template executed a network, container or deployment command'
fi
pass 'template mode only renders text'

TEMPLATE_OUTPUT="$("$PREFLIGHT" --template)" || fail '17B template generation'
for line in \
  'Review checklist:' \
  'docker compose -f docker-compose.prod.yml config' \
  'Future manual checks' \
  'Expected sanitized evidence:' \
  'Rollback example'
do
  grep -Fq -- "$line" <<<"$TEMPLATE_OUTPUT" || fail "template line $line"
  pass "template line $line"
done

STATUS_AFTER="$(git -C "$ROOT_DIR" status --short)"
[ "$STATUS_BEFORE" = "$STATUS_AFTER" ] \
  || fail '17B preflight modes changed the worktree'
pass 'all exercised 17B modes are read-only'

require_pattern "$CI" \
  'scripts/smoke-hardening-compose-nginx-17b.sh --dry-run' \
  'CI runs only the 17B dry-run smoke'
reject_pattern "$CI" \
  'scripts/preflight-hardening-compose-nginx-17b\.sh' \
  'direct 17B preflight execution in CI'
[ "$(grep -Ec -- 'scripts/(preflight|smoke)-hardening-compose-nginx-17b\.sh' "$CI")" -eq 1 ] \
  || fail 'CI must contain exactly one 17B script invocation'
pass 'CI contains exactly one 17B script invocation'
reject_pattern "$CI" \
  '^[[:space:]]*(curl|wget|dig|nslookup|host|getent)[[:space:]]' \
  'network/DNS command in CI'
reject_pattern "$CI" \
  '^[[:space:]]*(docker[[:space:]]+compose|docker-compose)[[:space:]]+(up|run|start|restart|pull|push|build|exec|config)' \
  'Docker Compose command in CI'
reject_pattern "$CI" \
  '^[[:space:]]*(az|azd|kubectl|helm|terraform|pulumi)[[:space:]].*(deploy|apply|up|create)' \
  'deployment command in CI'
reject_pattern "$CI" \
  '^[[:space:]].*(prisma[[:space:]]+migrate|prisma:migrate:deploy)' \
  'live migration command in CI'
reject_pattern "$CI" \
  'run:.*(openai|provider|mcp[[:space:]]+(run|execute)|playwright)' \
  'provider, MCP real or visual/UI command in CI'

CI_17B_STEP="$(
  awk '
    /name: Run 17B production artifact hardening static gate/ { capture = 1 }
    capture { print }
    capture && /^[[:space:]]*-[[:space:]]+name:/ \
      && !/Run 17B production artifact hardening static gate/ { exit }
  ' "$CI"
)"
[ -n "$CI_17B_STEP" ] || fail 'CI 17B step is missing'
grep -Fxq -- \
  '        run: scripts/smoke-hardening-compose-nginx-17b.sh --dry-run' \
  <<<"$CI_17B_STEP" || fail 'CI 17B step is not the exact dry-run smoke command'
pass 'CI 17B step is exactly the offline dry-run smoke'

for file in "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV"; do
  reject_pattern "$file" \
    '(https://)?(api\.)?orchestra\.mcm\.eng\.br' \
    "planned Orchestra URL in ${file#"$ROOT_DIR/"}"
done
for file in "$PROD_COMPOSE" "$CI" "$NGINX_CONFIG"; do
  reject_pattern "$file" \
    '(https://)?(api\.)?orchestra\.mcm\.eng\.br' \
    "planned Orchestra URL in ${file#"$ROOT_DIR/"}"
done
if grep -ERn \
  '(https://)?(api\.)?orchestra\.mcm\.eng\.br' \
  "$ROOT_DIR/backend/src" "$ROOT_DIR/frontend/src" >/dev/null
then
  fail 'planned Orchestra URL is materialized in functional source'
fi
pass 'planned URLs remain limited to documentation and textual templates'

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
    "${file#"$ROOT_DIR/"} remote allowlist placeholder"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' \
    "${file#"$ROOT_DIR/"} corporate origin placeholder"
done

for setting in \
  'RUNTIME_ALLOW_EXTERNAL_TOOLS: "false"' \
  'AGNO_RUNTIME_HTTP_TOOLS_ENABLED: "false"' \
  'MCP_REMOTE_ENABLED: "false"' \
  'MCP_REMOTE_EXECUTION_ENABLED: "false"' \
  'MCP_REMOTE_READONLY_ENABLED: "false"' \
  'MCP_CORPORATE_READONLY_ENABLED: "false"' \
  'LLM_PROVIDERS_ENABLED: "false"' \
  'LLM_EXECUTION_ENABLED: "false"' \
  'OPENAI_EXECUTION_ENABLED: "false"'
do
  require_pattern "$PROD_COMPOSE" "$setting" \
    "production Compose fail-closed setting $setting"
done

require_pattern "$NGINX_CONFIG" 'try_files $uri $uri/ /index.html;' \
  'Nginx SPA fallback'
require_pattern "$NGINX_CONFIG" 'server_tokens off;' \
  'Nginx token suppression'
require_pattern "$NGINX_CONFIG" 'add_header X-Content-Type-Options "nosniff" always;' \
  'Nginx security headers'
require_pattern "$NGINX_CONFIG" 'location ^~ /assets/' \
  'Nginx static asset cache policy'

for file in "$BACKEND_DOCKERFILE" "$FRONTEND_DOCKERFILE"; do
  reject_pattern "$file" \
    '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})' \
    "apparent credential in ${file#"$ROOT_DIR/"}"
  reject_pattern "$file" \
    '(API_KEY|TOKEN|BEARER|PASSWORD|JWT_SECRET|CLIENT_SECRET)[[:space:]]*=' \
    "secret assignment in ${file#"$ROOT_DIR/"}"
done

if git -C "$ROOT_DIR" status --short -- \
  backend/prisma/schema.prisma backend/prisma/migrations | grep -q .
then
  fail 'Prisma schema or migrations changed'
fi
pass 'Prisma schema and migrations are unchanged'
if git -C "$ROOT_DIR" status --short -- backend/src frontend/src | grep -q .; then
  fail 'backend or frontend functional source changed'
fi
pass 'backend and frontend functional source are unchanged'

bash -n "$PREFLIGHT"
bash -n "$SMOKE"
pass '17B Bash syntax checks passed'

REGRESSION_17A_OUTPUT="$("$SMOKE_17A" --dry-run)" \
  || fail '17A regression dry-run'
grep -Fq -- 'deployment=false realExecution=false' <<<"$REGRESSION_17A_OUTPUT" \
  || fail '17A regression does not preserve the offline boundary'
pass '17A regression passed and transitively preserves 16Z, 16Y, 16X, 16W, 16V, 16U, 16T and 16S'

printf '\n17B hardening smoke summary: PASS=%d FAIL=0 deployment=false realExecution=false\n' \
  "$pass_count"
