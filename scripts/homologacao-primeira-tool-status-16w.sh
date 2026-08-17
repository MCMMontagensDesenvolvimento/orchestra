#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PRIMEIRA_EXECUCAO_REAL_TOOL_STATUS_16W.md"
TRANSPORT="$ROOT_DIR/backend/src/modules/mcp/remote/corporate-readonly/corporate-readonly.transport.ts"
FACTORY="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-transport.factory.ts"
ENV_CONFIG="$ROOT_DIR/backend/src/config/env.ts"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/homologacao-primeira-tool-status-16w.sh [MODE]

Modes:
  --dry-run        Validate the versioned 16W preparation without network access.
  --prepare-local  Print the offline local preparation checklist; no service is contacted.
  --local-check    Validate optional local variables without resolving or printing secrets.
  --audit-template Print one read-only SQL projection with allowlisted technical fields.
  --help           Print this help.

There is intentionally no local live-execution mode. The governed corporate transport requires
an approved HTTPS origin, while the Orchestra development backend is HTTP. A real execution must
use the supervised HTTPS procedure in the 16W runbook; CI and this script never perform it.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n16W first-tool preparation summary: mode=%s PASS=%d FAIL=1 realExecution=false\n' \
    "${MODE#--}" "$pass_count" >&2
  exit 1
}

require_file() {
  [ -f "$1" ] || fail "${1#"$ROOT_DIR/"} is missing"
  pass "${1#"$ROOT_DIR/"} exists"
}

require_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  grep -Fq -- "$pattern" "$file" || fail "$label is missing"
  pass "$label"
}

render_audit_sql() {
  cat <<'SQL16W'
SELECT
  id AS "runId",
  status AS "status",
  metadata #>> '{runtime,externalMcpCalled}' AS "externalMcpCalled",
  metadata #>> '{runtime,simulated}' AS "simulated",
  metadata #>> '{runtime,mcpRemoteAllowed}' AS "mcpRemoteAllowed",
  metadata #>> '{runtime,mcpRemoteBlocked}' AS "mcpRemoteBlocked",
  metadata #>> '{runtime,mcpRemoteBlockedReason}' AS "mcpRemoteBlockedReason",
  metadata #>> '{runtime,mcpRemoteHost}' AS "mcpRemoteHost",
  metadata #>> '{runtime,mcpRemoteToolId}' AS "mcpRemoteToolId",
  metadata #>> '{runtime,responseBytes}' AS "responseBytes",
  metadata #>> '{runtime,latencyMs}' AS "latencyMs",
  metadata #>> '{runtime,rawContentLogged}' AS "rawContentLogged"
FROM agent_runs
WHERE id = :'run_id'::uuid
LIMIT 1;
SQL16W
}

run_dry_run() {
  require_file "$RUNBOOK"
  require_file "$TRANSPORT"
  require_file "$FACTORY"
  require_file "$ENV_CONFIG"

  require_pattern "$TRANSPORT" "corporateReadonlyToolName = 'corporate.status.read'" \
    'the corporate tool name remains fixed'
  require_pattern "$TRANSPORT" "method: 'GET'" 'the corporate transport remains GET-only'
  require_pattern "$TRANSPORT" "'/v1/corporate-readonly/health'" \
    'the authenticated health path remains fixed'
  require_pattern "$TRANSPORT" "'/v1/corporate-readonly/status'" \
    'the authenticated status path remains fixed'
  require_pattern "$TRANSPORT" "'/v1/corporate-readonly/status/availability'" \
    'the authenticated availability path remains fixed'
  require_pattern "$FACTORY" "target.protocol === 'https:'" \
    'the corporate transport selector still requires HTTPS'
  require_pattern "$ENV_CONFIG" "MCP_REMOTE_ENABLED: booleanString('false')" \
    'remote MCP remains disabled by default'
  require_pattern "$ENV_CONFIG" "MCP_CORPORATE_READONLY_ENABLED: booleanString('false')" \
    'the corporate adapter remains disabled by default'
  require_pattern "$RUNBOOK" 'Opção C' 'the local HTTP decision is documented'
  require_pattern "$RUNBOOK" 'não foi executada' 'the absence of a real call is explicit'

  bash -n "$0"
  pass 'Bash syntax is valid'

  local sql
  sql="$(render_audit_sql)"
  [ "$(grep -cE ' AS "[A-Za-z]+"' <<<"$sql")" -eq 12 ] \
    || fail 'audit SQL must expose exactly twelve allowlisted fields'
  pass 'audit SQL exposes exactly twelve allowlisted fields'
}

