#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_MCP_EXTERNO_READONLY_16P.md"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
ENV_CONFIG="$ROOT_DIR/backend/src/config/env.ts"
EGRESS="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-egress.ts"
POLICY="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-readonly-policy.ts"
CLIENT="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote.client.ts"
SCHEMA="$ROOT_DIR/backend/src/modules/mcp/mcp.schema.ts"
MAPPER="$ROOT_DIR/backend/src/modules/mcp/mcp.mapper.ts"
GATEWAY="$ROOT_DIR/backend/src/modules/runtime/runtime.tool-gateway.service.ts"
ADAPTER="$ROOT_DIR/backend/src/modules/runtime/runtime.agno-http-adapter.ts"
OBS_MAPPER="$ROOT_DIR/backend/src/modules/ai-observability/runtime-observability.mapper.ts"
MCP_UI="$ROOT_DIR/frontend/src/pages/MCP/McpHubPage.tsx"
MCP_DETAIL_UI="$ROOT_DIR/frontend/src/pages/MCP/McpDetailPage.tsx"
ANALYTICS_UI="$ROOT_DIR/frontend/src/pages/Analytics/AnalyticsPage.tsx"
CLIENT_TEST="$ROOT_DIR/backend/tests/unit/mcp-remote-client.test.ts"
GATEWAY_TEST="$ROOT_DIR/backend/tests/runtime/runtime-tool-gateway.test.ts"
OBS_TEST="$ROOT_DIR/backend/tests/api/runtime-observability.test.ts"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-mcp-externo-readonly-16p.sh [MODE]

Modes:
  --dry-run          Validate static MCP remote read-only contracts (default).
  --print-checklist  Print the safe manual homologation checklist.
  --help             Print this help.

The dry-run reads versioned files only. It never loads .env files, resolves DNS, contacts a
database or external host, starts a runtime, resolves a secret, or executes an MCP tool.
EOF
}

