#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_READINESS_HTTPS_TOOL_STATUS_16Y.md"
READINESS="$ROOT_DIR/scripts/readiness-https-tool-status-16y.sh"
SMOKE="$ROOT_DIR/scripts/smoke-readiness-https-tool-status-16y.sh"
CI="$ROOT_DIR/.github/workflows/ci.yml"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
ENV_CONFIG="$ROOT_DIR/backend/src/config/env.ts"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
TRANSPORT="$ROOT_DIR/backend/src/modules/mcp/remote/corporate-readonly/corporate-readonly.transport.ts"
FACTORY="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-transport.factory.ts"
EGRESS="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-egress.ts"
DOC_INDEX="$ROOT_DIR/docs/ai-orchestration/README.md"
STATE_DOC="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_ESTADO_ATUAL_PROJETO.md"
DOC_16X="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_ALINHAMENTO_TOOL_STATUS_ENDPOINT_16X.md"
DOC_16W="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PRIMEIRA_EXECUCAO_REAL_TOOL_STATUS_16W.md"
DOC_16V="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_ENDPOINT_STATUS_READONLY_16V.md"
DOC_16U="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_HOMOLOGACAO_SUPERVISIONADA_CONECTOR_READONLY_16U.md"
DOC_16T="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_CONECTOR_CORPORATIVO_READONLY_16T.md"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-readiness-https-tool-status-16y.sh [--dry-run|--help]

The dry-run reads versioned files and invokes only offline regression gates. It never loads
operational variables, contacts DNS/network/database, resolves credentials, starts a service,
executes MCP, calls a provider, runs a migration or performs a real status request.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n16Y HTTPS readiness smoke summary: PASS=%d FAIL=1 structuralReadiness=false realExecution=false\n' \
    "$pass_count" >&2
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
  "$RUNBOOK" "$READINESS" "$SMOKE" "$CI" "$ROOT_ENV" "$BACKEND_ENV" \
  "$ENV_CONFIG" "$PROD_COMPOSE" "$TRANSPORT" "$FACTORY" "$EGRESS" \
  "$DOC_INDEX" "$STATE_DOC" "$DOC_16X" "$DOC_16W" "$DOC_16V" "$DOC_16U" "$DOC_16T"
do
  require_file "$file"
done
require_executable "$READINESS"
require_executable "$SMOKE"

HELP_OUTPUT="$("$READINESS" --help)"
for mode in --dry-run --local-check --https-template --audit-template --help; do
  grep -Fq -- "$mode" <<<"$HELP_OUTPUT" || fail "readiness mode $mode"
  pass "readiness mode $mode"
done
reject_pattern "$READINESS" '(^|[[:space:]])--(run|live|run-once)([[:space:]]|$)' \
  'live readiness mode'

if grep -En \
  '^[[:space:]]*(command[[:space:]]+)?(/[^[:space:]]*/)?(curl|wget|nc|ncat|telnet|ssh)[[:space:]]' \
  "$READINESS" >/dev/null
then
  fail 'readiness script contains an executable network command'
fi
pass 'readiness script contains no executable network command'
reject_pattern "$READINESS" \
  '(/dev/(tcp|udp)|(^|[^[:alnum:]_])(fetch|request|connect|lookup)[[:space:]]*\()' \
  'network API in readiness script'
reject_pattern "$READINESS" \
  '^[[:space:]]*(env([[:space:]]|$)|printenv([[:space:]]|$)|set[[:space:]]+-x([[:space:]]|$)|export[[:space:]]+-p([[:space:]]|$)|cat[[:space:]]+/proc/[^/]+/environ)' \
  'complete environment dump in readiness script'
reject_pattern "$READINESS" \
  '(^|[;&|])[[:space:]]*(npx[[:space:]]+)?prisma[[:space:]]+(migrate|db[[:space:]]+push)' \
  'migration command in readiness script'

READINESS_DRY_OUTPUT="$("$READINESS" --dry-run)" \
  || fail 'readiness dry-run execution'
require_pattern "$READINESS" 'realExecution=false' 'readiness records no real execution'
grep -Fq -- 'realExecution=false' <<<"$READINESS_DRY_OUTPUT" \
  || fail 'readiness dry-run result records no real execution'
pass 'readiness dry-run is offline and records no real execution'

for pattern in \
  "APPROVED_ORIGIN='https://api.orchestra.mcm.eng.br'" \
  "APPROVED_SECRET_REF='env://ORCHESTRA_STATUS_READONLY_TOKEN'" \
  "parsed.protocol !== 'https:'" \
  'parsed.username' 'parsed.password' "parsed.pathname !== '/'" \
  'parsed.search' 'parsed.hash' 'blockedName' 'blockedIpv4' 'blockedIpv6' \
  'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN" = "$MCP_CORPORATE_READONLY_ORIGIN' \
  'MCP_REMOTE_EGRESS_ALLOWLIST" = "$MCP_CORPORATE_READONLY_ORIGIN'
do
  require_pattern "$READINESS" "$pattern" "local-check contract $pattern"
done
pass 'local-check accepts only the fixed API origin and logical reference'

