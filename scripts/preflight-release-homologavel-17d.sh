#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
STRICT_BASELINE=false
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PREFLIGHT_RELEASE_HOMOLOGAVEL_17D.md"
MANIFEST="$ROOT_DIR/docs/ai-orchestration/release/ORCHESTRA_RELEASE_MANIFEST_17D.json"
INVENTORY="$ROOT_DIR/docs/ai-orchestration/secrets/ORCHESTRA_SECRETS_INVENTORY_17C.json"
CI="$ROOT_DIR/.github/workflows/ci.yml"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
FRONTEND_ENV="$ROOT_DIR/frontend/.env.example"
RUNTIME_ENV="$ROOT_DIR/runtime/agno-bridge/.env.example"
PREFLIGHT="$ROOT_DIR/scripts/preflight-release-homologavel-17d.sh"
SMOKE="$ROOT_DIR/scripts/smoke-release-homologavel-17d.sh"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/preflight-release-homologavel-17d.sh [MODE]

Modes:
  --dry-run            Validate the static/offline 17D release and safety contract.
  --strict-baseline    Also require functional source to match the 17D snapshot.
  --check-manifest     Validate the machine-readable 17D manifest.
  --go-no-go-template  Print the textual GO/NO-GO table; execute nothing.
  --help               Print this help.

Every mode is offline, read-only and non-operational. This script never calls network
or DNS services, executes curl/wget, starts Docker Compose, deploys, migrates or rolls
back a database, executes MCP/tool/provider code, tests UI/CRUD, resolves or prints a
secret, or changes a file.

The default dry-run is forward-compatible with governed functional phases after 17D.
Use --strict-baseline only to audit the original 17D functional-source snapshot.
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
  printf '\n17D release preflight summary: mode=%s PASS=%d FAIL=1 deployment=false realExecution=false secretValuesRead=false releasePreflightReady=true deployGo=false\n' \
    "${MODE#--}" "$pass_count" >&2
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

reject_executable_operations() {
  local file="$1"
  local label="$2"

  reject_pattern "$file" \
    '^[[:space:]]*(command[[:space:]]+)?(/[^[:space:]]*/)?(curl|wget|nc|ncat|telnet|ssh|scp|sftp|dig|nslookup|host|getent)[[:space:]]' \
    "executable network/DNS command in $label"
  reject_pattern "$file" \
    '(/dev/(tcp|udp)|^[[:space:]]*(node|python|python3)[[:space:]].*(fetch|request|connect|lookup)[[:space:]]*\()' \
    "executable network API in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(docker[[:space:]]+compose|docker-compose)[[:space:]]+(up|run|start|restart|pull|push|build|exec|create|rm|down|config)' \
    "executable Docker Compose command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(az|azd|kubectl|helm|terraform|pulumi)[[:space:]].*(deploy|apply|up|create|delete|destroy)' \
    "executable infrastructure/deployment command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(npm|npx|pnpm|yarn)[[:space:]].*(prisma:)?migrat(e|ion)' \
    "executable migration command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(npm|npx|node|python|python3)[[:space:]].*(smoke-agno-real|smoke-chat-provider-real|mcp.*run-real|provider.*run-real)' \
    "executable real MCP/provider command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(npx|npm|pnpm|yarn)[[:space:]].*(playwright|cypress|test:e2e|test:visual)' \
    "executable UI/browser command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(rm|mv|cp|install|touch|mkdir|rmdir|chmod|chown|truncate|tee)[[:space:]]' \
    "executable filesystem mutation in $label"
}

