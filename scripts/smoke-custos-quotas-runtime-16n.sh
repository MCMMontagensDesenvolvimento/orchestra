#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_CUSTOS_QUOTAS_RUNTIME_16N.md"
AGENT_SERVICE="$ROOT_DIR/backend/src/modules/agent-runs/agent-runs.service.ts"
AGENT_TEST="$ROOT_DIR/backend/tests/api/agent-runs.test.ts"
USAGE_SERVICE="$ROOT_DIR/backend/src/modules/ai-observability/ai-observability.service.ts"
RUNTIME_REPOSITORY="$ROOT_DIR/backend/src/modules/ai-observability/runtime-observability.repository.ts"
RUNTIME_MAPPER="$ROOT_DIR/backend/src/modules/ai-observability/runtime-observability.mapper.ts"
RUNTIME_SCHEMA="$ROOT_DIR/backend/src/modules/ai-observability/runtime-observability.schema.ts"
RUNTIME_TEST="$ROOT_DIR/backend/tests/api/runtime-observability.test.ts"
FRONTEND_SERVICE="$ROOT_DIR/frontend/src/services/analytics.service.ts"
FRONTEND_PAGE="$ROOT_DIR/frontend/src/pages/Analytics/AnalyticsPage.tsx"

pass_count=0

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\nCosts and quotas runtime 16N smoke summary: PASS=%d FAIL=1\n' "$pass_count" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: scripts/smoke-custos-quotas-runtime-16n.sh [MODE]

Modes:
  --dry-run          Validate the static 16N enforcement, allowlist, UI, tests and runbook (default).
  --print-checklist  Print the safe manual validation checklist.
  --help             Print this help.

This smoke reads versioned files only. It does not load .env files, query a database, invoke
providers, execute tools, alter policies or print persisted metadata.
EOF
}

