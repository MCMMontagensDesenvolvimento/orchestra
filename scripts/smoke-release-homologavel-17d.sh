#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
STRICT_BASELINE=false
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PREFLIGHT_RELEASE_HOMOLOGAVEL_17D.md"
MANIFEST="$ROOT_DIR/docs/ai-orchestration/release/ORCHESTRA_RELEASE_MANIFEST_17D.json"
INVENTORY="$ROOT_DIR/docs/ai-orchestration/secrets/ORCHESTRA_SECRETS_INVENTORY_17C.json"
PREFLIGHT="$ROOT_DIR/scripts/preflight-release-homologavel-17d.sh"
SMOKE="$ROOT_DIR/scripts/smoke-release-homologavel-17d.sh"
SMOKE_17C="$ROOT_DIR/scripts/smoke-secrets-variaveis-17c.sh"
CI="$ROOT_DIR/.github/workflows/ci.yml"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
FRONTEND_ENV="$ROOT_DIR/frontend/.env.example"
RUNTIME_ENV="$ROOT_DIR/runtime/agno-bridge/.env.example"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-release-homologavel-17d.sh [--dry-run|--strict-baseline|--help]

The dry-run validates only local/versioned state and invokes offline regression gates.
It does not call DNS/network or curl/wget, start Docker Compose, deploy, migrate, roll
back, execute a provider/MCP/tool, resolve or print a secret, test UI/CRUD, or change
a file.

The default dry-run accepts governed functional changes made after 17D.
Use --strict-baseline to enforce the historical 17D source snapshot.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

warn() {
  printf 'WARN %s\n' "$1" >&2
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n17D release smoke summary: PASS=%d FAIL=1 deployment=false realExecution=false secretValuesRead=false releasePreflightReady=true deployGo=false\n' \
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
    '^[[:space:]]*(rm|mv|cp|install|touch|mkdir|rmdir|chmod|chown|truncate|tee)[[:space:]]' \
    "executable filesystem mutation in $label"
}

case "$MODE" in
  --dry-run) ;;
  --strict-baseline) STRICT_BASELINE=true ;;
  --help|-h) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac
[ "$#" -le 1 ] || fail 'only one mode can be selected'

for file in \
  "$RUNBOOK" "$MANIFEST" "$INVENTORY" "$CI" "$PROD_COMPOSE" \
  "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV"
do
  require_file "$file"
done
require_executable "$PREFLIGHT"
require_executable "$SMOKE"
require_executable "$SMOKE_17C"

HELP_OUTPUT="$("$PREFLIGHT" --help)"
for mode in --dry-run --strict-baseline --check-manifest --go-no-go-template --help; do
  grep -Fq -- "$mode" <<<"$HELP_OUTPUT" || fail "preflight mode $mode"
  pass "preflight mode $mode"
done

reject_executable_operations "$PREFLIGHT" '17D preflight'
reject_executable_operations "$SMOKE" '17D smoke'

STATUS_BEFORE="$(git -C "$ROOT_DIR" status --short)"

PREFLIGHT_DRY_OUTPUT="$("$PREFLIGHT" "$MODE")" \
  || fail '17D preflight dry-run execution'
for marker in \
  'deployment=false' \
  'realExecution=false' \
  'secretValuesRead=false' \
  'uiCrudTested=false' \
  'mcpRealExecuted=false' \
  'providerRealExecuted=false' \
  'releasePreflightReady=true' \
  'deployGo=false'
do
  grep -Fq -- "$marker" <<<"$PREFLIGHT_DRY_OUTPUT" \
    || fail "preflight dry-run marker $marker"
  pass "preflight dry-run marker $marker"
done

MANIFEST_OUTPUT="$("$PREFLIGHT" --check-manifest)" \
  || fail '17D manifest validation'
for marker in \
  'deployment=false' \
  'realExecution=false' \
  'secretValuesRead=false' \
  'releasePreflightReady=true' \
  'deployGo=false'
do
  grep -Fq -- "$marker" <<<"$MANIFEST_OUTPUT" \
    || fail "manifest check marker $marker"
  pass "manifest check marker $marker"
done

TEMPLATE_TRACE="$(bash -x "$PREFLIGHT" --go-no-go-template 2>&1 >/dev/null)" \
  || fail '17D GO/NO-GO template trace'
