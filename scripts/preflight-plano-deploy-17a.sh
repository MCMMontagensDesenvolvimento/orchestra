#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK_17A="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PLANO_DEPLOY_HOMOLOGADO_17A.md"
RUNBOOK_16Z="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PREPARACAO_PUBLICACAO_HTTPS_16Z.md"
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
CI="$ROOT_DIR/.github/workflows/ci.yml"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/preflight-plano-deploy-17a.sh [MODE]

Modes:
  --dry-run                 Validate the versioned 17A plan and static fail-closed state.
  --check-local-readiness   Validate local examples and documented production requirements.
  --template                Print production env, manual deploy, post-deploy, rollback and evidence templates.
  --go-no-go-template       Print the textual go/no-go decision table.
  --help                    Print this help.

Every mode is offline, read-only and non-operational. This script never calls a network
or DNS service, executes curl, starts a container, deploys, migrates a database, resolves
or prints a secret, executes MCP/provider code, or changes a file.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n17A deployment-plan preflight summary: mode=%s PASS=%d FAIL=1 deployment=false realExecution=false\n' \
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
    'RUNTIME_ALLOW_EXTERNAL_TOOLS: "false"' \
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
    'LLM_EXECUTION_ENABLED: "false"' \
    'OPENAI_EXECUTION_ENABLED: "false"' \
    'AZURE_OPENAI_EXECUTION_ENABLED: "false"' \
    'ANTHROPIC_EXECUTION_ENABLED: "false"'
  do
    require_pattern "$PROD_COMPOSE" "$pattern" "production fail-closed setting $pattern"
  done
}

check_no_planned_urls_in_env_examples() {
  local file
  for file in "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV"; do
    reject_pattern "$file" \
      '(https://)?(api\.)?orchestra\.mcm\.eng\.br' \
      "planned Orchestra URL in ${file#"$ROOT_DIR/"}"
  done
}

check_no_operational_endpoint_in_runtime_config() {
  reject_pattern "$PROD_COMPOSE" \
    '(https://)?(api\.)?orchestra\.mcm\.eng\.br|/v1/status(/availability)?' \
    'planned URL or corporate status endpoint in production Compose'
}

check_local_example_values() {
  require_exact_line "$ROOT_ENV" 'FRONTEND_ORIGIN=http://localhost:5173' \
    'root example frontend origin remains local'
  require_exact_line "$BACKEND_ENV" 'FRONTEND_ORIGIN=http://localhost:5173' \
    'backend example frontend origin remains local'
  require_exact_line "$FRONTEND_ENV" \
    'VITE_API_BASE_URL=http://localhost:3000/api/v1' \
    'frontend example API base remains local'
  require_exact_line "$BACKEND_ENV" 'COOKIE_SECURE=false' \
    'backend example cookie security remains local'
}

check_no_apparent_secret() {
  if grep -ERn \
    '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})' \
    "$RUNBOOK_17A" "$RUNBOOK_16Z" "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" \
    "$RUNTIME_ENV" "$PROD_COMPOSE" >/dev/null
  then
    fail 'apparent credential material detected in the 17A plan scope'
  fi
  pass 'no apparent credential material in the 17A plan scope'
}

check_prisma_unchanged() {
  if git -C "$ROOT_DIR" status --short -- \
    backend/prisma/schema.prisma backend/prisma/migrations | grep -q .
  then
    fail 'Prisma schema or migrations changed'
  fi
  pass 'Prisma schema and migrations are unchanged'
}

check_ci_dry_run_only() {
  require_pattern "$CI" 'scripts/smoke-plano-deploy-17a.sh --dry-run' \
    'CI runs the 17A smoke in dry-run mode'
  reject_pattern "$CI" 'scripts/preflight-plano-deploy-17a\.sh' \
    'direct 17A preflight execution in CI'
  reject_pattern "$CI" \
    'smoke-plano-deploy-17a\.sh[[:space:]]+--(template|go-no-go-template|check-local-readiness|live|run|deploy)' \
    'non-dry 17A smoke mode in CI'
}