check_manifest() {
  require_file "$MANIFEST"

  MANIFEST_PATH="$MANIFEST" node <<'NODE' \
    || fail 'machine-readable 17D manifest contract'
const fs = require('fs');
const path = process.env.MANIFEST_PATH;
const raw = fs.readFileSync(path, 'utf8');
let manifest;
try {
  manifest = JSON.parse(raw);
} catch {
  throw new Error('manifest is not valid JSON');
}

const fail = (message) => {
  throw new Error(message);
};
const exact = {
  phase: '17D',
  name: 'Preflight de Release Homologável sem Deploy',
  baseBranch: 'main',
  deployment: false,
  realExecution: false,
  secretValuesRead: false,
  uiCrudTested: false,
  mcpRealExecuted: false,
  providerRealExecuted: false,
  containsRealValues: false,
  releasePreflightReady: true,
  deployGo: false,
  requiresManualDeployWindow: true,
};
for (const [key, expected] of Object.entries(exact)) {
  if (manifest[key] !== expected) fail(`${key} must equal ${JSON.stringify(expected)}`);
}

if (
  !manifest.plannedUrls
  || manifest.plannedUrls.documentationOnly !== true
  || manifest.plannedUrls.plannedInactive !== true
  || manifest.plannedUrls.frontend !== 'https://orchestra.mcm.eng.br'
  || manifest.plannedUrls.api !== 'https://api.orchestra.mcm.eng.br'
) {
  fail('plannedUrls must be the exact approved documentation-only inactive set');
}

const requireArray = (key) => {
  if (!Array.isArray(manifest[key]) || manifest[key].length === 0) {
    fail(`${key} must be a non-empty array`);
  }
  return manifest[key];
};
const containsAll = (key, expected) => {
  const actual = new Set(requireArray(key));
  for (const value of expected) {
    if (!actual.has(value)) fail(`${key} is missing ${value}`);
  }
};

containsAll('includedPhases', ['16Z', '17A', '17B', '17C', '17D']);
containsAll('requiredArtifacts', [
  'docs/ai-orchestration/README.md',
  'docs/ai-orchestration/ORCHESTRA_ESTADO_ATUAL_PROJETO.md',
  'docs/ai-orchestration/ORCHESTRA_PREPARACAO_PUBLICACAO_HTTPS_16Z.md',
  'docs/ai-orchestration/ORCHESTRA_PLANO_DEPLOY_HOMOLOGADO_17A.md',
  'docs/ai-orchestration/ORCHESTRA_HARDENING_COMPOSE_NGINX_17B.md',
  'docs/ai-orchestration/ORCHESTRA_INVENTARIO_SECRETS_VARIAVEIS_17C.md',
  'docs/ai-orchestration/ORCHESTRA_PREFLIGHT_RELEASE_HOMOLOGAVEL_17D.md',
  'docs/ai-orchestration/release/ORCHESTRA_RELEASE_MANIFEST_17D.json',
  'docs/ai-orchestration/secrets/ORCHESTRA_SECRETS_INVENTORY_17C.json',
  'docker-compose.prod.yml',
  'backend/Dockerfile.prod',
  'frontend/Dockerfile.prod',
  'frontend/nginx.conf',
  '.env.example',
  'backend/.env.example',
  'frontend/.env.example',
  'runtime/agno-bridge/.env.example',
  '.github/workflows/ci.yml',
]);
containsAll('requiredScripts', [
  'scripts/preflight-publicacao-https-16z.sh',
  'scripts/smoke-publicacao-https-16z.sh',
  'scripts/preflight-plano-deploy-17a.sh',
  'scripts/smoke-plano-deploy-17a.sh',
  'scripts/preflight-hardening-compose-nginx-17b.sh',
  'scripts/smoke-hardening-compose-nginx-17b.sh',
  'scripts/preflight-secrets-variaveis-17c.sh',
  'scripts/smoke-secrets-variaveis-17c.sh',
  'scripts/preflight-release-homologavel-17d.sh',
  'scripts/smoke-release-homologavel-17d.sh',
]);
containsAll('requiredDocs', [
  'docs/ai-orchestration/README.md',
  'docs/ai-orchestration/ORCHESTRA_ESTADO_ATUAL_PROJETO.md',
  'docs/ai-orchestration/ORCHESTRA_PREPARACAO_PUBLICACAO_HTTPS_16Z.md',
  'docs/ai-orchestration/ORCHESTRA_PLANO_DEPLOY_HOMOLOGADO_17A.md',
  'docs/ai-orchestration/ORCHESTRA_HARDENING_COMPOSE_NGINX_17B.md',
  'docs/ai-orchestration/ORCHESTRA_INVENTARIO_SECRETS_VARIAVEIS_17C.md',
  'docs/ai-orchestration/ORCHESTRA_PREFLIGHT_RELEASE_HOMOLOGAVEL_17D.md',
]);

const policyIds = new Map(requireArray('requiredPolicies').map((item) => [item.id, item]));
for (const id of [
  'mcp-remote-fail-closed',
  'mcp-corporate-fail-closed',
  'llm-providers-fail-closed',
  'agno-fail-closed',
  'embeddings-fail-closed',
  'external-tools-fail-closed',
]) {
  const policy = policyIds.get(id);
  if (!policy || policy.failClosed !== true || typeof policy.scope !== 'string') {
    fail(`required fail-closed policy ${id} is missing or invalid`);
  }
}

for (const gate of requireArray('deploymentBlockingGates')) {
  if (
    typeof gate.id !== 'string'
    || gate.blocksDeploy !== true
    || typeof gate.reason !== 'string'
    || gate.reason.trim() === ''
  ) {
    fail('deployment blocking gate is invalid');
  }
}
for (const key of ['offlineValidations', 'manualNextSteps']) requireArray(key);

const decisions = new Map(requireArray('goNoGo').map((item) => [item.id, item]));
for (const id of ['real-deployment', 'mcp-real-execution', 'ui-crud-mcp-test']) {
  const item = decisions.get(id);
  if (!item || item.status !== 'NO_GO') fail(`${id} must be NO_GO`);
}
for (const item of decisions.values()) {
  for (const field of ['id', 'status', 'evidence', 'responsible', 'decision']) {
    if (typeof item[field] !== 'string' || item[field].trim() === '') {
      fail(`goNoGo item has invalid ${field}`);
    }
  }
  if (!['GO', 'NO_GO'].includes(item.status)) fail(`invalid status ${item.status}`);
}

const forbiddenValueFields =
  /^(secretValue|resolvedValue|runtimeValue|currentValue|credentialValue|connectionString|apiKey|bearerToken)$/i;
const apparentCredential =
  /(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._~+/-]{16,})/;
