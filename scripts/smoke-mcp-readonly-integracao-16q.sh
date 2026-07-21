#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_MCP_READONLY_INTEGRACAO_HOMOLOGADA_16Q.md"
DEMO_DIR="$ROOT_DIR/runtime/mcp-readonly-demo"
DEMO_SERVER="$DEMO_DIR/server.js"
DEMO_CATALOG="$DEMO_DIR/catalog.js"
DEMO_TEST="$DEMO_DIR/tests/server.test.js"
DEMO_DOCKERFILE="$DEMO_DIR/Dockerfile"
DEMO_COMPOSE="$ROOT_DIR/docker-compose.mcp-readonly-demo.yml"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
ENV_CONFIG="$ROOT_DIR/backend/src/config/env.ts"
EGRESS="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-egress.ts"
TRANSPORT="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-readonly-demo-http.transport.ts"
CLIENT="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote.client.ts"
POLICY="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-readonly-policy.ts"
READINESS="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-readiness.service.ts"
DISCOVERY="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-discovery.service.ts"
ROUTES="$ROOT_DIR/backend/src/modules/mcp/mcp.routes.ts"
GATEWAY="$ROOT_DIR/backend/src/modules/runtime/runtime.tool-gateway.service.ts"
OBS_MAPPER="$ROOT_DIR/backend/src/modules/ai-observability/runtime-observability.mapper.ts"
MCP_UI="$ROOT_DIR/frontend/src/pages/MCP/McpHubPage.tsx"
MCP_DETAIL_UI="$ROOT_DIR/frontend/src/pages/MCP/McpDetailPage.tsx"
ANALYTICS_UI="$ROOT_DIR/frontend/src/pages/Analytics/AnalyticsPage.tsx"
CLIENT_TEST="$ROOT_DIR/backend/tests/unit/mcp-remote-client.test.ts"
GATEWAY_TEST="$ROOT_DIR/backend/tests/runtime/runtime-tool-gateway.test.ts"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-mcp-readonly-integracao-16q.sh [MODE]

Modes:
  --dry-run          Validate static 16Q contracts without network or containers (default).
  --print-checklist  Print the controlled local homologation checklist.
  --help             Print this help.
EOF
}

print_checklist() {
  cat <<'EOF'
Manual 16Q checklist:
1. Keep all MCP flags disabled and the allowlist empty before homologation.
2. Run the demo package tests and start only the mcp-demo Compose profile.
3. Enable the local HTTP exception only outside production and allowlist its exact origin.
4. Validate a blocked readiness/discovery before the permitted path.
5. Confirm discovery returns only catalog.search and catalog.get_status.
6. Execute only a published, low-risk, read-only, explicitly governed tool call.
7. Confirm the real demo path has externalMcpCalled=true and simulated=false.
8. Confirm sandbox/fake paths remain simulated=true and no args/output/secretRef are persisted.
9. Roll back by disabling flags, emptying the allowlist and stopping the demo profile.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\nMCP read-only homologated integration 16Q smoke summary: PASS=%d FAIL=1\n' "$pass_count" >&2
  exit 1
}

case "$MODE" in
  --dry-run) ;;
  --print-checklist) print_checklist; exit 0 ;;
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
  if grep -Fq -- "$pattern" "$file"; then
    fail "$label is present"
  fi
  pass "$label absent"
}

for file in \
  "$RUNBOOK" "$DEMO_SERVER" "$DEMO_CATALOG" "$DEMO_TEST" "$DEMO_DOCKERFILE" "$DEMO_DIR/package.json" \
  "$DEMO_COMPOSE" "$PROD_COMPOSE" "$ROOT_ENV" "$BACKEND_ENV" "$ENV_CONFIG" "$EGRESS" "$TRANSPORT" \
  "$CLIENT" "$POLICY" "$READINESS" "$DISCOVERY" "$ROUTES" "$GATEWAY" "$OBS_MAPPER" \
  "$MCP_UI" "$MCP_DETAIL_UI" "$ANALYTICS_UI" "$CLIENT_TEST" "$GATEWAY_TEST"
do
  require_file "$file"
done

for endpoint in "'/health'" "'/ready'" "'/v1/catalog'" "'/v1/tools/call'"; do
  require_pattern "$DEMO_SERVER" "$endpoint" "demo endpoint $endpoint"
done
require_pattern "$DEMO_CATALOG" "externalName: 'catalog.search'" 'demo catalog.search tool'
require_pattern "$DEMO_CATALOG" "externalName: 'catalog.get_status'" 'demo catalog.get_status tool'
require_pattern "$DEMO_CATALOG" 'readOnly: true' 'demo tools explicitly read-only'
require_pattern "$DEMO_CATALOG" "riskLevel: 'low'" 'demo tools low risk'
require_pattern "$DEMO_SERVER" 'defaultMaxPayloadBytes = 8_192' 'demo payload limit'
require_pattern "$DEMO_SERVER" 'server.requestTimeout = requestTimeoutMs' 'demo request timeout'
require_pattern "$DEMO_SERVER" "event: 'mcp_readonly_demo_request'" 'demo structured request log'
reject_pattern "$DEMO_SERVER" 'body: payload' 'demo raw request logging'
reject_pattern "$DEMO_SERVER" 'catalog.delete' 'demo write tool implementation'

