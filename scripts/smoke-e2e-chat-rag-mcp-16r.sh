#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_E2E_CHAT_RAG_MCP_READONLY_16R.md"
HOMOLOGATION="$ROOT_DIR/scripts/homologacao-e2e-chat-rag-mcp-16r.sh"
FIXTURE_DIR="$ROOT_DIR/runtime/e2e-fixtures/16r"
FIXTURE_RUNTIME="$FIXTURE_DIR/runtime-proxy.mjs"
FIXTURE_TEST="$FIXTURE_DIR/tests/runtime-proxy.test.mjs"
DEMO_DIR="$ROOT_DIR/runtime/mcp-readonly-demo"
DEMO_COMPOSE="$ROOT_DIR/docker-compose.mcp-readonly-demo.yml"
E2E_COMPOSE="$ROOT_DIR/docker-compose.e2e-16r.yml"
SCHEMA="$ROOT_DIR/backend/prisma/schema.prisma"
ANALYTICS="$ROOT_DIR/frontend/src/pages/Analytics/AnalyticsPage.tsx"
OBS_MAPPER="$ROOT_DIR/backend/src/modules/ai-observability/runtime-observability.mapper.ts"
GATEWAY="$ROOT_DIR/backend/src/modules/runtime/runtime.tool-gateway.service.ts"
READONLY_POLICY="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-readonly-policy.ts"
GATEWAY_TEST="$ROOT_DIR/backend/tests/runtime/runtime-tool-gateway.test.ts"
AGENT_RUN_TEST="$ROOT_DIR/backend/tests/api/agent-runs.test.ts"
CI="$ROOT_DIR/.github/workflows/ci.yml"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-e2e-chat-rag-mcp-16r.sh [--dry-run|--help]

The dry-run reads versioned files only. It does not load .env files, contact a service,
open a database, start containers, execute an AgentRun, call a provider or invoke an MCP tool.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n16R E2E static smoke summary: PASS=%d FAIL=1\n' "$pass_count" >&2
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
  "$RUNBOOK" "$HOMOLOGATION" "$FIXTURE_DIR/README.md" "$FIXTURE_DIR/catalogo-ficticio.md" \
  "$FIXTURE_DIR/package.json" "$FIXTURE_DIR/Dockerfile" "$FIXTURE_RUNTIME" "$FIXTURE_TEST" \
  "$DEMO_DIR/server.js" "$DEMO_DIR/catalog.js" "$DEMO_DIR/package.json" "$DEMO_DIR/tests/server.test.js" \
  "$DEMO_COMPOSE" "$E2E_COMPOSE" "$SCHEMA" "$ANALYTICS" "$OBS_MAPPER" "$GATEWAY" \
  "$READONLY_POLICY" "$GATEWAY_TEST" "$AGENT_RUN_TEST" "$CI"
do
  require_file "$file"
done
require_executable "$HOMOLOGATION"

for script in \
  smoke-mcp-readonly-integracao-16q.sh smoke-mcp-externo-readonly-16p.sh \
  smoke-hardening-producao-runtime-16o.sh preflight-prod-runtime-16o.sh \
  smoke-custos-quotas-runtime-16n.sh smoke-observabilidade-runtime-16m.sh \
  smoke-chat-rag-operacional-16k.sh smoke-knowledge-rag-16i.sh
do
  require_executable "$ROOT_DIR/scripts/$script"
done

for section in \
  '## Objetivo' '## Escopo' '## Fora de escopo' '## Arquitetura E2E' \
  '## Pré-requisitos' '## Flags e envs necessárias' '## Como subir a stack local' \
  '## Como subir MCP demo' '## Readiness e discovery' '## Preparar base RAG demo' \
  '## Preparar assistant, policy, binding e tool' '## Executar AgentRun' \
  '## Validar RAG' '## Validar MCP read-only real' '## Validar Analytics' \
  '## Validar audit e eventos' '## Validar bloqueios e fail-closed' \
  '## Comandos SQL seguros' '## Campos allowlistados' '## Campos proibidos' \
  '## Critérios de aceite' '## Rollback e cleanup' '## Riscos remanescentes' '## Próximos passos'
do
  require_pattern "$RUNBOOK" "$section" "runbook section $section"