const plannedOccurrences = [];
const walk = (value, pathParts = []) => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => walk(entry, [...pathParts, String(index)]));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (forbiddenValueFields.test(key)) fail(`forbidden value field ${[...pathParts, key].join('.')}`);
      walk(entry, [...pathParts, key]);
    }
    return;
  }
  if (typeof value === 'string') {
    if (apparentCredential.test(value)) fail(`apparent credential at ${pathParts.join('.')}`);
    if (/https:\/\/(?:api\.)?orchestra\.mcm\.eng\.br/.test(value)) {
      plannedOccurrences.push(pathParts.join('.'));
    }
  }
};
walk(manifest);
const approvedUrlPaths = new Set(['plannedUrls.frontend', 'plannedUrls.api']);
if (
  plannedOccurrences.length !== approvedUrlPaths.size
  || plannedOccurrences.some((pathName) => !approvedUrlPaths.has(pathName))
) {
  fail('planned URL appears outside plannedUrls documentation-only fields');
}
NODE

  pass 'manifest JSON is valid and satisfies the governed 17D contract'
  reject_pattern "$MANIFEST" \
    '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})' \
    'apparent credential material in manifest'
}

check_inventory_json() {
  require_file "$INVENTORY"
  INVENTORY_PATH="$INVENTORY" node <<'NODE' \
    || fail '17C inventory JSON boundary'
const fs = require('fs');
const inventory = JSON.parse(fs.readFileSync(process.env.INVENTORY_PATH, 'utf8'));
if (inventory.inventoryVersion !== '17C') throw new Error('unexpected inventory version');
if (inventory.containsRealValues !== false) throw new Error('inventory must contain no real values');
if (!Array.isArray(inventory.items) || inventory.items.length === 0) {
  throw new Error('inventory items are missing');
}
if (!Array.isArray(inventory.plannedDocumentationOnly)) {
  throw new Error('planned documentation list is missing');
}
for (const entry of inventory.plannedDocumentationOnly) {
  if (entry.active !== false) throw new Error('planned URL must remain inactive');
}
NODE
  pass '17C inventory is valid JSON and records no real values'
}

