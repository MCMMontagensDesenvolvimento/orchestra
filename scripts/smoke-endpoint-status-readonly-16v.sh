#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_ENDPOINT_STATUS_READONLY_16V.md"
STATUS_DIR="$ROOT_DIR/backend/src/modules/status"
ROUTES="$STATUS_DIR/status.routes.ts"
SERVICE="$STATUS_DIR/status.service.ts"
SCHEMA="$STATUS_DIR/status.schema.ts"
APP_ROUTES="$ROOT_DIR/backend/src/app/routes.ts"
HEALTH_ROUTES="$ROOT_DIR/backend/src/modules/health/health.routes.ts"
TEST="$ROOT_DIR/backend/tests/api/status.test.ts"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
ENV_CONFIG="$ROOT_DIR/backend/src/config/env.ts"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
CI="$ROOT_DIR/.github/workflows/ci.yml"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-endpoint-status-readonly-16v.sh [--dry-run|--help]

The dry-run reads versioned files only. It does not contact a service/database, start a
container, run a migration, resolve a secret, call a provider or execute an MCP tool.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n16V read-only status endpoint smoke summary: PASS=%d FAIL=1\n' "$pass_count" >&2
  exit 1
}

case "$MODE" in
  --dry-run) ;;
  --help|-h) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac
[ "$#" -le 1 ] || fail 'only one mode can be selected'

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
  if grep -Eq -- "$pattern" "$file"; then fail "$label is present"; fi
  pass "$label absent"
}

for file in \
  "$RUNBOOK" "$STATUS_DIR/index.ts" "$ROUTES" "$SERVICE" "$SCHEMA" \
  "$APP_ROUTES" "$HEALTH_ROUTES" "$TEST" "$ROOT_ENV" "$BACKEND_ENV" \
  "$ENV_CONFIG" "$PROD_COMPOSE" "$CI"
do
  require_file "$file"
done

for script in \
  smoke-homologacao-conector-readonly-16u.sh \
  smoke-conector-corporativo-readonly-16t.sh \
  evals-runtime-qualidade-16s.sh smoke-evals-qualidade-16s.sh \
  smoke-e2e-chat-rag-mcp-16r.sh homologacao-e2e-chat-rag-mcp-16r.sh
do
  require_executable "$ROOT_DIR/scripts/$script"
done

for section in \
  '## Objetivo' '## Escopo' '## Fora de escopo' '## Ambientes e URLs' \
  '## Contrato dos endpoints' '## Exemplos de resposta' '## Campos permitidos' \
  '## Campos proibidos' '## Como testar localmente' '## Relação com 16T e 16U' \
  '## Por que isso ainda não executa MCP real' '## Critérios de aceite' \
  '## Rollback' '## Riscos remanescentes' '## Próximo passo sugerido'
do
  require_pattern "$RUNBOOK" "$section" "runbook section $section"
done

require_pattern "$APP_ROUTES" "app.use('/health', createHealthRouter(dependencies));" 'existing /health mount preserved'
require_pattern "$HEALTH_ROUTES" "router.get('/'," 'existing GET /health route preserved'
require_pattern "$APP_ROUTES" "app.use('/v1/status', createStatusRouter(dependencies));" 'status router mounted at /v1/status'
require_pattern "$ROUTES" "router.get('/'," 'GET /v1/status route'
require_pattern "$ROUTES" "router.get('/availability'," 'GET /v1/status/availability route'
reject_pattern "$ROUTES" 'router\.(post|put|patch|delete)[[:space:]]*\(' 'status write route'

require_pattern "$SCHEMA" "status: z.enum(['ok', 'degraded'])" 'status enum contract'
require_pattern "$SCHEMA" 'summary: z.string().min(1).max(240)' 'bounded summary contract'
require_pattern "$SCHEMA" 'updatedAt: z.string().datetime({ offset: true })' 'ISO timestamp contract'
require_pattern "$SCHEMA" '}).strict();' 'strict response schema'

schema_fields="$(
  sed -n '/z\.object({/,/}).strict()/p' "$SCHEMA" \
    | sed -nE 's/^[[:space:]]*([A-Za-z][A-Za-z0-9]*):.*/\1/p' \
    | sort -u \
    | paste -sd, -
)"
[ "$schema_fields" = 'status,summary,updatedAt' ] || fail "response schema has unexpected fields: $schema_fields"
pass 'response schema contains only status, summary and updatedAt'

example_fields="$(
  awk '
    /^```json$/ { in_json = 1; next }
    /^```$/ && in_json { in_json = 0; next }
    in_json { print }
  ' "$RUNBOOK" \
    | sed -nE 's/^[[:space:]]*"([^"]+)":.*/\1/p' \
    | sort -u \
    | paste -sd, -
)"
[ "$example_fields" = 'status,summary,updatedAt' ] || fail "documented response examples have unexpected fields: $example_fields"
pass 'documented response examples contain only allowed fields'

