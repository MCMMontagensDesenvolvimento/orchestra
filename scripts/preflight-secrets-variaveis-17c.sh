#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_INVENTARIO_SECRETS_VARIAVEIS_17C.md"
INVENTORY="$ROOT_DIR/docs/ai-orchestration/secrets/ORCHESTRA_SECRETS_INVENTORY_17C.json"
ROOT_ENV="$ROOT_DIR/.env.example"
BACKEND_ENV="$ROOT_DIR/backend/.env.example"
FRONTEND_ENV="$ROOT_DIR/frontend/.env.example"
RUNTIME_ENV="$ROOT_DIR/runtime/agno-bridge/.env.example"
PROD_COMPOSE="$ROOT_DIR/docker-compose.prod.yml"
CI="$ROOT_DIR/.github/workflows/ci.yml"
DOC_INDEX="$ROOT_DIR/docs/ai-orchestration/README.md"
STATE_DOC="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_ESTADO_ATUAL_PROJETO.md"
DOC_17A="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PLANO_DEPLOY_HOMOLOGADO_17A.md"
DOC_17B="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_HARDENING_COMPOSE_NGINX_17B.md"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/preflight-secrets-variaveis-17c.sh [MODE]

Modes:
  --dry-run          Validate the complete static/offline 17C contract.
  --check-inventory  Validate the machine-readable inventory without resolving values.
  --template         Print sanitized request, evidence, go/no-go and rollback templates.
  --help             Print this help.

Every mode is offline, read-only and non-operational. This script never calls network
or DNS services, executes curl, starts Docker Compose, deploys, migrates a database,
executes MCP/provider code, resolves or prints a secret, or changes a file.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n17C secrets inventory preflight summary: mode=%s PASS=%d FAIL=1 deployment=false realExecution=false secretValuesRead=false\n' \
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

reject_pattern() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -Eq -- "$pattern" "$file"; then
    fail "$label is present"
  fi
  pass "$label is absent"
}

check_inventory() {
  require_file "$INVENTORY"

  INVENTORY_PATH="$INVENTORY" node <<'NODE' \
    || fail 'machine-readable inventory contract'
const fs = require('fs');
const path = process.env.INVENTORY_PATH;
const raw = fs.readFileSync(path, 'utf8');
let inventory;
try {
  inventory = JSON.parse(raw);
} catch {
  throw new Error('inventory is not valid JSON');
}

const fail = (message) => {
  throw new Error(message);
};
const fields = [
  'name',
  'group',
  'environment',
  'required',
  'secret',
  'publicClientExposed',
  'defaultPolicy',
  'ownerRole',
  'rotationPolicy',
  'validationMode',
  'notes',
];
const stringFields = [
  'name',
  'group',
  'environment',
  'defaultPolicy',
  'ownerRole',
  'rotationPolicy',
  'validationMode',
  'notes',
];
const environments = new Set(['local', 'homolog', 'production', 'all']);
const policies = new Set([
  'local-placeholder',
  'empty',
  'fail-closed',
  'runtime-required',
  'documentation-only',
]);
const secretPolicies = new Set(['runtime-required', 'empty', 'documentation-only']);
const governedExternalPolicies = new Set(['fail-closed', 'runtime-required']);
const forbiddenValueFields = /^(value|defaultValue|exampleValue|currentValue|secretValue|resolvedValue|runtimeValue|endpointValue)$/i;
const apparentCredential =
  /(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._~+/-]{16,})/;

if (inventory.inventoryVersion !== '17C') fail('unexpected inventoryVersion');
if (inventory.containsRealValues !== false) fail('containsRealValues must be false');
if (!Array.isArray(inventory.items) || inventory.items.length === 0) fail('items must be a non-empty array');
if (!Array.isArray(inventory.plannedDocumentationOnly)) fail('plannedDocumentationOnly must be an array');

for (const planned of inventory.plannedDocumentationOnly) {
  const keys = Object.keys(planned).sort().join(',');
  if (keys !== 'active,purpose,url') fail('planned URL entry contains an unexpected field');
  if (planned.active !== false || typeof planned.purpose !== 'string' || typeof planned.url !== 'string') {
    fail('planned URL entry is not explicitly inactive documentation');
  }
  if (!/^https:\/\/(?:api\.)?orchestra\.mcm\.eng\.br$/.test(planned.url)) {
    fail('planned documentation URL is outside the approved inactive set');
  }
}