check_ci() {
  require_file "$CI"
  require_pattern "$CI" \
    'scripts/smoke-release-homologavel-17d.sh --dry-run' \
    'CI runs the 17D smoke in dry-run mode'
  reject_pattern "$CI" \
    'scripts/preflight-release-homologavel-17d\.sh' \
    'direct 17D preflight execution in CI'
  [ "$(grep -Ec -- 'scripts/(preflight|smoke)-release-homologavel-17d\.sh' "$CI")" -eq 1 ] \
    || fail 'CI must contain exactly one 17D script invocation'
  pass 'CI contains exactly one 17D script invocation'
  require_exact_line "$CI" \
    '        run: scripts/smoke-release-homologavel-17d.sh --dry-run' \
    'CI 17D step is exactly the offline dry-run smoke'

  reject_pattern "$CI" \
    '^[[:space:]]*(run:[[:space:]]*)?(curl|wget|dig|nslookup|host|getent)[[:space:]]' \
    'network/DNS command in CI'
  reject_pattern "$CI" \
    '^[[:space:]]*(run:[[:space:]]*)?(docker[[:space:]]+compose|docker-compose)[[:space:]]+(up|run|start|restart|pull|push|build|exec|config)' \
    'Docker Compose command in CI'
  reject_pattern "$CI" \
    '^[[:space:]]*(run:[[:space:]]*)?(az|azd|kubectl|helm|terraform|pulumi)[[:space:]].*(deploy|apply|up|create|delete|destroy)' \
    'deploy command in CI'
  reject_pattern "$CI" \
    '^[[:space:]]*(run:[[:space:]]*)?(npm|npx|pnpm|yarn)[[:space:]].*(prisma:)?migrat(e|ion)' \
    'migration command in CI'
  reject_pattern "$CI" \
    '(smoke-agno-real|smoke-chat-provider-real|--run-real|--execute-real|test:visual|playwright|cypress)' \
    'real provider/MCP or UI/browser execution in CI'
}

