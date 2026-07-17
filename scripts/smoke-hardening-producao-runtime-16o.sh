#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_HARDENING_PRODUCAO_RUNTIME_16O.md"
PREFLIGHT="$ROOT_DIR/scripts/preflight-prod-runtime-16o.sh"
MIGRATE_SCRIPT="$ROOT_DIR/scripts/prod-migrate-deploy.sh"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
NGINX_FILE="$ROOT_DIR/frontend/nginx.conf"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
ENV_CONFIG="$ROOT_DIR/backend/src/config/env.ts"
SECRET_CONFIG="$ROOT_DIR/backend/src/config/production-secrets.ts"
CI_WORKFLOW="$ROOT_DIR/.github/workflows/ci.yml"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-hardening-producao-runtime-16o.sh [MODE]

Modes:
  --dry-run          Validate the static 16O production hardening contracts (default).
  --print-checklist  Print the safe manual homologation checklist.
  --help             Print this help.

This smoke reads versioned files only. It never loads real .env files, starts containers, contacts
a database/provider, applies migrations, executes tools, enables MCP, or prints credential values.
EOF
}

print_checklist() {
  cat <<'EOF'
Manual 16O checklist:
1. Record the code SHA and immutable application image tags.
2. Run the 16O preflight with --check-compose using synthetic validation values.
3. Confirm secrets come from the approved manager without capturing their values.
4. Back up the database and restore it into isolated homologation before migrate deploy.
5. Apply only existing migrations through prod-migrate-deploy.sh with explicit confirmation.
6. Confirm db, backend and frontend health; validate authenticated Agno stub only when approved.
7. Run 16O, 16N, 16M, 16K and 16I smokes and record redacted evidence.
8. Keep previous image tags and the restore/forward-fix decision ready for rollback.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\nProduction hardening runtime 16O smoke summary: PASS=%d FAIL=1\n' "$pass_count" >&2
  exit 1
}

case "$MODE" in
  --dry-run) ;;
  --print-checklist) print_checklist; exit 0 ;;
  --help|-h) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac

[ "$#" -le 1 ] || fail 'only one mode can be selected'

require_file() {
  [ -f "$1" ] || fail "$1 is missing"
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
  if grep -Fq -- "$pattern" "$file"; then
    fail "$label is present"
  fi
  pass "$label absent"
}

expect_blank_env() {
  local file="$1"
  local variable="$2"
  grep -Eq "^${variable}=$" "$file" || fail "$variable must be documented without a value"
  pass "$variable documented without a value"
}

require_file "$RUNBOOK"
require_executable "$PREFLIGHT"
require_executable "$MIGRATE_SCRIPT"
require_file "$COMPOSE_FILE"
require_file "$NGINX_FILE"
require_file "$ROOT_ENV"
require_file "$BACKEND_ENV"
require_file "$ENV_CONFIG"
require_file "$SECRET_CONFIG"
require_file "$CI_WORKFLOW"

require_pattern "$COMPOSE_FILE" 'pgvector/pgvector:0.8.3-pg16' 'pinned pgvector production image'
require_pattern "$COMPOSE_FILE" 'agno-bridge:' 'Agno bridge production service'
require_pattern "$COMPOSE_FILE" 'profiles: ["agno"]' 'Agno opt-in profile'
require_pattern "$COMPOSE_FILE" 'profiles: ["operations"]' 'migration opt-in profile'
require_pattern "$COMPOSE_FILE" 'command: ["npm", "run", "prisma:migrate:deploy"]' 'migration deploy job'
require_pattern "$COMPOSE_FILE" '/health/db' 'backend database healthcheck'
require_pattern "$COMPOSE_FILE" 'pg_isready' 'database healthcheck'
require_pattern "$COMPOSE_FILE" 'AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY: "true"' 'Agno bearer requirement'
require_pattern "$COMPOSE_FILE" 'AGNO_RUNTIME_HTTP_TOOLS_ENABLED: "false"' 'Agno tools disabled'
require_pattern "$COMPOSE_FILE" 'AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS: "0"' 'Agno max tool calls zero'
require_pattern "$COMPOSE_FILE" 'MCP_REMOTE_EXECUTION_ENABLED: "false"' 'MCP execution disabled'
reject_pattern "$COMPOSE_FILE" 'container_name:' 'container_name declaration'

require_pattern "$NGINX_FILE" 'location = /health' 'Nginx health endpoint'
require_pattern "$NGINX_FILE" 'location ^~ /api/' 'Nginx API proxy location'
require_pattern "$NGINX_FILE" 'proxy_pass http://backend:3000;' 'Nginx backend upstream'
require_pattern "$NGINX_FILE" 'try_files $uri $uri/ /index.html;' 'Nginx SPA fallback'

