#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PREPARACAO_PUBLICACAO_HTTPS_16Z.md"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
BACKEND_DOCKERFILE="$ROOT_DIR/backend/Dockerfile.prod"
FRONTEND_DOCKERFILE="$ROOT_DIR/frontend/Dockerfile.prod"
NGINX_CONFIG="$ROOT_DIR/frontend/nginx.conf"
APP_ROUTES="$ROOT_DIR/backend/src/app/routes.ts"
HEALTH_ROUTES="$ROOT_DIR/backend/src/modules/health/health.routes.ts"
STATUS_ROUTES="$ROOT_DIR/backend/src/modules/status/status.routes.ts"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
FRONTEND_ENV="$ROOT_DIR/frontend/.env.example"
RUNTIME_ENV="$ROOT_DIR/runtime/agno-bridge/.env.example"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/preflight-publicacao-https-16z.sh [MODE]

Modes:
  --dry-run           Validate versioned HTTPS publication structure and fail-closed defaults.
  --check-local-config
                      Validate only the current local/example configuration contract.
  --template          Print DNS, environment, deployment and post-deploy templates; execute nothing.
  --help              Print this help.

All modes are offline and read-only. The script never calls a URL, executes curl, starts
Docker Compose, deploys, resolves or prints a secret, changes a file, or executes MCP.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n16Z HTTPS publication preflight summary: mode=%s PASS=%d FAIL=1 realExecution=false\n' \
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

require_exact_line() {
  local file="$1"
  local line="$2"
  local label="$3"
  grep -Fxq -- "$line" "$file" || fail "$label is missing or changed"
  pass "$label"
}

require_empty_assignment() {
  local file="$1"
  local name="$2"
  grep -Fxq -- "$name=" "$file" || fail "$name must be empty in ${file#"$ROOT_DIR/"}"
  pass "$name is empty in ${file#"$ROOT_DIR/"}"
}

reject_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -Eq -- "$pattern" "$file"; then
    fail "$label is present"
  fi
  pass "$label is absent"
}

check_env_fail_closed() {
  local file
  for file in "$ROOT_ENV" "$BACKEND_ENV"; do
    require_pattern "$file" 'MCP_REMOTE_ENABLED=false' \
      "${file#"$ROOT_DIR/"} remote MCP disabled"
    require_pattern "$file" 'MCP_REMOTE_EXECUTION_ENABLED=false' \
      "${file#"$ROOT_DIR/"} remote execution disabled"
    require_pattern "$file" 'MCP_REMOTE_DISCOVERY_ENABLED=false' \
      "${file#"$ROOT_DIR/"} remote discovery disabled"
    require_pattern "$file" 'MCP_REMOTE_READONLY_ENABLED=false' \
      "${file#"$ROOT_DIR/"} remote read-only disabled"
    require_empty_assignment "$file" MCP_REMOTE_EGRESS_ALLOWLIST
    require_pattern "$file" 'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' \
      "${file#"$ROOT_DIR/"} write tools disabled"
    require_pattern "$file" 'MCP_CORPORATE_READONLY_ENABLED=false' \
      "${file#"$ROOT_DIR/"} corporate adapter disabled"
    require_empty_assignment "$file" MCP_CORPORATE_READONLY_ALLOWED_ORIGIN
  done
}

check_prod_fail_closed() {
  local pattern
  for pattern in \
    'MCP_REMOTE_ENABLED: "false"' \
    'MCP_REMOTE_EXECUTION_ENABLED: "false"' \
    'MCP_REMOTE_DISCOVERY_ENABLED: "false"' \
    'MCP_REMOTE_READONLY_ENABLED: "false"' \
    'MCP_REMOTE_EGRESS_ALLOWLIST: ""' \
    'MCP_REMOTE_ALLOW_WRITE_TOOLS: "false"' \
    'MCP_CORPORATE_READONLY_ENABLED: "false"' \
    'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: ""'
  do
    require_pattern "$PROD_COMPOSE" "$pattern" "production fail-closed setting $pattern"
  done
}

check_no_operational_endpoint_in_env_examples() {
  local file
  for file in "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV"; do
    reject_pattern "$file" \
      '(https://)?(api\.)?orchestra\.mcm\.eng\.br|/v1/status(/availability)?' \
      "planned Orchestra endpoint in ${file#"$ROOT_DIR/"}"
  done
}

check_no_apparent_secret() {
  if grep -ERn \
    '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})' \
    "$RUNBOOK" "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV" \
    "$PROD_COMPOSE" >/dev/null
  then
    fail 'apparent credential material detected in the 16Z publication scope'
  fi
  pass 'no apparent credential material in the 16Z publication scope'
}