const names = new Map();
for (const [index, item] of inventory.items.entries()) {
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(item, field)) {
      fail(`item ${index} is missing ${field}`);
    }
  }
  for (const key of Object.keys(item)) {
    if (forbiddenValueFields.test(key)) fail(`item ${index} contains forbidden value field ${key}`);
  }
  for (const field of stringFields) {
    if (typeof item[field] !== 'string' || item[field].trim() === '') {
      fail(`item ${index} has empty or invalid ${field}`);
    }
  }
  for (const field of ['required', 'secret', 'publicClientExposed']) {
    if (typeof item[field] !== 'boolean') fail(`item ${index} has invalid ${field}`);
  }
  if (!environments.has(item.environment)) fail(`item ${index} has invalid environment`);
  if (!policies.has(item.defaultPolicy)) fail(`item ${index} has invalid defaultPolicy`);
  if (names.has(item.name)) fail(`duplicate inventory name ${item.name}`);
  names.set(item.name, item);

  if (item.secret && item.publicClientExposed) fail(`${item.name} exposes a secret to the public client`);
  if (item.secret && !secretPolicies.has(item.defaultPolicy)) {
    fail(`${item.name} uses a forbidden secret default policy`);
  }
  if (item.group === 'frontend' && (!item.publicClientExposed || item.secret)) {
    fail(`${item.name} violates the frontend public-variable contract`);
  }
  if (
    ['llm-providers', 'mcp-tools'].includes(item.group)
    && !governedExternalPolicies.has(item.defaultPolicy)
  ) {
    fail(`${item.name} is not fail-closed or runtime-required`);
  }
  if (/orchestra\.mcm\.eng\.br/i.test(JSON.stringify(item))) {
    fail(`${item.name} materializes a planned URL as runtime inventory data`);
  }
  if (apparentCredential.test(JSON.stringify(item))) {
    fail(`${item.name} contains apparent credential material`);
  }
  if (/(^|[^<])(?:SECRET|TOKEN|PASSWORD|API_KEY)_[A-Z0-9]{12,}/.test(item.notes)) {
    fail(`${item.name} contains an unsanitized placeholder`);
  }
}

const requiredNames = [
  'NODE_ENV', 'PORT', 'DATABASE_URL', 'JWT_SECRET', 'FRONTEND_ORIGIN',
  'COOKIE_SECURE', 'COOKIE_SAME_SITE', 'LOG_LEVEL', 'VITE_API_BASE_URL',
  'POSTGRES_DB', 'POSTGRES_USER', 'POSTGRES_PASSWORD',
  'MICROSOFT_CLIENT_ID', 'MICROSOFT_CLIENT_SECRET', 'MICROSOFT_TENANT_ID',
  'MICROSOFT_REDIRECT_URI', 'MICROSOFT_POST_LOGOUT_REDIRECT_URI',
  'MICROSOFT_ALLOWED_DOMAINS', 'LLM_PROVIDERS_ENABLED', 'LLM_EXECUTION_ENABLED',
  'OPENAI_ENABLED', 'OPENAI_EXECUTION_ENABLED', 'OPENAI_API_KEY',
  'AZURE_OPENAI_ENABLED', 'AZURE_OPENAI_EXECUTION_ENABLED', 'AZURE_OPENAI_API_KEY',
  'AZURE_OPENAI_ENDPOINT', 'ANTHROPIC_ENABLED', 'ANTHROPIC_EXECUTION_ENABLED',
  'ANTHROPIC_API_KEY', 'EMBEDDINGS_ENABLED', 'EMBEDDINGS_EXECUTION_ENABLED',
  'EMBEDDINGS_PROVIDER', 'EMBEDDINGS_MODEL', 'AGNO_ENABLED',
  'AGNO_EXECUTION_ENABLED', 'RUNTIME_ALLOW_EXTERNAL_TOOLS',
  'AGNO_RUNTIME_HTTP_TOOLS_ENABLED', 'AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS',
  'AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED', 'MCP_REMOTE_ENABLED',
  'MCP_REMOTE_EXECUTION_ENABLED', 'MCP_REMOTE_DISCOVERY_ENABLED',
  'MCP_REMOTE_READONLY_ENABLED', 'MCP_REMOTE_EGRESS_ALLOWLIST',
  'MCP_REMOTE_ALLOW_WRITE_TOOLS', 'MCP_CORPORATE_READONLY_ENABLED',
  'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN', 'MCP_CORPORATE_READONLY_SECRET_REF',
  'ORCHESTRA_BACKUP_ID', 'ORCHESTRA_CHANGE_ID', 'ORCHESTRA_ROLLBACK_RELEASE_ID',
];
for (const name of requiredNames) {
  if (!names.has(name)) fail(`required inventory item ${name} is missing`);
}

for (const name of [
  'OPENAI_API_KEY',
  'AZURE_OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'JWT_SECRET',
  'MICROSOFT_CLIENT_SECRET',
  'DATABASE_URL',
  'POSTGRES_PASSWORD',
]) {
  const item = names.get(name);
  if (!item.secret || item.publicClientExposed || item.defaultPolicy !== 'runtime-required') {
    fail(`${name} does not satisfy the secret runtime-required contract`);
  }
}

