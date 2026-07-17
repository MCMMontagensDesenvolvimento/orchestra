#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.prod.yml"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
ROOT_ENV="$ROOT_DIR/.env.example"
NGINX_FILE="$ROOT_DIR/frontend/nginx.conf"
ENV_CONFIG="$ROOT_DIR/backend/src/config/env.ts"
SECRET_CONFIG="$ROOT_DIR/backend/src/config/production-secrets.ts"
MIGRATE_SCRIPT="$ROOT_DIR/scripts/prod-migrate-deploy.sh"
CHECK_COMPOSE=false
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/preflight-prod-runtime-16o.sh [OPTIONS]

Read-only production/homologation preflight. It never loads real .env files, contacts a database,
starts containers, invokes providers, executes tools, or applies migrations.

Options:
  --dry-run         Run the static checks (default and accepted explicitly).
  --check-compose   Also validate Compose syntax without resolving service env files.
  --help            Print this help.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\nProduction runtime 16O preflight summary: PASS=%d FAIL=1\n' "$pass_count" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) shift ;;
    --check-compose) CHECK_COMPOSE=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) usage >&2; fail "unknown option: $1" ;;
  esac
done

require_file() {
  [ -f "$1" ] || fail "$1 is missing"
  pass "${1#"$ROOT_DIR/"} exists"
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

require_file "$COMPOSE_FILE"
require_file "$ROOT_DIR/backend/Dockerfile.prod"
require_file "$ROOT_DIR/frontend/Dockerfile.prod"
require_file "$ROOT_DIR/runtime/agno-bridge/Dockerfile"
require_file "$NGINX_FILE"
require_file "$BACKEND_ENV"
require_file "$ROOT_ENV"
require_file "$ENV_CONFIG"
require_file "$SECRET_CONFIG"
require_file "$MIGRATE_SCRIPT"

require_pattern "$COMPOSE_FILE" 'pgvector/pgvector:' 'pgvector-compatible production database'
require_pattern "$COMPOSE_FILE" 'agno-bridge:' 'production Agno bridge service'
require_pattern "$COMPOSE_FILE" 'profiles: ["agno"]' 'opt-in Agno profile'
require_pattern "$COMPOSE_FILE" 'profiles: ["operations"]' 'opt-in migration job profile'
require_pattern "$COMPOSE_FILE" 'command: ["npm", "run", "prisma:migrate:deploy"]' 'Compose migration deploy job'
require_pattern "$COMPOSE_FILE" '/health/db' 'backend database readiness healthcheck'
require_pattern "$COMPOSE_FILE" 'pg_isready' 'database healthcheck'
require_pattern "$COMPOSE_FILE" 'http://127.0.0.1/health' 'frontend healthcheck'
require_pattern "$COMPOSE_FILE" 'AGNO_RUNTIME_HTTP_TOOLS_ENABLED: "false"' 'Agno tools disabled by default'
require_pattern "$COMPOSE_FILE" 'AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS: "0"' 'Agno max tool calls zero'
require_pattern "$COMPOSE_FILE" 'MCP_REMOTE_EXECUTION_ENABLED: "false"' 'remote MCP execution disabled'
reject_pattern "$COMPOSE_FILE" 'container_name:' 'container_name declaration'

require_pattern "$NGINX_FILE" 'location = /health' 'Nginx health endpoint'
require_pattern "$NGINX_FILE" 'location ^~ /api/' 'Nginx API route'
require_pattern "$NGINX_FILE" 'proxy_pass http://backend:3000;' 'Nginx backend proxy'
require_pattern "$NGINX_FILE" 'try_files $uri $uri/ /index.html;' 'Nginx SPA fallback'

for variable in DATABASE_URL JWT_SECRET POSTGRES_PASSWORD RUNTIME_PROVIDER AGNO_RUNTIME_HTTP_ENABLED AGNO_RUNTIME_HTTP_SECURITY_KEY; do
  if ! grep -Eq "^${variable}=" "$ROOT_ENV" && ! grep -Eq "^${variable}=" "$BACKEND_ENV"; then
    fail "$variable is not documented in an env example"
  fi
  pass "$variable documented in env examples"
done

require_pattern "$ENV_CONFIG" 'productionJwtSecretIssue(value.NODE_ENV, value.JWT_SECRET)' 'production JWT validation hook'
require_pattern "$SECRET_CONFIG" 'minimumProductionJwtSecretLength = 32' 'minimum production JWT strength'
require_pattern "$SECRET_CONFIG" "nodeEnv !== 'production'" 'development/test compatibility guard'
require_pattern "$MIGRATE_SCRIPT" 'run prisma:migrate:deploy' 'auditable prisma migrate deploy command'
require_pattern "$MIGRATE_SCRIPT" 'DATABASE_URL is required' 'migration DATABASE_URL fail-fast'
reject_pattern "$MIGRATE_SCRIPT" 'prisma:migrate:dev' 'prisma migrate dev command'

for smoke in \
  smoke-custos-quotas-runtime-16n.sh \
  smoke-observabilidade-runtime-16m.sh \
  smoke-chat-rag-operacional-16k.sh \
  smoke-knowledge-rag-16i.sh
do
  require_file "$ROOT_DIR/scripts/$smoke"
done

if grep -ERn --include='docker-compose.prod.yml' --include='.env.example' \
  '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----)' \
  "$ROOT_DIR" >/dev/null; then
  fail 'apparent credential material detected in production configuration'
fi
pass 'no apparent credential material in production configuration'

if grep -Eq 'postgres(ql)?://[^$[:space:]]+:[^$[:space:]@]+@' "$COMPOSE_FILE" "$ROOT_ENV"; then
  fail 'literal DATABASE_URL detected in production configuration'
fi
pass 'no literal DATABASE_URL in production configuration'

if grep -Eq "POSTGRES_PASSWORD:[[:space:]]*[\"']?[A-Za-z0-9]" "$COMPOSE_FILE"; then
  fail 'literal database password detected in production Compose'
fi
pass 'no literal database password in production Compose'

if git -C "$ROOT_DIR" diff --name-only -- backend/prisma/schema.prisma backend/prisma/migrations | grep -q .; then
  fail 'Prisma schema or migrations changed'
fi
pass 'Prisma schema and migrations unchanged'

if [ "$CHECK_COMPOSE" = true ]; then
  command -v docker >/dev/null 2>&1 || fail 'docker is required for --check-compose'
  docker compose version >/dev/null 2>&1 || fail 'Docker Compose plugin is required for --check-compose'
  env \
    DATABASE_URL='postgresql://compose_check:compose_check@db:5432/orchestra' \
    JWT_SECRET='compose-check-only-secret-with-32-characters' \
    POSTGRES_PASSWORD='compose-check-only-password' \
    docker compose --env-file /dev/null --profile agno -f "$COMPOSE_FILE" \
      config --quiet --no-env-resolution \
    || fail 'docker-compose.prod.yml syntax validation'
  pass 'docker-compose.prod.yml syntax validation'
fi

printf '\nProduction runtime 16O preflight summary: PASS=%d FAIL=0\n' "$pass_count"