if grep -Eq -- \
  '^\+[[:space:]]+(curl|wget|nc|ncat|telnet|ssh|dig|nslookup|host|getent|docker[[:space:]]+compose|docker-compose|azd|kubectl|helm|terraform|npm|npx|node|python|python3)[[:space:]]' \
  <<<"$TEMPLATE_TRACE"
then
  fail '17D GO/NO-GO template executed a network, container, deployment, migration, provider, MCP or UI-capable command'
fi
pass 'GO/NO-GO template mode only renders text'

TEMPLATE_OUTPUT="$("$PREFLIGHT" --go-no-go-template)" \
  || fail '17D GO/NO-GO template generation'
for line in \
  '17D GO/NO-GO template' \
  'Expected status' \
  'Evidence' \
  'Responsible' \
  'Decision' \
  'Default decision: NO_GO for deployment' \
  'RELEASE_PREFLIGHT_READY=true; DEPLOY_GO=false'
do
  grep -Fq -- "$line" <<<"$TEMPLATE_OUTPUT" || fail "GO/NO-GO template line $line"
  pass "GO/NO-GO template line $line"
done

STATUS_AFTER="$(git -C "$ROOT_DIR" status --short)"
[ "$STATUS_BEFORE" = "$STATUS_AFTER" ] \
  || fail '17D preflight modes changed the worktree'
pass 'all exercised 17D modes are read-only'

require_pattern "$CI" \
  'scripts/smoke-release-homologavel-17d.sh --dry-run' \
  'CI runs only the 17D dry-run smoke'
reject_pattern "$CI" \
  'scripts/preflight-release-homologavel-17d\.sh' \
  'direct 17D preflight execution in CI'
[ "$(grep -Ec -- 'scripts/(preflight|smoke)-release-homologavel-17d\.sh' "$CI")" -eq 1 ] \
  || fail 'CI must contain exactly one 17D script invocation'
pass 'CI contains exactly one 17D script invocation'
require_exact_line "$CI" \
  '        run: scripts/smoke-release-homologavel-17d.sh --dry-run' \
  'CI 17D step is exactly the offline dry-run smoke'

reject_pattern "$CI" \
  '^[[:space:]]*(run:[[:space:]]*)?(curl|wget|dig|nslookup|host|getent)[[:space:]]' \
  'network/DNS command in CI'
reject_pattern "$CI" \
  '^[[:space:]]*(run:[[:space:]]*)?(docker[[:space:]]+compose|docker-compose)[[:space:]]+(up|run|start|restart|pull|push|build|exec|config)' \
  'Docker Compose command in CI'
reject_pattern "$CI" \
  '^[[:space:]]*(run:[[:space:]]*)?(az|azd|kubectl|helm|terraform|pulumi)[[:space:]].*(deploy|apply|up|create|delete|destroy)' \
  'deploy command in CI'
reject_pattern "$CI" \
  '^[[:space:]]*(run:[[:space:]]*)?(npm|npx|pnpm|yarn)[[:space:]].*(prisma:)?migrat(e|ion)' \
  'migration command in CI'
reject_pattern "$CI" \
  '(smoke-agno-real|smoke-chat-provider-real|--run-real|--execute-real|test:visual|playwright|cypress)' \
  'real provider/MCP or UI/browser execution in CI'

for file in "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV" \
  "$PROD_COMPOSE" "$CI"
do
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
pass 'planned URLs are limited to documentation/templates/manifest metadata'

MANIFEST_PATH="$MANIFEST" INVENTORY_PATH="$INVENTORY" node <<'NODE' \
  || fail 'manifest and inventory no-real-value boundary'
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync(process.env.MANIFEST_PATH, 'utf8'));
const inventory = JSON.parse(fs.readFileSync(process.env.INVENTORY_PATH, 'utf8'));
if (manifest.containsRealValues !== false || inventory.containsRealValues !== false) {
  throw new Error('real-value boundary changed');
}
if (
  manifest.plannedUrls.documentationOnly !== true
  || manifest.plannedUrls.plannedInactive !== true
) {
  throw new Error('planned URL boundary changed');
}
if (manifest.deployment !== false || manifest.realExecution !== false || manifest.deployGo !== false) {
  throw new Error('no-deploy boundary changed');
}
NODE
pass 'manifest and inventory contain no real values and preserve no-deploy boundaries'

