#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_EXAMPLE="$ROOT_DIR/backend/.env.example"
DOC_FILE="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_KNOWLEDGE_RAG_OPERACIONAL_16I.md"

pass_count=0

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\nKnowledge/RAG 16I smoke summary: PASS=%d FAIL=1\n' "$pass_count" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: scripts/smoke-knowledge-rag-16i.sh [MODE]

Modes:
  --dry-run          Validate versioned files, env defaults, routes, docs and tests (default).
  --print-checklist  Print manual validation steps without secrets or payloads.
  --help             Print this help.

This smoke never loads .env files, calls network endpoints, invokes a provider, prints document
content, prints credentials, submits Chat, executes RAG queries, or starts containers.
EOF
}

print_checklist() {
  cat <<'EOF'
Manual 16I checklist:
1. Keep EMBEDDINGS_ENABLED=false unless testing the offline stub or an explicitly approved provider.
2. Upload a small TXT, MD and CSV file from the Knowledge Hub.
3. Request ingestion for each uploaded document and verify chunks/source references counters.
4. Open knowledge base readiness and confirm keyword readiness before binding to an assistant.
5. Bind only bases with allowRuntimeRetrieval=true and matching workspace.
6. Run Chat/RAG manually only after confirming no sensitive excerpts are captured in evidence.
7. Capture only status, counters, route names, timestamps and redacted screenshots.
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

env_value() {
  local file="$1"
  local name="$2"
  awk -F= -v key="$name" '$1 == key { sub(/^[^=]*=/, ""); print; found=1; exit } END { if (!found) exit 1 }' "$file"
}

expect_env_value() {
  local name="$1"
  local expected="$2"
  local value
  value="$(env_value "$BACKEND_EXAMPLE" "$name")" || fail "$name is missing from backend/.env.example"
  [ "$value" = "$expected" ] || fail "$name expected $expected"
  pass "$name=$expected"
}

require_file "$BACKEND_EXAMPLE"
require_file "$DOC_FILE"
require_file "$ROOT_DIR/backend/src/config/env.ts"
require_file "$ROOT_DIR/backend/src/modules/knowledge/knowledge.upload.ts"
require_file "$ROOT_DIR/backend/src/modules/knowledge/knowledge.config.ts"
require_file "$ROOT_DIR/backend/src/shared/policies/response-scope.ts"
require_file "$ROOT_DIR/backend/prisma/migrations/20260716160000_phase_16j_answer_scope_policy/migration.sql"
require_file "$ROOT_DIR/backend/src/modules/embeddings/providers/stub-embedding.provider.ts"
require_file "$ROOT_DIR/backend/tests/unit/knowledge-upload.test.ts"
require_file "$ROOT_DIR/backend/tests/unit/embedding-stub.test.ts"
require_file "$ROOT_DIR/frontend/src/pages/Knowledge/KnowledgeDetailPage.tsx"

expect_env_value EMBEDDINGS_ENABLED false
expect_env_value EMBEDDINGS_PROVIDER disabled
expect_env_value EMBEDDINGS_EXECUTION_ENABLED false
expect_env_value KNOWLEDGE_MAX_UPLOAD_BYTES 1048576
expect_env_value KNOWLEDGE_ALLOWED_FILE_TYPES txt,md,csv
expect_env_value KNOWLEDGE_RETRIEVAL_MODE hybrid
expect_env_value KNOWLEDGE_RETRIEVAL_MAX_TOP_K 5
expect_env_value KNOWLEDGE_RETRIEVAL_MAX_EXCERPT_CHARS 1200
expect_env_value KNOWLEDGE_RETRIEVAL_MAX_CONTEXT_CHARS 6000
expect_env_value AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED false

if grep -Fq 'EMBEDDING_PROVIDER=' "$BACKEND_EXAMPLE"; then
  fail "legacy singular EMBEDDING_PROVIDER remains in backend/.env.example"
fi
pass "legacy singular embedding env absent"

require_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.routes.ts" '/:id/documents/upload' 'upload route'
require_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.routes.ts" 'getKnowledgeUploadConfig().maxUploadBytes' 'upload route governed max bytes'
reject_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.routes.ts" '10_485_760' 'hardcoded upload route parser limit'
require_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.routes.ts" '/:id/policy' 'knowledge policy update route'
require_pattern "$ROOT_DIR/backend/src/config/env.ts" 'KNOWLEDGE_MAX_UPLOAD_BYTES: z.coerce.number().int().min(1024).max(10_485_760).default(1_048_576)' 'upload env bounds and default'
require_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.config.ts" 'maxUploadBytes: env.KNOWLEDGE_MAX_UPLOAD_BYTES' 'upload config uses governed env'
require_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.routes.ts" '/:id/readiness' 'base readiness route'
require_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.upload.ts" 'KNOWLEDGE_UPLOAD_BINARY_NOT_SUPPORTED' 'binary upload rejection'
require_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.repository.ts" 'knowledge_ingestion_unchanged' 'idempotent reingestion event'
require_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.repository.ts" 'allowRuntimeRetrieval' 'policy-gated readiness'
require_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.service.ts" 'RAG_RETRIEVAL_FAILED' 'fail-closed semantic retrieval'
require_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.service.ts" 'hybrid_stub_keyword_priority' 'hybrid stub keyword-priority retrieval mode'
require_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.service.ts" 'hybridMergeApplied' 'hybrid merge metadata'
require_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.service.ts" 'stubKeywordPriority' 'stub semantic auxiliary metadata'
require_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.service.ts" 'sourceNameFromUri' 'source filename normalization for ranking'
require_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.service.ts" 'termOccurrences' 'stopword-flexible phrase ranking'
require_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.repository.ts" 'sourceReferences: { some: { label:' 'source label lexical candidate search'
require_pattern "$ROOT_DIR/backend/src/modules/knowledge/knowledge.repository.ts" 'linkRagQueryToAgentRun' 'rag query linked to agent run'
require_pattern "$ROOT_DIR/backend/src/shared/policies/response-scope.ts" "defaultResponseScopeMode: ResponseScopeMode = 'knowledge_first'" 'versioned default response scope'
require_pattern "$ROOT_DIR/backend/src/modules/assistants/assistants.schema.ts" 'responseScopeMode: z.enum(responseScopeModeValues).optional()' 'assistant policy response scope schema'
require_pattern "$ROOT_DIR/backend/src/modules/assistants/assistants.mapper.ts" 'responseScopeModeFromMetadata' 'assistant policy response scope mapper'
require_pattern "$ROOT_DIR/backend/src/modules/assistants/assistants.repository.ts" 'mergeResponseScopeMetadata' 'assistant policy response scope metadata storage'
require_pattern "$ROOT_DIR/backend/prisma/schema.prisma" 'metadata                    Json?' 'assistant execution policy metadata schema'
require_pattern "$ROOT_DIR/backend/prisma/migrations/20260716160000_phase_16j_answer_scope_policy/migration.sql" 'ADD COLUMN "metadata" JSONB' 'assistant execution policy metadata migration'
require_pattern "$ROOT_DIR/backend/src/modules/agent-runs/agent-runs.service.ts" 'detectRuntimeRagIntent' 'runtime RAG intent detector'
require_pattern "$ROOT_DIR/backend/src/modules/agent-runs/agent-runs.service.ts" 'general_question_no_knowledge_signal' 'general question RAG skip reason'
require_pattern "$ROOT_DIR/backend/src/modules/agent-runs/agent-runs.service.ts" 'non_general_query_with_knowledge_bindings' 'knowledge-bound non-general RAG intent reason'
require_pattern "$ROOT_DIR/backend/src/modules/agent-runs/agent-runs.service.ts" 'runtime_rag_retrieval_skipped' 'RAG skipped audit event'
require_pattern "$ROOT_DIR/backend/src/modules/agent-runs/agent-runs.service.ts" 'fallbackOutsideKnowledgeUsed' 'outside knowledge fallback metadata'
require_pattern "$ROOT_DIR/backend/src/modules/agent-runs/agent-runs.service.ts" 'rawContentLogged: false' 'raw content logging disabled metadata'
require_pattern "$ROOT_DIR/backend/src/modules/agent-runs/agent-runs.service.ts" 'linkRagQueryToAgentRun' 'agent run persists rag query association'
require_pattern "$ROOT_DIR/backend/src/modules/runtime/runtime.assistant-spec.builder.ts" 'Se a resposta estiver no contexto RAG, responda diretamente.' 'RAG grounding instruction'
require_pattern "$ROOT_DIR/backend/src/modules/runtime/runtime.assistant-spec.builder.ts" 'buildResponseScopeInstructions' 'runtime response scope instructions'
require_pattern "$ROOT_DIR/backend/src/modules/runtime/runtime.assistant-spec.builder.ts" 'Pelo conhecimento geral do modelo' 'knowledge_first disclosure instruction'
require_pattern "$ROOT_DIR/backend/src/modules/runtime/runtime.agno-http-adapter.ts" 'responseScopeMode: context.responseScope.mode' 'Agno HTTP response scope metadata'
require_pattern "$ROOT_DIR/backend/tests/api/knowledge-mcp-catalog.test.ts" 'answers the five 16I homologation retrieval questions' '16I homologation retrieval test'
require_pattern "$ROOT_DIR/backend/tests/api/knowledge-mcp-catalog.test.ts" 'troca notebook' '16J notebook ranking test'
require_pattern "$ROOT_DIR/backend/tests/api/agent-runs.test.ts" 'skips governed RAG for a general question in knowledge_first' '16J knowledge_first general skip test'
require_pattern "$ROOT_DIR/backend/tests/api/agent-runs.test.ts" 'triggers governed RAG for FAQ intent even when general_allowed is configured' '16J FAQ RAG detector test'
require_pattern "$ROOT_DIR/backend/src/modules/embeddings/providers/stub-embedding.provider.ts" 'externalProviderCalled: false' 'offline stub metadata'
require_pattern "$ROOT_DIR/frontend/src/pages/Knowledge/KnowledgeDetailPage.tsx" 'accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"' 'frontend upload accept list'
require_pattern "$ROOT_DIR/frontend/src/pages/Knowledge/KnowledgeDetailPage.tsx" 'Habilitar retrieval em runtime' 'frontend runtime retrieval CTA'
require_pattern "$ROOT_DIR/frontend/src/pages/Knowledge/KnowledgeDetailPage.tsx" 'Solicitar embeddings' 'frontend document embeddings action'
require_pattern "$ROOT_DIR/frontend/src/pages/Knowledge/KnowledgeDetailPage.tsx" 'Solicitar embeddings da base' 'frontend base embeddings action'
require_pattern "$ROOT_DIR/frontend/src/pages/Knowledge/KnowledgeDetailPage.tsx" 'allowRuntimeRetrieval' 'frontend runtime policy field'
require_pattern "$ROOT_DIR/frontend/src/pages/Assistants/AssistantDetailPage.tsx" 'Escopo de resposta' 'frontend response scope selector'
require_pattern "$ROOT_DIR/frontend/src/types/index.ts" "ResponseScopeMode = 'knowledge_only' | 'knowledge_first' | 'general_allowed'" 'frontend response scope type'
require_pattern "$ROOT_DIR/frontend/src/hooks/queries/useKnowledge.ts" 'useUpdateKnowledgePolicyMutation' 'frontend policy mutation'
require_pattern "$ROOT_DIR/frontend/src/hooks/queries/useKnowledge.ts" 'useRequestKnowledgeDocumentEmbeddingsMutation' 'frontend document embeddings mutation'
require_pattern "$ROOT_DIR/frontend/src/hooks/queries/useKnowledge.ts" 'useRequestKnowledgeBaseEmbeddingsMutation' 'frontend base embeddings mutation'
require_pattern "$ROOT_DIR/frontend/src/services/api/endpoints.ts" 'requestDocumentEmbeddings' 'frontend document embeddings endpoint'
require_pattern "$ROOT_DIR/frontend/src/services/api/endpoints.ts" 'requestBaseEmbeddings' 'frontend base embeddings endpoint'
require_pattern "$DOC_FILE" 'Rollback seguro' 'rollback section'

printf '\nKnowledge/RAG 16I smoke summary: PASS=%d FAIL=0\n' "$pass_count"