check_fail_closed() {
  local file setting

  for file in "$ROOT_ENV" "$BACKEND_ENV"; do
    for setting in \
      'MCP_REMOTE_ENABLED=false' \
      'MCP_REMOTE_EXECUTION_ENABLED=false' \
      'MCP_REMOTE_DISCOVERY_ENABLED=false' \
      'MCP_REMOTE_READONLY_ENABLED=false' \
      'MCP_REMOTE_ALLOW_WRITE_TOOLS=false' \
      'MCP_CORPORATE_READONLY_ENABLED=false'
    do
      require_exact_line "$file" "$setting" \
        "${file#"$ROOT_DIR/"} fail-closed setting $setting"
    done
    require_exact_line "$file" 'MCP_REMOTE_EGRESS_ALLOWLIST=' \
      "${file#"$ROOT_DIR/"} remote allowlist empty"
    require_exact_line "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' \
      "${file#"$ROOT_DIR/"} corporate origin empty"
  done

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
    'EMBEDDINGS_EXECUTION_ENABLED=false' \
    'AGNO_ENABLED=false' \
    'AGNO_EXECUTION_ENABLED=false' \
    'RUNTIME_ALLOW_EXTERNAL_TOOLS=false' \
    'AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false' \
    'AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0' \
    'AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false'
  do
    require_exact_line "$BACKEND_ENV" "$setting" \
      "backend env fail-closed setting $setting"
  done

  require_exact_line "$FRONTEND_ENV" \
    'VITE_API_BASE_URL=http://localhost:3000/api/v1' \
    'frontend example API base remains local'
  require_exact_line "$RUNTIME_ENV" 'AGNO_BRIDGE_EXECUTION_MODE=stub' \
    'Agno bridge execution remains stub'
  require_exact_line "$RUNTIME_ENV" 'AGNO_BRIDGE_PROVIDER=stub' \
    'Agno bridge provider remains stub'
  require_exact_line "$RUNTIME_ENV" 'AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false' \
    'Agno bridge tools remain disabled'
  require_exact_line "$RUNTIME_ENV" 'AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0' \
    'Agno bridge tool calls remain zero'
  for setting in 'OPENAI_API_KEY=' 'AZURE_OPENAI_API_KEY=' 'AZURE_OPENAI_ENDPOINT=' 'ANTHROPIC_API_KEY='; do
    require_exact_line "$RUNTIME_ENV" "$setting" \
      "runtime env value remains empty: $setting"
  done

  for setting in \
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
      "production Compose fail-closed setting $setting"
  done
}

check_url_scope() {
  local file
  for file in "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" "$RUNTIME_ENV" \
    "$PROD_COMPOSE" "$CI"
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
  pass 'planned URLs are absent from backend and frontend functional source'
}

check_no_apparent_secret() {
  local credential_pattern
  credential_pattern='(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})'
  if grep -ERn -- "$credential_pattern" \
    "$RUNBOOK" "$MANIFEST" "$INVENTORY" \
    "$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PREPARACAO_PUBLICACAO_HTTPS_16Z.md" \
    "$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PLANO_DEPLOY_HOMOLOGADO_17A.md" \
    "$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_HARDENING_COMPOSE_NGINX_17B.md" \
    "$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_INVENTARIO_SECRETS_VARIAVEIS_17C.md" \
    "$PREFLIGHT" "$SMOKE" >/dev/null
  then
    fail 'apparent credential material detected in the 17D release scope'
  fi
  pass 'no apparent credential material in the 17D release scope'
}

check_sources_unchanged() {
  if git -C "$ROOT_DIR" status --short -- \
    backend/prisma/schema.prisma backend/prisma/migrations | grep -q .
  then
    fail 'Prisma schema or migrations changed'
  fi
  pass 'Prisma schema and migrations are unchanged'

  if git -C "$ROOT_DIR" status --short -- backend/src frontend/src | grep -q .; then
    if [ "$STRICT_BASELINE" = true ]; then
      fail 'backend or frontend functional source differs from the historical 17D baseline'
    fi
    warn 'backend or frontend functional source differs from the historical 17D baseline; accepted in forward-compatible dry-run (use --strict-baseline to enforce)'
  else
    pass 'backend and frontend functional source are unchanged from the historical 17D baseline'
  fi
}

run_dry_run() {
  local file section
  for file in \
    "$RUNBOOK" "$MANIFEST" "$INVENTORY" "$PROD_COMPOSE" \
    "$ROOT_DIR/backend/Dockerfile.prod" "$ROOT_DIR/frontend/Dockerfile.prod" \
    "$ROOT_DIR/frontend/nginx.conf" "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" \
    "$RUNTIME_ENV" "$CI" \
    "$ROOT_DIR/docs/ai-orchestration/README.md" \
    "$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_ESTADO_ATUAL_PROJETO.md" \
    "$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PREPARACAO_PUBLICACAO_HTTPS_16Z.md" \
    "$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PLANO_DEPLOY_HOMOLOGADO_17A.md" \
    "$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_HARDENING_COMPOSE_NGINX_17B.md" \
    "$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_INVENTARIO_SECRETS_VARIAVEIS_17C.md"
  do
    require_file "$file"
  done

  for file in \
    "$ROOT_DIR/scripts/preflight-publicacao-https-16z.sh" \
    "$ROOT_DIR/scripts/smoke-publicacao-https-16z.sh" \
    "$ROOT_DIR/scripts/preflight-plano-deploy-17a.sh" \
    "$ROOT_DIR/scripts/smoke-plano-deploy-17a.sh" \
    "$ROOT_DIR/scripts/preflight-hardening-compose-nginx-17b.sh" \
    "$ROOT_DIR/scripts/smoke-hardening-compose-nginx-17b.sh" \
    "$ROOT_DIR/scripts/preflight-secrets-variaveis-17c.sh" \
    "$ROOT_DIR/scripts/smoke-secrets-variaveis-17c.sh"
  do
    require_file "$file"
  done
  require_executable "$PREFLIGHT"
  require_executable "$SMOKE"

  for section in \
    '## Objetivo' \
    '## Escopo' \
    '## Fora de escopo' \
    '## Estado atual local' \
    '## URLs planejadas e inativas' \
    '## Relação com 16Z, 17A, 17B e 17C' \
    '## Artefatos obrigatórios da release homologável' \
    '## Matriz de critérios de aceite' \
    '## Matriz GO/NO-GO' \
    '## Checklist de release homologável' \
    '## Checklist antes de deploy futuro' \
    '## Checklist antes de habilitar MCP real futuro' \
    '## Checklist antes de teste direto na tela' \
    '## Evidências esperadas' \
    '## Rollback' \
    '## Riscos remanescentes' \
    '## Validação offline' \
    '## Próximos passos sugeridos'
  do
    require_pattern "$RUNBOOK" "$section" "runbook section $section"
  done
  require_pattern "$RUNBOOK" 'A 17D é preflight de release, não deploy' \
    'runbook no-deploy boundary'
  require_pattern "$RUNBOOK" 'O Orchestra segue totalmente local' \
    'runbook local-state boundary'
  require_pattern "$RUNBOOK" 'O usuário será avisado antes de qualquer teste direto na tela' \
    'runbook direct-screen notice'
  require_pattern "$RUNBOOK" 'RELEASE_PREFLIGHT_READY=true' \
    'runbook release preflight decision'
  require_pattern "$RUNBOOK" 'DEPLOY_GO=false' \
    'runbook deployment decision'

  reject_executable_operations "$PREFLIGHT" '17D preflight'
  reject_executable_operations "$SMOKE" '17D smoke'
  check_manifest
  check_inventory_json
  check_ci
  check_fail_closed
  check_url_scope
  check_no_apparent_secret
  check_sources_unchanged
  bash -n "$PREFLIGHT"
  bash -n "$SMOKE"
  pass '17D Bash syntax checks passed'
  pass 'dry-run completed by reading local versioned state only'
}

render_go_no_go_template() {
  printf '%s\n' \
    '17D GO/NO-GO template (text only; no command was executed)' \
    '' \
    '| Decision | Expected status | Evidence | Responsible | Decision |' \
    '|---|---|---|---|---|' \
    '| Release preflight candidate | GO | Static 17D gates and regressions pass | Release Manager | Candidate may be homologated; no deployment authorization |' \
    '| Real deployment | NO_GO | Approved window, infrastructure, secrets, backup/restore and live checks | Change Manager + Platform | Default NO_GO until future approved window |' \
    '| Real MCP/tool execution | NO_GO | Published HTTPS, origin, secretRef, egress, audit and supervision | Security + MCP Owner | Keep MCP/tools fail-closed |' \
    '| Direct UI/CRUD MCP test | NO_GO | Separate approved screen-test phase and user notice | Product + QA | Do not test UI/CRUD in 17D |' \
    '| External provider execution | NO_GO | Secrets, quota, egress and observability approved | AI Platform + Security | Keep providers/embeddings fail-closed |' \
    '' \
    'Default decision: NO_GO for deployment until a future window is explicitly approved.' \
    'Release decision: RELEASE_PREFLIGHT_READY=true; DEPLOY_GO=false.'
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
  --check-manifest)
    check_manifest
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

printf '\n17D release preflight summary: mode=%s PASS=%d FAIL=0 strictBaseline=%s deployment=false realExecution=false secretValuesRead=false uiCrudTested=false mcpRealExecuted=false providerRealExecuted=false releasePreflightReady=true deployGo=false\n' \
  "${MODE#--}" "$pass_count" "$STRICT_BASELINE"