check_runbook_contract() {
  local section
  for section in \
    '## Objetivo' \
    '## Escopo' \
    '## Fora de escopo' \
    '## Estado atual local' \
    '## URLs planejadas' \
    '## Topologia alvo' \
    '## Papéis e responsabilidades' \
    '## Pré-requisitos' \
    '## Matriz go/no-go' \
    '## Plano de comunicação e janela' \
    '## Checklist antes do deploy' \
    '## Checklist durante o deploy' \
    '## Checklist após deploy' \
    '## Checklist de infraestrutura' \
    '## Checklist DNS' \
    '## Checklist TLS/certificado' \
    '## Checklist reverse proxy/Nginx' \
    '## Checklist Docker Compose produção' \
    '## Checklist banco, backup e restore' \
    '## Checklist secrets' \
    '## Checklist variáveis de ambiente' \
    '## Checklist SSO Microsoft produção' \
    '## Checklist CORS/cookies' \
    '## Checklist health/readiness' \
    '## Checklist MCP/corporate fail-closed' \
    '## Checklist observabilidade/logs' \
    '## Checklist segurança' \
    '## Comandos manuais propostos, mas não executados automaticamente' \
    '## Evidências esperadas' \
    '## Rollback' \
    '## Pós-rollback' \
    '## Riscos remanescentes' \
    '## Relação com 16T, 16U, 16V, 16W, 16X, 16Y e 16Z' \
    '## Próximos passos sugeridos'
  do
    require_pattern "$RUNBOOK_17A" "$section" "runbook section $section"
  done

  require_pattern "$RUNBOOK_17A" 'A 17A é plano, não deploy.' \
    'runbook plan-not-deploy boundary'
  require_pattern "$RUNBOOK_17A" 'O ambiente continua totalmente local.' \
    'runbook local-state boundary'
  require_pattern "$RUNBOOK_17A" 'planejada, não ativa, não consultada e não publicada' \
    'runbook records planned inactive URLs'
  require_pattern "$RUNBOOK_17A" \
    'A primeira execução real da tool só pode ocorrer após a API HTTPS estar publicada e validada' \
    'runbook real-tool prerequisite'
  require_pattern "$RUNBOOK_17A" 'UI/CRUD MCP continua fora de escopo' \
    'runbook keeps MCP UI/CRUD out of scope'
  require_pattern "$RUNBOOK_17A" 'O usuário será avisado explicitamente' \
    'runbook direct-test notice'
  require_pattern "$RUNBOOK_17A" 'deployment=false' \
    'runbook records no deployment'
  require_pattern "$RUNBOOK_17A" 'realExecution=false' \
    'runbook records no real execution'
}

check_local_endpoints() {
  require_pattern "$APP_ROUTES" "app.use('/health', createHealthRouter(dependencies));" \
    'backend /health mount'
  require_pattern "$HEALTH_ROUTES" "router.get('/'," \
    'backend GET /health route'
  require_pattern "$APP_ROUTES" "app.use('/v1/status', createStatusRouter(dependencies));" \
    'backend /v1/status mount'
  require_pattern "$STATUS_ROUTES" "router.get('/'," \
    'backend GET /v1/status route'
  require_pattern "$STATUS_ROUTES" "router.get('/availability'," \
    'backend GET /v1/status/availability route'
}

check_existing_nginx() {
  if [ -e "$NGINX_CONFIG" ]; then
    require_file "$NGINX_CONFIG"
    require_pattern "$NGINX_CONFIG" 'proxy_set_header Host $host;' \
      'Nginx preserves Host'
    require_pattern "$NGINX_CONFIG" \
      'proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;' \
      'Nginx preserves forwarded client chain'
    require_pattern "$NGINX_CONFIG" \
      'proxy_set_header X-Forwarded-Proto $orchestra_forwarded_proto;' \
      'Nginx preserves the approved forwarded protocol mapping'
    require_pattern "$NGINX_CONFIG" 'proxy_hide_header X-Powered-By;' \
      'Nginx hides upstream technology header'
  else
    pass 'no existing Nginx/proxy file requires validation'
  fi
}

run_dry_run() {
  local file
  for file in \
    "$RUNBOOK_17A" "$RUNBOOK_16Z" "$PROD_COMPOSE" \
    "$BACKEND_DOCKERFILE" "$FRONTEND_DOCKERFILE" \
    "$APP_ROUTES" "$HEALTH_ROUTES" "$STATUS_ROUTES" \
    "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV" "$CI"
  do
    require_file "$file"
  done

  check_runbook_contract
  check_existing_nginx
  check_local_endpoints
  check_local_example_values
  check_env_fail_closed
  check_prod_fail_closed
  check_no_planned_urls_in_env_examples
  check_no_operational_endpoint_in_runtime_config
  check_no_apparent_secret
  check_prisma_unchanged
  check_ci_dry_run_only

  bash -n "$0"
  pass '17A preflight Bash syntax is valid'
  pass 'dry-run completed from local versioned state only'
}