done
require_pattern "$RUNBOOK" 'Evals continuas e qualidade' 'runbook recommends evals before a sensitive connector'
require_pattern "$RUNBOOK" 'externalMcpCalled=true' 'runbook real MCP acceptance'
require_pattern "$RUNBOOK" 'rawContentLogged=false' 'runbook raw logging prohibition'
require_pattern "$RUNBOOK" 'MCP_REMOTE_ALLOW_WRITE_TOOLS' 'runbook write gate'
require_pattern "$RUNBOOK" 'mcpRemoteBlockedReason=egress_blocked' 'runbook allowlist fail-closed scenario'

for mode in --dry-run --prepare --run --audit --cleanup --help; do
  require_pattern "$HOMOLOGATION" "$mode" "homologation mode $mode"
done
require_pattern "$HOMOLOGATION" "STATE_FILE=\"\${ORCHESTRA_16R_STATE_FILE:-/tmp/" 'state defaults outside repository'
require_pattern "$HOMOLOGATION" "fixturePhase: '16R'" 'fixture ownership marker'
require_pattern "$HOMOLOGATION" "assert_safe_observability_json" 'safe audit response validator'
require_pattern "$HOMOLOGATION" "run.externalMcpCalled === true" 'strict same-run MCP acceptance'
require_pattern "$HOMOLOGATION" "run.ragMode === 'resolved_context'" 'strict same-run RAG acceptance'
require_pattern "$HOMOLOGATION" "run.rawContentLogged === false" 'strict raw logging acceptance'
require_pattern "$HOMOLOGATION" "rm -f -- \"\$STATE_FILE\"" 'targeted state cleanup'
reject_pattern "$HOMOLOGATION" 'migrate dev' 'Prisma migrate dev command'
reject_pattern "$HOMOLOGATION" 'prisma migrate' 'Prisma migration command'
reject_pattern "$HOMOLOGATION" 'db push' 'Prisma db push command'
reject_pattern "$HOMOLOGATION" 'set -x' 'shell trace mode'
reject_pattern "$HOMOLOGATION" 'printenv' 'environment dump command'
reject_pattern "$HOMOLOGATION" 'curl --verbose' 'verbose HTTP output'
reject_pattern "$HOMOLOGATION" 'cat "$response"' 'raw API response display'
reject_pattern "$HOMOLOGATION" 'tee "$response"' 'raw API response tee'

if grep -ERn \
  '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)' \
  "$HOMOLOGATION" "$FIXTURE_DIR" "$E2E_COMPOSE" >/dev/null; then
  fail 'apparent hardcoded credential material detected in 16R artifacts'
fi
pass 'no apparent API key, cloud key or private key is hardcoded'

if grep -En "(password|api[_-]?key|token)[[:space:]]*[:=][[:space:]]*[\"'][A-Za-z0-9._~+/-]{16,}[\"']" \
  "$HOMOLOGATION" "$FIXTURE_RUNTIME" "$E2E_COMPOSE" >/dev/null; then
  fail 'apparent hardcoded password, API key or token detected'
fi
pass 'no password, API key or token literal is hardcoded'

require_pattern "$FIXTURE_RUNTIME" "allowedToolNames = new Set(['catalog.search', 'catalog.get_status'])" 'fixture exact read-only tool allowlist'
require_pattern "$FIXTURE_RUNTIME" 'maxRequestBytes = 262_144' 'fixture bounded request size'
require_pattern "$FIXTURE_RUNTIME" "redirect: 'manual'" 'fixture blocks redirects'
require_pattern "$FIXTURE_RUNTIME" 'safeGatewayMetadata' 'fixture metadata allowlist'
require_pattern "$FIXTURE_RUNTIME" "event: 'phase16r_runtime_request'" 'fixture structured safe log'
reject_pattern "$FIXTURE_RUNTIME" 'logger(payload)' 'fixture payload logging'
reject_pattern "$FIXTURE_RUNTIME" 'logger(gatewayBody)' 'fixture gateway response logging'
reject_pattern "$FIXTURE_RUNTIME" "result: { content: data" 'fixture raw tool result forwarding'
require_pattern "$FIXTURE_TEST" 'must-not-be-forwarded' 'fixture negative raw-output assertion'
require_pattern "$FIXTURE_TEST" "includes('must-not-be-forwarded'), false" 'fixture raw-output absence check'