const logicalRef = names.get('MCP_CORPORATE_READONLY_SECRET_REF');
if (
  logicalRef.secret
  || logicalRef.publicClientExposed
  || logicalRef.defaultPolicy !== 'runtime-required'
  || !logicalRef.notes.includes('env://ORCHESTRA_CORPORATE_READONLY_<PURPOSE>')
) {
  fail('MCP corporate secret reference is not a sanitized logical reference');
}

const plannedUrlsInRaw = raw.match(/https:\/\/(?:api\.)?orchestra\.mcm\.eng\.br/g) || [];
if (plannedUrlsInRaw.length !== inventory.plannedDocumentationOnly.length) {
  fail('planned URL appears outside plannedDocumentationOnly');
}
NODE
  pass 'inventory JSON is valid and satisfies the governed field contract'

  reject_pattern "$INVENTORY" \
    '(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})' \
    'apparent credential material in inventory'
  reject_pattern "$INVENTORY" \
    '"(value|defaultValue|exampleValue|currentValue|secretValue|resolvedValue|runtimeValue|endpointValue)"[[:space:]]*:' \
    'runtime or secret value field in inventory'
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
      "${file#"$ROOT_DIR/"} write tools disabled"
    require_exact_line "$file" 'MCP_CORPORATE_READONLY_ENABLED=false' \
      "${file#"$ROOT_DIR/"} corporate adapter disabled"
    require_exact_line "$file" 'MCP_CORPORATE_READONLY_ALLOWED_ORIGIN=' \
      "${file#"$ROOT_DIR/"} corporate origin empty"
  done

  require_exact_line "$BACKEND_ENV" 'FRONTEND_ORIGIN=http://localhost:5173' \
    'backend frontend origin remains local'
  require_exact_line "$FRONTEND_ENV" 'VITE_API_BASE_URL=http://localhost:3000/api/v1' \
    'frontend API example remains local'
  require_exact_line "$BACKEND_ENV" 'COOKIE_SECURE=false' \
    'backend cookie example remains local-only'

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
    'RUNTIME_ALLOW_EXTERNAL_TOOLS=false'
  do
    require_exact_line "$BACKEND_ENV" "$setting" \
      "backend example fail-closed setting $setting"
  done

  for setting in \
    'AGNO_BRIDGE_EXECUTION_MODE=stub' \
    'AGNO_BRIDGE_PROVIDER=stub' \
    'AGNO_RUNTIME_HTTP_TOOLS_ENABLED=false' \
    'AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS=0' \
    'AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED=false' \
    'AGNO_TELEMETRY=false'
  do
    require_exact_line "$RUNTIME_ENV" "$setting" \
      "bridge example fail-closed setting $setting"
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
    'COOKIE_SECURE: "true"' \
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

  for required in DATABASE_URL JWT_SECRET POSTGRES_PASSWORD; do
    require_pattern "$PROD_COMPOSE" "${required}: \"\${${required}:?" \
      "production Compose requires $required at runtime"
  done
}

check_no_runtime_planned_urls() {
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
  pass 'planned Orchestra URLs are absent from functional source'
}

check_ci() {
  require_pattern "$CI" \
    'scripts/smoke-secrets-variaveis-17c.sh --dry-run' \
    'CI runs the 17C smoke in dry-run mode'
  reject_pattern "$CI" \
    'scripts/preflight-secrets-variaveis-17c\.sh' \
    'direct 17C preflight invocation in CI'
  reject_pattern "$CI" \
    'smoke-secrets-variaveis-17c\.sh[[:space:]]+--(check-inventory|template|live|run|deploy)' \
    'non-dry 17C smoke mode in CI'
  [ "$(grep -Ec -- 'scripts/(preflight|smoke)-secrets-variaveis-17c\.sh' "$CI")" -eq 1 ] \
    || fail 'CI must contain exactly one 17C script invocation'
  pass 'CI contains exactly one 17C dry-run smoke invocation'
}

