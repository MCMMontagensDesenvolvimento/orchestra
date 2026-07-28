#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
STRICT_BASELINE=false
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_INVENTARIO_SECRETS_VARIAVEIS_17C.md"
INVENTORY="$ROOT_DIR/docs/ai-orchestration/secrets/ORCHESTRA_SECRETS_INVENTORY_17C.json"
PREFLIGHT="$ROOT_DIR/scripts/preflight-secrets-variaveis-17c.sh"
SMOKE="$ROOT_DIR/scripts/smoke-secrets-variaveis-17c.sh"
SMOKE_17B="$ROOT_DIR/scripts/smoke-hardening-compose-nginx-17b.sh"
CI="$ROOT_DIR/.github/workflows/ci.yml"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
FRONTEND_ENV="$ROOT_DIR/frontend/.env.example"
RUNTIME_ENV="$ROOT_DIR/runtime/agno-bridge/.env.example"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-secrets-variaveis-17c.sh [--dry-run|--strict-baseline|--help]

The dry-run validates only local/versioned state and invokes offline regression gates.
It does not call DNS/network or curl, start Docker Compose, deploy, migrate, execute a
provider or MCP, resolve or print a secret, test UI/CRUD, or change a file.

The default dry-run accepts governed functional changes made after 17C.
Use --strict-baseline to enforce the historical 17C source snapshot.
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
  printf '\n17C secrets inventory smoke summary: PASS=%d FAIL=1 deployment=false realExecution=false secretValuesRead=false\n' \
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
  --strict-baseline) STRICT_BASELINE=true ;;
  --help|-h) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac
[ "$#" -le 1 ] || fail 'only one mode can be selected'

for file in \
  "$RUNBOOK" "$INVENTORY" "$CI" "$PROD_COMPOSE" "$ROOT_ENV" "$BACKEND_ENV" \
  "$FRONTEND_ENV" "$RUNTIME_ENV"
do
  require_file "$file"
done
require_executable "$PREFLIGHT"
require_executable "$SMOKE"
require_executable "$SMOKE_17B"

HELP_OUTPUT="$("$PREFLIGHT" --help)"
for mode in --dry-run --strict-baseline --check-inventory --template --help; do
  grep -Fq -- "$mode" <<<"$HELP_OUTPUT" || fail "preflight mode $mode"
  pass "preflight mode $mode"
done

reject_executable_network_or_mutation "$PREFLIGHT" '17C preflight'
reject_executable_network_or_mutation "$SMOKE" '17C smoke'

STATUS_BEFORE="$(git -C "$ROOT_DIR" status --short)"

PREFLIGHT_DRY_OUTPUT="$("$PREFLIGHT" "$MODE")" \
  || fail '17C preflight dry-run execution'
grep -Fq -- 'deployment=false realExecution=false secretValuesRead=false' \
  <<<"$PREFLIGHT_DRY_OUTPUT" \
  || fail 'preflight dry-run does not record the offline/no-secret boundary'
pass 'preflight dry-run records no deployment, real execution or secret read'

INVENTORY_OUTPUT="$("$PREFLIGHT" --check-inventory)" \
  || fail '17C inventory validation'
grep -Fq -- 'deployment=false realExecution=false secretValuesRead=false' \
  <<<"$INVENTORY_OUTPUT" \
  || fail 'inventory check does not record the offline/no-secret boundary'
pass 'inventory check is offline and records no secret read'

TEMPLATE_TRACE="$(bash -x "$PREFLIGHT" --template 2>&1 >/dev/null)" \
  || fail '17C template trace'
if grep -Eq -- \
  '^\+[[:space:]]+(curl|wget|nc|ncat|telnet|ssh|dig|nslookup|host|getent|docker[[:space:]]+compose|docker-compose|azd|kubectl|helm|terraform)[[:space:]]' \
  <<<"$TEMPLATE_TRACE"
then
  fail '17C template executed a network, container or deployment command'
fi
pass 'template mode only renders text'

TEMPLATE_OUTPUT="$("$PREFLIGHT" --template)" || fail '17C template generation'
for line in \
  '17C secret request template' \
  'Sanitized evidence template:' \
  'Secrets go/no-go template:' \
  'Rollback and disable-flags template:' \
  'valueIncluded: false'
do
  grep -Fq -- "$line" <<<"$TEMPLATE_OUTPUT" || fail "template line $line"
  pass "template line $line"
done

STATUS_AFTER="$(git -C "$ROOT_DIR" status --short)"
[ "$STATUS_BEFORE" = "$STATUS_AFTER" ] \
  || fail '17C preflight modes changed the worktree'
pass 'all exercised 17C modes are read-only'

