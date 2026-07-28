#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
STRICT_BASELINE=false
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK_17B="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_HARDENING_COMPOSE_NGINX_17B.md"
RUNBOOK_17A="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PLANO_DEPLOY_HOMOLOGADO_17A.md"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
BACKEND_DOCKERFILE="$ROOT_DIR/backend/Dockerfile.prod"
FRONTEND_DOCKERFILE="$ROOT_DIR/frontend/Dockerfile.prod"
NGINX_CONFIG="$ROOT_DIR/frontend/nginx.conf"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
FRONTEND_ENV="$ROOT_DIR/frontend/.env.example"
RUNTIME_ENV="$ROOT_DIR/runtime/agno-bridge/.env.example"
CI="$ROOT_DIR/.github/workflows/ci.yml"
DOC_INDEX="$ROOT_DIR/docs/ai-orchestration/README.md"
STATE_DOC="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_ESTADO_ATUAL_PROJETO.md"
DOC_16Z="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PREPARACAO_PUBLICACAO_HTTPS_16Z.md"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/preflight-hardening-compose-nginx-17b.sh [MODE]

Modes:
  --dry-run                Validate the static/offline 17B safety contract.
  --strict-baseline        Also require functional source to match the 17B snapshot.
  --check-prod-artifacts   Validate production Compose, Dockerfiles and Nginx statically.
  --template               Print review, future manual check, evidence and rollback examples.
  --help                   Print this help.

Every mode is offline, read-only and non-operational. This script never calls network
or DNS services, executes curl, starts or runs a container, deploys, migrates a database,
executes MCP/provider code, resolves or prints a secret, or changes a file.

The default dry-run is forward-compatible with governed functional phases after 17B.
Use --strict-baseline only to audit the original 17B functional-source snapshot.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

warn() {
  printf 'WARN %s\n' "$1" >&2
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n17B hardening preflight summary: mode=%s PASS=%d FAIL=1 deployment=false realExecution=false\n' \
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

require_regex() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  grep -Eq -- "$pattern" "$file" || fail "$label is missing"
  pass "$label"
}