HTTPS_TEMPLATE="$("$READINESS" --https-template)" \
  || fail 'HTTPS template generation'
for line in \
  'curl -i https://api.orchestra.mcm.eng.br/v1/status' \
  'curl -i https://api.orchestra.mcm.eng.br/v1/status/availability' \
  '"status": "ok"' '"summary": "..."' '"updatedAt": "<ISO timestamp>"'
do
  grep -Fq -- "$line" <<<"$HTTPS_TEMPLATE" || fail "HTTPS template line $line"
done
pass 'HTTPS template contains only the two fixed targets and expected contract'
if grep -Eiq -- 'authorization|bearer|api.?key|password|credential' <<<"$HTTPS_TEMPLATE"; then
  fail 'HTTPS template exposes an authentication field'
fi
pass 'HTTPS template exposes no authentication field and executed no request'

AUDIT_TEMPLATE="$("$READINESS" --audit-template)" \
  || fail 'audit template generation'
for field in \
  runId status externalMcpCalled simulated mcpRemoteAllowed mcpRemoteBlocked \
  mcpRemoteBlockedReason mcpRemoteHost mcpRemoteToolId responseBytes latencyMs rawContentLogged
do
  grep -Fq -- "\"$field\"" <<<"$AUDIT_TEMPLATE" || fail "audit field $field"
done
[ "$(grep -cE ' AS "[A-Za-z]+"' <<<"$AUDIT_TEMPLATE")" -eq 12 ] \
  || fail 'audit template must expose exactly twelve allowlisted fields'
pass 'audit template exposes exactly twelve allowlisted fields'
if grep -Eiq -- \
  '(^|[^A-Za-z])(input|context|args|output|body|headers|authorization|bearer|token|secretref|credential|password|api.?key|connection)([^A-Za-z]|$)' \
  <<<"$AUDIT_TEMPLATE"
then
  fail 'audit template contains a sensitive or raw field'
fi
pass 'audit template excludes sensitive and raw fields'

require_pattern "$CI" 'scripts/smoke-readiness-https-tool-status-16y.sh --dry-run' \
  'CI runs the 16Y smoke only in dry-run mode'
reject_pattern "$CI" 'scripts/readiness-https-tool-status-16y\.sh' \
  'direct 16Y readiness execution in CI'
reject_pattern "$CI" 'smoke-readiness-https-tool-status-16y\.sh[[:space:]]+--(local-check|https-template|audit-template|live|run)' \
  'non-dry-run 16Y smoke mode in CI'
reject_pattern "$CI" '(^|[[:space:]])curl([[:space:]]|$)' 'curl command in CI'
reject_pattern "$CI" 'api\.orchestra\.mcm\.eng\.br' 'operational API endpoint in CI'
ci_16y_step="$(
  awk '
    /name: Run 16Y HTTPS readiness static gate/ { capture = 1 }
    capture { print }
    capture && /^[[:space:]]*-[[:space:]]+name:/ && !/Run 16Y HTTPS readiness static gate/ { exit }
  ' "$CI"
)"
if grep -Eiq -- 'docker[[:space:]]+(exec|run|compose)|openai|provider|mcp[[:space:]]+(run|execute)|https?://' \
  <<<"$ci_16y_step"
then
  fail 'CI 16Y step contains a live, MCP or provider command'
fi
pass 'CI 16Y step is dry-run-only, static and provider-free'