check_prisma_unchanged() {
  if git -C "$ROOT_DIR" status --short -- \
    backend/prisma/schema.prisma backend/prisma/migrations | grep -q .
  then
    fail 'Prisma schema or migrations changed'
  fi
  pass 'Prisma schema and migrations are unchanged'
}

run_dry_run() {
  local file
  for file in \
    "$RUNBOOK" "$PROD_COMPOSE" "$BACKEND_DOCKERFILE" "$FRONTEND_DOCKERFILE" \
    "$APP_ROUTES" "$HEALTH_ROUTES" "$STATUS_ROUTES" \
    "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV"
  do
    require_file "$file"
  done

  for section in \
    '## Objetivo' '## Escopo' '## Fora de escopo' '## Contexto local atual' \
    '## URLs planejadas' '## Diferença entre frontend e backend/API' '## Topologia alvo' \
    '## Checklist DNS' '## Checklist TLS/certificado' \
    '## Checklist reverse proxy/Nginx' '## Checklist Docker Compose produção' \
    '## Checklist de variáveis de ambiente' '## Checklist de secrets' \
    '## Checklist de CORS/cookies' '## Checklist de health/readiness' \
    '## Checklist de MCP/corporate fail-closed' '## Checklist antes do primeiro deploy' \
    '## Checklist após deploy manual' '## Comandos manuais sugeridos, mas não executados automaticamente' \
    '## Evidências esperadas' '## Rollback' '## Riscos remanescentes' \
    '## Relação com 16T, 16U, 16V, 16W, 16X e 16Y' '## Próximo passo sugerido'
  do
    require_pattern "$RUNBOOK" "$section" "runbook section $section"
  done
  require_pattern "$RUNBOOK" 'A 16Z não publica nada' 'runbook no-deploy boundary'
  require_pattern "$RUNBOOK" 'não executa MCP real' 'runbook no-real-MCP boundary'
  require_pattern "$RUNBOOK" 'O ambiente continua totalmente local' 'runbook local-state boundary'
  require_pattern "$RUNBOOK" 'depois que a API HTTPS estiver publicada e validada' \
    'runbook real-tool prerequisite'
  require_pattern "$RUNBOOK" 'O usuário será avisado explicitamente' \
    'runbook direct-test notice'
  require_pattern "$RUNBOOK" 'UI/CRUD MCP' 'runbook keeps MCP UI/CRUD out of scope'

  if [ -e "$NGINX_CONFIG" ]; then
    require_file "$NGINX_CONFIG"
    require_pattern "$NGINX_CONFIG" 'proxy_set_header Host $host;' \
      'Nginx preserves Host'
    require_pattern "$NGINX_CONFIG" 'proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
      'Nginx preserves forwarded client chain'
    require_pattern "$NGINX_CONFIG" 'proxy_set_header X-Forwarded-Proto $scheme;' \
      'Nginx preserves forwarded protocol'
    require_pattern "$NGINX_CONFIG" 'proxy_hide_header X-Powered-By;' \
      'Nginx hides upstream technology header'
  else
    pass 'no existing Nginx/proxy file requires validation'
  fi

  require_pattern "$APP_ROUTES" "app.use('/health', createHealthRouter(dependencies));" \
    'backend /health mount'
  require_pattern "$HEALTH_ROUTES" "router.get('/'," 'backend GET /health route'
  require_pattern "$APP_ROUTES" "app.use('/v1/status', createStatusRouter(dependencies));" \
    'backend /v1/status mount'
  require_pattern "$STATUS_ROUTES" "router.get('/'," 'backend GET /v1/status route'
  require_pattern "$STATUS_ROUTES" "router.get('/availability'," \
    'backend GET /v1/status/availability route'

  check_env_fail_closed
  check_prod_fail_closed
  check_no_operational_endpoint_in_env_examples
  reject_pattern "$PROD_COMPOSE" \
    '(https://)?api\.orchestra\.mcm\.eng\.br|/v1/status(/availability)?' \
    'operational corporate/status endpoint in production Compose'
  check_no_apparent_secret
  check_prisma_unchanged

  bash -n "$0"
  pass '16Z preflight Bash syntax is valid'
  pass 'dry-run completed by reading local versioned state only'
}

