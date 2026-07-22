#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
SCRIPT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/audit-conector-readonly-16u.sh [--dry-run|--sql-template|--help]

  --dry-run      Validate the versioned SQL projection and script safety without database access.
  --sql-template Print a read-only, allowlisted query for an operator to execute manually.
  --help         Print this help.

The script never connects to a database and never reads environment variables or raw run content.
EOF
}

render_sql() {
  cat <<'SQL16U'
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
SQL16U
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n16U post-run audit summary: PASS=%d FAIL=1\n' "$pass_count" >&2
  exit 1
}

case "$MODE" in
  --dry-run|--sql-template) ;;
  --help|-h) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac
[ "$#" -le 1 ] || fail 'only one mode can be selected'

if [ "$MODE" = '--sql-template' ]; then
  render_sql
  exit 0
fi

bash -n "$SCRIPT_PATH"
pass 'audit script Bash syntax is valid'

SQL_TEMPLATE="$(render_sql)"
for field in \
  runId status externalMcpCalled simulated mcpRemoteAllowed mcpRemoteBlocked \
  mcpRemoteBlockedReason mcpRemoteHost mcpRemoteToolId responseBytes latencyMs rawContentLogged
do
  grep -Fq -- "\"$field\"" <<<"$SQL_TEMPLATE" || fail "allowlisted projection $field is missing"
  pass "allowlisted projection $field"
done

[ "$(grep -cE ' AS "[A-Za-z]+"' <<<"$SQL_TEMPLATE")" -eq 12 ] \
  || fail 'SQL template must expose exactly twelve allowlisted fields'
pass 'SQL template exposes exactly twelve allowlisted fields'

if grep -Eiq -- '(^|[^A-Za-z])(input|context|args|output|body|headers|secretRef)([^A-Za-z]|$)' <<<"$SQL_TEMPLATE"; then
  fail 'SQL template contains a forbidden raw field'
fi
pass 'SQL template excludes forbidden raw fields'

if grep -Eiq -- 'select[[:space:]]+\*|metadata[[:space:]]*(,|from)' <<<"$SQL_TEMPLATE"; then
  fail 'SQL template selects an unrestricted row or metadata object'
fi
pass 'SQL template has no unrestricted projection'

grep -Fq -- "WHERE id = :'run_id'::uuid" <<<"$SQL_TEMPLATE" \
  || fail 'SQL template must require one explicit run_id'
pass 'SQL template is scoped to one explicit run_id'

printf '\n16U post-run audit summary: PASS=%d FAIL=0\n' "$pass_count"
