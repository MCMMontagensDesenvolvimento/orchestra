#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PRIMEIRA_EXECUCAO_REAL_TOOL_STATUS_16W.md"
DOC_INDEX="$ROOT_DIR/docs/ai-orchestration/README.md"
STATE_DOC="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_ESTADO_ATUAL_PROJETO.md"
DOC_16T="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_CONECTOR_CORPORATIVO_READONLY_16T.md"
DOC_16U="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_HOMOLOGACAO_SUPERVISIONADA_CONECTOR_READONLY_16U.md"
DOC_16V="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_ENDPOINT_STATUS_READONLY_16V.md"
HARNESS="$ROOT_DIR/scripts/homologacao-primeira-tool-status-16w.sh"
SMOKE="$ROOT_DIR/scripts/smoke-primeira-tool-status-16w.sh"
CI_FILE="$ROOT_DIR/.github/workflows/ci.yml"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
ENV_CONFIG="$ROOT_DIR/backend/src/config/env.ts"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
TRANSPORT="$ROOT_DIR/backend/src/modules/mcp/remote/corporate-readonly/corporate-readonly.transport.ts"
POLICY="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-readonly-policy.ts"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-primeira-tool-status-16w.sh [--dry-run|--help]

The dry-run performs static/offline checks only. It never contacts a service or database,
starts a process/container, resolves credentials, executes a tool, runs a migration or calls
an LLM provider.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n16W first-tool smoke summary: PASS=%d FAIL=1 realExecution=false\n' "$pass_count" >&2
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

reject_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -Eq -- "$pattern" "$file"; then fail "$label is present"; fi
  pass "$label is absent"
}

case "$MODE" in
  --dry-run) ;;
  --help|-h) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac
[ "$#" -le 1 ] || fail 'only one mode can be selected'

for file in \
  "$RUNBOOK" "$DOC_INDEX" "$STATE_DOC" "$DOC_16T" "$DOC_16U" "$DOC_16V" \
  "$CI_FILE" "$ROOT_ENV" "$BACKEND_ENV" "$ENV_CONFIG" \
  "$PROD_COMPOSE" "$TRANSPORT" "$POLICY"
do
  require_file "$file"
done
require_executable "$HARNESS"
require_executable "$SMOKE"

for section in \
  '## Objetivo' '## Escopo' '## Fora de escopo' '## Pré-requisitos' \
  '## Relação com 16T, 16U e 16V' '## Matriz de decisão local HTTP vs HTTPS homologado' \
  '## Variáveis de ambiente necessárias' '## `MCP_CORPORATE_READONLY_ALLOWED_ORIGIN`' \
  '## `MCP_CORPORATE_READONLY_ORIGIN` no preflight 16U' '## Endpoint e secret fora do Git' \
  '## Passo a passo local' '## Passo a passo para ambiente HTTPS homologado' \
  '## Evidências esperadas' '## Consultas SQL/audit seguras' '## Rollback' \
  '## Critérios de aceite' '## Riscos remanescentes' '## Próximo passo sugerido'
do
  require_pattern "$RUNBOOK" "$section" "runbook section $section"
done
require_pattern "$RUNBOOK" 'Opção C' 'runbook records the local HTTP decision'
require_pattern "$RUNBOOK" 'realExecution=false' 'runbook records no real execution'

for file in "$DOC_INDEX" "$STATE_DOC" "$DOC_16T" "$DOC_16U" "$DOC_16V"; do
  require_pattern "$file" '16W' "${file#"$ROOT_DIR/"} references phase 16W"
done
require_pattern "$DOC_INDEX" 'Nenhuma chamada real ocorreu' \
  'documentation index records no real execution'
require_pattern "$STATE_DOC" 'Nenhuma chamada real ocorreu' \
  'current-state document records no real execution'
require_pattern "$DOC_16T" 'MCP/Tool real para sistemas sensíveis' \
  '16T keeps sensitive systems out of scope'
require_pattern "$DOC_16U" 'teste visual MCP/Assistant' \
  '16U defers complete visual validation'
require_pattern "$DOC_16V" '`--run-once-local` não foi implementado' \
  '16V records the rejected local live mode'

for mode in --dry-run --prepare-local --local-check --audit-template --help; do
  require_pattern "$HARNESS" "$mode" "homologation mode $mode"