check_runbook_contract() {
  local section
  for section in \
    '## Objetivo' \
    '## Escopo' \
    '## Fora de escopo' \
    '## Estado atual local' \
    '## Relação com 16Z, 17A e 17B' \
    '## Princípios de secret management' \
    '## Matriz de classificação' \
    '## Inventário core backend' \
    '## Inventário frontend' \
    '## Inventário banco/Postgres' \
    '## Inventário Microsoft SSO' \
    '## Inventário LLM/providers' \
    '## Inventário Agno/runtime bridge' \
    '## Inventário MCP/Tools' \
    '## Inventário operações/deploy' \
    '## Variáveis públicas vs privadas' \
    '## Secrets obrigatórios por ambiente' \
    '## Variáveis opcionais por ambiente' \
    '## Placeholders permitidos' \
    '## Variáveis proibidas em Git' \
    '## Rotação' \
    '## Revogação' \
    '## Evidência sanitizada' \
    '## Checklist antes do deploy' \
    '## Checklist antes de habilitar provider externo' \
    '## Checklist antes de habilitar MCP real' \
    '## Rollback/disable flags' \
    '## Riscos remanescentes' \
    '## Validação offline' \
    '## Próximos passos sugeridos'
  do
    require_pattern "$RUNBOOK" "$section" "runbook section $section"
  done

  for boundary in \
    'A 17C não cria `.env` real.' \
    'A 17C não coleta valor real.' \
    'A 17C não imprime segredo.' \
    'A 17C não executa deploy.' \
    'A 17C não executa MCP real.' \
    'A 17C não testa UI/CRUD MCP.' \
    'A primeira execução real da tool depende de publicação HTTPS futura' \
    'O usuário será avisado quando chegar o teste direto na tela'
  do
    require_pattern "$RUNBOOK" "$boundary" "runbook boundary $boundary"
  done
}

check_untouched_functional_scope() {
  if git -C "$ROOT_DIR" status --short -- \
    backend/prisma/schema.prisma backend/prisma/migrations | grep -q .
  then
    fail 'Prisma schema or migrations changed'
  fi
  pass 'Prisma schema and migrations are unchanged'

  if git -C "$ROOT_DIR" status --short -- backend/src frontend/src | grep -q .; then
    fail 'backend or frontend functional source changed'
  fi
  pass 'backend and frontend functional source are unchanged'
}

run_dry_run() {
  local file
  for file in \
    "$RUNBOOK" "$INVENTORY" "$ROOT_ENV" "$BACKEND_ENV" "$FRONTEND_ENV" \
    "$RUNTIME_ENV" "$PROD_COMPOSE" "$CI" "$DOC_INDEX" "$STATE_DOC" "$DOC_17A" "$DOC_17B"
  do
    require_file "$file"
  done

  check_runbook_contract
  check_inventory
  check_env_examples
  check_compose_fail_closed
  check_no_runtime_planned_urls
  check_ci
  check_untouched_functional_scope

  bash -n "$0"
  pass '17C preflight Bash syntax is valid'
  pass 'dry-run completed from local versioned state only'
}

render_template() {
  printf '%s\n' \
    '17C secret request template (text only; no value was read or requested here)' \
    '  environment: <HOMOLOG_OR_PRODUCTION>' \
    '  configurationName: <INVENTORY_NAME>' \
    '  ownerRole: <OWNER_ROLE>' \
    '  expectedSource: <APPROVED_SECRET_MANAGER_OR_CONFIGURATION_SYSTEM>' \
    '  requiredByChange: <CHANGE_ID>' \
    '  rotationDue: <DATE_OR_NOT_APPLICABLE>' \
    '  deliveryRule: runtime injection only; never paste the value into Git, chat, ticket or evidence' \
    '' \
    'Sanitized evidence template:' \
    '  configurationName: <INVENTORY_NAME>' \
    '  environment: <ENVIRONMENT>' \
    '  status: <PRESENT_MISSING_OR_NOT_APPLICABLE>' \
    '  ownerRole: <OWNER_ROLE>' \
    '  rotationStatus: <CURRENT_DUE_OR_NOT_APPLICABLE>' \
    '  validation: <PASS_OR_FAIL>' \
    '  valueIncluded: false' \
    '' \
    'Secrets go/no-go template:' \
    '  [ ] GO: all required entries report present through metadata-only checks' \
    '  [ ] GO: owners, rotation, revocation, backup, restore and rollback are approved' \
    '  [ ] GO: configuration is injected at runtime and evidence is sanitized' \
    '  [ ] NO-GO: any missing owner, exposed value, unresolved dependency or weak placeholder' \
    '  [ ] NO-GO: provider, MCP or tool gate differs from the approved fail-closed state' \
    '' \
    'Rollback and disable-flags template:' \
    '  action: disable provider, embeddings, Agno, external-tool and MCP execution gates' \
    '  limits: set runtime tool-call maximum to zero' \
    '  credential: revoke the affected entry at its source' \
    '  release: restore the approved previous image digests' \
    '  database: follow the separately approved DBA recovery decision' \
    '  evidence: record only sanitized identifiers, timestamps and pass-or-fail results' \
    '' \
    'This output is instructional text. No secret, request, network call, container, migration, deploy, provider or MCP execution occurred.'
}

[ "$#" -le 1 ] || { usage >&2; exit 2; }

case "$MODE" in
  --dry-run)
    run_dry_run
    ;;
  --check-inventory)
    check_inventory
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

printf '\n17C secrets inventory preflight summary: mode=%s PASS=%d FAIL=0 deployment=false realExecution=false secretValuesRead=false\n' \
  "${MODE#--}" "$pass_count"