for variable in POSTGRES_PASSWORD DATABASE_URL JWT_SECRET AGNO_RUNTIME_HTTP_SECURITY_KEY; do
  expect_blank_env "$ROOT_ENV" "$variable"
done
for variable in RUNTIME_PROVIDER AGNO_RUNTIME_HTTP_ENABLED AGNO_BRIDGE_EXECUTION_MODE AGNO_BRIDGE_PROVIDER; do
  grep -Eq "^${variable}=" "$ROOT_ENV" || fail "$variable is missing from .env.example"
  pass "$variable documented in .env.example"
done

require_pattern "$ENV_CONFIG" 'productionJwtSecretIssue(value.NODE_ENV, value.JWT_SECRET)' 'production JWT fail-fast hook'
require_pattern "$SECRET_CONFIG" 'minimumProductionJwtSecretLength = 32' 'strong production JWT minimum'
require_pattern "$SECRET_CONFIG" "normalizedSecret.includes('placeholder')" 'placeholder JWT rejection'
require_pattern "$ROOT_DIR/backend/tests/unit/production-secrets.test.ts" 'rejects missing-strength and placeholder JWT secrets' 'production secret unit test'

require_pattern "$MIGRATE_SCRIPT" 'run prisma:migrate:deploy' 'migration deploy command'
require_pattern "$MIGRATE_SCRIPT" 'DATABASE_URL is required' 'migration DATABASE_URL validation'
require_pattern "$MIGRATE_SCRIPT" '--confirm deploy-NAME' 'migration confirmation contract'
reject_pattern "$MIGRATE_SCRIPT" 'prisma:migrate:dev' 'migrate dev command'

for smoke in \
  smoke-custos-quotas-runtime-16n.sh \
  smoke-observabilidade-runtime-16m.sh \
  smoke-chat-rag-operacional-16k.sh \
  smoke-knowledge-rag-16i.sh
do
  require_executable "$ROOT_DIR/scripts/$smoke"
done

for section in \
  '## Objetivo' \
  '## Arquitetura produtiva esperada' \
  '## pgvector' \
  '## Variáveis e secrets obrigatórios' \
  '## Agno bridge' \
  '## Migration deploy' \
  '## Backup antes da migration' \
  '## Restore testado' \
  '## Rollback' \
  '## CI/CD mínimo' \
  '## Critérios de aceite' \
  '## Riscos remanescentes'
do
  require_pattern "$RUNBOOK" "$section" "runbook section $section"
done

require_pattern "$CI_WORKFLOW" 'npm --prefix backend run typecheck' 'CI backend typecheck'
require_pattern "$CI_WORKFLOW" 'npm --prefix frontend run typecheck' 'CI frontend typecheck'
require_pattern "$CI_WORKFLOW" 'npm --prefix frontend run build' 'CI frontend build'
require_pattern "$CI_WORKFLOW" 'smoke-hardening-producao-runtime-16o.sh --dry-run' 'CI smoke 16O'
reject_pattern "$CI_WORKFLOW" '${{ secrets.' 'CI secret reference'
reject_pattern "$CI_WORKFLOW" 'migrate:deploy' 'CI migration execution'

if grep -ERn --include='docker-compose.prod.yml' --include='.env.example' \
  '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)' \
  "$ROOT_DIR" >/dev/null; then
  fail 'apparent API key or private key detected in changed production configuration'
fi
pass 'no apparent API key or private key in changed production configuration'

if grep -Eq 'postgres(ql)?://[^$[:space:]]+:[^$[:space:]@]+@' "$COMPOSE_FILE" "$ROOT_ENV"; then
  fail 'literal DATABASE_URL detected in changed production configuration'
fi
pass 'no literal DATABASE_URL in changed production configuration'

if git -C "$ROOT_DIR" diff --name-only -- backend/prisma/schema.prisma backend/prisma/migrations | grep -q .; then
  fail 'Prisma schema or migrations changed'
fi
pass 'Prisma schema and migrations unchanged'

"$PREFLIGHT" --dry-run >/dev/null || fail '16O preflight dry-run'
pass '16O preflight dry-run'
"$MIGRATE_SCRIPT" --dry-run --environment homologation >/dev/null || fail 'migration script dry-run'
pass 'migration script dry-run'

printf '\nProduction hardening runtime 16O smoke summary: PASS=%d FAIL=0\n' "$pass_count"
