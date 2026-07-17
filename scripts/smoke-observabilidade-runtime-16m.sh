#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_OBSERVABILIDADE_OPERACIONAL_RUNTIME_16M.md"
FRONTEND_SERVICE="$ROOT_DIR/frontend/src/services/analytics.service.ts"
FRONTEND_ENDPOINTS="$ROOT_DIR/frontend/src/services/api/endpoints.ts"
FRONTEND_PAGE="$ROOT_DIR/frontend/src/pages/Analytics/AnalyticsPage.tsx"
BACKEND_ROUTES="$ROOT_DIR/backend/src/modules/ai-observability/ai-observability.routes.ts"
BACKEND_REPOSITORY="$ROOT_DIR/backend/src/modules/ai-observability/runtime-observability.repository.ts"
BACKEND_MAPPER="$ROOT_DIR/backend/src/modules/ai-observability/runtime-observability.mapper.ts"
BACKEND_SCHEMA="$ROOT_DIR/backend/src/modules/ai-observability/runtime-observability.schema.ts"

pass_count=0

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\nRuntime observability 16M smoke summary: PASS=%d FAIL=1\n' "$pass_count" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: scripts/smoke-observabilidade-runtime-16m.sh [MODE]

Modes:
  --dry-run          Validate versioned routes, DTO allowlists, frontend integration and runbook (default).
  --print-checklist  Print the safe manual validation checklist.
  --help             Print this help.

This smoke only reads versioned files. It never loads .env files, calls endpoints, queries a
database, invokes providers, executes tools, prints persisted metadata or starts containers.
EOF
}

print_checklist() {
  cat <<'EOF'
Manual 16M checklist:
1. Authenticate with audit.read and open /app/analytics with VITE_USE_MOCKS=false.
2. Validate cards, pagination, every allowlisted filter and input_summary search.
3. Open runs with and without RAG metadata and verify the "Não informado" fallback.
4. Inspect the detail response and verify that only IDs, summaries, flags, counters and truncated RAG excerpts exist.
5. Repeat with a user without audit.read and an out-of-scope workspace; both must fail closed.
6. Do not capture prompts, context, provider payloads, document content, headers, cookies, tokens, API keys or secrets.
EOF
}

case "$MODE" in
  --dry-run) ;;
  --print-checklist)
    print_checklist
    exit 0
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

[ "$#" -le 1 ] || fail "only one mode can be selected"

require_file() {
  [ -f "$1" ] || fail "$1 is missing"
  pass "$(basename "$1") exists"
}

require_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  grep -Fq "$pattern" "$file" || fail "$label is missing"
  pass "$label"
}

reject_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -Fq "$pattern" "$file"; then
    fail "$label is present"
  fi
  pass "$label absent"
}

require_file "$RUNBOOK"
require_file "$FRONTEND_SERVICE"
require_file "$FRONTEND_ENDPOINTS"
require_file "$FRONTEND_PAGE"
require_file "$BACKEND_ROUTES"
require_file "$BACKEND_REPOSITORY"
require_file "$BACKEND_MAPPER"
require_file "$BACKEND_SCHEMA"
require_file "$ROOT_DIR/backend/tests/api/runtime-observability.test.ts"
require_file "$ROOT_DIR/scripts/smoke-knowledge-rag-16i.sh"
require_file "$ROOT_DIR/scripts/smoke-chat-rag-operacional-16k.sh"

require_pattern "$FRONTEND_SERVICE" 'apiClient.get<PaginatedApiEnvelope<RuntimeRunSummary>>' 'real paginated analytics API call'
require_pattern "$FRONTEND_SERVICE" 'endpoints.analytics.runtimeRuns' 'runtime runs endpoint usage'
require_pattern "$FRONTEND_SERVICE" 'endpoints.analytics.runtimeSummary' 'runtime summary endpoint usage'
require_pattern "$FRONTEND_SERVICE" 'if (env.useMocks)' 'mock mode remains explicit'
require_pattern "$FRONTEND_ENDPOINTS" "runtimeRuns: '/ai-observability/runtime-runs'" 'real runtime runs endpoint'
require_pattern "$FRONTEND_ENDPOINTS" "runtimeSummary: '/ai-observability/runtime-summary'" 'real runtime summary endpoint'

