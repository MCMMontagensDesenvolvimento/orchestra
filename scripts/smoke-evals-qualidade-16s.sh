#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_EVALS_QUALIDADE_SEGURANCA_16S.md"
EVAL_DIR="$ROOT_DIR/runtime/evals/16s"
RUNNER="$ROOT_DIR/scripts/evals-runtime-qualidade-16s.sh"
VALIDATOR="$EVAL_DIR/validate.mjs"
CI="$ROOT_DIR/.github/workflows/ci.yml"
SCHEMA="$ROOT_DIR/backend/prisma/schema.prisma"
MIGRATIONS="$ROOT_DIR/backend/prisma/migrations"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-evals-qualidade-16s.sh [--dry-run|--help]

The dry-run reads versioned files and invokes only the structural 16S validator. It never loads
.env files, contacts a provider/service/database, runs a migration, executes a tool or prints cases.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n16S quality/security static smoke summary: PASS=%d FAIL=1\n' "$pass_count" >&2
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

require_file "$RUNBOOK"
[ -d "$EVAL_DIR" ] || fail 'runtime/evals/16s is missing'
pass 'runtime/evals/16s exists'
require_file "$EVAL_DIR/README.md"
require_file "$VALIDATOR"
for file in cases.chat-rag.json cases.response-scope.json cases.mcp-readonly.json cases.corporate-readonly.json cases.security.json; do
  require_file "$EVAL_DIR/$file"
done
require_executable "$RUNNER"
require_file "$CI"
require_file "$SCHEMA"
[ -d "$MIGRATIONS" ] || fail 'backend/prisma/migrations is missing'
pass 'backend/prisma/migrations exists'

for mode in --dry-run --run-offline --report --help; do
  require_pattern "$RUNNER" "$mode" "runner mode $mode"
done
for forbidden in 'curl ' 'wget ' 'docker ' 'migrate dev' 'prisma migrate' 'printenv' 'set -x'; do
  reject_pattern "$RUNNER" "$forbidden" "runner forbidden command $forbidden"
done

require_pattern "$EVAL_DIR/cases.chat-rag.json" '"category": "rag_grounding"' 'RAG grounding cases'
require_pattern "$EVAL_DIR/cases.response-scope.json" '"category": "response_scope"' 'response scope cases'
require_pattern "$EVAL_DIR/cases.response-scope.json" '"responseScopeMode": "knowledge_only"' 'knowledge_only case'
require_pattern "$EVAL_DIR/cases.response-scope.json" '"responseScopeMode": "general_allowed"' 'general_allowed case'
require_pattern "$EVAL_DIR/cases.mcp-readonly.json" '"category": "mcp_readonly"' 'MCP read-only cases'
require_pattern "$EVAL_DIR/cases.mcp-readonly.json" '"mcp_flag_block"' 'MCP flag block case'
require_pattern "$EVAL_DIR/cases.mcp-readonly.json" '"mcp_write_block"' 'MCP write tool block case'
require_pattern "$EVAL_DIR/cases.corporate-readonly.json" '"category": "corporate_readonly"' 'corporate read-only cases'
require_pattern "$EVAL_DIR/cases.corporate-readonly.json" '"corporate_disabled_default"' 'corporate disabled-by-default case'
require_pattern "$EVAL_DIR/cases.corporate-readonly.json" '"corporate_unsafe_host"' 'corporate unsafe-host case'
require_pattern "$EVAL_DIR/cases.corporate-readonly.json" '"corporate_secretref_required"' 'corporate secretRef case'
require_pattern "$EVAL_DIR/cases.corporate-readonly.json" '"corporate_raw_payload"' 'corporate raw-payload case'
require_pattern "$EVAL_DIR/cases.corporate-readonly.json" '"supervised_approval_window"' 'supervised approval-window case'
require_pattern "$EVAL_DIR/cases.corporate-readonly.json" '"local_check_missing_allowlist"' 'local-check missing-allowlist case'
require_pattern "$EVAL_DIR/cases.corporate-readonly.json" '"local_check_https_origin"' 'local-check HTTPS-origin case'
require_pattern "$EVAL_DIR/cases.corporate-readonly.json" '"audit_query_no_raw_fields"' 'safe audit-query case'
require_pattern "$EVAL_DIR/cases.security.json" '"category": "prompt_injection"' 'prompt injection cases'
require_pattern "$EVAL_DIR/cases.security.json" '"category": "quota_enforcement"' 'quota enforcement case'
require_pattern "$EVAL_DIR/cases.security.json" '"category": "raw_payload_leakage"' 'raw payload leakage case'
require_pattern "$VALIDATOR" 'forbiddenMetadataFields' 'raw payload forbidden-field gate'
require_pattern "$VALIDATOR" 'governed-runtime-source-contracts' 'runtime source contract gate'
require_pattern "$VALIDATOR" 'supervised-audit-source-contract' 'supervised audit source-contract gate'

for section in \
  '## Objetivo' '## Escopo' '## Fora de escopo' '## Matriz de evals' \
  '## Gates obrigatórios' '## Critérios de aprovação' '## Como rodar localmente' \
  '## Como interpretar falhas' '## Política de regressão' '## Relação com a Fase 16R' \
  '## Por que o conector corporativo real vem depois' '## Rollback e remediação'
do
  require_pattern "$RUNBOOK" "$section" "runbook section $section"
done

require_pattern "$CI" 'scripts/evals-runtime-qualidade-16s.sh --dry-run' 'CI runs 16S dry-run'
reject_pattern "$CI" 'scripts/evals-runtime-qualidade-16s.sh --run-offline' 'CI offline evaluation mode'

for script in \
  smoke-e2e-chat-rag-mcp-16r.sh smoke-mcp-readonly-integracao-16q.sh \
  smoke-mcp-externo-readonly-16p.sh smoke-hardening-producao-runtime-16o.sh \
  preflight-prod-runtime-16o.sh smoke-custos-quotas-runtime-16n.sh \
  smoke-observabilidade-runtime-16m.sh smoke-chat-rag-operacional-16k.sh \
  smoke-knowledge-rag-16i.sh
do
  require_executable "$ROOT_DIR/scripts/$script"
done

if git -C "$ROOT_DIR" status --short -- backend/prisma/schema.prisma backend/prisma/migrations | grep -q .; then
  fail 'Prisma schema or migrations changed'
fi
pass 'Prisma schema and migrations unchanged'

if grep -ERn \
  '(sk-[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[^[:space:]]+)' \
  "$EVAL_DIR" >/dev/null; then
  fail 'apparent credential material detected in 16S eval artifacts'
fi
pass 'no apparent credential material in 16S eval artifacts'

if grep -ERn \
  '(postgres(ql)?|mysql|mongodb(\+srv)?):\/\/[^[:space:]]+' \
  "$EVAL_DIR" >/dev/null; then
  fail 'apparent connection string detected in 16S eval artifacts'
fi
pass 'no apparent connection string in 16S eval artifacts'

bash -n "$RUNNER"
bash -n "$ROOT_DIR/scripts/smoke-evals-qualidade-16s.sh"
node --check "$VALIDATOR"
pass '16S Bash and Node syntax checks passed'

"$RUNNER" --dry-run >/dev/null || fail '16S runner dry-run'
pass '16S runner dry-run'

printf '\n16S quality/security static smoke summary: PASS=%d FAIL=0\n' "$pass_count"
