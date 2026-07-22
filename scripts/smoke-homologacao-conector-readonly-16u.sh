#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_HOMOLOGACAO_SUPERVISIONADA_CONECTOR_READONLY_16U.md"
PREFLIGHT="$ROOT_DIR/scripts/preflight-conector-readonly-16u.sh"
AUDIT="$ROOT_DIR/scripts/audit-conector-readonly-16u.sh"
SMOKE="$ROOT_DIR/scripts/smoke-homologacao-conector-readonly-16u.sh"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
ENV_CONFIG="$ROOT_DIR/backend/src/config/env.ts"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
CORPORATE_TRANSPORT="$ROOT_DIR/backend/src/modules/mcp/remote/corporate-readonly/corporate-readonly.transport.ts"
CI="$ROOT_DIR/.github/workflows/ci.yml"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-homologacao-conector-readonly-16u.sh [--dry-run|--help]

The dry-run performs static, offline checks only. It does not load local variables, contact a
service/database, resolve credentials, execute a tool, start containers or run a migration.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n16U supervised homologation smoke summary: PASS=%d FAIL=1\n' "$pass_count" >&2
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

for file in "$RUNBOOK" "$ROOT_ENV" "$BACKEND_ENV" "$ENV_CONFIG" "$PROD_COMPOSE" "$CORPORATE_TRANSPORT" "$CI"; do
  require_file "$file"
done
require_executable "$PREFLIGHT"
require_executable "$AUDIT"
require_executable "$SMOKE"

for script in \
  smoke-conector-corporativo-readonly-16t.sh \
  evals-runtime-qualidade-16s.sh smoke-evals-qualidade-16s.sh \
  smoke-e2e-chat-rag-mcp-16r.sh homologacao-e2e-chat-rag-mcp-16r.sh \
  smoke-mcp-readonly-integracao-16q.sh smoke-mcp-externo-readonly-16p.sh
do
  require_executable "$ROOT_DIR/scripts/$script"
done

for script in "$PREFLIGHT" "$AUDIT" "$SMOKE"; do
  if grep -En '(^|[^[:alnum:]_])(c[u]rl|w[g]et)([^[:alnum:]_]|$)' "$script" >/dev/null; then
    fail "${script#"$ROOT_DIR/"} contains an automatic network command"
  fi
  pass "${script#"$ROOT_DIR/"} has no automatic network command"

  if grep -En '^[[:space:]]*(env([[:space:]]|$)|printenv([[:space:]]|$)|set[[:space:]]+-x([[:space:]]|$)|export[[:space:]]+-p([[:space:]]|$)|cat[[:space:]]+/proc/[^/]+/environ)' "$script" >/dev/null; then
    fail "${script#"$ROOT_DIR/"} can print a complete environment"
  fi
  pass "${script#"$ROOT_DIR/"} does not print a complete environment"

  if grep -En '(^|[;&|])[[:space:]]*(npx[[:space:]]+)?prisma[[:space:]]+(migrate|db[[:space:]]+push)|(^|[;&|])[[:space:]]*npm[^;&|]*(prisma:migrate|migrate:)' "$script" >/dev/null; then
    fail "${script#"$ROOT_DIR/"} contains a migration command"
  fi
  pass "${script#"$ROOT_DIR/"} has no migration command"

  if grep -EIn 'https?://[[:alnum:]]' "$script" >/dev/null; then
    fail "${script#"$ROOT_DIR/"} contains a configured endpoint literal"
  fi
  pass "${script#"$ROOT_DIR/"} has no endpoint literal"
done

if grep -ERn \
  '(sk-[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{12,})' \
  "$RUNBOOK" "$PREFLIGHT" "$AUDIT" "$SMOKE" >/dev/null; then
  fail 'apparent credential material detected in 16U artifacts'
fi
pass 'no apparent credential material in 16U artifacts'

