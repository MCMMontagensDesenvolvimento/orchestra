#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_READINESS_HTTPS_TOOL_STATUS_16Y.md"
TRANSPORT="$ROOT_DIR/backend/src/modules/mcp/remote/corporate-readonly/corporate-readonly.transport.ts"
FACTORY="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-transport.factory.ts"
EGRESS="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-egress.ts"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
APPROVED_ORIGIN='https://api.orchestra.mcm.eng.br'
APPROVED_SECRET_REF='env://ORCHESTRA_STATUS_READONLY_TOKEN'
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/readiness-https-tool-status-16y.sh [MODE]

Modes:
  --dry-run        Validate versioned 16Y contracts and fail-closed defaults without network.
  --local-check    Validate the approved operational window variables without resolving credentials.
  --https-template Print the two fixed, manual HTTPS checks and expected payload; execute nothing.
  --audit-template Print one read-only SQL projection with allowlisted technical fields.
  --help           Print this help.

Every mode is offline. This script accepts no URL or path argument, writes no versioned file,
does not execute MCP, does not contact a provider and never reads or prints a credential value.
Phase 16Z prepares publication only; real execution remains reserved for a later authorized phase.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n16Y HTTPS readiness summary: mode=%s PASS=%d FAIL=1 structuralReadiness=false realExecution=false\n' \
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

require_local_variable() {
  local name="$1"
  [ -n "${!name+x}" ] || fail "$name is not set"
  [ -n "${!name}" ] || fail "$name is empty"
  pass "$name is present"
}

require_true() {
  local name="$1"
  [ "${!name}" = 'true' ] || fail "$name must be true only during the approved window"
  pass "$name is explicitly enabled for the approved window"
}

render_audit_sql() {
  cat <<'SQL16Y'
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
SQL16Y
}

