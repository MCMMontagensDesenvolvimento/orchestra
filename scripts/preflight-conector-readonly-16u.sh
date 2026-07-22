#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_HOMOLOGACAO_SUPERVISIONADA_CONECTOR_READONLY_16U.md"
DOC_INDEX="$ROOT_DIR/docs/ai-orchestration/README.md"
BOUNDARY_RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_CONECTOR_CORPORATIVO_READONLY_16T.md"
STATE_DOC="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_ESTADO_ATUAL_PROJETO.md"
AUDIT_SCRIPT="$ROOT_DIR/scripts/audit-conector-readonly-16u.sh"
SMOKE_SCRIPT="$ROOT_DIR/scripts/smoke-homologacao-conector-readonly-16u.sh"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
ENV_CONFIG="$ROOT_DIR/backend/src/config/env.ts"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/preflight-conector-readonly-16u.sh [--dry-run|--local-check|--help]

  --dry-run     Validate versioned 16U artifacts and fail-closed defaults only.
  --local-check Validate the six operator variables without resolving a secret or using network.
  --help        Print this help.

No mode loads an env file, contacts a service/database, runs a migration or prints variable values.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n16U supervised preflight summary: mode=%s PASS=%d FAIL=1\n' "${MODE#--}" "$pass_count" >&2
  exit 1
}

case "$MODE" in
  --dry-run|--local-check) ;;
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

require_local_variable() {
  local name="$1"
  [ -n "${!name+x}" ] || fail "$name is not set"
  [ -n "${!name}" ] || fail "$name is empty"
  pass "$name is present"
}

require_true() {
  local name="$1"
  [ "${!name}" = 'true' ] || fail "$name must be true for the approved local window"
  pass "$name is explicitly enabled for the local window"
}