require_pattern "$CI" \
  'scripts/smoke-secrets-variaveis-17c.sh --dry-run' \
  'CI runs only the 17C dry-run smoke'
reject_pattern "$CI" \
  'scripts/preflight-secrets-variaveis-17c\.sh' \
  'direct 17C preflight execution in CI'
[ "$(grep -Ec -- 'scripts/(preflight|smoke)-secrets-variaveis-17c\.sh' "$CI")" -eq 1 ] \
  || fail 'CI must contain exactly one 17C script invocation'
pass 'CI contains exactly one 17C script invocation'

CI_17C_STEP="$(
  awk '
    /name: Run 17C secrets and production variables inventory static gate/ { capture = 1 }
    capture { print }
    capture && /^[[:space:]]*-[[:space:]]+name:/ \
      && !/Run 17C secrets and production variables inventory static gate/ { exit }
  ' "$CI"
)"
[ -n "$CI_17C_STEP" ] || fail 'CI 17C step is missing'
grep -Fxq -- \
  '        run: scripts/smoke-secrets-variaveis-17c.sh --dry-run' \
  <<<"$CI_17C_STEP" || fail 'CI 17C step is not the exact dry-run smoke command'
pass 'CI 17C step is exactly the offline dry-run smoke'

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
  'run:.*(openai|provider[[:space:]]+(run|execute)|mcp[[:space:]]+(run|execute)|playwright)' \
  'provider, MCP real or visual/UI command in CI'

for file in "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV" "$PROD_COMPOSE" "$CI"; do
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
pass 'planned URLs remain limited to documentation and documentation-only inventory metadata'

INVENTORY_PATH="$INVENTORY" node <<'NODE' \
  || fail 'inventory planned-documentation-only boundary'
const fs = require('fs');
const inventory = JSON.parse(fs.readFileSync(process.env.INVENTORY_PATH, 'utf8'));
if (inventory.containsRealValues !== false) throw new Error('inventory value boundary changed');
if (!Array.isArray(inventory.plannedDocumentationOnly) || inventory.plannedDocumentationOnly.length !== 2) {
  throw new Error('planned documentation set changed');
}
for (const entry of inventory.plannedDocumentationOnly) {
  if (entry.active !== false) throw new Error('planned URL marked active');
}
for (const item of inventory.items) {
  if (/orchestra\.mcm\.eng\.br/i.test(JSON.stringify(item))) {
    throw new Error('planned URL found in runtime inventory item');
  }
  if (item.secret && item.publicClientExposed) throw new Error('public secret found');
  if (item.group === 'frontend' && (item.secret || !item.publicClientExposed)) {
    throw new Error('frontend public-variable contract changed');
  }
}
NODE
pass 'planned URLs and public-secret boundaries are enforced in inventory'

reject_pattern "$INVENTORY" \
  '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})' \
  'apparent credential material in inventory'
reject_pattern "$INVENTORY" \
  '"(value|defaultValue|exampleValue|currentValue|secretValue|resolvedValue|runtimeValue|endpointValue)"[[:space:]]*:' \
  'runtime or secret value field in inventory'

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
  'AGNO_RUNTIME_HTTP_TOOLS_ENABLED: "false"' \
  'AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS: "0"' \
  'AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED: "false"' \
  'MCP_REMOTE_ENABLED: "false"' \
  'MCP_REMOTE_EXECUTION_ENABLED: "false"' \
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
    fail 'backend or frontend functional source differs from the historical 17C baseline'
  fi
  warn 'backend or frontend functional source differs from the historical 17C baseline; accepted in forward-compatible dry-run (use --strict-baseline to enforce)'
else
  pass 'backend and frontend functional source are unchanged from the historical 17C baseline'
fi

bash -n "$PREFLIGHT"
bash -n "$SMOKE"
pass '17C Bash syntax checks passed'

regression_17b_mode=--dry-run
if [ "$STRICT_BASELINE" = true ]; then
  regression_17b_mode=--strict-baseline
fi
REGRESSION_17B_OUTPUT="$("$SMOKE_17B" "$regression_17b_mode")" \
  || fail '17B regression dry-run'
grep -Fq -- 'deployment=false realExecution=false' <<<"$REGRESSION_17B_OUTPUT" \
  || fail '17B regression does not preserve the offline boundary'
pass '17B regression passed and transitively preserves 17A, 16Z, 16Y, 16X, 16W, 16V, 16U, 16T and 16S'

printf '\n17C secrets inventory smoke summary: PASS=%d FAIL=0 strictBaseline=%s deployment=false realExecution=false secretValuesRead=false\n' \
  "$pass_count" "$STRICT_BASELINE"