print_checklist() {
  cat <<'EOF'
Manual 16P checklist:
1. Keep every MCP remote flag false for the initial deployment.
2. Approve one HTTPS origin and one low-risk tool explicitly marked read-only.
3. Configure only a logical secret reference; never record its resolved value.
4. Connect only a reviewed transport in isolated homologation.
5. Validate a blocked call first and confirm externalMcpCalled=false.
6. Validate one controlled read-only call and confirm host, tool ID, simulated and responseBytes.
7. Confirm audit/analytics contain no arguments, raw output, headers, auth or secret reference.
8. Roll back by disabling execution/read-only and emptying the egress allowlist.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\nMCP external read-only 16P smoke summary: PASS=%d FAIL=1\n' "$pass_count" >&2
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
  "$RUNBOOK" "$ROOT_ENV" "$BACKEND_ENV" "$COMPOSE_FILE" "$ENV_CONFIG" \
  "$EGRESS" "$POLICY" "$CLIENT" "$SCHEMA" "$MAPPER" "$GATEWAY" "$ADAPTER" \
  "$OBS_MAPPER" "$MCP_UI" "$MCP_DETAIL_UI" "$ANALYTICS_UI" "$CLIENT_TEST" "$GATEWAY_TEST" "$OBS_TEST"
do
  require_file "$file"
done

for file in "$ROOT_ENV" "$BACKEND_ENV"; do
  require_pattern "$file" 'MCP_REMOTE_EXECUTION_ENABLED=false' "${file#"$ROOT_DIR/"} execution disabled"
  require_pattern "$file" 'MCP_REMOTE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} read-only disabled"
  require_pattern "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' "${file#"$ROOT_DIR/"} empty egress allowlist"
  require_pattern "$file" 'MCP_REMOTE_MAX_TIMEOUT_MS=5000' "${file#"$ROOT_DIR/"} bounded remote timeout"
  require_pattern "$file" 'MCP_REMOTE_MAX_RESPONSE_BYTES=65536' "${file#"$ROOT_DIR/"} bounded remote response"
  require_pattern "$file" 'MCP_REMOTE_REQUIRE_SECRET_REF=true' "${file#"$ROOT_DIR/"} secret reference required"
  require_pattern "$file" 'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' "${file#"$ROOT_DIR/"} write tools disabled"
done

require_pattern "$COMPOSE_FILE" 'MCP_REMOTE_ENABLED: "false"' 'Compose MCP remote disabled'
require_pattern "$COMPOSE_FILE" 'MCP_REMOTE_EXECUTION_ENABLED: "false"' 'Compose MCP execution disabled'
require_pattern "$COMPOSE_FILE" 'MCP_REMOTE_READONLY_ENABLED: "false"' 'Compose MCP read-only disabled'
require_pattern "$COMPOSE_FILE" 'MCP_REMOTE_EGRESS_ALLOWLIST: ""' 'Compose MCP allowlist empty'
require_pattern "$COMPOSE_FILE" 'MCP_REMOTE_MAX_TIMEOUT_MS: "5000"' 'Compose MCP timeout bounded'
require_pattern "$COMPOSE_FILE" 'MCP_REMOTE_MAX_RESPONSE_BYTES: "65536"' 'Compose MCP response bounded'
require_pattern "$COMPOSE_FILE" 'MCP_REMOTE_ALLOW_WRITE_TOOLS: "false"' 'Compose write tools disabled'

require_pattern "$ENV_CONFIG" "MCP_REMOTE_READONLY_ENABLED: booleanString('false')" 'backend read-only fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_REMOTE_EGRESS_ALLOWLIST: z.string().default('')" 'backend empty allowlist default'
require_pattern "$ENV_CONFIG" "MCP_REMOTE_REQUIRE_SECRET_REF: booleanString('true')" 'backend logical secret requirement'
require_pattern "$ENV_CONFIG" "MCP_REMOTE_ALLOW_WRITE_TOOLS: booleanString('false')" 'backend write prohibition default'

for pattern in 'localhost' '169' '127' '192' 'metadata.google.internal' "parsed.protocol !== 'https:'" 'parsed.username || parsed.password' 'parsed.search' 'isBlockedMcpRemoteAddress'; do
  require_pattern "$EGRESS" "$pattern" "egress guard $pattern"
done
require_pattern "$EGRESS" 'parseAllowedOrigins(allowlist).has(origin)' 'explicit normalized origin allowlist'

require_pattern "$SCHEMA" 'logicalSecretRef' 'logical secret reference schema'
require_pattern "$SCHEMA" 'URLs nao devem conter credenciais, query string ou fragment embutidos.' 'embedded credential/query rejection'
require_pattern "$SCHEMA" 'Nao informe secrets, tokens, passwords, api keys ou authorization' 'direct credential-shaped JSON rejection'
require_pattern "$SCHEMA" '}).strict();' 'strict request body schemas'
require_pattern "$MAPPER" 'credentialConfigured: Boolean(server.secretRef)' 'public boolean credential status'
reject_pattern "$MAPPER" 'secretRef: server.secretRef' 'public secret reference mapping'
require_pattern "$MCP_UI" 'Referência lógica de secret' 'frontend logical secret reference input'
reject_pattern "$MCP_UI" 'apiKey:' 'frontend direct API key field'
reject_pattern "$MCP_UI" 'Rotacionar' 'frontend fake credential rotation action'
reject_pattern "$MCP_UI" '>Sincronizar<' 'frontend fake discovery action'
require_pattern "$MCP_DETAIL_UI" 'readOnly: true' 'frontend catalog read-only classification'
reject_pattern "$MCP_DETAIL_UI" '>Sincronizar<' 'frontend detail fake discovery action'
reject_pattern "$MCP_DETAIL_UI" '{log.input}' 'frontend raw tool input rendering'

require_pattern "$POLICY" 'if (!input.tool.readOnly)' 'explicit read-only classification'
require_pattern "$POLICY" 'hasDangerousMcpRemoteOperation(input.tool)' 'tool metadata write-operation classification'
require_pattern "$POLICY" "input.tool.riskLevel !== 'low'" 'low-risk requirement'
for verb in create update delete remove write post put patch drop truncate send transfer approve execute shell command; do
  require_pattern "$POLICY" "$verb" "dangerous verb $verb"
done

require_pattern "$CLIENT" 'validateMcpRemoteEgress' 'client egress validation before transport'
require_pattern "$CLIENT" 'executeReadonlyTool' 'read-only transport method'
require_pattern "$CLIENT" 'MCP_REMOTE_RESPONSE_TOO_LARGE' 'response size fail-closed'
require_pattern "$CLIENT" 'externalMcpCalled: true' 'client marks completed controlled transport call'
require_pattern "$CLIENT" 'simulated: output.simulated' 'client preserves fake/sandbox signal'

require_pattern "$GATEWAY" 'validateCurrentGovernance' 'gateway current-state revalidation'
require_pattern "$GATEWAY" 'evaluateMcpRemoteReadOnly' 'gateway remote read-only policy revalidation'
require_pattern "$GATEWAY" 'dependencies.createRemoteClient' 'gateway controlled client boundary'
require_pattern "$GATEWAY" "governance.remote && run.mode === 'sandbox'" 'sandbox keeps external MCP blocked'
require_pattern "$GATEWAY" "mode: remote ? 'remote_controlled' : 'sandbox'" 'remote controlled persistence mode'
require_pattern "$GATEWAY" 'externalMcpCalled: remoteResult.externalMcpCalled' 'external call signal only from client result'
require_pattern "$GATEWAY" 'inputHash: sha256(request.arguments)' 'hashed arguments persistence'
reject_pattern "$GATEWAY" 'inputPreview: request.arguments' 'raw arguments persistence'
reject_pattern "$GATEWAY" 'outputPreview: content' 'raw response persistence'

for field in mcpRemoteEvaluationApplied mcpRemoteAllowed mcpRemoteBlocked mcpRemoteBlockedReason mcpRemoteReadOnly mcpRemoteHost mcpRemoteToolId mcpRemoteRiskLevel externalMcpCalled simulated responseBytes; do
  require_pattern "$ADAPTER" "$field" "adapter safe metadata $field"
  require_pattern "$OBS_MAPPER" "$field" "observability safe metadata $field"
  require_pattern "$ANALYTICS_UI" "$field" "analytics field $field"
done
require_pattern "$OBS_TEST" 'rawArguments' 'observability raw argument negative fixture'
require_pattern "$OBS_TEST" 'rawOutput' 'observability raw output negative fixture'
require_pattern "$OBS_TEST" 'secretRef' 'observability secret reference negative fixture'

require_pattern "$CLIENT_TEST" 'DNS rebinding/private resolution' 'SSRF/private DNS test'
require_pattern "$CLIENT_TEST" 'without invoking transport' 'blocked tool avoids transport test'
require_pattern "$GATEWAY_TEST" 'createRemoteClient).not.toHaveBeenCalled' 'gateway blocked path avoids client'
require_pattern "$GATEWAY_TEST" 'externalMcpCalled: true' 'gateway controlled call observability test'
require_pattern "$GATEWAY_TEST" 'simulated: true' 'gateway fake/sandbox signal test'

for smoke in \
  smoke-hardening-producao-runtime-16o.sh \
  smoke-custos-quotas-runtime-16n.sh \
  smoke-observabilidade-runtime-16m.sh \
  smoke-chat-rag-operacional-16k.sh \
  smoke-knowledge-rag-16i.sh
do
  require_executable "$ROOT_DIR/scripts/$smoke"
done

for section in \
  '## Objetivo' '## Escopo' '## Fora de escopo' '## Arquitetura' '## Flags' \
  '## Egress allowlist' '## SecretRef' '## Policy, risco e approval' \
  '## Fluxo gateway para MCP client' '## Matriz permitido e bloqueado' \
  '## Campos allowlistados' '## Campos proibidos' '## Validação manual' \
  '## Consultas SQL e auditoria' '## Rollback' '## Incidentes' '## Riscos remanescentes'
do
  require_pattern "$RUNBOOK" "$section" "runbook section $section"
done

if git -C "$ROOT_DIR" diff --name-only -- backend/prisma/schema.prisma backend/prisma/migrations | grep -q .; then
  fail 'Prisma schema or migrations changed'
fi
pass 'Prisma schema and migrations unchanged'

if grep -ERn --include='.env.example' --include='docker-compose.prod.yml' \
  '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)' \
  "$ROOT_DIR" >/dev/null; then
  fail 'apparent credential material detected in versioned examples'
fi
pass 'no apparent credential material in versioned examples'

printf '\nMCP external read-only 16P smoke summary: PASS=%d FAIL=0\n' "$pass_count"
