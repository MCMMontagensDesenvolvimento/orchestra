#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHASE_BASE_COMMIT="06b4022"
CATALOG="$ROOT_DIR/backend/src/modules/mcp/local-demo/mcp-local-demo.catalog.ts"
SEED="$ROOT_DIR/backend/prisma/mcp-local-demo.seed.ts"
SEED_ENTRY="$ROOT_DIR/backend/prisma/seed.ts"
SEED_TARGET="$ROOT_DIR/backend/prisma/seed-target.ts"
BACKEND_PACKAGE="$ROOT_DIR/backend/package.json"
SERVICE="$ROOT_DIR/backend/src/modules/mcp/mcp.service.ts"
ROUTES="$ROOT_DIR/backend/src/modules/mcp/mcp.routes.ts"
BACKEND_TEST="$ROOT_DIR/backend/tests/unit/mcp-local-demo.test.ts"
FRONTEND_MOCK="$ROOT_DIR/frontend/src/services/mocks/mcp-demo-local.mock.ts"
FRONTEND_TEST="$ROOT_DIR/frontend/src/services/mocks/mcp-demo-local.mock.test.ts"
HUB="$ROOT_DIR/frontend/src/pages/MCP/McpHubPage.tsx"
DETAIL="$ROOT_DIR/frontend/src/pages/MCP/McpDetailPage.tsx"
DOC="$ROOT_DIR/docs/ai-orchestration/mcp/ORCHESTRA_MCP_TOOLS_GOVERNADO_LOCAL_18D.md"
SMOKE="$ROOT_DIR/scripts/smoke-mcp-tools-governado-local-18d.sh"
PREFLIGHT="$ROOT_DIR/scripts/preflight-mcp-tools-governado-local-18d.sh"
CI="$ROOT_DIR/.github/workflows/ci.yml"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/preflight-mcp-tools-governado-local-18d.sh [--dry-run|--help]

Validates the Phase 18D governed local MCP catalog using only static, offline and
read-only checks. It does not seed a database, call network or production, start
Docker Compose, deploy, migrate, execute MCP/tools/provider/embeddings, send Chat
messages, create AgentRuns, launch a browser, or change files.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n18D governed local MCP preflight summary: mode=%s PASS=%d FAIL=1 phase=18D localDemo=true deployment=false migration=false remoteMcpExecution=false writeToolsAllowed=false externalNetworkAllowed=false realProviderExecution=false realEmbeddingsExecution=false realChatAgentRunExecution=false production=false\n' \
    "${MODE#--}" "$pass_count" >&2
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

phase_change_records() {
  git -C "$ROOT_DIR" diff --name-status "$PHASE_BASE_COMMIT"
  git -C "$ROOT_DIR" ls-files --others --exclude-standard | sed $'s/^/A\t/'
}

check_phase_scope() {
  local status first_path second_path path
  git -C "$ROOT_DIR" cat-file -e "${PHASE_BASE_COMMIT}^{commit}" 2>/dev/null \
    || fail "18D base commit $PHASE_BASE_COMMIT is unavailable"
  pass "18D base commit $PHASE_BASE_COMMIT is available"

  [ -n "$(phase_change_records)" ] || fail '18D phase change set is empty'
  pass '18D phase change set is available'

  while IFS=$'\t' read -r status first_path second_path; do
    [ -n "$status" ] || continue
    path="${second_path:-$first_path}"
    case "$path" in
      backend/prisma/schema.prisma|backend/prisma/migrations/*)
        fail "Prisma schema or migration changed in 18D: $path"
        ;;
      .env|*/.env|*.pem|*.key|*.p12|*.pfx)
        fail "sensitive file type changed in 18D: $path"
        ;;
    esac
  done < <(phase_change_records)

  pass 'Prisma schema and migrations are unchanged in the 18D phase scope'
  pass 'no .env, private key or certificate bundle changed in the 18D phase scope'
}

check_no_apparent_credentials() {
  local credential_pattern
  credential_pattern='(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})'
  if grep -ERn -- "$credential_pattern" \
    "$CATALOG" "$SEED" "$SEED_TARGET" "$BACKEND_TEST" "$FRONTEND_MOCK" "$FRONTEND_TEST" "$HUB" "$DETAIL" "$DOC" >/dev/null
  then
    fail 'apparent credential material detected in 18D files'
  fi
  pass 'no apparent secret, token, cookie, authorization header or private key value in 18D files'
}