run_dry_run() {
  for file in \
    "$RUNBOOK" "$TRANSPORT" "$FACTORY" "$EGRESS" \
    "$ROOT_ENV" "$BACKEND_ENV" "$PROD_COMPOSE"
  do
    require_file "$file"
  done

  require_pattern "$RUNBOOK" '## Objetivo' 'runbook objective'
  require_pattern "$RUNBOOK" '## Topologia prevista' 'runbook topology'
  require_pattern "$RUNBOOK" '## Readiness estrutural sem chamada real' \
    'runbook offline readiness boundary'
  require_pattern "$RUNBOOK" '## SQL/audit template seguro' 'runbook safe audit template'
  require_pattern "$RUNBOOK" '16Z' 'runbook hands off publication preparation to 16Z'

  require_pattern "$TRANSPORT" "corporateReadonlyToolName = 'corporate.status.read'" \
    'the corporate status tool remains fixed'
  require_pattern "$TRANSPORT" "method: 'GET'" 'the corporate transport remains GET-only'
  require_pattern "$TRANSPORT" "'/v1/corporate-readonly/health'" \
    'the authenticated readiness path remains fixed'
  require_pattern "$TRANSPORT" "'/v1/corporate-readonly/status'" \
    'the authenticated status path remains fixed'
  require_pattern "$TRANSPORT" "'/v1/corporate-readonly/status/availability'" \
    'the authenticated availability path remains fixed'
  require_pattern "$TRANSPORT" "required: ['status', 'summary', 'updatedAt']" \
    'the 16V/16X output contract remains fixed'
  require_pattern "$FACTORY" "target.protocol === 'https:'" \
    'the corporate transport selector still requires HTTPS'
  require_pattern "$EGRESS" 'metadataHosts' 'metadata hosts remain blocked'
  require_pattern "$EGRESS" 'isBlockedMcpRemoteAddress' \
    'private and loopback addresses remain blocked'
  require_pattern "$EGRESS" 'parseAllowedOrigins(allowlist, policy).has(origin)' \
    'exact egress allowlisting remains enforced'

  for file in "$ROOT_ENV" "$BACKEND_ENV"; do
    require_pattern "$file" 'MCP_REMOTE_EXECUTION_ENABLED=false' \
      "${file#"$ROOT_DIR/"} remote execution remains disabled"
    require_pattern "$file" 'MCP_REMOTE_READONLY_ENABLED=false' \
      "${file#"$ROOT_DIR/"} remote read-only remains disabled"
    require_pattern "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' \
      "${file#"$ROOT_DIR/"} egress allowlist remains empty"
    require_pattern "$file" 'MCP_CORPORATE_READONLY_ENABLED=false' \
      "${file#"$ROOT_DIR/"} corporate adapter remains disabled"
    require_pattern "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' \
      "${file#"$ROOT_DIR/"} corporate origin remains empty"
  done

  require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_EXECUTION_ENABLED: "false"' \
    'production remote execution remains disabled'
  require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_READONLY_ENABLED: "false"' \
    'production remote read-only remains disabled'
  require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_EGRESS_ALLOWLIST: ""' \
    'production egress allowlist remains empty'
  require_pattern "$PROD_COMPOSE" 'MCP_CORPORATE_READONLY_ENABLED: "false"' \
    'production corporate adapter remains disabled'
  require_pattern "$PROD_COMPOSE" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: ""' \
    'production corporate origin remains empty'

  bash -n "$0"
  pass 'Bash syntax is valid'
  pass 'the readiness script is read-only and performs no network or MCP execution'
}

run_local_check() {
  local variables=(
    MCP_CORPORATE_READONLY_ENABLED
    MCP_CORPORATE_READONLY_ORIGIN
    MCP_CORPORATE_READONLY_ALLOWED_ORIGIN
    MCP_REMOTE_EGRESS_ALLOWLIST
    MCP_REMOTE_EXECUTION_ENABLED
    MCP_REMOTE_READONLY_ENABLED
    MCP_CORPORATE_READONLY_SECRET_REF
  )
  local name
  for name in "${variables[@]}"; do
    require_local_variable "$name"
  done

  require_true MCP_CORPORATE_READONLY_ENABLED
  require_true MCP_REMOTE_EXECUTION_ENABLED
  require_true MCP_REMOTE_READONLY_ENABLED

  APPROVED_ORIGIN="$APPROVED_ORIGIN" node <<'NODE16Y' \
    || fail 'MCP_CORPORATE_READONLY_ORIGIN must be the exact approved public HTTPS API origin'
const raw = process.env.MCP_CORPORATE_READONLY_ORIGIN;
const expected = process.env.APPROVED_ORIGIN;
let parsed;
try {
  parsed = new URL(raw);
} catch {
  process.exit(1);
}

const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
const metadataHosts = new Set([
  'metadata',
  'metadata.google.internal',
  'metadata.azure.internal',
  'instance-data.ec2.internal',
]);
const ipv4 = host.split('.').map(Number);
const isIpv4 = ipv4.length === 4
  && ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255);
const [a, b] = ipv4;
const blockedIpv4 = isIpv4 && (
  a === 0
  || a === 10
  || a === 127
  || (a === 100 && b >= 64 && b <= 127)
  || (a === 169 && b === 254)
  || (a === 172 && b >= 16 && b <= 31)
  || (a === 192 && (b === 0 || b === 168))
  || (a === 198 && (b === 18 || b === 19))
  || a >= 224
);
const blockedIpv6 = host === '::'
  || host === '::1'
  || /^(?:fc|fd)/.test(host)
  || /^fe[89ab]/.test(host)
  || host.startsWith('ff')
  || host.startsWith('2001:db8:');
const blockedName = host === 'localhost'
  || host.endsWith('.localhost')
  || host === 'local'
  || host.endsWith('.local')
  || metadataHosts.has(host);

if (
  raw !== expected
  || parsed.protocol !== 'https:'
  || parsed.username
  || parsed.password
  || parsed.pathname !== '/'
  || parsed.search
  || parsed.hash
  || raw !== parsed.origin
  || blockedName
  || blockedIpv4
  || blockedIpv6
) {
  process.exit(1);
}
NODE16Y
  pass 'MCP_CORPORATE_READONLY_ORIGIN is the exact approved public HTTPS API origin'

  [ "$MCP_CORPORATE_READONLY_ALLOWED_ORIGIN" = "$MCP_CORPORATE_READONLY_ORIGIN" ] \
    || fail 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN must be textually equal to the origin'
  pass 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN is textually equal to the origin'

  [ "$MCP_REMOTE_EGRESS_ALLOWLIST" = "$MCP_CORPORATE_READONLY_ORIGIN" ] \
    || fail 'MCP_REMOTE_EGRESS_ALLOWLIST must contain only the exact approved origin'
  pass 'MCP_REMOTE_EGRESS_ALLOWLIST contains only the exact approved origin'

  [[ "$MCP_CORPORATE_READONLY_SECRET_REF" =~ ^env://[A-Z][A-Z0-9_]{2,127}$ ]] \
    || fail 'MCP_CORPORATE_READONLY_SECRET_REF must be a logical env reference'
  [ "$MCP_CORPORATE_READONLY_SECRET_REF" = "$APPROVED_SECRET_REF" ] \
    || fail 'MCP_CORPORATE_READONLY_SECRET_REF must use the approved logical reference'
  pass 'MCP_CORPORATE_READONLY_SECRET_REF is the approved logical reference (not resolved or printed)'

  pass 'all execution flags are enabled only in the current approved process window'
  pass 'the check did not write configuration or any versioned file'
}

render_https_template() {
  printf '%s\n' \
    '16Y manual HTTPS template (instructions only; no command was executed)' \
    '' \
    'curl -i https://api.orchestra.mcm.eng.br/v1/status' \
    'curl -i https://api.orchestra.mcm.eng.br/v1/status/availability' \
    '' \
    'Expected payload contract:' \
    '{' \
    '  "status": "ok",' \
    '  "summary": "...",' \
    '  "updatedAt": "<ISO timestamp>"' \
    '}' \
    '' \
    'Run these checks only outside CI, in an approved manual window. They are not MCP execution.'
}

case "$MODE" in
  --dry-run)
    [ "$#" -le 1 ] || fail 'only one mode can be selected'
    run_dry_run
    ;;
  --local-check)
    [ "$#" -le 1 ] || fail 'only one mode can be selected'
    run_local_check
    ;;
  --https-template)
    [ "$#" -le 1 ] || fail 'only one mode can be selected'
    render_https_template
    exit 0
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

printf '\n16Y HTTPS readiness summary: mode=%s PASS=%d FAIL=0 structuralReadiness=true realExecution=false\n' \
  "${MODE#--}" "$pass_count"