require_pattern "$E2E_COMPOSE" 'AGNO_BRIDGE_EXECUTION_MODE: stub' 'provider-free Agno bridge profile'
require_pattern "$E2E_COMPOSE" 'AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS: "1"' 'single tool call limit'
require_pattern "$E2E_COMPOSE" 'MCP_REMOTE_ALLOW_WRITE_TOOLS: "false"' 'write tools disabled'
require_pattern "$E2E_COMPOSE" 'MCP_REMOTE_EGRESS_ALLOWLIST: "${MCP_REMOTE_EGRESS_ALLOWLIST-http://mcp-readonly-demo:8092}"' 'exact local allowlist with empty override support'
require_pattern "$E2E_COMPOSE" 'AGNO_RUNTIME_HTTP_SECURITY_KEY: "${AGNO_RUNTIME_HTTP_SECURITY_KEY:?' 'runtime credential required outside Git'
reject_pattern "$ROOT_DIR/docker-compose.prod.yml" 'e2e-runtime-16r' '16R fixture in production compose'
reject_pattern "$ROOT_DIR/docker-compose.prod.yml" 'mcp-readonly-demo:' 'MCP demo in production compose'

for endpoint in "'/health'" "'/ready'" "'/v1/catalog'" "'/v1/tools/call'"; do
  require_pattern "$DEMO_DIR/server.js" "$endpoint" "MCP demo endpoint $endpoint"
done
require_pattern "$DEMO_DIR/catalog.js" "externalName: 'catalog.search'" 'MCP demo catalog.search'
require_pattern "$DEMO_DIR/catalog.js" "externalName: 'catalog.get_status'" 'MCP demo catalog.get_status'
require_pattern "$DEMO_DIR/catalog.js" 'readOnly: true' 'MCP demo tools marked read-only'
reject_pattern "$DEMO_DIR/catalog.js" 'catalog.delete' 'MCP demo write tool'
require_pattern "$DEMO_COMPOSE" 'profiles: ["mcp-demo"]' 'MCP demo opt-in profile'
require_pattern "$DEMO_COMPOSE" 'internal: true' 'MCP demo internal network'

for field in \
  ragMode responseScopeMode ragIntentDetected externalMcpCalled simulated \
  mcpRemoteAllowed mcpRemoteBlocked mcpRemoteBlockedReason rawContentLogged
do
  require_pattern "$OBS_MAPPER" "$field" "observability allowlisted field $field"
  require_pattern "$ANALYTICS" "$field" "Analytics field $field"
done
require_pattern "$ANALYTICS" 'MCP demo real' 'Analytics real MCP marker'
require_pattern "$ANALYTICS" 'MCP fail-closed' 'Analytics fail-closed marker'

require_pattern "$GATEWAY" "governance.remote && run.mode === 'sandbox'" 'gateway blocks remote MCP in sandbox'
require_pattern "$GATEWAY" "MCP_REMOTE_TOOL_OPERATION_BLOCKED: 'dangerous_operation'" 'gateway maps dangerous write operation'
require_pattern "$READONLY_POLICY" 'dangerousOperationPattern' 'read-only policy detects write-capable operations'
require_pattern "$READONLY_POLICY" "return block('write_tools_not_allowed')" 'read-only policy write gate'
require_pattern "$READONLY_POLICY" "return block('dangerous_operation')" 'read-only policy dangerous-operation gate'
reject_pattern "$GATEWAY" 'inputPreview: request.arguments' 'gateway raw arguments persistence'
reject_pattern "$GATEWAY" 'outputPreview: content' 'gateway raw output persistence'

require_pattern "$GATEWAY_TEST" 'blocks a remote write-capable tool before creating a client' 'write-tool gateway regression test'
require_pattern "$GATEWAY_TEST" "mcpRemoteBlockedReason: 'dangerous_operation'" 'write-tool sanitized reason assertion'
require_pattern "$AGENT_RUN_TEST" '16R combines governed RAG and safe real MCP metadata on one AgentRun' 'combined RAG and MCP AgentRun test'
require_pattern "$AGENT_RUN_TEST" 'rawContentLogged: false' 'combined test raw logging assertion'

if git -C "$ROOT_DIR" status --short -- backend/prisma/schema.prisma backend/prisma/migrations | grep -q .; then
  fail 'Prisma schema or migrations changed'
fi
pass 'Prisma schema and migrations unchanged'

require_pattern "$CI" 'scripts/smoke-e2e-chat-rag-mcp-16r.sh --dry-run' 'CI 16R static smoke'
bash -n "$HOMOLOGATION"
bash -n "$ROOT_DIR/scripts/smoke-e2e-chat-rag-mcp-16r.sh"
node --check "$FIXTURE_RUNTIME"
pass '16R Bash and Node syntax checks passed'

printf '\n16R E2E static smoke summary: PASS=%d FAIL=0\n' "$pass_count"