check_no_production_target() {
  if grep -ERq -- 'https://(api\.)?orchestra\.mcm\.eng\.br' \
    "$CATALOG" "$SEED" "$BACKEND_TEST" "$FRONTEND_MOCK" "$FRONTEND_TEST" "$HUB" "$DETAIL" "$CI"
  then
    fail 'planned production URL appears in 18D functional files or CI'
  fi
  pass 'production URLs are absent from 18D functional files and CI'
}

[ "$#" -le 1 ] || fail 'only one mode can be selected'
case "$MODE" in
  --dry-run)
    ;;
  --help|-h)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

for file in \
  "$CATALOG" "$SEED" "$SEED_ENTRY" "$SEED_TARGET" "$BACKEND_PACKAGE" "$SERVICE" "$ROUTES" "$BACKEND_TEST" \
  "$FRONTEND_MOCK" "$FRONTEND_TEST" "$HUB" "$DETAIL" "$DOC" "$CI"
do
  require_file "$file"
done
require_executable "$PREFLIGHT"
require_executable "$SMOKE"

check_phase_scope
check_no_apparent_credentials
check_no_production_target

require_pattern "$CATALOG" "name: 'MCP Demo Local — Corporate Readonly'" '18D local demo server name'
require_pattern "$CATALOG" "name: 'corporate.status.read'" 'corporate.status.read tool'
require_pattern "$CATALOG" "name: 'corporate.policy.lookup'" 'corporate.policy.lookup tool'
require_pattern "$CATALOG" "name: 'corporate.document.search.placeholder'" 'corporate.document.search.placeholder tool'

for policy in \
  'readOnly: true' \
  'remoteExecution: false' \
  'writeToolsAllowed: false' \
  'externalNetworkAllowed: false' \
  'requiresApproval: true' \
  'sandboxOnly: true' \
  'allowRuntimeExecution: false' \
  'blockedByDefault: true' \
  'externalProviderAllowed: false' \
  'realEmbeddingsAllowed: false' \
  'chatAgentRunAllowed: false' \
  "executionMode: 'precheck_only'"
do
  require_pattern "$CATALOG" "$policy" "catalog policy $policy"
done

require_pattern "$CATALOG" "allowed: false" 'local precheck never authorizes execution'
require_pattern "$CATALOG" "failClosed: true" 'local precheck is fail-closed'
require_pattern "$SEED" 'mcpServer.upsert' 'server seed uses upsert'
require_pattern "$SEED" 'mcpTool.upsert' 'tool seed uses upsert'
require_pattern "$SEED" 'mcpToolPolicy.upsert' 'policy seed uses upsert'
require_pattern "$SEED" 'assistantMcpBinding.upsert' 'binding seed uses upsert'
require_pattern "$SEED" "action: 'mcp.demo.seeded'" 'seed audit evidence'
require_pattern "$SEED_ENTRY" 'await seedMcpLocalDemo(prisma' 'demo bootstrap invokes the local MCP seed'
require_pattern "$SEED_ENTRY" 'const argv = process.argv.slice(2);' 'seed entrypoint reads process.argv'
require_pattern "$SEED_TARGET" "parseArgumentValue(argv, '--tenant-slug')" 'tenant slug argument parser'
require_pattern "$SEED_TARGET" "parseArgumentValue(argv, '--workspace-slug')" 'workspace slug argument parser'
require_pattern "$SEED_TARGET" "source: 'preferred-local'" 'mcm/principal preferred local target'
require_pattern "$SEED_TARGET" "source: 'fallback-local'" 'orchestra-dev/default final fallback target'
require_pattern "$BACKEND_PACKAGE" '"prisma:seed:mcp-demo-local": "tsx prisma/seed.ts --demo"' 'explicit local MCP demo seed command'
require_pattern "$DOC" 'npm run prisma:seed:mcp-demo-local -- --tenant-slug mcm --workspace-slug principal' 'documented explicit seed target command'
require_pattern "$SERVICE" "action: 'mcp.server.viewed'" 'server view audit evidence'
require_pattern "$SERVICE" "action: 'mcp.tool.catalog.viewed'" 'tool catalog audit evidence'
require_pattern "$SERVICE" "action: 'mcp.precheck.demo_checked'" 'demo precheck audit evidence'
require_pattern "$SERVICE" "action: 'mcp.precheck.blocked'" 'tool-call path is blocked before demo execution'
require_pattern "$SERVICE" "'MCP_LOCAL_DEMO_PRECHECK_ONLY'" 'demo tool-call rejection code'
require_pattern "$ROUTES" '/servers/:id/local-demo-precheck' 'local demo precheck route'
require_pattern "$ROUTES" "router.get('/bindings'" 'MCP catalog bindings route'