done
reject_pattern "$HARNESS" '--run-once-local' 'unsafe local live-execution mode'
require_pattern "$RUNBOOK" '`--run-once-local` não foi implementado' \
  'runbook records the rejected local live mode'

dry_run_body="$(
  sed -n '/^run_dry_run() {$/,/^}$/p' "$HARNESS"
)"
if grep -Eiq -- '(^|[^[:alnum:]_])(curl|wget)([^[:alnum:]_]|$)|docker[[:space:]]+exec|npm[[:space:]]+start|fetch[[:space:]]*[(]' \
  <<<"$dry_run_body"
then
  fail 'homologation dry-run contains a network/process-start command'
fi
pass 'homologation dry-run has no network/process-start command'

require_pattern "$CI_FILE" 'scripts/smoke-primeira-tool-status-16w.sh --dry-run' \
  'CI runs the 16W smoke only in dry-run mode'
reject_pattern "$CI_FILE" 'smoke-primeira-tool-status-16w\.sh[[:space:]]+(--run-once-local|--prepare-local|--local-check|--audit-template)' \
  'CI non-dry 16W mode'
reject_pattern "$CI_FILE" 'homologacao-primeira-tool-status-16w\.sh' \
  'CI direct 16W homologation harness call'

ci_16w_step="$(
  awk '
    /name: Run 16W first-tool static gate/ { capture = 1 }
    capture { print }
    capture && /^[[:space:]]*-[[:space:]]+name:/ && !/Run 16W first-tool static gate/ { exit }
  ' "$CI_FILE"
)"
if grep -Eiq -- 'curl|wget|docker[[:space:]]+(exec|run|compose)|openai|https?://' <<<"$ci_16w_step"; then
  fail 'CI 16W step contains a live/external command'
fi
pass 'CI 16W step is static and provider-free'

for file in "$ROOT_ENV" "$BACKEND_ENV"; do
  require_pattern "$file" 'MCP_REMOTE_ENABLED=false' "${file#"$ROOT_DIR/"} remote MCP disabled"
  require_pattern "$file" 'MCP_REMOTE_EXECUTION_ENABLED=false' "${file#"$ROOT_DIR/"} remote execution disabled"
  require_pattern "$file" 'MCP_REMOTE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} remote read-only disabled"
  require_pattern "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' "${file#"$ROOT_DIR/"} allowlist empty"
  require_pattern "$file" 'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' "${file#"$ROOT_DIR/"} write tools disabled"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} corporate adapter disabled"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' "${file#"$ROOT_DIR/"} corporate origin empty"
  if grep -En '^MCP_(REMOTE_EGRESS_ALLOWLIST|CORPORATE_READONLY_ALLOWED_ORIGIN)=.+$' "$file" >/dev/null; then
    fail "${file#"$ROOT_DIR/"} versions a remote endpoint"
  fi
  pass "${file#"$ROOT_DIR/"} has no versioned remote endpoint"
done

require_pattern "$ENV_CONFIG" "MCP_REMOTE_ENABLED: booleanString('false')" \
  'backend remote MCP fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_REMOTE_EXECUTION_ENABLED: booleanString('false')" \
  'backend remote execution fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_REMOTE_READONLY_ENABLED: booleanString('false')" \
  'backend remote read-only fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_REMOTE_ALLOW_WRITE_TOOLS: booleanString('false')" \
  'backend write tools fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_CORPORATE_READONLY_ENABLED: booleanString('false')" \
  'backend corporate adapter fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: z.string().default('')" \
  'backend corporate origin empty default'

require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_ENABLED: "false"' 'production remote MCP disabled'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_EXECUTION_ENABLED: "false"' 'production remote execution disabled'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_READONLY_ENABLED: "false"' 'production remote read-only disabled'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_ALLOW_WRITE_TOOLS: "false"' 'production write tools disabled'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_EGRESS_ALLOWLIST: ""' 'production allowlist empty'
require_pattern "$PROD_COMPOSE" 'MCP_CORPORATE_READONLY_ENABLED: "false"' 'production corporate adapter disabled'
require_pattern "$PROD_COMPOSE" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: ""' 'production corporate origin empty'

require_pattern "$TRANSPORT" "corporateReadonlyToolName = 'corporate.status.read'" \
  'only corporate status tool remains fixed'
require_pattern "$TRANSPORT" "allowedScopes = new Set(['summary', 'availability'])" \
  'only fixed status scopes remain allowed'
require_pattern "$TRANSPORT" "method: 'GET'" 'corporate transport remains GET-only'
require_pattern "$TRANSPORT" "'/health'" 'fixed health path'
require_pattern "$TRANSPORT" "'/v1/status'" 'fixed status path'
require_pattern "$TRANSPORT" "'/v1/status/availability'" 'fixed availability path'
reject_pattern "$TRANSPORT" "method:[[:space:]]*'(POST|PUT|PATCH|DELETE)'" \
  'corporate transport write method'
status_paths="$(
  grep -oE "'/(health|v1/[^']*)'" "$TRANSPORT" \
    | tr -d "'" \
    | sort -u \
    | paste -sd, -
)"
[ "$status_paths" = '/health,/v1/status,/v1/status/availability' ] \
  || fail "corporate transport contains an unexpected status path: $status_paths"