for file in "$ROOT_ENV" "$BACKEND_ENV"; do
  require_pattern "$file" 'MCP_REMOTE_ENABLED=false' "${file#"$ROOT_DIR/"} remote MCP disabled"
  require_pattern "$file" 'MCP_REMOTE_EXECUTION_ENABLED=false' "${file#"$ROOT_DIR/"} remote execution disabled"
  require_pattern "$file" 'MCP_REMOTE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} remote read-only disabled"
  require_pattern "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' "${file#"$ROOT_DIR/"} allowlist empty"
  require_pattern "$file" 'MCP_REMOTE_REQUIRE_SECRET_REF=true' "${file#"$ROOT_DIR/"} secret reference required"
  require_pattern "$file" 'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' "${file#"$ROOT_DIR/"} write tools disabled"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} corporate adapter disabled"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' "${file#"$ROOT_DIR/"} corporate origin empty"
done

require_pattern "$ENV_CONFIG" "MCP_REMOTE_ENABLED: booleanString('false')" 'backend remote MCP fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_REMOTE_EXECUTION_ENABLED: booleanString('false')" 'backend remote execution fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_REMOTE_READONLY_ENABLED: booleanString('false')" 'backend remote read-only fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_REMOTE_ALLOW_WRITE_TOOLS: booleanString('false')" 'backend write tools fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_CORPORATE_READONLY_ENABLED: booleanString('false')" 'backend corporate fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: z.string().default('')" 'backend corporate origin empty default'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_ENABLED: "false"' 'production remote MCP disabled'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_EXECUTION_ENABLED: "false"' 'production remote execution disabled'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_READONLY_ENABLED: "false"' 'production remote read-only disabled'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_ALLOW_WRITE_TOOLS: "false"' 'production write tools disabled'
require_pattern "$PROD_COMPOSE" 'MCP_CORPORATE_READONLY_ENABLED: "false"' 'production corporate adapter disabled'
require_pattern "$PROD_COMPOSE" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: ""' 'production corporate origin empty'

require_pattern "$CORPORATE_TRANSPORT" "corporateReadonlyToolName = 'corporate.status.read'" 'single corporate read-only tool remains fixed'
require_pattern "$RUNBOOK" 'no máximo uma execução real' 'runbook one-execution limit'
require_pattern "$RUNBOOK" 'não faz chamada real automaticamente' 'runbook forbids automatic real calls'
require_pattern "$RUNBOOK" 'não configura endpoint ou segredo no Git' 'runbook keeps endpoint and secret out of Git'
require_pattern "$CI" 'scripts/preflight-conector-readonly-16u.sh --dry-run' 'CI runs only 16U preflight dry-run'
require_pattern "$CI" 'scripts/smoke-homologacao-conector-readonly-16u.sh --dry-run' 'CI runs 16U smoke dry-run'
if grep -Fq -- 'scripts/preflight-conector-readonly-16u.sh --local-check' "$CI"; then
  fail 'CI must not run 16U local-check'
fi
pass 'CI does not run 16U local-check'

SQL_TEMPLATE="$($AUDIT --sql-template)" || fail 'audit SQL template generation'
for field in \
  runId status externalMcpCalled simulated mcpRemoteAllowed mcpRemoteBlocked \
  mcpRemoteBlockedReason mcpRemoteHost mcpRemoteToolId responseBytes latencyMs rawContentLogged
do
  grep -Fq -- "\"$field\"" <<<"$SQL_TEMPLATE" || fail "audit SQL field $field"
done
pass 'audit SQL contains every allowlisted field'
if grep -Eiq -- '(^|[^A-Za-z])(input|context|args|output|body|headers|secretRef)([^A-Za-z]|$)' <<<"$SQL_TEMPLATE"; then
  fail 'audit SQL contains a forbidden raw field'
fi
pass 'audit SQL excludes raw fields'

if git -C "$ROOT_DIR" status --short -- backend/prisma/schema.prisma backend/prisma/migrations | grep -q .; then
  fail 'Prisma schema or migrations changed'
fi
pass 'Prisma schema and migrations unchanged'

bash -n "$PREFLIGHT"
bash -n "$AUDIT"
bash -n "$SMOKE"
pass '16U Bash syntax checks passed'

"$PREFLIGHT" --dry-run >/dev/null || fail '16U preflight dry-run'
pass '16U preflight dry-run'
"$AUDIT" --dry-run >/dev/null || fail '16U audit dry-run'
pass '16U audit dry-run'

printf '\n16U supervised homologation smoke summary: PASS=%d FAIL=0\n' "$pass_count"