for file in "$ROOT_ENV" "$BACKEND_ENV"; do
  require_pattern "$file" 'MCP_REMOTE_ENABLED=false' "${file#"$ROOT_DIR/"} remote MCP disabled"
  require_pattern "$file" 'MCP_REMOTE_EXECUTION_ENABLED=false' \
    "${file#"$ROOT_DIR/"} remote execution disabled"
  require_pattern "$file" 'MCP_REMOTE_READONLY_ENABLED=false' \
    "${file#"$ROOT_DIR/"} remote read-only disabled"
  require_pattern "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' "${file#"$ROOT_DIR/"} allowlist empty"
  require_pattern "$file" 'MCP_REMOTE_REQUIRE_SECRET_REF=true' \
    "${file#"$ROOT_DIR/"} logical secret reference required"
  require_pattern "$file" 'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' \
    "${file#"$ROOT_DIR/"} write tools disabled"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_ENABLED=false' \
    "${file#"$ROOT_DIR/"} corporate adapter disabled"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' \
    "${file#"$ROOT_DIR/"} corporate origin empty"
  if grep -En \
    '^(MCP_REMOTE_EGRESS_ALLOWLIST|MCP_CORPORATE_READONLY_ALLOWED_ORIGIN)=.+$' \
    "$file" >/dev/null
  then
    fail "${file#"$ROOT_DIR/"} versions a corporate origin"
  fi
  pass "${file#"$ROOT_DIR/"} versions no corporate origin"
  if grep -Eq -- 'api\.orchestra\.mcm\.eng\.br|/v1/status(/availability)?' "$file"; then
    fail "${file#"$ROOT_DIR/"} versions the operational status endpoint"
  fi
  pass "${file#"$ROOT_DIR/"} versions no operational status endpoint"
done

require_pattern "$ENV_CONFIG" "MCP_REMOTE_ENABLED: booleanString('false')" \
  'backend remote MCP fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_REMOTE_EXECUTION_ENABLED: booleanString('false')" \
  'backend execution fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_REMOTE_READONLY_ENABLED: booleanString('false')" \
  'backend read-only fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_CORPORATE_READONLY_ENABLED: booleanString('false')" \
  'backend corporate fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: z.string().default('')" \
  'backend corporate origin empty default'

for pattern in \
  'MCP_REMOTE_ENABLED: "false"' \
  'MCP_REMOTE_EXECUTION_ENABLED: "false"' \
  'MCP_REMOTE_READONLY_ENABLED: "false"' \
  'MCP_REMOTE_EGRESS_ALLOWLIST: ""' \
  'MCP_REMOTE_ALLOW_WRITE_TOOLS: "false"' \
  'MCP_CORPORATE_READONLY_ENABLED: "false"' \
  'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: ""'
do
  require_pattern "$PROD_COMPOSE" "$pattern" "production fail-closed setting $pattern"
done
reject_pattern "$PROD_COMPOSE" 'api\.orchestra\.mcm\.eng\.br|/v1/status(/availability)?' \
  'operational status endpoint in production Compose'

require_pattern "$TRANSPORT" "corporateReadonlyToolName = 'corporate.status.read'" \
  'corporate tool remains fixed'
require_pattern "$TRANSPORT" "method: 'GET'" 'corporate tool remains GET-only'
reject_pattern "$TRANSPORT" "method:[[:space:]]*'(POST|PUT|PATCH|DELETE)'" \
  'write method in corporate transport'
status_paths="$(
  grep -oE "'/(health|v1/[^']*)'" "$TRANSPORT" \
    | tr -d "'" \
    | sort -u \
    | paste -sd, -
)"
[ "$status_paths" = '/health,/v1/status,/v1/status/availability' ] \
  || fail "corporate transport contains an unexpected status path: $status_paths"
pass 'corporate transport contains only the three fixed status paths'
require_pattern "$TRANSPORT" "required: ['status', 'summary', 'updatedAt']" \
  'tool output contract remains status, summary and updatedAt'
require_pattern "$FACTORY" "target.protocol === 'https:'" \
  'corporate transport still requires HTTPS'
for pattern in \
  'metadataHosts' 'isBlockedMcpRemoteAddress' "parsed.protocol !== 'https:'" \
  'host === '\''localhost'\''' 'parseAllowedOrigins(allowlist, policy).has(origin)'
do
  require_pattern "$EGRESS" "$pattern" "egress contract $pattern"
done

for file in "$RUNBOOK" "$DOC_INDEX" "$STATE_DOC" "$DOC_16X" "$DOC_16W" "$DOC_16V" "$DOC_16U" "$DOC_16T"; do
  require_pattern "$file" '16Y' "${file#"$ROOT_DIR/"} references phase 16Y"
  require_pattern "$file" '16Z' "${file#"$ROOT_DIR/"} references publication-preparation phase 16Z"
  require_pattern "$file" 'não executa chamada real' \
    "${file#"$ROOT_DIR/"} records that 16Y performs no real call"
  require_pattern "$file" 'UI/CRUD MCP' \
    "${file#"$ROOT_DIR/"} defers MCP UI/CRUD validation"
done

if git -C "$ROOT_DIR" status --short -- backend/prisma/schema.prisma backend/prisma/migrations | grep -q .; then
  fail 'Prisma schema or migrations changed'
fi
pass 'Prisma schema and migrations are unchanged'

if grep -ERn \
  '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})' \
  "$RUNBOOK" "$READINESS" "$SMOKE" "$ROOT_ENV" "$BACKEND_ENV" "$PROD_COMPOSE" >/dev/null
then
  fail 'apparent credential material detected in 16Y scope'
fi
pass 'no apparent credential material in 16Y scope'

bash -n "$READINESS"
bash -n "$SMOKE"
pass '16Y Bash syntax checks passed'

for regression in \
  'smoke-alinhamento-tool-status-16x.sh --dry-run' \
  'smoke-primeira-tool-status-16w.sh --dry-run' \
  'homologacao-primeira-tool-status-16w.sh --dry-run' \
  'smoke-endpoint-status-readonly-16v.sh --dry-run' \
  'smoke-homologacao-conector-readonly-16u.sh --dry-run' \
  'smoke-conector-corporativo-readonly-16t.sh --dry-run' \
  'evals-runtime-qualidade-16s.sh --dry-run' \
  'smoke-evals-qualidade-16s.sh --dry-run'
do
  read -r script argument <<<"$regression"
  require_executable "$ROOT_DIR/scripts/$script"
  "$ROOT_DIR/scripts/$script" "$argument" >/dev/null \
    || fail "regression $script $argument"
  pass "regression $script $argument"
done

printf '\n16Y HTTPS readiness smoke summary: PASS=%d FAIL=0 structuralReadiness=true realExecution=false\n' \
  "$pass_count"