reject_pattern "$CATALOG" '(fetch[[:space:]]*\(|axios|node:https|node:http|McpRemote|remote/)' 'network or remote MCP client in local demo catalog'
reject_pattern "$SEED" '(baseUrl:[[:space:]]*["'\'']https?://|secretRef:[[:space:]]*["'\''][^"'\'']+)' 'remote URL or secret reference in local demo seed'
reject_pattern "$FRONTEND_MOCK" '(https?://|writeOperation:[[:space:]]*true|allowRuntimeExecution:[[:space:]]*true)' 'remote/write/runtime capability in frontend demo fixture'
require_pattern "$FRONTEND_MOCK" 'export const mockToolExecutionLogs: ToolExecutionLog[] = []' 'frontend demo has zero execution logs'
require_pattern "$DETAIL" 'Verificar precheck local' 'governed local precheck UI action'
require_pattern "$DETAIL" 'execução permitida: não' 'UI communicates blocked execution'
require_pattern "$HUB" 'Gerenciado por seed' 'dangerous Hub registration action is disabled'

require_exact_line "$ROOT_DIR/.env.example" 'MCP_REMOTE_ENABLED=false' 'root env keeps MCP remote disabled'
require_exact_line "$ROOT_DIR/.env.example" 'MCP_REMOTE_EXECUTION_ENABLED=false' 'root env keeps MCP remote execution disabled'
require_exact_line "$ROOT_DIR/.env.example" 'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' 'root env blocks MCP write tools'
require_exact_line "$ROOT_DIR/backend/.env.example" 'LLM_PROVIDERS_ENABLED=false' 'backend env keeps providers disabled'
require_exact_line "$ROOT_DIR/backend/.env.example" 'LLM_PROVIDER_EXECUTION_ENABLED=false' 'backend env keeps provider execution disabled'
require_exact_line "$ROOT_DIR/backend/.env.example" 'EMBEDDINGS_ENABLED=false' 'backend env keeps embeddings disabled'
require_exact_line "$ROOT_DIR/backend/.env.example" 'EMBEDDINGS_EXECUTION_ENABLED=false' 'backend env keeps embedding execution disabled'
require_exact_line "$ROOT_DIR/backend/.env.example" 'AGNO_ALLOW_REMOTE_MCP=false' 'backend env blocks remote MCP in Agno'

require_exact_line "$CI" \
  '        run: scripts/smoke-mcp-tools-governado-local-18d.sh --dry-run' \
  'CI invokes only the 18D dry-run smoke'
reject_pattern "$CI" 'scripts/preflight-mcp-tools-governado-local-18d\.sh' 'direct 18D preflight execution in CI'
reject_pattern "$CI" '(smoke-agno-real|smoke-chat-provider-real|--run-real|--execute-real)' 'real MCP/provider execution in CI'

bash -n "$PREFLIGHT"
bash -n "$SMOKE"
pass '18D Bash syntax checks passed'

printf '\n18D governed local MCP preflight summary: mode=%s PASS=%d FAIL=0 phase=18D localDemo=true catalogTools=3 bindings=3 precheckAllowed=false deployment=false migration=false remoteMcpExecution=false writeToolsAllowed=false externalNetworkAllowed=false realProviderExecution=false realEmbeddingsExecution=false realChatAgentRunExecution=false production=false secretsVersioned=false frontendTypecheckExpected=true frontendBuildExpected=true backendTypecheckExpected=true targetedTestsExpected=true\n' \
  "${MODE#--}" "$pass_count"