run_dry_check() {
  require_file "$RUNBOOK"
  require_file "$DOC_INDEX"
  require_file "$BOUNDARY_RUNBOOK"
  require_file "$STATE_DOC"
  require_executable "$AUDIT_SCRIPT"
  require_executable "$SMOKE_SCRIPT"
  require_file "$ROOT_ENV"
  require_file "$BACKEND_ENV"
  require_file "$ENV_CONFIG"
  require_file "$PROD_COMPOSE"

  for file in "$ROOT_ENV" "$BACKEND_ENV"; do
    require_pattern "$file" 'MCP_REMOTE_EXECUTION_ENABLED=false' "${file#"$ROOT_DIR/"} remote execution disabled"
    require_pattern "$file" 'MCP_REMOTE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} remote read-only disabled"
    require_pattern "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' "${file#"$ROOT_DIR/"} allowlist empty"
    require_pattern "$file" 'MCP_REMOTE_REQUIRE_SECRET_REF=true' "${file#"$ROOT_DIR/"} logical secret reference required"
    require_pattern "$file" 'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' "${file#"$ROOT_DIR/"} write tools disabled"
    require_pattern "$file" 'MCP_CORPORATE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} corporate adapter disabled"
    require_pattern "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' "${file#"$ROOT_DIR/"} corporate origin empty"
  done

  require_pattern "$ENV_CONFIG" "MCP_REMOTE_EXECUTION_ENABLED: booleanString('false')" 'backend remote execution fail-closed default'
  require_pattern "$ENV_CONFIG" "MCP_REMOTE_READONLY_ENABLED: booleanString('false')" 'backend remote read-only fail-closed default'
  require_pattern "$ENV_CONFIG" "MCP_REMOTE_ALLOW_WRITE_TOOLS: booleanString('false')" 'backend write tools fail-closed default'
  require_pattern "$ENV_CONFIG" "MCP_CORPORATE_READONLY_ENABLED: booleanString('false')" 'backend corporate fail-closed default'
  require_pattern "$ENV_CONFIG" "MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: z.string().default('')" 'backend corporate origin empty default'
  require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_EXECUTION_ENABLED: "false"' 'production remote execution disabled'
  require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_READONLY_ENABLED: "false"' 'production remote read-only disabled'
  require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_ALLOW_WRITE_TOOLS: "false"' 'production write tools disabled'
  require_pattern "$PROD_COMPOSE" 'MCP_CORPORATE_READONLY_ENABLED: "false"' 'production corporate adapter disabled'
  require_pattern "$PROD_COMPOSE" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: ""' 'production corporate origin empty'

  for section in \
    '## Objetivo' '## Pré-requisitos' '## Critérios de aprovação do endpoint' \
    '## Critérios de dados não sensíveis' '## Checklist antes da janela' \
    '## Readiness supervisionada' '## Execução única controlada' \
    '## Consulta SQL segura' '## Rollback' '## Encerramento da janela' \
    '## Critérios para reprovar a homologação' '## Riscos remanescentes'
  do
    require_pattern "$RUNBOOK" "$section" "runbook section $section"
  done
  require_pattern "$RUNBOOK" 'corporate.status.read' 'runbook exact read-only tool'
  require_pattern "$DOC_INDEX" 'A Fase 16U prepara a homologação supervisionada' 'documentation index describes supervised homologation'
  require_pattern "$BOUNDARY_RUNBOOK" 'A Fase 16U não altera esse boundary' '16T runbook hands off to 16U'
  require_pattern "$STATE_DOC" 'nenhuma chamada real é automática' 'current-state document keeps real calls manual'

  bash -n "$ROOT_DIR/scripts/preflight-conector-readonly-16u.sh"
  bash -n "$AUDIT_SCRIPT"
  bash -n "$SMOKE_SCRIPT"
  pass '16U Bash syntax checks passed'
}

run_local_check() {
  local variables=(
    MCP_CORPORATE_READONLY_ENABLED
    MCP_CORPORATE_READONLY_ORIGIN
    MCP_CORPORATE_READONLY_SECRET_REF
    MCP_REMOTE_EGRESS_ALLOWLIST
    MCP_REMOTE_EXECUTION_ENABLED
    MCP_REMOTE_READONLY_ENABLED
  )
  local name
  for name in "${variables[@]}"; do
    require_local_variable "$name"
  done

  require_true MCP_CORPORATE_READONLY_ENABLED
  require_true MCP_REMOTE_EXECUTION_ENABLED
  require_true MCP_REMOTE_READONLY_ENABLED

  node -e '
    const raw = process.env.MCP_CORPORATE_READONLY_ORIGIN;
    let parsed;
    try { parsed = new URL(raw); } catch { process.exit(1); }
    if (parsed.protocol !== "https:") process.exit(1);
    if (parsed.username || parsed.password || parsed.search || parsed.hash) process.exit(1);
    if (parsed.pathname !== "/") process.exit(1);
    if (raw !== parsed.origin && raw !== `${parsed.origin}/`) process.exit(1);
  ' || fail 'MCP_CORPORATE_READONLY_ORIGIN must be one credential-free HTTPS origin'
  pass 'MCP_CORPORATE_READONLY_ORIGIN is a structurally valid HTTPS origin'

  [ "$MCP_REMOTE_EGRESS_ALLOWLIST" = "$MCP_CORPORATE_READONLY_ORIGIN" ] \
    || fail 'MCP_REMOTE_EGRESS_ALLOWLIST must contain exactly the approved origin'
  pass 'MCP_REMOTE_EGRESS_ALLOWLIST contains exactly the approved origin'

  [[ "$MCP_CORPORATE_READONLY_SECRET_REF" =~ ^env://[A-Z][A-Z0-9_]{2,127}$ ]] \
    || fail 'MCP_CORPORATE_READONLY_SECRET_REF must be a logical env reference'
  pass 'MCP_CORPORATE_READONLY_SECRET_REF is a logical reference (value not resolved)'
}

if [ "$MODE" = '--dry-run' ]; then
  run_dry_check
else
  run_local_check
fi

printf '\n16U supervised preflight summary: mode=%s PASS=%d FAIL=0\n' "${MODE#--}" "$pass_count"
