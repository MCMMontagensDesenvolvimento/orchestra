#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_ALINHAMENTO_TOOL_STATUS_ENDPOINT_16X.md"
TRANSPORT="$ROOT_DIR/backend/src/modules/mcp/remote/corporate-readonly/corporate-readonly.transport.ts"
TEST="$ROOT_DIR/backend/tests/unit/corporate-readonly-transport.test.ts"
FACTORY="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-transport.factory.ts"
EGRESS="$ROOT_DIR/backend/src/modules/mcp/remote/mcp-remote-egress.ts"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
ENV_CONFIG="$ROOT_DIR/backend/src/config/env.ts"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
CI="$ROOT_DIR/.github/workflows/ci.yml"
DOC_INDEX="$ROOT_DIR/docs/ai-orchestration/README.md"
STATE_DOC="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_ESTADO_ATUAL_PROJETO.md"
DOC_16T="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_CONECTOR_CORPORATIVO_READONLY_16T.md"
DOC_16W="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PRIMEIRA_EXECUCAO_REAL_TOOL_STATUS_16W.md"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-alinhamento-tool-status-16x.sh [--dry-run|--help]

The dry-run reads versioned files and executes only offline regression gates. It never
contacts an endpoint or database, starts a service/container, resolves a credential,
executes MCP, calls OpenAI or another provider, or uses a live/run-once mode.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n16X status-contract alignment smoke summary: PASS=%d FAIL=1 realExecution=false\n' \
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
  "$RUNBOOK" "$TRANSPORT" "$TEST" "$FACTORY" "$EGRESS" \
  "$ROOT_ENV" "$BACKEND_ENV" "$ENV_CONFIG" "$PROD_COMPOSE" "$CI" \
  "$DOC_INDEX" "$STATE_DOC" "$DOC_16T" "$DOC_16W"
do
  require_file "$file"
done

for section in \
  '## Objetivo' '## Escopo' '## Fora de escopo' '## Contrato comum da tool' \
  '## Diferença entre `/health` e os endpoints 16V' '## Normalização de `/health`' \
  '## Validação estrita de `/v1/status` e `/v1/status/availability`' \
  '## Segurança e fail-closed' '## Relação com 16T, 16U, 16V e 16W' \
  '## Como validar sem execução real' '## Readiness para origem HTTPS aprovada' \
  '## Critérios de aceite' '## Rollback' '## Riscos remanescentes' \
  '## Próximo passo sugerido'
do
  require_pattern "$RUNBOOK" "$section" "runbook section $section"
done
require_pattern "$RUNBOOK" 'realExecution=false' 'runbook records no real execution'
require_pattern "$RUNBOOK" 'teste visual' 'runbook defers visual validation'

require_pattern "$TRANSPORT" "corporateReadonlyToolName = 'corporate.status.read'" \
  'single corporate status tool'
require_pattern "$TRANSPORT" "allowedScopes = new Set(['summary', 'availability'])" \
  'fixed corporate scopes'
require_pattern "$TRANSPORT" "allowedStatuses = new Set(['ok', 'degraded'])" \
  'strict common status enum'
require_pattern "$TRANSPORT" "required: ['status', 'summary', 'updatedAt']" \
  'strict common required fields'
require_pattern "$TRANSPORT" "legacyHealthKeys = new Set(['status', 'service', 'timestamp', 'requestId'])" \
  'legacy health contract'
require_pattern "$TRANSPORT" "statusEndpointKeys = new Set(['status', 'summary', 'updatedAt'])" \
  'strict 16V endpoint keys'
require_pattern "$TRANSPORT" "summary: 'Orchestra health endpoint operational'" \
  'fixed normalized health summary'
require_pattern "$TRANSPORT" 'updatedAt,' 'normalized health timestamp'
require_pattern "$TRANSPORT" "method: 'GET'" 'GET-only transport'
require_pattern "$TRANSPORT" "redirect: 'manual'" 'redirect blocking'
require_pattern "$TRANSPORT" 'readBoundedJson' 'bounded JSON response reader'
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

for pattern in \
  'accepts the strict 16V status payload' \
  'accepts the strict 16V availability payload' \
  'normalizes the legacy health payload without propagating requestId or service' \
  'an unexpected status' 'a missing summary' 'a missing updatedAt' 'an invalid updatedAt' \
  'an extra non-contract field' 'HTML in summary' 'an oversized summary' \
  'blocks write-like tools and unsupported input before invoking the transport' \
  'fails safely on redirects and response fields shaped like raw payload' \
  'enforces the governed response byte limit before mapping content' \
  'aborts a corporate request at the dedicated transport timeout' \
  'stays fail-closed unless its dedicated flag and exact HTTPS origin match' \
  'blocks private and metadata-style destinations before the corporate transport' \
  'requires a logical secret reference before any request'
do
  require_pattern "$TEST" "$pattern" "unit coverage $pattern"
done
require_pattern "$TEST" "rawOutput: rawMarker" 'sensitive response field rejection'
require_pattern "$TEST" 'not.toContain(requestIdMarker)' 'requestId is not propagated'
require_pattern "$TEST" "not.toContain('orchestra-backend')" 'service is not propagated'
require_pattern "$TEST" 'not.toContain(secretMarker)' 'secret value is not exposed'
require_pattern "$TRANSPORT" 'unsafeMarkup.test(normalized)' 'HTML text rejection'
require_pattern "$TRANSPORT" 'setTimeout(() => controller.abort(), this.config.timeoutMs)' \
  'dedicated transport timeout'