forbidden_property='(user|email|tenant|workspace|prompt|context|args|output|headers|cookies|Authorization|env|stack|dependencyVersions|DATABASE_URL|connectionString|secrets|apiKey|internalPath|privateHost|database|metrics)[[:space:]]*:'
if grep -ERn -- "$forbidden_property" "$STATUS_DIR" >/dev/null; then
  fail 'forbidden response property detected in status module'
fi
pass 'status module contains no forbidden response property'

require_pattern "$SERVICE" "buildOperationalStatus('Orchestra operational', dependencies)" 'fixed general summary'
require_pattern "$SERVICE" "'Orchestra availability endpoint operational'" 'fixed availability summary'
for file in "$STATUS_DIR/index.ts" "$ROUTES" "$SERVICE" "$SCHEMA"; do
  reject_pattern "$file" '(fetch[[:space:]]*\(|axios|node:https|node:http|child_process|openai|prisma)' "external/provider/database dependency in ${file#"$ROOT_DIR/"}"
done

require_pattern "$TEST" "get('/v1/status')" 'GET status API test'
require_pattern "$TEST" "get('/v1/status/availability')" 'GET availability API test'
require_pattern "$TEST" "['post', 'put', 'patch', 'delete']" 'unsupported method API tests'
require_pattern "$TEST" "get('/health')" '/health regression test'
require_pattern "$TEST" "toEqual(['status', 'summary', 'updatedAt'].sort())" 'exact response key assertion'
require_pattern "$TEST" 'toISOString()).toBe(body.updatedAt)' 'ISO timestamp assertion'

for file in "$ROOT_ENV" "$BACKEND_ENV"; do
  require_pattern "$file" 'MCP_REMOTE_ENABLED=false' "${file#"$ROOT_DIR/"} remote MCP disabled"
  require_pattern "$file" 'MCP_REMOTE_EXECUTION_ENABLED=false' "${file#"$ROOT_DIR/"} remote execution disabled"
  require_pattern "$file" 'MCP_REMOTE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} remote read-only disabled"
  require_pattern "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' "${file#"$ROOT_DIR/"} remote allowlist empty"
  require_pattern "$file" 'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' "${file#"$ROOT_DIR/"} write tools disabled"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} corporate adapter disabled"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' "${file#"$ROOT_DIR/"} corporate origin empty"
done
require_pattern "$ENV_CONFIG" "MCP_REMOTE_ENABLED: booleanString('false')" 'backend remote MCP fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_REMOTE_EXECUTION_ENABLED: booleanString('false')" 'backend remote execution fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_REMOTE_READONLY_ENABLED: booleanString('false')" 'backend remote read-only fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_CORPORATE_READONLY_ENABLED: booleanString('false')" 'backend corporate adapter fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: z.string().default('')" 'backend corporate origin empty default'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_EXECUTION_ENABLED: "false"' 'production remote execution disabled'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_READONLY_ENABLED: "false"' 'production remote read-only disabled'
require_pattern "$PROD_COMPOSE" 'MCP_CORPORATE_READONLY_ENABLED: "false"' 'production corporate adapter disabled'
require_pattern "$PROD_COMPOSE" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: ""' 'production corporate origin empty'

if grep -En '^MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=.+$' "$ROOT_ENV" "$BACKEND_ENV" >/dev/null; then
  fail 'a real corporate endpoint is configured in a versioned env example'
fi
pass 'no corporate endpoint configured in versioned env examples'

if grep -ERn \
  '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})' \
  "$STATUS_DIR" "$TEST" "$RUNBOOK" >/dev/null
then
  fail 'apparent credential material detected in 16V artifacts'
fi
pass 'no apparent credential material in 16V artifacts'

if git -C "$ROOT_DIR" status --short -- backend/prisma/schema.prisma backend/prisma/migrations | grep -q .; then
  fail 'Prisma schema or migrations changed'
fi
pass 'Prisma schema and migrations unchanged'

require_pattern "$CI" 'tests/api/status.test.ts' 'CI status endpoint API test'
require_pattern "$CI" 'scripts/smoke-endpoint-status-readonly-16v.sh --dry-run' 'CI runs only 16V dry-run mode'
reject_pattern "$CI" 'smoke-endpoint-status-readonly-16v\.sh[[:space:]]+(--live|--run|--local-check)' 'CI live 16V smoke mode'
reject_pattern "$CI" '(curl|wget).*/v1/status' 'CI live status request'

bash -n "$ROOT_DIR/scripts/smoke-endpoint-status-readonly-16v.sh"
pass '16V Bash syntax check passed'

printf '\n16V read-only status endpoint smoke summary: PASS=%d FAIL=0\n' "$pass_count"