credential_pattern='(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})'
if grep -ERn -- "$credential_pattern" \
  "$RUNBOOK" "$MANIFEST" "$INVENTORY" \
  "$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PREPARACAO_PUBLICACAO_HTTPS_16Z.md" \
  "$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PLANO_DEPLOY_HOMOLOGADO_17A.md" \
  "$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_HARDENING_COMPOSE_NGINX_17B.md" \
  "$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_INVENTARIO_SECRETS_VARIAVEIS_17C.md" \
  "$PREFLIGHT" "$SMOKE" >/dev/null
then
  fail 'apparent credential material detected in the 17D release scope'
fi
pass 'manifest, inventory, docs and scripts contain no apparent credential material'

for file in "$ROOT_ENV" "$BACKEND_ENV"; do
  for setting in \
    'MCP_REMOTE_ENABLED=false' \
    'MCP_REMOTE_EXECUTION_ENABLED=false' \
    'MCP_REMOTE_DISCOVERY_ENABLED=false' \
    'MCP_REMOTE_READONLY_ENABLED=false' \
    'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' \
    'MCP_CORPORATE_READONLY_ENABLED=false'
  do
    require_exact_line "$file" "$setting" \
      "${file#"$ROOT_DIR/"} fail-closed setting $setting"
  done
  require_exact_line "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' \
    "${file#"$ROOT_DIR/"} remote allowlist empty"
  require_exact_line "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' \
    "${file#"$ROOT_DIR/"} corporate origin empty"
done
for setting in \
  'RUNTIME_ALLOW_EXTERNAL_TOOLS: "false"' \
  'AGNO_EXECUTION_ENABLED: "false"' \
  'AGNO_RUNTIME_HTTP_TOOLS_ENABLED: "false"' \
  'AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS: "0"' \
  'AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED: "false"' \
  'MCP_REMOTE_ENABLED: "false"' \
  'MCP_REMOTE_EXECUTION_ENABLED: "false"' \
  'MCP_REMOTE_DISCOVERY_ENABLED: "false"' \
  'MCP_REMOTE_READONLY_ENABLED: "false"' \
  'MCP_CORPORATE_READONLY_ENABLED: "false"' \
  'LLM_PROVIDERS_ENABLED: "false"' \
  'LLM_EXECUTION_ENABLED: "false"' \
  'OPENAI_EXECUTION_ENABLED: "false"' \
  'AZURE_OPENAI_EXECUTION_ENABLED: "false"' \
  'ANTHROPIC_EXECUTION_ENABLED: "false"' \
  'EMBEDDINGS_EXECUTION_ENABLED: "false"'
do
  require_pattern "$PROD_COMPOSE" "$setting" \
    "production Compose fail-closed setting $setting"
done

if git -C "$ROOT_DIR" status --short -- \
  backend/prisma/schema.prisma backend/prisma/migrations | grep -q .
then
  fail 'Prisma schema or migrations changed'
fi
pass 'Prisma schema and migrations are unchanged'
if git -C "$ROOT_DIR" status --short -- backend/src frontend/src | grep -q .; then
  if [ "$STRICT_BASELINE" = true ]; then
    fail 'backend or frontend functional source differs from the historical 17D baseline'
  fi
  warn 'backend or frontend functional source differs from the historical 17D baseline; accepted in forward-compatible dry-run (use --strict-baseline to enforce)'
else
  pass 'backend and frontend functional source are unchanged from the historical 17D baseline'
fi

bash -n "$PREFLIGHT"
bash -n "$SMOKE"
pass '17D Bash syntax checks passed'

regression_17c_mode=--dry-run
if [ "$STRICT_BASELINE" = true ]; then
  regression_17c_mode=--strict-baseline
fi
REGRESSION_17C_OUTPUT="$("$SMOKE_17C" "$regression_17c_mode")" \
  || fail '17C regression dry-run'
grep -Fq -- 'deployment=false realExecution=false secretValuesRead=false' \
  <<<"$REGRESSION_17C_OUTPUT" \
  || fail '17C regression does not preserve the offline/no-secret boundary'
pass '17C regression passed and transitively preserves 17B, 17A, 16Z, 16Y, 16X, 16W, 16V, 16U, 16T and 16S'

printf '\n17D release smoke summary: PASS=%d FAIL=0 strictBaseline=%s deployment=false realExecution=false secretValuesRead=false uiCrudTested=false mcpRealExecuted=false providerRealExecuted=false releasePreflightReady=true deployGo=false\n' \
  "$pass_count" "$STRICT_BASELINE"