print_checklist() {
  cat <<'EOF'
Manual 16N checklist:
1. Validate no-policy, monitor_only below/exceeded and enforce below/exceeded scenarios in an isolated environment.
2. Confirm enforce blocks before RAG, adapter health, Agno/provider and MCP/tool calls.
3. Inspect AgentRun, AgentRunEvent, AiRunUsageEvent and AuditLog using only the runbook allowlist.
4. Confirm /app/analytics cards, blocked filter, mode/blocked badges, limit detail and missing-data fallbacks.
5. Show cost only when currency and minor units were both persisted.
6. Never capture raw prompt, input, RAG/conversation context, provider payload, headers, cookies, tokens, API keys or secrets.
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

line_of() {
  local file="$1"
  local pattern="$2"
  grep -nF "$pattern" "$file" | head -1 | cut -d: -f1
}

require_before() {
  local file="$1"
  local first="$2"
  local second="$3"
  local label="$4"
  local first_line second_line
  first_line="$(line_of "$file" "$first")"
  second_line="$(line_of "$file" "$second")"
  [ -n "$first_line" ] && [ -n "$second_line" ] && [ "$first_line" -lt "$second_line" ] \
    || fail "$label is not ordered safely"
  pass "$label"
}

for file in \
  "$RUNBOOK" \
  "$AGENT_SERVICE" \
  "$AGENT_TEST" \
  "$USAGE_SERVICE" \
  "$RUNTIME_REPOSITORY" \
  "$RUNTIME_MAPPER" \
  "$RUNTIME_SCHEMA" \
  "$RUNTIME_TEST" \
  "$FRONTEND_SERVICE" \
  "$FRONTEND_PAGE" \
  "$ROOT_DIR/scripts/smoke-observabilidade-runtime-16m.sh" \
  "$ROOT_DIR/scripts/smoke-chat-rag-operacional-16k.sh" \
  "$ROOT_DIR/scripts/smoke-knowledge-rag-16i.sh"
do
  require_file "$file"
done

require_pattern "$AGENT_SERVICE" 'evaluateAiUsageLimits({' 'usage limit evaluator call in AgentRun'
require_pattern "$AGENT_SERVICE" "projectedUsage: { runCount: 1n }" 'known preflight run projection'
require_before "$AGENT_SERVICE" 'const usageLimitPrecheck = await evaluateRunUsageLimits({' 'const runtimeConfig = getRuntimeConfig();' 'usage limit evaluation before runtime/RAG configuration'
require_before "$AGENT_SERVICE" 'if (usageLimitPrecheck.metadata.usageLimitBlocked)' 'const runtimeContext = await buildRuntimeExecutionContext({' 'enforce block before runtime context'
require_before "$AGENT_SERVICE" 'if (usageLimitPrecheck.metadata.usageLimitBlocked)' 'runtimeResult = await runtimeService.execute(runtimeContext);' 'enforce block before runtime execute'

for field in \
  usageLimitEvaluationApplied \
  usageLimitMode \
  usageLimitExceeded \
  usageLimitEnforced \
  usageLimitBlocked \
  usageLimitMetric \
  usageLimitScope \
  usageLimitPolicyId \
  usageLimitWindow \
  usageLimitCurrentValue \
  usageLimitThreshold \
  usageLimitReason
do
  require_pattern "$AGENT_SERVICE" "$field" "AgentRun metadata $field"
  require_pattern "$RUNTIME_MAPPER" "$field" "runtime DTO $field"
  require_pattern "$FRONTEND_SERVICE" "$field" "frontend contract $field"
  require_pattern "$FRONTEND_PAGE" "$field" "analytics UI $field"
done

require_pattern "$AGENT_SERVICE" "type: 'run.usage_limit_evaluated'" 'usage limit evaluated event'
require_pattern "$AGENT_SERVICE" "type: 'run.usage_limit_violation'" 'monitor_only violation event'
require_pattern "$AGENT_SERVICE" "type: 'run.usage_limit_blocked'" 'enforce blocked event'
require_pattern "$AGENT_SERVICE" "action: 'agent_run_usage_limit_evaluated'" 'policy evaluated audit'
require_pattern "$AGENT_SERVICE" "action: 'agent_run_usage_limit_monitor_violation'" 'monitor_only violation audit'
require_pattern "$AGENT_SERVICE" "action: 'agent_run_usage_limit_blocked'" 'enforce blocked audit'
require_pattern "$AGENT_SERVICE" "action: 'agent_run_usage_limit_evaluator_failed'" 'evaluator failure audit'
require_pattern "$AGENT_SERVICE" 'metadata: sanitizeMetadata({' 'audit metadata sanitization'

require_pattern "$AGENT_TEST" "allows and audits an exceeded monitor_only usage limit" 'monitor_only non-blocking test'
require_pattern "$AGENT_TEST" "blocks an exceeded enforce usage limit before RAG, runtime, provider or tools" 'pre-runtime enforce test'
require_pattern "$AGENT_TEST" "expect(executeSpy).not.toHaveBeenCalled()" 'runtime not called assertion'
require_pattern "$AGENT_TEST" "expect(fetchSpy).not.toHaveBeenCalled()" 'provider not called assertion'
require_pattern "$AGENT_TEST" "expect(mocks.knowledgeService.queryRag).not.toHaveBeenCalled()" 'RAG not called assertion'

require_pattern "$RUNTIME_REPOSITORY" "type: 'run.usage_limit_blocked'" 'indexed blocked-run summary/filter'
require_pattern "$RUNTIME_REPOSITORY" "type: 'run.usage_limit_violation'" 'indexed monitor_only summary'
require_pattern "$RUNTIME_SCHEMA" 'usageLimitBlocked: optionalBooleanQuery' 'strict blocked filter'
require_pattern "$FRONTEND_PAGE" 'Bloqueados por limite' 'blocked runs card'
require_pattern "$FRONTEND_PAGE" 'Violações monitor_only' 'monitor_only violations card'

require_pattern "$AGENT_SERVICE" 'costCurrency: costCurrencyValue(usage?.costCurrency)' 'normalized runtime cost currency persistence'
require_pattern "$AGENT_SERVICE" 'estimatedCostMinorUnits: costMinorUnitsValue(usage?.estimatedCostMinorUnits)' 'normalized runtime minor units persistence'
require_pattern "$USAGE_SERVICE" 'const hasReliableCostPair' 'incomplete cost pair rejection'
require_pattern "$RUNTIME_MAPPER" 'if (!usage?.costCurrency || usage.estimatedCostMinorUnits === null) return null;' 'persisted cost pair gate'
require_pattern "$RUNTIME_MAPPER" 'costMinorUnits' 'cost minor units DTO'
require_pattern "$RUNTIME_MAPPER" 'costCurrency' 'cost currency DTO'
require_pattern "$RUNTIME_TEST" 'exposes cost only when persisted currency and minor units are both present' 'cost visibility test'

reject_pattern "$RUNTIME_REPOSITORY" 'message: true' 'event message selection'
reject_pattern "$RUNTIME_REPOSITORY" 'queryText: true' 'raw RAG query selection'
reject_pattern "$RUNTIME_REPOSITORY" 'normalizedQuery: true' 'normalized RAG query selection'
reject_pattern "$RUNTIME_REPOSITORY" 'content: true' 'raw document or chunk selection'
reject_pattern "$RUNTIME_MAPPER" 'prompt:' 'raw prompt DTO property'
reject_pattern "$RUNTIME_MAPPER" 'input:' 'raw input DTO property'
reject_pattern "$RUNTIME_MAPPER" 'context:' 'raw context DTO property'
reject_pattern "$RUNTIME_MAPPER" 'providerPayload:' 'raw provider payload DTO property'
reject_pattern "$RUNTIME_MAPPER" 'headers:' 'headers DTO property'
reject_pattern "$RUNTIME_MAPPER" 'apiKey:' 'API key DTO property'

for section in \
  '## Objetivo' \
  '## Escopo' \
  '## Arquitetura de decisão' \
  '## Momento da avaliação no AgentRun' \
  '## `monitor_only` e `enforce`' \
  '## Metadata e campos allowlistados' \
  '## Campos explicitamente proibidos' \
  '## Critérios de aceite' \
  '## Consultas SQL para auditoria' \
  '## Roteiro de teste manual' \
  '## Rollback'
do
  require_pattern "$RUNBOOK" "$section" "runbook section $section"
done

if git -C "$ROOT_DIR" diff --name-only -- backend/prisma/schema.prisma backend/prisma/migrations | grep -q .; then
  fail "Prisma schema or migrations changed"
fi
pass 'Prisma schema and migrations unchanged'

printf '\nCosts and quotas runtime 16N smoke summary: PASS=%d FAIL=0\n' "$pass_count"