require_exact_line() {
  local file="$1"
  local line="$2"
  local label="$3"
  grep -Fxq -- "$line" "$file" || fail "$label is missing or changed"
  pass "$label"
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

check_env_examples() {
  local file
  for file in "$ROOT_ENV" "$BACKEND_ENV"; do
    require_exact_line "$file" 'MCP_REMOTE_ENABLED=false' \
      "${file#"$ROOT_DIR/"} remote MCP disabled"
    require_exact_line "$file" 'MCP_REMOTE_EXECUTION_ENABLED=false' \
      "${file#"$ROOT_DIR/"} remote execution disabled"
    require_exact_line "$file" 'MCP_REMOTE_DISCOVERY_ENABLED=false' \
      "${file#"$ROOT_DIR/"} remote discovery disabled"
    require_exact_line "$file" 'MCP_REMOTE_READONLY_ENABLED=false' \
      "${file#"$ROOT_DIR/"} remote read-only disabled"
    require_exact_line "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' \
      "${file#"$ROOT_DIR/"} remote allowlist empty"
    require_exact_line "$file" 'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' \
      "${file#"$ROOT_DIR/"} remote write tools disabled"
    require_exact_line "$file" 'MCP_CORPORATE_READONLY_ENABLED=false' \
      "${file#"$ROOT_DIR/"} corporate adapter disabled"
    require_exact_line "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' \
      "${file#"$ROOT_DIR/"} corporate origin empty"
  done

  require_exact_line "$ROOT_ENV" 'FRONTEND_ORIGIN=http://localhost:5173' \
    'root example frontend origin remains local'
  require_exact_line "$BACKEND_ENV" 'FRONTEND_ORIGIN=http://localhost:5173' \
    'backend example frontend origin remains local'
  require_exact_line "$FRONTEND_ENV" \
    'VITE_API_BASE_URL=http://localhost:3000/api/v1' \
    'frontend example API remains local'
  require_exact_line "$BACKEND_ENV" 'COOKIE_SECURE=false' \
    'backend example cookie setting remains local-only'

  for setting in \
    'LLM_PROVIDERS_ENABLED=false' \
    'LLM_EXECUTION_ENABLED=false' \
    'OPENAI_ENABLED=false' \
    'OPENAI_EXECUTION_ENABLED=false' \
    'AZURE_OPENAI_ENABLED=false' \
    'AZURE_OPENAI_EXECUTION_ENABLED=false' \
    'ANTHROPIC_ENABLED=false' \
    'ANTHROPIC_EXECUTION_ENABLED=false' \
    'EMBEDDINGS_ENABLED=false' \
    'EMBEDDINGS_EXECUTION_ENABLED=false'
  do
    require_exact_line "$BACKEND_ENV" "$setting" \
      "backend example external provider gate $setting"
  done

  for file in "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV"; do
    reject_pattern "$file" \
      '(https://)?(api\.)?orchestra\.mcm\.eng\.br' \
      "planned Orchestra URL in ${file#"$ROOT_DIR/"}"
  done
}

check_compose_fail_closed() {
  local setting
  for setting in \
    'RUNTIME_ALLOW_PROVIDER_FALLBACK: "false"' \
    'RUNTIME_ALLOW_EXTERNAL_TOOLS: "false"' \
    'AGNO_ENABLED: "false"' \
    'AGNO_EXECUTION_ENABLED: "false"' \
    'AGNO_RUNTIME_HTTP_TOOLS_ENABLED: "false"' \
    'AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS: "0"' \
    'AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED: "false"' \
    'MCP_REMOTE_ENABLED: "false"' \
    'MCP_REMOTE_EXECUTION_ENABLED: "false"' \
    'MCP_REMOTE_DISCOVERY_ENABLED: "false"' \
    'MCP_REMOTE_READONLY_ENABLED: "false"' \
    'MCP_REMOTE_EGRESS_ALLOWLIST: ""' \
    'MCP_REMOTE_ALLOW_WRITE_TOOLS: "false"' \
    'MCP_CORPORATE_READONLY_ENABLED: "false"' \
    'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN: ""' \
    'LLM_PROVIDERS_ENABLED: "false"' \
    'LLM_EXECUTION_ENABLED: "false"' \
    'OPENAI_ENABLED: "false"' \
    'OPENAI_EXECUTION_ENABLED: "false"' \
    'AZURE_OPENAI_ENABLED: "false"' \
    'AZURE_OPENAI_EXECUTION_ENABLED: "false"' \
    'ANTHROPIC_ENABLED: "false"' \
    'ANTHROPIC_EXECUTION_ENABLED: "false"' \
    'EMBEDDINGS_ENABLED: "false"' \
    'EMBEDDINGS_EXECUTION_ENABLED: "false"'
  do
    require_pattern "$PROD_COMPOSE" "$setting" \
      "production fail-closed setting $setting"
  done
}

check_no_planned_urls() {
  local file
  for file in "$PROD_COMPOSE" "$BACKEND_DOCKERFILE" "$FRONTEND_DOCKERFILE" \
    "$NGINX_CONFIG" "$CI"
  do
    reject_pattern "$file" \
      '(https://)?(api\.)?orchestra\.mcm\.eng\.br' \
      "planned Orchestra URL in ${file#"$ROOT_DIR/"}"
  done

  if grep -ERn \
    '(https://)?(api\.)?orchestra\.mcm\.eng\.br' \
    "$ROOT_DIR/backend/src" "$ROOT_DIR/frontend/src" >/dev/null
  then
    fail 'planned Orchestra URL is materialized in functional source'
  fi
  pass 'planned Orchestra URLs are absent from functional source'
}

check_no_apparent_secret() {
  if grep -ERn \
    '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})' \
    "$RUNBOOK_17B" "$PROD_COMPOSE" "$BACKEND_DOCKERFILE" "$FRONTEND_DOCKERFILE" \
    "$NGINX_CONFIG" "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV" \
    "$CI" >/dev/null
  then
    fail 'apparent credential material detected in the 17B scope'
  fi
  pass 'no apparent credential material in the 17B scope'
}

check_untouched_functional_scope() {
  if git -C "$ROOT_DIR" status --short -- \
    backend/prisma/schema.prisma backend/prisma/migrations | grep -q .
  then
    fail 'Prisma schema or migrations changed'
  fi
  pass 'Prisma schema and migrations are unchanged'

  if git -C "$ROOT_DIR" status --short -- backend/src frontend/src | grep -q .
  then
    if [ "$STRICT_BASELINE" = true ]; then
      fail 'backend or frontend functional source differs from the historical 17B baseline'
    fi
    warn 'backend or frontend functional source differs from the historical 17B baseline; accepted in forward-compatible dry-run (use --strict-baseline to enforce)'
  else
    pass 'backend and frontend functional source are unchanged from the historical 17B baseline'
  fi
}

check_ci() {
  require_pattern "$CI" \
    'scripts/smoke-hardening-compose-nginx-17b.sh --dry-run' \
    'CI runs the 17B smoke in dry-run mode'
  reject_pattern "$CI" \
    'scripts/preflight-hardening-compose-nginx-17b\.sh' \
    'direct 17B preflight invocation in CI'
  reject_pattern "$CI" \
    'smoke-hardening-compose-nginx-17b\.sh[[:space:]]+--(check-prod-artifacts|template|live|run|deploy)' \
    'non-dry 17B smoke mode in CI'
  [ "$(grep -Ec -- 'scripts/(preflight|smoke)-hardening-compose-nginx-17b\.sh' "$CI")" -eq 1 ] \
    || fail 'CI must contain exactly one 17B script invocation'
  pass 'CI contains exactly one 17B dry-run smoke invocation'
}

check_runbook_contract() {
  local section
  for section in \
    '## Objetivo' \
    '## Escopo' \
    '## Fora de escopo' \
    '## Estado atual local' \
    '## Relação com 16Z e 17A' \
    '## Artefatos revisados' \
    '## Hardening do Docker Compose de produção' \
    '## Hardening do backend/Dockerfile.prod' \
    '## Hardening do frontend/Dockerfile.prod' \
    '## Hardening do frontend/nginx.conf' \
    '## Variáveis obrigatórias de produção' \
    '## Fail-closed de MCP, corporate e providers' \
    '## Segurança de secrets' \
    '## Healthchecks e readiness' \
    '## Rede, portas e exposição mínima' \
    '## Volumes e persistência' \
    '## Profile de migrations e operations' \
    '## Rollback' \
    '## Riscos remanescentes' \
    '## Validação offline' \
    '## Próximo passo sugerido'
  do
    require_pattern "$RUNBOOK_17B" "$section" "runbook section $section"
  done

  require_pattern "$RUNBOOK_17B" 'A 17B não executa deploy.' \
    'runbook no-deploy boundary'
  require_pattern "$RUNBOOK_17B" 'A 17B não publica URLs.' \
    'runbook no-publication boundary'
  require_pattern "$RUNBOOK_17B" 'A 17B não executa MCP real.' \
    'runbook no-real-MCP boundary'
  require_pattern "$RUNBOOK_17B" 'A 17B não testa UI/CRUD MCP.' \
    'runbook no-MCP-UI boundary'
  require_pattern "$RUNBOOK_17B" 'permanecem planejadas e inativas' \
    'runbook planned inactive URL boundary'
  require_pattern "$RUNBOOK_17B" \
    'A primeira execução real da tool depende de publicação HTTPS futura' \
    'runbook future publication prerequisite'
}

check_prod_artifacts() {
  local file
  for file in "$PROD_COMPOSE" "$BACKEND_DOCKERFILE" "$FRONTEND_DOCKERFILE" "$NGINX_CONFIG"; do
    require_file "$file"
  done

  [ "$(grep -cF -- 'healthcheck:' "$PROD_COMPOSE")" -ge 4 ] \
    || fail 'production Compose must define at least four healthchecks'
  pass 'production Compose defines frontend, backend, database and bridge healthchecks'
  require_pattern "$PROD_COMPOSE" 'condition: service_healthy' \
    'production dependencies use healthy-service conditions'
  require_pattern "$PROD_COMPOSE" \
    'DATABASE_URL: "${DATABASE_URL:?DATABASE_URL must be supplied by the deployment environment}"' \
    'production Compose requires DATABASE_URL at interpolation time'
  require_pattern "$PROD_COMPOSE" \
    'JWT_SECRET: "${JWT_SECRET:?JWT_SECRET must be supplied by the deployment environment}"' \
    'production Compose requires JWT_SECRET at interpolation time'
  require_pattern "$PROD_COMPOSE" 'COOKIE_SECURE: "true"' \
    'production Compose forces secure cookies'
  require_pattern "$PROD_COMPOSE" 'profiles: ["operations"]' \
    'migration service is isolated by the operations profile'
  require_pattern "$PROD_COMPOSE" 'target: operations' \
    'migration service uses the dedicated operations image target'
  require_pattern "$PROD_COMPOSE" 'internal: true' \
    'database network is internal'
  require_pattern "$PROD_COMPOSE" '127.0.0.1' \
    'frontend host binding defaults to loopback'
  [ "$(grep -cE -- '^[[:space:]]+ports:[[:space:]]*$' "$PROD_COMPOSE")" -eq 1 ] \
    || fail 'production Compose must publish only the frontend port'
  pass 'production Compose publishes only the frontend port'
  check_compose_fail_closed

  for file in "$BACKEND_DOCKERFILE" "$FRONTEND_DOCKERFILE"; do
    reject_pattern "$file" \
      '(API_KEY|TOKEN|BEARER|PASSWORD|JWT_SECRET|CLIENT_SECRET)[[:space:]]*=' \
      "secret assignment in ${file#"$ROOT_DIR/"}"
  done
  require_pattern "$BACKEND_DOCKERFILE" 'FROM base AS operations' \
    'backend Dockerfile has a dedicated operations stage'
  require_pattern "$BACKEND_DOCKERFILE" 'RUN npm ci --omit=dev' \
    'backend runtime installs only production dependencies from the lockfile'
  require_pattern "$BACKEND_DOCKERFILE" 'RUN npx prisma generate && npm run build' \
    'Prisma Client is generated in the build stage'
  require_pattern "$BACKEND_DOCKERFILE" 'USER node' \
    'backend images use a non-root user'
  require_pattern "$BACKEND_DOCKERFILE" 'ENV NODE_ENV=production' \
    'backend images set production mode'
  require_pattern "$BACKEND_DOCKERFILE" \
    "fetch('http://127.0.0.1:3000/health/db')" \
    'backend image healthcheck uses database readiness'

  require_regex "$FRONTEND_DOCKERFILE" '^FROM node:.* AS build$' \
    'frontend Dockerfile uses a Node build stage'
  require_regex "$FRONTEND_DOCKERFILE" '^FROM nginx:.* AS runner$' \
    'frontend Dockerfile uses an Nginx runner stage'
  require_pattern "$FRONTEND_DOCKERFILE" 'COPY nginx.conf /etc/nginx/nginx.conf' \
    'frontend image installs the reviewed full Nginx configuration'
  require_pattern "$FRONTEND_DOCKERFILE" 'USER nginx' \
    'frontend image runs as the Nginx non-root user'

  require_pattern "$NGINX_CONFIG" 'try_files $uri $uri/ /index.html;' \
    'Nginx has SPA fallback'
  require_pattern "$NGINX_CONFIG" 'server_tokens off;' \
    'Nginx server tokens are disabled'
  require_pattern "$NGINX_CONFIG" 'add_header X-Content-Type-Options "nosniff" always;' \
    'Nginx sends X-Content-Type-Options'
  require_pattern "$NGINX_CONFIG" 'add_header X-Frame-Options "DENY" always;' \
    'Nginx sends X-Frame-Options'
  require_pattern "$NGINX_CONFIG" \
    'add_header Referrer-Policy "strict-origin-when-cross-origin" always;' \
    'Nginx sends Referrer-Policy'
  require_pattern "$NGINX_CONFIG" 'gzip on;' \
    'Nginx enables controlled gzip compression'
  require_pattern "$NGINX_CONFIG" 'location ^~ /assets/' \
    'Nginx has a dedicated static asset cache policy'
  require_pattern "$NGINX_CONFIG" 'proxy_hide_header Server;' \
    'Nginx hides the upstream Server header'
  require_pattern "$NGINX_CONFIG" 'proxy_hide_header X-Powered-By;' \
    'Nginx hides the upstream technology header'

  check_no_planned_urls
  check_no_apparent_secret
}

run_dry_run() {
  local file
  for file in \
    "$RUNBOOK_17B" "$RUNBOOK_17A" "$PROD_COMPOSE" "$BACKEND_DOCKERFILE" \
    "$FRONTEND_DOCKERFILE" "$NGINX_CONFIG" "$ROOT_ENV" "$BACKEND_ENV" \
    "$FRONTEND_ENV" "$RUNTIME_ENV" "$CI" "$DOC_INDEX" "$STATE_DOC" "$DOC_16Z"
  do
    require_file "$file"
  done

  check_runbook_contract
  check_prod_artifacts
  check_env_examples
  check_ci
  check_untouched_functional_scope

  bash -n "$0"
  pass '17B preflight Bash syntax is valid'
  pass 'dry-run completed from local versioned state only'
}

render_template() {
  printf '%s\n' \
    '17B production-artifact review template (text only; nothing was executed)' \
    '' \
    'Review checklist:' \
    '  [ ] Required runtime variables are supplied outside Git.' \
    '  [ ] Frontend is the only deliberately published Compose port.' \
    '  [ ] Backend and database healthchecks pass before dependents start.' \
    '  [ ] MCP, corporate adapters, tool execution and external providers remain disabled.' \
    '  [ ] The operations profile is invoked only in an approved maintenance window.' \
    '  [ ] Image digests, backup evidence and rollback owners are recorded.' \
    '' \
    'Future manual Compose validation example (do not paste secret values into logs):' \
    '  docker compose -f docker-compose.prod.yml config' \
    '' \
    'Future manual checks after an approved HTTPS publication:' \
    '  curl -i <HTTPS_FRONTEND_ORIGIN>/health' \
    '  curl -i <HTTPS_API_ORIGIN>/health' \
    '  curl -i <HTTPS_API_ORIGIN>/v1/status' \
    '  inspect response headers for server-token suppression and security headers' \
    '  confirm the database has no published host port' \
    '  confirm the operations profile is not active after migration' \
    '' \
    'Expected sanitized evidence:' \
    '  commit=<APPROVED_COMMIT>' \
    '  compose_config=<PASS|FAIL>' \
    '  image_digests=<SANITIZED_DIGEST_REFERENCES>' \
    '  health_readiness=<NOT_RUN|PASS|FAIL>' \
    '  headers_and_cache=<NOT_RUN|PASS|FAIL>' \
    '  port_and_network_review=<PASS|FAIL>' \
    '  fail_closed_review=<PASS|FAIL>' \
    '  migration=<NOT_RUN|PASS|FAIL>' \
    '  responsible=<ROLE_OR_APPROVED_IDENTIFIER>' \
    '' \
    'Rollback example for a future approved window:' \
    '  restore the previously approved frontend, backend and migration image digests' \
    '  re-render and review the Compose configuration without logging secrets' \
    '  redeploy only through the approved operational process' \
    '  if a migration ran, follow its reviewed database-compatible rollback plan' \
    '' \
    'This output is instructional text. No request, DNS lookup, container, migration, deploy, rollback or MCP execution occurred.'
}

[ "$#" -le 1 ] || { usage >&2; exit 2; }

case "$MODE" in
  --dry-run)
    run_dry_run
    ;;
  --strict-baseline)
    STRICT_BASELINE=true
    run_dry_run
    ;;
  --check-prod-artifacts)
    check_prod_artifacts
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

printf '\n17B hardening preflight summary: mode=%s PASS=%d FAIL=0 strictBaseline=%s deployment=false realExecution=false\n' \
  "${MODE#--}" "$pass_count" "$STRICT_BASELINE"