run_check_local_readiness() {
  local file
  for file in \
    "$RUNBOOK_17A" "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" \
    "$RUNTIME_ENV" "$PROD_COMPOSE"
  do
    require_file "$file"
  done

  check_local_example_values
  require_exact_line "$BACKEND_ENV" \
    'MICROSOFT_REDIRECT_URI=http://localhost:3000/api/v1/auth/microsoft/callback' \
    'backend example Microsoft redirect remains local'

  require_pattern "$RUNBOOK_17A" '`COOKIE_SECURE` | obrigatoriamente `true` em produção' \
    'runbook requires COOKIE_SECURE=true in production'
  require_pattern "$RUNBOOK_17A" \
    '`JWT_SECRET` forte, exclusivo, rotacionável e fora do Git' \
    'runbook requires a strong JWT secret outside Git'
  require_pattern "$RUNBOOK_17A" '`DATABASE_URL` entregue fora do Git' \
    'runbook requires DATABASE_URL outside Git'
  require_pattern "$RUNBOOK_17A" \
    'callback HTTPS futuro cadastrado exatamente no portal Microsoft' \
    'runbook requires future Microsoft HTTPS redirect'
  require_pattern "$RUNBOOK_17A" \
    'MCP remoto/corporate, tools e providers externos confirmados fail-closed' \
    'runbook keeps MCP/corporate closed for deployment'

  require_pattern "$PROD_COMPOSE" 'COOKIE_SECURE: "true"' \
    'production Compose requires secure cookies'
  require_pattern "$PROD_COMPOSE" \
    'DATABASE_URL: "${DATABASE_URL:?DATABASE_URL must be supplied by the deployment environment}"' \
    'production Compose requires runtime DATABASE_URL'
  require_pattern "$PROD_COMPOSE" \
    'JWT_SECRET: "${JWT_SECRET:?JWT_SECRET must be supplied by the deployment environment}"' \
    'production Compose requires runtime JWT secret'

  check_env_fail_closed
  check_prod_fail_closed
  check_no_planned_urls_in_env_examples
  check_no_apparent_secret
  check_prisma_unchanged
  pass 'local examples remain local and production requirements remain external'
}

render_template() {
  printf '%s\n' \
    '17A operational deployment template (text only; nothing was executed)' \
    '' \
    'Production environment template (placeholders only; keep real values outside Git):' \
    '  NODE_ENV=production' \
    '  FRONTEND_ORIGIN=<HTTPS_FRONTEND_ORIGIN>' \
    '  VITE_API_BASE_URL=<HTTPS_API_BASE_URL>/api/v1' \
    '  COOKIE_SECURE=true' \
    '  COOKIE_SAME_SITE=<APPROVED_SAME_SITE_POLICY>' \
    '  DATABASE_URL=<SECRET_MANAGER_REFERENCE>' \
    '  JWT_SECRET=<SECRET_MANAGER_REFERENCE>' \
    '  MICROSOFT_CLIENT_ID=<SECRET_MANAGER_REFERENCE>' \
    '  MICROSOFT_CLIENT_SECRET=<SECRET_MANAGER_REFERENCE>' \
    '  MICROSOFT_TENANT_ID=<APPROVED_TENANT_ID>' \
    '  MICROSOFT_REDIRECT_URI=<HTTPS_API_BASE_URL>/api/v1/auth/microsoft/callback' \
    '  MICROSOFT_POST_LOGOUT_REDIRECT_URI=<HTTPS_FRONTEND_ORIGIN>/login' \
    '  MCP_REMOTE_ENABLED=false' \
    '  MCP_REMOTE_EXECUTION_ENABLED=false' \
    '  MCP_REMOTE_DISCOVERY_ENABLED=false' \
    '  MCP_REMOTE_READONLY_ENABLED=false' \
    '  MCP_REMOTE_EGRESS_ALLOWLIST=' \
    '  MCP_CORPORATE_READONLY_ENABLED=false' \
    '  MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' \
    '' \
    'Manual deployment command template (future approved window only):' \
    '  docker compose -f docker-compose.prod.yml config' \
    '  docker compose -f docker-compose.prod.yml --profile operations run --rm migrate' \
    '  docker compose -f docker-compose.prod.yml up -d' \
    '  docker compose -f docker-compose.prod.yml ps' \
    '' \
    'Manual post-deploy check template (future approved window only):' \
    '  curl -i https://api.orchestra.mcm.eng.br/health' \
    '  curl -i https://api.orchestra.mcm.eng.br/v1/status' \
    '  curl -i https://api.orchestra.mcm.eng.br/v1/status/availability' \
    '' \
    'Manual rollback template (replace image placeholders outside Git):' \
    '  export ORCHESTRA_FRONTEND_IMAGE=<PREVIOUS_FRONTEND_IMAGE_DIGEST>' \
    '  export ORCHESTRA_BACKEND_IMAGE=<PREVIOUS_BACKEND_IMAGE_DIGEST>' \
    '  docker compose -f docker-compose.prod.yml up -d' \
    '  docker compose -f docker-compose.prod.yml ps' \
    '' \
    'Evidence template (never include secret values or raw payloads):' \
    '  change_id=<APPROVED_CHANGE_ID>' \
    '  commit=<APPROVED_COMMIT>' \
    '  frontend_digest=<APPROVED_FRONTEND_DIGEST>' \
    '  backend_digest=<APPROVED_BACKEND_DIGEST>' \
    '  backup_id=<APPROVED_BACKUP_ID>' \
    '  migration_status=<NOT_RUN|PASS|FAIL>' \
    '  dns_tls_status=<NOT_CHECKED|PASS|FAIL>' \
    '  health_status=<NOT_CHECKED|PASS|FAIL>' \
    '  sso_cors_cookie_status=<NOT_CHECKED|PASS|FAIL>' \
    '  rollback_status=<NOT_REQUIRED|PASS|FAIL>' \
    '  decision=<GO|NO_GO|ROLLED_BACK>' \
    '  responsible=<ROLE_OR_APPROVED_IDENTIFIER>' \
    '' \
    'This output is instructional text. No request, DNS lookup, container, migration, deploy, rollback or MCP execution occurred.'
}

