#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_CHAT_RAG_HOMOLOGACAO_OPERACIONAL_16K.md"
AGENT_RUNS_SERVICE="$ROOT_DIR/backend/src/modules/agent-runs/agent-runs.service.ts"
RUNTIME_BUILDER="$ROOT_DIR/backend/src/modules/runtime/runtime.assistant-spec.builder.ts"
RUNTIME_EVENTS="$ROOT_DIR/backend/src/modules/runtime/runtime.events.ts"
KNOWLEDGE_SERVICE="$ROOT_DIR/backend/src/modules/knowledge/knowledge.service.ts"
MATRIX_TESTS="$ROOT_DIR/backend/tests/api/agent-runs.test.ts"

pass_count=0

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\nChat/RAG operational 16K smoke summary: PASS=%d FAIL=1\n' "$pass_count" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: scripts/smoke-chat-rag-operacional-16k.sh [MODE]

Modes:
  --dry-run          Validate governed runtime markers, the 16K matrix, runbook and SQL evidence (default).
  --print-checklist  Print the manual homologation checklist without payloads or credentials.
  --help             Print this help.

This smoke only reads versioned files. It never loads .env files, calls network endpoints,
invokes providers, queries a database, starts containers, or prints prompts and document content.
EOF
}

print_checklist() {
  cat <<'EOF'
Manual 16K checklist:
1. Run the 16K and 16I smoke scripts in --dry-run mode.
2. Run the backend matrix tests and backend/frontend typechecks documented in the runbook.
3. In an authorized environment, exercise the eight response-scope scenarios with synthetic data.
4. Audit recent agent_runs and RAG results with tenant/workspace/time filters.
5. Capture only IDs, timestamps, statuses, counters, governed modes and redacted evidence.
6. Do not capture prompts, full query text, full excerpts, headers, tokens, credentials or API keys.
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

require_file "$RUNBOOK"
require_file "$AGENT_RUNS_SERVICE"
require_file "$RUNTIME_BUILDER"
require_file "$RUNTIME_EVENTS"
require_file "$KNOWLEDGE_SERVICE"
require_file "$MATRIX_TESTS"

require_pattern "$AGENT_RUNS_SERVICE" 'responseScopeMode' 'responseScopeMode runtime metadata'
require_pattern "$AGENT_RUNS_SERVICE" 'ragIntentDetected' 'ragIntentDetected runtime metadata'
require_pattern "$AGENT_RUNS_SERVICE" 'ragSkippedReason' 'ragSkippedReason runtime metadata'
require_pattern "$AGENT_RUNS_SERVICE" 'fallbackOutsideKnowledgeUsed' 'fallbackOutsideKnowledgeUsed runtime metadata'
require_pattern "$AGENT_RUNS_SERVICE" 'rawContentLogged: false' 'rawContentLogged=false invariant'
require_pattern "$AGENT_RUNS_SERVICE" 'non_general_query_with_knowledge_bindings' 'non-general knowledge-binding intent reason'
require_pattern "$AGENT_RUNS_SERVICE" 'response_scope_question' 'response-scope question skip reason'
require_pattern "$AGENT_RUNS_SERVICE" 'general_question_no_knowledge_signal' 'general-question skip reason'
require_pattern "$RUNTIME_BUILDER" 'rawContentLogged: false' 'runtime spec raw-content invariant'
require_pattern "$RUNTIME_EVENTS" 'runtime.rag_context_attached' 'governed RAG attached event'
require_pattern "$KNOWLEDGE_SERVICE" 'hybrid_stub_keyword_priority' 'hybrid stub keyword-priority retrieval'

require_pattern "$MATRIX_TESTS" '16K matrix: knowledge_first with a knowledge-base question sends RAG resolved_context' 'knowledge_first base-question matrix test'
require_pattern "$MATRIX_TESTS" '16K matrix: knowledge_first with a general Brazil states question skips RAG and marks fallback' 'knowledge_first Brazil-states matrix test'
require_pattern "$MATRIX_TESTS" '16K matrix: knowledge_first with an outside-base question skips RAG as response_scope_question' 'knowledge_first outside-base matrix test'
require_pattern "$MATRIX_TESTS" '16K matrix: knowledge_only with a general Brazil states question stays limited to the base' 'knowledge_only Brazil-states matrix test'
require_pattern "$MATRIX_TESTS" '16K matrix: knowledge_only with an outside-base question stays limited and skips RAG' 'knowledge_only outside-base matrix test'
require_pattern "$MATRIX_TESTS" '16K matrix: general_allowed with a general Brazil states question skips RAG without fallback' 'general_allowed Brazil-states matrix test'
require_pattern "$MATRIX_TESTS" '16K matrix: general_allowed with troca de notebook sends RAG resolved_context' 'general_allowed notebook-change matrix test'
require_pattern "$MATRIX_TESTS" '16K matrix: general_allowed with explicit FAQ intent sends RAG resolved_context' 'general_allowed explicit-FAQ matrix test'
require_pattern "$MATRIX_TESTS" "input: 'me fale sobre troca de notebook'" 'notebook-change test input'
require_pattern "$MATRIX_TESTS" "input: 'Liste todos os estados do Brasil.'" 'Brazil-states test input'
require_pattern "$MATRIX_TESTS" "input: 'pode procurar fora da base?'" 'outside-base test input'

require_pattern "$RUNBOOK" 'Auditoria de `agent_runs` recentes' 'agent_runs SQL audit section'
require_pattern "$RUNBOOK" 'Auditoria de `rag_queries` e `rag_query_results`' 'RAG SQL audit section'
require_pattern "$RUNBOOK" 'rawContentLogged' 'runbook raw-content evidence field'
require_pattern "$RUNBOOK" 'hybridMergeApplied' 'runbook hybrid merge evidence field'
require_pattern "$RUNBOOK" 'stubKeywordPriority' 'runbook stub keyword-priority evidence field'
require_pattern "$RUNBOOK" 'Rollback seguro' 'runbook rollback section'

printf '\nChat/RAG operational 16K smoke summary: PASS=%d FAIL=0\n' "$pass_count"
