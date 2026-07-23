#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_CONECTOR_CORPORATIVO_READONLY_16T.md"
CORPORATE_DIR="$ROOT_DIR/backend/src/modules/mcp/remote/corporate-readonly"
CONFIG="$CORPORATE_DIR/corporate-readonly.config.ts"
TRANSPORT="$CORPORATE_DIR/corporate-readonly.transport.ts"
FACTORY="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-transport.factory.ts"
EGRESS="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-egress.ts"
POLICY="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-readonly-policy.ts"
GATEWAY="$ROOT_DIR/backend/src/modules/runtime/runtime.tool-gateway.service.ts"
OBS_MAPPER="$ROOT_DIR/backend/src/modules/ai-observability/runtime-observability.mapper.ts"
ANALYTICS="$ROOT_DIR/frontend/src/pages/Analytics/AnalyticsPage.tsx"
MCP_HUB="$ROOT_DIR/frontend/src/pages/MCP/McpHubPage.tsx"
MCP_DETAIL="$ROOT_DIR/frontend/src/pages/MCP/McpDetailPage.tsx"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
ENV_CONFIG="$ROOT_DIR/backend/src/config/env.ts"
EVAL_DIR="$ROOT_DIR/runtime/evals/16s"
EVAL_RUNNER="$ROOT_DIR/scripts/evals-runtime-qualidade-16s.sh"
EVAL_SMOKE="$ROOT_DIR/scripts/smoke-evals-qualidade-16s.sh"
TEST="$ROOT_DIR/backend/tests/unit/corporate-readonly-transport.test.ts"
CI="$ROOT_DIR/.github/workflows/ci.yml"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-conector-corporativo-readonly-16t.sh [--dry-run|--help]

The dry-run reads versioned contracts only. It does not load .env files, resolve a secret,
contact DNS/network/database, execute a tool, start a service, deploy or run a migration.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\nCorporate read-only connector 16T smoke summary: PASS=%d FAIL=1\n' "$pass_count" >&2
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
  if grep -Fq -- "$pattern" "$file"; then fail "$label is present"; fi
  pass "$label absent"
}

for file in \
  "$RUNBOOK" "$CONFIG" "$TRANSPORT" "$CORPORATE_DIR/index.ts" "$FACTORY" "$EGRESS" \
  "$POLICY" "$GATEWAY" "$OBS_MAPPER" "$ANALYTICS" "$MCP_HUB" "$MCP_DETAIL" \
  "$ROOT_ENV" "$BACKEND_ENV" "$PROD_COMPOSE" "$ENV_CONFIG" "$TEST" "$CI"
do
  require_file "$file"
done