pass 'corporate transport contains only the three fixed status paths'
require_pattern "$POLICY" 'hasDangerousMcpRemoteOperation(input.tool)' \
  'write-like remote operations remain blocked'
require_pattern "$POLICY" "return block('dangerous_operation')" \
  'dangerous remote operation fail-closed result'

if grep -ERn \
  '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})' \
  "$RUNBOOK" "$HARNESS" "$SMOKE" >/dev/null
then
  fail 'apparent credential material detected in 16W artifacts'
fi
pass 'no apparent credential material in 16W artifacts'

sql_template="$("$HARNESS" --audit-template)" || fail 'audit SQL template generation'
for field in \
  runId status externalMcpCalled simulated mcpRemoteAllowed mcpRemoteBlocked \
  mcpRemoteBlockedReason mcpRemoteHost mcpRemoteToolId responseBytes latencyMs rawContentLogged
do
  grep -Fq -- "\"$field\"" <<<"$sql_template" || fail "audit SQL field $field is missing"
done
pass 'audit SQL contains every allowlisted field'
[ "$(grep -cE ' AS "[A-Za-z]+"' <<<"$sql_template")" -eq 12 ] \
  || fail 'audit SQL must expose exactly twelve fields'
pass 'audit SQL exposes exactly twelve fields'
if grep -Eiq -- '(^|[^A-Za-z])(prompt|context|args|output|body|headers|Authorization|secretRef|apiKey|password|connectionString)([^A-Za-z]|$)' \
  <<<"$sql_template"
then
  fail 'audit SQL contains a forbidden raw/sensitive field'
fi
pass 'audit SQL excludes forbidden raw/sensitive fields'
if grep -Eiq -- 'select[[:space:]]+\*|metadata[[:space:]]*(,|from)' <<<"$sql_template"; then
  fail 'audit SQL contains an unrestricted projection'
fi
pass 'audit SQL has no unrestricted projection'
grep -Fq -- "WHERE id = :'run_id'::uuid" <<<"$sql_template" \
  || fail 'audit SQL must require one explicit run_id'
pass 'audit SQL is scoped to one explicit run_id'

if git -C "$ROOT_DIR" status --short -- backend/prisma/schema.prisma backend/prisma/migrations | grep -q .; then
  fail 'Prisma schema or migrations changed'
fi
pass 'Prisma schema and migrations are unchanged'

bash -n "$HARNESS"
bash -n "$SMOKE"
pass '16W Bash syntax checks passed'

"$HARNESS" --dry-run >/dev/null || fail '16W homologation dry-run'
pass '16W homologation dry-run passed'

for regression in \
  'smoke-endpoint-status-readonly-16v.sh --dry-run' \
  'smoke-homologacao-conector-readonly-16u.sh --dry-run' \
  'smoke-conector-corporativo-readonly-16t.sh --dry-run' \
  'evals-runtime-qualidade-16s.sh --dry-run'
do
  read -r script argument <<<"$regression"
  "$ROOT_DIR/scripts/$script" "$argument" >/dev/null \
    || fail "regression $script $argument"
  pass "regression $script $argument"
done

printf '\n16W first-tool smoke summary: PASS=%d FAIL=0 realExecution=false\n' "$pass_count"