run_check_local_config() {
  local file
  for file in "$RUNBOOK" "$PROD_COMPOSE" "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV"; do
    require_file "$file"
  done

  require_exact_line "$ROOT_ENV" 'FRONTEND_ORIGIN=http://localhost:5173' \
    'root example local frontend origin'
  require_exact_line "$BACKEND_ENV" 'FRONTEND_ORIGIN=http://localhost:5173' \
    'backend example local frontend origin'
  require_exact_line "$BACKEND_ENV" 'PORT=3000' 'backend example local port'
  require_exact_line "$BACKEND_ENV" 'COOKIE_SECURE=false' \
    'backend example local cookie security'
  require_exact_line "$BACKEND_ENV" 'JWT_SECRET=change-me-in-production' \
    'backend example JWT placeholder'
  require_exact_line "$ROOT_ENV" 'JWT_SECRET=' 'root example empty JWT secret'
  require_exact_line "$BACKEND_ENV" \
    'MICROSOFT_REDIRECT_URI=http://localhost:3000/api/v1/auth/microsoft/callback' \
    'backend example local Microsoft redirect'
  require_exact_line "$FRONTEND_ENV" \
    'VITE_API_BASE_URL=http://localhost:3000/api/v1' \
    'frontend example local API base'

  require_pattern "$PROD_COMPOSE" 'COOKIE_SECURE: "true"' \
    'production Compose requires secure cookies'
  require_pattern "$PROD_COMPOSE" \
    'FRONTEND_ORIGIN: "${FRONTEND_ORIGIN:-http://localhost:5173}"' \
    'production Compose supports runtime frontend origin'
  require_pattern "$PROD_COMPOSE" \
    'JWT_SECRET: "${JWT_SECRET:?JWT_SECRET must be supplied by the deployment environment}"' \
    'production Compose requires runtime JWT secret'
  require_pattern "$RUNBOOK" 'não aceitar o fallback local em publicação' \
    'runbook requires production frontend-origin override'
  require_pattern "$RUNBOOK" 'secret forte e exclusivo' \
    'runbook requires JWT replacement in production'
  require_pattern "$RUNBOOK" 'SSO produtivo exige ajuste manual futuro' \
    'runbook documents future manual SSO configuration'

  check_env_fail_closed
  check_no_operational_endpoint_in_env_examples
  check_no_apparent_secret
  check_prisma_unchanged
  pass 'local/example configuration remains local and production guidance remains external'
}

render_template() {
  printf '%s\n' \
    '16Z HTTPS publication template (instructions only; nothing was executed)' \
    '' \
    'Expected DNS records:' \
    '  orchestra.mcm.eng.br     A/AAAA/CNAME -> <APPROVED_HTTPS_INGRESS>' \
    '  api.orchestra.mcm.eng.br A/AAAA/CNAME -> <APPROVED_HTTPS_INGRESS>' \
    '' \
    'Production environment template (placeholders only; keep real values outside Git):' \
    '  NODE_ENV=production' \
    '  FRONTEND_ORIGIN=<HTTPS_FRONTEND_ORIGIN>' \
    '  VITE_API_BASE_URL=<HTTPS_API_BASE_URL>/api/v1' \
    '  COOKIE_SECURE=true' \
    '  DATABASE_URL=<SECRET_MANAGER_REFERENCE>' \
    '  JWT_SECRET=<SECRET_MANAGER_REFERENCE>' \
    '  MICROSOFT_REDIRECT_URI=<HTTPS_API_BASE_URL>/api/v1/auth/microsoft/callback' \
    '  MCP_REMOTE_ENABLED=false' \
    '  MCP_REMOTE_EXECUTION_ENABLED=false' \
    '  MCP_REMOTE_DISCOVERY_ENABLED=false' \
    '  MCP_REMOTE_READONLY_ENABLED=false' \
    '  MCP_REMOTE_EGRESS_ALLOWLIST=' \
    '  MCP_CORPORATE_READONLY_ENABLED=false' \
    '  MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' \
    '' \
    'Manual Docker Compose examples (review and run only in a future approved deployment):' \
    '  docker compose -f docker-compose.prod.yml config' \
    '  docker compose -f docker-compose.prod.yml --profile operations run --rm migrate' \
    '  docker compose -f docker-compose.prod.yml up -d' \
    '  docker compose -f docker-compose.prod.yml ps' \
    '' \
    'Manual post-deploy checks (review and run only after publication):' \
    '  curl -i https://api.orchestra.mcm.eng.br/health' \
    '  curl -i https://api.orchestra.mcm.eng.br/v1/status' \
    '  curl -i https://api.orchestra.mcm.eng.br/v1/status/availability' \
    '' \
    'These are text templates. No DNS lookup, request, container start, deploy or MCP execution occurred.'
}

[ "$#" -le 1 ] || { usage >&2; exit 2; }

case "$MODE" in
  --dry-run)
    run_dry_run
    ;;
  --check-local-config)
    run_check_local_config
    ;;
  --template)
    render_template
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

printf '\n16Z HTTPS publication preflight summary: mode=%s PASS=%d FAIL=0 realExecution=false\n' \
  "${MODE#--}" "$pass_count"