require_pattern "$FACTORY" 'matchesCorporateReadonlyOrigin' 'exact-origin transport selector'
for pattern in \
  'metadataHosts' 'isBlockedMcpRemoteAddress' "parsed.protocol !== 'https:'" \
  'parseAllowedOrigins(allowlist, policy).has(origin)'
do
  require_pattern "$EGRESS" "$pattern" "egress contract $pattern"
done

for file in "$ROOT_ENV" "$BACKEND_ENV"; do
  require_pattern "$file" 'MCP_REMOTE_ENABLED=false' "${file#"$ROOT_DIR/"} remote MCP disabled"
  require_pattern "$file" 'MCP_REMOTE_EXECUTION_ENABLED=false' "${file#"$ROOT_DIR/"} execution disabled"
  require_pattern "$file" 'MCP_REMOTE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} read-only disabled"
  require_pattern "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' "${file#"$ROOT_DIR/"} allowlist empty"
  require_pattern "$file" 'MCP_REMOTE_REQUIRE_SECRET_REF=true' "${file#"$ROOT_DIR/"} secretRef required"
  require_pattern "$file" 'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' "${file#"$ROOT_DIR/"} write tools disabled"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_ENABLED=false' "${file#"$ROOT_DIR/"} adapter disabled"
  require_pattern "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' "${file#"$ROOT_DIR/"} origin empty"
  if grep -En '^MCP_(REMOTE_EGRESS_ALLOWLIST|CORPORATE_READONLY_ALLOWED_ORIGIN)=.+$' "$file" >/dev/null; then
    fail "${file#"$ROOT_DIR/"} versions a remote endpoint"
  fi
  pass "${file#"$ROOT_DIR/"} has no versioned remote endpoint"
done

require_pattern "$ENV_CONFIG" "MCP_REMOTE_ENABLED: booleanString('false')" \
  'backend remote MCP fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_REMOTE_EXECUTION_ENABLED: booleanString('false')" \
  'backend execution fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_REMOTE_READONLY_ENABLED: booleanString('false')" \
  'backend read-only fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_CORPORATE_READONLY_ENABLED: booleanString('false')" \
  'backend adapter fail-closed default'
require_pattern "$ENV_CONFIG" "MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: z.string().default('')" \
  'backend origin empty default'

require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_ENABLED: "false"' 'production remote MCP disabled'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_EXECUTION_ENABLED: "false"' 'production execution disabled'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_READONLY_ENABLED: "false"' 'production read-only disabled'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_EGRESS_ALLOWLIST: ""' 'production allowlist empty'
require_pattern "$PROD_COMPOSE" 'MCP_REMOTE_ALLOW_WRITE_TOOLS: "false"' 'production write tools disabled'
require_pattern "$PROD_COMPOSE" 'MCP_CORPORATE_READONLY_ENABLED: "false"' 'production adapter disabled'
require_pattern "$PROD_COMPOSE" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: ""' 'production origin empty'

require_pattern "$CI" 'scripts/smoke-alinhamento-tool-status-16x.sh --dry-run' \
  'CI runs the 16X smoke only in dry-run mode'
reject_pattern "$CI" 'smoke-alinhamento-tool-status-16x\.sh[[:space:]]+(--run|--live|--run-once)' \
  'CI live 16X smoke mode'
ci_16x_step="$(
  awk '
    /name: Run 16X status-contract alignment static gate/ { capture = 1 }
    capture { print }
    capture && /^[[:space:]]*-[[:space:]]+name:/ && !/Run 16X status-contract alignment static gate/ { exit }
  ' "$CI"
)"
if grep -Eiq -- 'curl|wget|docker[[:space:]]+(exec|run|compose)|openai|https?://' <<<"$ci_16x_step"; then
  fail 'CI 16X step contains a live/external command'
fi
pass 'CI 16X step is static and provider-free'

for file in "$DOC_INDEX" "$STATE_DOC" "$DOC_16T" "$DOC_16W"; do
  require_pattern "$file" '16X' "${file#"$ROOT_DIR/"} references phase 16X"
  require_pattern "$file" 'nenhuma chamada real' "${file#"$ROOT_DIR/"} records no real execution"
done

if git -C "$ROOT_DIR" status --short -- backend/prisma/schema.prisma backend/prisma/migrations | grep -q .; then
  fail 'Prisma schema or migrations changed'
fi
pass 'Prisma schema and migrations are unchanged'

if grep -ERn \
  '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})' \
  "$RUNBOOK" "$TRANSPORT" "$TEST" "$ROOT_ENV" "$BACKEND_ENV" "$PROD_COMPOSE" >/dev/null
then
  fail 'apparent credential material detected in 16X scope'
fi
pass 'no apparent credential material in 16X scope'

bash -n "$ROOT_DIR/scripts/smoke-alinhamento-tool-status-16x.sh"
pass '16X Bash syntax check passed'

for regression in \
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

printf '\n16X status-contract alignment smoke summary: PASS=%d FAIL=0 realExecution=false\n' \
  "$pass_count"