render_go_no_go_template() {
  printf '%s\n' \
    '17A go/no-go template (text only; default decision is NO_GO)' \
    '' \
    '| Item | Status esperado | Evidência | Responsável | Decisão |' \
    '|---|---|---|---|---|' \
    '| Autorizações e janela | PASS | <CHANGE_APPROVAL_REFERENCE> | <CHANGE_OWNER> | <GO|NO_GO> |' \
    '| CI, commit e digests | PASS | <CI_AND_RELEASE_REFERENCE> | <APPLICATION_OWNER> | <GO|NO_GO> |' \
    '| Infraestrutura e capacidade | PASS | <INFRA_CHECKLIST_REFERENCE> | <INFRA_OWNER> | <GO|NO_GO> |' \
    '| DNS, TLS e proxy | PASS | <EDGE_REVIEW_REFERENCE> | <DNS_TLS_OWNER> | <GO|NO_GO> |' \
    '| Banco, backup e restore | PASS | <DBA_EVIDENCE_REFERENCE> | <DBA_OWNER> | <GO|NO_GO> |' \
    '| Secrets e variáveis | PASS | <SANITIZED_SECRET_INVENTORY> | <SECURITY_OWNER> | <GO|NO_GO> |' \
    '| SSO, CORS e cookies | PASS | <IDENTITY_SECURITY_REVIEW> | <IDENTITY_OWNER> | <GO|NO_GO> |' \
    '| Observabilidade e on-call | PASS | <MONITORING_REFERENCE> | <OBSERVABILITY_OWNER> | <GO|NO_GO> |' \
    '| Rollback | PASS | <ROLLBACK_PLAN_REFERENCE> | <CHANGE_OWNER> | <GO|NO_GO> |' \
    '| MCP/corporate fail-closed | PASS | <SANITIZED_CONFIG_REFERENCE> | <SECURITY_OWNER> | <GO|NO_GO> |' \
    '| Decisão final | ALL_PASS | <SIGNED_DECISION_REFERENCE> | <BUSINESS_APPROVER> | <GO|NO_GO> |' \
    '' \
    'Any missing blocking evidence means NO_GO. No state was inspected or changed by this template.'
}

[ "$#" -le 1 ] || { usage >&2; exit 2; }

case "$MODE" in
  --dry-run)
    run_dry_run
    ;;
  --check-local-readiness)
    run_check_local_readiness
    ;;
  --template)
    render_template
    exit 0
    ;;
  --go-no-go-template)
    render_go_no_go_template
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

printf '\n17A deployment-plan preflight summary: mode=%s PASS=%d FAIL=0 deployment=false realExecution=false\n' \
  "${MODE#--}" "$pass_count"