for file in "$ROOT_ENV" "$BACKEND_ENV"; do
  require_pattern "$file" 'MCP_REMOTE_EXECUTION_ENABLED=false' "${file#"$ROOT_DIR/"} remote execution disabled"
  require_pattern "$file" 'MCP_REMOTE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} remote read-only disabled"
  require_pattern "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' "${file#"$ROOT_DIR/"} remote allowlist empty"
  require_pattern "$file" 'MCP_REMOTE_REQUIRE_SECRET_REF=true' "${file#"$ROOT_DIR/"} logical secretRef required"
  require_pattern "$file" 'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' "${file#"$ROOT_DIR/"} write tools disabled"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} corporate adapter disabled"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' "${file#"$ROOT_DIR/"} corporate origin empty"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_TIMEOUT_MS=3000' "${file#"$ROOT_DIR/"} corporate timeout bounded"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_MAX_RESPONSE_BYTES=16384' "${file#"$ROOT_DIR/"} corporate response bounded"
done
require_pattern "$PROD_COMPOSE" 'MCP_CORPORATE_READONLY_ENABLED: "false"' 'production corporate adapter disabled'
require_pattern "$PROD_COMPOSE" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: ""' 'production corporate origin empty'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_EXECUTION_ENABLED: "false"' 'production remote execution disabled'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_READONLY_ENABLED: "false"' 'production remote read-only disabled'
require_pattern "$ENV_CONFIG" "MCP_CORPORATE_READONLY_ENABLED: booleanString('false')" 'backend corporate fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: z.string().default('')" 'backend corporate empty origin default'
require_pattern "$ENV_CONFIG" 'Corporate read-only transport requires one explicit HTTPS origin.' 'enabled adapter requires corporate origin'
require_pattern "$ENV_CONFIG" 'Corporate read-only allowlist must be one exact credential-free HTTPS origin.' 'corporate origin validation'

require_pattern "$TRANSPORT" "corporateReadonlyToolName = 'corporate.status.read'" 'single corporate status tool'
require_pattern "$TRANSPORT" "if (!this.config.enabled)" 'adapter dedicated enabled gate'
require_pattern "$TRANSPORT" "input.authType !== 'bearer' || !input.credentialRef" 'adapter bearer secretRef gate'
require_pattern "$TRANSPORT" "method: 'GET'" 'adapter GET-only request'
require_pattern "$TRANSPORT" "redirect: 'manual'" 'adapter redirect blocking'
require_pattern "$TRANSPORT" 'defaultMaxRequestBytes = 512' 'adapter request limit'
require_pattern "$TRANSPORT" 'additionalProperties: false' 'adapter strict simple input'
require_pattern "$TRANSPORT" "allowedScopes = new Set(['summary', 'availability'])" 'adapter scope allowlist'
require_pattern "$TRANSPORT" 'readBoundedJson' 'adapter bounded response reader'
require_pattern "$TRANSPORT" 'sanitizedStatus' 'adapter sanitized summary mapper'
require_pattern "$TRANSPORT" "allowedStatuses = new Set(['ok', 'degraded'])" 'adapter strict 16V status enum'
require_pattern "$TRANSPORT" "statusEndpointKeys = new Set(['status', 'summary', 'updatedAt'])" 'adapter strict 16V response fields'
reject_pattern "$TRANSPORT" "method: 'POST'" 'adapter POST request'
reject_pattern "$TRANSPORT" "method: 'PUT'" 'adapter PUT request'
reject_pattern "$TRANSPORT" "method: 'PATCH'" 'adapter PATCH request'
reject_pattern "$TRANSPORT" "method: 'DELETE'" 'adapter DELETE request'

require_pattern "$FACTORY" 'createGovernedMcpRemoteTransport' 'governed transport router'
require_pattern "$FACTORY" 'matchesCorporateReadonlyOrigin' 'corporate exact-origin selector'
require_pattern "$FACTORY" 'new FailClosedMcpRemoteClientTransport()' 'router fail-closed fallback'
require_pattern "$GATEWAY" 'createGovernedMcpRemoteTransport(options, config)' 'gateway uses governed transport router'
reject_pattern "$GATEWAY" 'new CorporateReadonlyHttpTransport' 'gateway direct corporate bypass'

for pattern in \
  'metadataHosts' 'isBlockedMcpRemoteAddress' "parsed.protocol !== 'https:'" \
  'parsed.username || parsed.password' 'parsed.search' 'parsed.hash' \
  'parseAllowedOrigins(allowlist, policy).has(origin)'
do
  require_pattern "$EGRESS" "$pattern" "egress contract $pattern"
done
require_pattern "$POLICY" 'if (!input.tool.readOnly)' 'read-only classifier'
require_pattern "$POLICY" 'hasDangerousMcpRemoteOperation(input.tool)' 'write-like classifier'
require_pattern "$POLICY" "input.tool.riskLevel !== 'low'" 'low-risk requirement'
require_pattern "$POLICY" "return block('dangerous_operation')" 'dangerous operation blocked'

for field in \
  externalMcpCalled simulated mcpRemoteAllowed mcpRemoteBlocked mcpRemoteBlockedReason \
  mcpRemoteHost mcpRemoteToolId mcpRemoteRiskLevel latencyMs responseBytes
do
  require_pattern "$OBS_MAPPER" "$field" "observability allowlisted field $field"
  require_pattern "$ANALYTICS" "$field" "Analytics allowlisted field $field"
done
for field in rawPrompt rawContext rawArgs rawOutput headers cookies Authorization secretRef apiKey password connectionString; do
  if grep -Eq "(^|[^[:alnum:]_])${field}[[:space:]]*:" "$OBS_MAPPER" "$ANALYTICS"; then
    fail "forbidden analytics/observability property $field is mapped"
  fi
  pass "forbidden analytics/observability property $field absent"
done
reject_pattern "$GATEWAY" 'inputPreview: request.arguments' 'gateway raw arguments persistence'
reject_pattern "$GATEWAY" 'outputPreview: content' 'gateway raw output persistence'

require_pattern "$MCP_HUB" 'adapter corporativo aguardando configuração' 'MCP Hub corporate fail-closed state'
require_pattern "$MCP_HUB" 'Referência lógica de secret' 'MCP Hub logical secret field'
reject_pattern "$MCP_HUB" 'apiKey:' 'MCP Hub raw API key payload'
require_pattern "$MCP_DETAIL" 'Testar readiness seguro' 'MCP detail safe readiness action'
require_pattern "$MCP_DETAIL" 'permanece aguardando configuração' 'MCP detail corporate fail-closed state'

require_file "$EVAL_DIR/cases.corporate-readonly.json"
require_pattern "$EVAL_DIR/cases.corporate-readonly.json" '"corporate_disabled_default"' '16S corporate disabled case'
require_pattern "$EVAL_DIR/cases.corporate-readonly.json" '"corporate_unsafe_host"' '16S corporate unsafe-host case'
require_pattern "$EVAL_DIR/cases.corporate-readonly.json" '"corporate_secretref_required"' '16S corporate secretRef case'
require_pattern "$EVAL_DIR/cases.corporate-readonly.json" '"corporate_write_block"' '16S corporate write-block case'
require_pattern "$EVAL_DIR/cases.corporate-readonly.json" '"corporate_raw_payload"' '16S corporate raw-payload case'
require_executable "$EVAL_RUNNER"
require_executable "$EVAL_SMOKE"

for script in \
  smoke-e2e-chat-rag-mcp-16r.sh smoke-mcp-readonly-integracao-16q.sh \
  smoke-mcp-externo-readonly-16p.sh smoke-hardening-producao-runtime-16o.sh \
  preflight-prod-runtime-16o.sh smoke-custos-quotas-runtime-16n.sh \
  smoke-observabilidade-runtime-16m.sh smoke-chat-rag-operacional-16k.sh \
  smoke-knowledge-rag-16i.sh
do
  require_executable "$ROOT_DIR/scripts/$script"
done

for section in \
  '## Objetivo' '## Escopo' '## Fora de escopo' '## Escolha segura do primeiro conector' \
  '## Requisitos de aprovação' '## Flags e envs' '## SecretRef' '## Allowlist e egress' \
  '## Readiness' '## Execução read-only' '## Matriz permitido e bloqueado' \
  '## Como homologar sem dados sensíveis' '## Evidências esperadas' '## Consultas SQL seguras' \
  '## Rollback' '## Critérios para avançar para um conector real sensível' '## Riscos remanescentes'
do
  require_pattern "$RUNBOOK" "$section" "runbook section $section"
done
require_pattern "$RUNBOOK" 'Esta branch não configura nem chama endpoint corporativo real.' 'runbook no real endpoint configured'
require_pattern "$RUNBOOK" 'corporate.status.read' 'runbook exact corporate tool'

require_pattern "$TEST" 'blocks private and metadata-style destinations before the corporate transport' 'corporate unsafe-host regression test'
require_pattern "$TEST" 'requires a logical secret reference before any request' 'corporate secretRef regression test'
require_pattern "$TEST" 'blocks write-like tools and unsupported input before invoking the transport' 'corporate write-block regression test'
require_pattern "$TEST" 'fails safely on redirects and response fields shaped like raw payload' 'corporate leakage regression test'
require_pattern "$CI" 'tests/unit/corporate-readonly-transport.test.ts' 'CI corporate adapter unit test'

if git -C "$ROOT_DIR" status --short -- backend/prisma/schema.prisma backend/prisma/migrations | grep -q .; then
  fail 'Prisma schema or migrations changed'
fi
pass 'Prisma schema and migrations unchanged'

if grep -ERn \
  '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)' \
  "$CORPORATE_DIR" "$TEST" "$ROOT_ENV" "$BACKEND_ENV" "$PROD_COMPOSE" >/dev/null; then
  fail 'apparent credential material detected in 16T artifacts'
fi
pass 'no apparent credential material in 16T artifacts'

if grep -En '^MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=.+$' "$ROOT_ENV" "$BACKEND_ENV" >/dev/null; then
  fail 'corporate endpoint is configured in a versioned env example'
fi
pass 'no corporate endpoint configured in versioned env examples'

bash -n "$ROOT_DIR/scripts/smoke-conector-corporativo-readonly-16t.sh"
pass '16T Bash syntax check passed'

"$EVAL_RUNNER" --dry-run >/dev/null || fail '16S eval dry-run'
pass '16S eval dry-run'

printf '\nCorporate read-only connector 16T smoke summary: PASS=%d FAIL=0\n' "$pass_count"