prepare_local() {
  cat <<'EOF'
16W local preparation (offline)

- Decision: Option C; local HTTP is not authorized for the corporate transport.
- Fixed local target: the Orchestra backend on port 3000.
- Allowed status paths: /health, /v1/status, /v1/status/availability.
- Keep every MCP remote/corporate execution flag disabled.
- Do not materialize an origin, credential, bearer value or custom header for local execution.
- Validate the passive 16V endpoints separately using the documented local procedure.
- Use the HTTPS supervised procedure only after endpoint, contract, catalog and window approval.
- A real call has not been executed by this mode.
EOF
}

validate_optional_origin() {
  local name="$1"
  local value="${!name-}"
  [ -z "$value" ] && {
    pass "$name is absent or empty"
    return
  }

  node -e '
    const value = process.argv[1];
    let parsed;
    try { parsed = new URL(value); } catch { process.exit(1); }
    const approved = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
    if (!approved.has(parsed.origin)) process.exit(1);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      process.exit(1);
    }
    if (value !== parsed.origin && value !== `${parsed.origin}/`) process.exit(1);
  ' "$value" || fail "$name must be empty or one exact Orchestra local origin"
  pass "$name is structurally restricted to the Orchestra local origin"
}

run_local_check() {
  [ "${NODE_ENV-}" != 'production' ] || fail 'local preparation is forbidden when NODE_ENV=production'
  pass 'NODE_ENV is not production'

  validate_optional_origin MCP_CORPORATE_READONLY_ORIGIN
  validate_optional_origin MCP_CORPORATE_READONLY_ALLOWED_ORIGIN
  validate_optional_origin MCP_REMOTE_EGRESS_ALLOWLIST

  local secret_ref="${MCP_CORPORATE_READONLY_SECRET_REF-}"
  if [ -n "$secret_ref" ]; then
    [[ "$secret_ref" =~ ^env://ORCHESTRA_CORPORATE_READONLY_[A-Z0-9_]+$ ]] \
      || fail 'MCP_CORPORATE_READONLY_SECRET_REF must be an approved logical env reference'
    pass 'MCP_CORPORATE_READONLY_SECRET_REF has an approved logical format (value not resolved)'
  else
    pass 'MCP_CORPORATE_READONLY_SECRET_REF is absent or empty'
  fi

  for name in \
    MCP_REMOTE_ENABLED \
    MCP_REMOTE_EXECUTION_ENABLED \
    MCP_REMOTE_READONLY_ENABLED \
    MCP_CORPORATE_READONLY_ENABLED
  do
    [ "${!name-false}" != 'true' ] \
      || fail "$name must not be enabled for local HTTP preparation"
    pass "$name is not enabled for local HTTP preparation"
  done

  [ "${MCP_REMOTE_ALLOW_WRITE_TOOLS-false}" != 'true' ] \
    || fail 'MCP_REMOTE_ALLOW_WRITE_TOOLS must remain false'
  pass 'write tools are not enabled'
}

case "$MODE" in
  --dry-run)
    [ "$#" -le 1 ] || fail 'only one mode can be selected'
    run_dry_run
    ;;
  --prepare-local)
    [ "$#" -le 1 ] || fail 'only one mode can be selected'
    prepare_local
    ;;
  --local-check)
    [ "$#" -le 1 ] || fail 'only one mode can be selected'
    run_local_check
    ;;
  --audit-template)
    [ "$#" -le 1 ] || fail 'only one mode can be selected'
    render_audit_sql
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

printf '\n16W first-tool preparation summary: mode=%s PASS=%d FAIL=0 realExecution=false\n' \
  "${MODE#--}" "$pass_count"