for field in \
  responseScopeMode \
  ragMode \
  ragIntentDetected \
  ragSkippedReason \
  fallbackOutsideKnowledgeUsed \
  rawContentLogged \
  externalProviderCalled \
  externalMcpCalled \
  toolCallsExecuted
do
  require_pattern "$FRONTEND_SERVICE" "$field" "frontend type $field"
  require_pattern "$FRONTEND_PAGE" "$field" "analytics UI $field"
  require_pattern "$BACKEND_MAPPER" "$field" "backend DTO $field"
done

require_pattern "$FRONTEND_PAGE" 'Runs recentes' 'recent runs UI'
require_pattern "$FRONTEND_PAGE" 'input_summary' 'input_summary UI'
require_pattern "$FRONTEND_PAGE" 'Não informado' 'missing metadata fallback'
require_pattern "$FRONTEND_PAGE" 'Eventos principais' 'run events drawer'
require_pattern "$FRONTEND_PAGE" 'Fontes RAG' 'RAG sources drawer'

require_pattern "$BACKEND_ROUTES" "'/runtime-runs'" 'runtime runs GET route'
require_pattern "$BACKEND_ROUTES" "'/runtime-runs/:id'" 'runtime run detail GET route'
require_pattern "$BACKEND_ROUTES" "'/runtime-summary'" 'runtime summary GET route'
require_pattern "$BACKEND_ROUTES" "requirePermission('audit.read')" 'audit.read RBAC'
require_pattern "$BACKEND_SCHEMA" ').strict()' 'strict filter allowlist'
require_pattern "$BACKEND_REPOSITORY" 'workspaceId: { in: workspaceIds }' 'workspace-scoped repository reads'
require_pattern "$BACKEND_REPOSITORY" "source: 'runtime_adapter'" 'runtime usage source isolation'
require_pattern "$BACKEND_MAPPER" 'safeString(result.excerpt, 240)' 'RAG excerpt truncation'

reject_pattern "$BACKEND_REPOSITORY" 'message: true' 'event message selection'
reject_pattern "$BACKEND_REPOSITORY" 'queryText: true' 'raw RAG query selection'
reject_pattern "$BACKEND_REPOSITORY" 'normalizedQuery: true' 'normalized RAG query selection'
reject_pattern "$BACKEND_REPOSITORY" 'content: true' 'document or chunk content selection'
reject_pattern "$BACKEND_REPOSITORY" 'precheckSnapshot: true' 'precheck snapshot selection'
reject_pattern "$BACKEND_MAPPER" 'prompt:' 'raw prompt DTO property'
reject_pattern "$BACKEND_MAPPER" 'context:' 'raw context DTO property'
reject_pattern "$BACKEND_MAPPER" 'providerPayload:' 'raw provider payload DTO property'
reject_pattern "$BACKEND_MAPPER" 'headers:' 'headers DTO property'
reject_pattern "$BACKEND_MAPPER" 'apiKey:' 'API key DTO property'

require_pattern "$RUNBOOK" 'Campos allowlistados' 'runbook allowlist section'
require_pattern "$RUNBOOK" 'Campos explicitamente proibidos' 'runbook prohibited fields section'
require_pattern "$RUNBOOK" 'Consultas SQL opcionais para comparação' 'runbook SQL comparison section'
require_pattern "$RUNBOOK" 'Validação manual' 'runbook manual validation section'
require_pattern "$RUNBOOK" 'Rollback' 'runbook rollback section'

printf '\nRuntime observability 16M smoke summary: PASS=%d FAIL=0\n' "$pass_count"