require_pattern "$DEMO_DOCKERFILE" 'USER node' 'demo non-root container user'
reject_pattern "$DEMO_DOCKERFILE" 'ARG API_KEY' 'demo API key build argument'
reject_pattern "$DEMO_DOCKERFILE" 'ENV TOKEN=' 'demo token environment'
require_pattern "$DEMO_COMPOSE" 'profiles: ["mcp-demo"]' 'demo opt-in Compose profile'
reject_pattern "$DEMO_COMPOSE" 'container_name:' 'demo container_name'
require_pattern "$DEMO_COMPOSE" 'internal: true' 'demo internal Compose network'
require_pattern "$DEMO_COMPOSE" '127.0.0.1:${MCP_READONLY_DEMO_PORT:-8092}:8092' 'demo loopback port binding'
require_pattern "$DEMO_COMPOSE" '/health' 'demo Compose healthcheck'
require_pattern "$DEMO_COMPOSE" 'MCP_REMOTE_ENABLED: "${MCP_REMOTE_ENABLED:-false}"' 'demo overlay MCP disabled by default'
require_pattern "$DEMO_COMPOSE" 'MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO: "${MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO:-false}"' 'demo overlay insecure exception disabled by default'

for file in "$ROOT_ENV" "$BACKEND_ENV"; do
  require_pattern "$file" 'MCP_REMOTE_ENABLED=false' "${file#"$ROOT_DIR/"} remote disabled"
  require_pattern "$file" 'MCP_REMOTE_DISCOVERY_ENABLED=false' "${file#"$ROOT_DIR/"} discovery disabled"
  require_pattern "$file" 'MCP_REMOTE_EXECUTION_ENABLED=false' "${file#"$ROOT_DIR/"} execution disabled"
  require_pattern "$file" 'MCP_REMOTE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} read-only disabled"
  require_pattern "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' "${file#"$ROOT_DIR/"} empty allowlist"
  require_pattern "$file" 'MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO=false' "${file#"$ROOT_DIR/"} local demo exception disabled"
  require_pattern "$file" 'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' "${file#"$ROOT_DIR/"} write tools disabled"
done

require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_ENABLED: "false"' 'production remote disabled'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO: "false"' 'production local demo exception disabled'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_LOCAL_DEMO_ORIGIN: ""' 'production local demo origin empty'
reject_pattern "$PROD_COMPOSE" 'mcp-readonly-demo:' 'production demo service'
require_pattern "$ENV_CONFIG" "MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO: booleanString('false')" 'backend local demo exception false default'
require_pattern "$ENV_CONFIG" "value.NODE_ENV === 'production' && value.MCP_REMOTE_ALLOW_INSECURE_LOCAL_DEMO" 'backend production prohibition'
require_pattern "$ENV_CONFIG" 'MCP insecure local demo transport is forbidden in production.' 'backend production fail-fast message'

require_pattern "$EGRESS" 'configuredLocalDemoOrigin' 'egress controlled local demo origin'
require_pattern "$EGRESS" "host === 'mcp-readonly-demo'" 'egress exact Compose demo host'
require_pattern "$EGRESS" 'origin === localDemoOrigin' 'egress exact local origin comparison'
require_pattern "$EGRESS" 'parseAllowedOrigins(allowlist, policy).has(origin)' 'egress explicit allowlist required'
require_pattern "$EGRESS" "policy.environment === 'production'" 'egress production prohibition'
require_pattern "$EGRESS" 'isBlockedMcpRemoteAddress' 'normal SSRF address protection'

require_pattern "$TRANSPORT" "allowedToolNames = new Set(['catalog.search', 'catalog.get_status'])" 'transport read-only tool allowlist'
require_pattern "$TRANSPORT" "redirect: 'manual'" 'transport redirect blocking'
require_pattern "$TRANSPORT" 'controlledEndpoint' 'transport exact-origin endpoint builder'
require_pattern "$TRANSPORT" 'readBoundedJson' 'transport bounded response reader'
require_pattern "$TRANSPORT" 'simulated: false' 'transport real demo signal'
require_pattern "$TRANSPORT" 'hasSensitiveKeys' 'transport sensitive response rejection'
require_pattern "$CLIENT" 'inputBytes > spec.limits.maxInputBytes' 'client input size gate'
require_pattern "$CLIENT" 'externalMcpCalled: true' 'client external call only after success'
require_pattern "$CLIENT" 'simulated: output.simulated' 'client transport simulation signal'

require_pattern "$ROUTES" '/servers/:id/remote-readiness' 'safe backend readiness endpoint'
require_pattern "$ROUTES" '/servers/:id/remote-discovery' 'safe backend discovery endpoint'
require_pattern "$READINESS" 'MCP remote is disabled by backend configuration.' 'readiness disabled fail-closed'
require_pattern "$DISCOVERY" 'transportCalled: false' 'discovery blocked before transport'
require_pattern "$DISCOVERY" 'sanitizeTransportWarnings' 'discovery warnings sanitizer'
require_pattern "$GATEWAY" 'evaluateMcpRemoteReadOnly' 'gateway read-only policy revalidation'
require_pattern "$GATEWAY" "governance.remote && run.mode === 'sandbox'" 'gateway sandbox external block'
require_pattern "$GATEWAY" "mode: remote ? 'remote_controlled' : 'sandbox'" 'gateway controlled remote mode'
reject_pattern "$GATEWAY" 'inputPreview: request.arguments' 'gateway raw arguments persistence'
reject_pattern "$GATEWAY" 'outputPreview: content' 'gateway raw output persistence'

require_pattern "$CLIENT_TEST" 'real local HTTP with simulated=false' 'real demo client transport test'
require_pattern "$CLIENT_TEST" 'forbids the insecure demo exception in production' 'production exception test'
require_pattern "$CLIENT_TEST" "externalMcpCalled: true" 'real client external call assertion'
require_pattern "$GATEWAY_TEST" 'real local demo HTTP call through gateway governance with simulated=false' 'real demo gateway test'
require_pattern "$GATEWAY_TEST" 'simulated: false' 'gateway real demo simulation assertion'
require_pattern "$GATEWAY_TEST" 'simulated: true' 'gateway fake/sandbox simulation assertion'
require_pattern "$GATEWAY_TEST" "not.toContain('safe lookup')" 'gateway raw arguments negative assertion'
require_pattern "$GATEWAY_TEST" 'not.toHaveProperty('"'"'outputPreview'"'"')' 'gateway raw output negative assertion'

require_pattern "$MCP_UI" 'Referência lógica de secret' 'frontend logical reference only'
reject_pattern "$MCP_UI" 'type="password"' 'frontend password input'
reject_pattern "$MCP_UI" 'apiKey:' 'frontend direct API key property'
require_pattern "$MCP_DETAIL_UI" 'Testar readiness seguro' 'frontend safe readiness action'
require_pattern "$MCP_DETAIL_UI" 'Consultar catálogo read-only' 'frontend safe discovery action'
require_pattern "$MCP_DETAIL_UI" 'O demo local continua homologado' 'frontend demo remains explicitly homologated'
require_pattern "$ANALYTICS_UI" 'MCP demo real' 'analytics real demo marker'
require_pattern "$ANALYTICS_UI" 'MCP fail-closed' 'analytics blocked marker'
for field in mcpRemoteEvaluationApplied mcpRemoteAllowed mcpRemoteBlocked mcpRemoteBlockedReason mcpRemoteReadOnly mcpRemoteHost mcpRemoteToolId mcpRemoteRiskLevel externalMcpCalled simulated responseBytes; do
  require_pattern "$OBS_MAPPER" "$field" "observability safe field $field"
  require_pattern "$ANALYTICS_UI" "$field" "analytics safe field $field"
done

for smoke in \
  smoke-mcp-externo-readonly-16p.sh \
  smoke-hardening-producao-runtime-16o.sh \
  preflight-prod-runtime-16o.sh \
  smoke-custos-quotas-runtime-16n.sh \
  smoke-observabilidade-runtime-16m.sh \
  smoke-chat-rag-operacional-16k.sh \
  smoke-knowledge-rag-16i.sh
do
  require_executable "$ROOT_DIR/scripts/$smoke"
done

for section in \
  '## Objetivo' '## Escopo' '## Fora de escopo' '## Arquitetura da integração demo' \
  '## Como subir o demo' '## Flags e envs necessárias' '## Allowlist e SSRF' \
  '## Readiness e discovery' '## Tool call read-only' '## Critérios para externalMcpCalled=true' \
  '## Simulated true versus false' '## Campos allowlistados' '## Campos proibidos' \
  '## Validação manual' '## Consultas SQL e auditoria' '## Rollback' \
  '## Riscos remanescentes' '## Próximos passos para um conector real'
do
  require_pattern "$RUNBOOK" "$section" "runbook section $section"
done

if git -C "$ROOT_DIR" diff --name-only -- backend/prisma/schema.prisma backend/prisma/migrations | grep -q .; then
  fail 'Prisma schema or migrations changed'
fi
pass 'Prisma schema and migrations unchanged'

if grep -ERn --include='.env.example' --include='docker-compose*.yml' \
  '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)' \
  "$ROOT_DIR" >/dev/null; then
  fail 'apparent credential material detected in versioned configuration'
fi
pass 'no apparent credential material in versioned configuration'

printf '\nMCP read-only homologated integration 16Q smoke summary: PASS=%d FAIL=0\n' "$pass_count"
