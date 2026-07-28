#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
STRICT_BASELINE=false
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_HOMOLOGACAO_FUNCIONAL_UI_18A.md"
INVENTORY="$ROOT_DIR/docs/ai-orchestration/ui/ORCHESTRA_UI_INVENTARIO_18A.md"
MATRIX="$ROOT_DIR/docs/ai-orchestration/ui/ORCHESTRA_UI_HOMOLOGATION_MATRIX_18A.json"
CHECKLIST="$ROOT_DIR/docs/ai-orchestration/ui/ORCHESTRA_UI_CHECKLIST_MANUAL_18A.md"
BUG_TEMPLATE="$ROOT_DIR/docs/ai-orchestration/ui/ORCHESTRA_UI_BUG_TEMPLATE_18A.md"
RUNBOOK_17D="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_PREFLIGHT_RELEASE_HOMOLOGAVEL_17D.md"
MANIFEST_17D="$ROOT_DIR/docs/ai-orchestration/release/ORCHESTRA_RELEASE_MANIFEST_17D.json"
PREFLIGHT="$ROOT_DIR/scripts/preflight-homologacao-ui-18a.sh"
SMOKE="$ROOT_DIR/scripts/smoke-homologacao-ui-18a.sh"
CI="$ROOT_DIR/.github/workflows/ci.yml"
EXPECTED_BACKEND_SRC_FINGERPRINT="e0f9805facde1a1dc6119b46da4ce174941b7f8e4a1614d33dd7dfc008d9d4c1"
EXPECTED_FRONTEND_SRC_FINGERPRINT="af19cdd5451db434f9261b0bd3b5a9f7959d8758e5540d40dac72d7695a355c6"
EXPECTED_PRISMA_SCHEMA_SHA256="079476ac5d4b8604997a58a975d888ef2568326223a8fdb312fa2779aac185e8"
EXPECTED_MIGRATIONS_FINGERPRINT="2f1596debf98d3ef33c78d273c8ebd5520adb593cf735ae7f1c8866f70ce0791"
EXPECTED_MIGRATION_FILE_COUNT="22"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/preflight-homologacao-ui-18a.sh [MODE]

Modes:
  --dry-run          Validate the static/offline 18A preparation and safety gates.
  --strict-baseline  Also require functional source to match the historical 18A hashes.
  --check-matrix     Validate the machine-readable UI homologation matrix.
  --template         Print only the suggested manual order and short templates.
  --help             Print this help.

All modes are offline and read-only. They do not call network or planned production
URLs, deploy, start Docker Compose, migrate a database, execute MCP/provider/embeddings,
launch a browser, test UI automatically, collect secrets, or change files.

The default dry-run is forward-compatible with governed functional phases after 18A.
Use --strict-baseline only to audit the original 18A functional-source snapshot.
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
  printf '\n18A UI preflight summary: mode=%s PASS=%d FAIL=1 uiHomologation=true deployment=false productionTest=false realMcpExecution=false realProviderExecution=false bugFixing=false manualBrowserTestingPrepared=true\n' \
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

tree_fingerprint() {
  (
    cd "$ROOT_DIR"
    find "$1" -type f -print0 \
      | LC_ALL=C sort -z \
      | xargs -0 sha256sum \
      | sha256sum \
      | awk '{print $1}'
  )
}

check_matrix() {
  require_file "$MATRIX"

  MATRIX_PATH="$MATRIX" node <<'NODE' \
    || fail 'machine-readable 18A UI homologation matrix contract'
const fs = require('fs');
const raw = fs.readFileSync(process.env.MATRIX_PATH, 'utf8');
let matrix;
try {
  matrix = JSON.parse(raw);
} catch {
  throw new Error('matrix is not valid JSON');
}

const exact = {
  phase: '18A',
  uiHomologation: true,
  deployment: false,
  productionTest: false,
  realMcpExecution: false,
  realProviderExecution: false,
  bugFixing: false,
  manualBrowserTestingPrepared: true,
};
for (const [key, expected] of Object.entries(exact)) {
  if (matrix[key] !== expected) {
    throw new Error(`${key} must equal ${JSON.stringify(expected)}`);
  }
}

const arrays = [
  'routes',
  'screens',
  'menus',
  'crudAreas',
  'forms',
  'buttonsAndActions',
  'rolesAndPermissions',
  'testFlows',
  'evidenceTemplates',
  'knownStaticAnalysisLimits',
];
const ids = new Set();
for (const key of arrays) {
  if (!Array.isArray(matrix[key]) || matrix[key].length === 0) {
    throw new Error(`${key} must be a non-empty array`);
  }
  for (const item of matrix[key]) {
    for (const field of ['id', 'name', 'status']) {
      if (typeof item[field] !== 'string' || item[field].trim() === '') {
        throw new Error(`${key} item has invalid ${field}`);
      }
    }
    if (item.status !== 'not-tested') {
      throw new Error(`${key}.${item.id} status must be not-tested`);
    }
    if (ids.has(item.id)) throw new Error(`duplicate id ${item.id}`);
    ids.add(item.id);
  }
}

for (const key of ['routes', 'screens', 'testFlows']) {
  for (const item of matrix[key]) {
    if (!('path' in item) && !('file' in item)) {
      throw new Error(`${key}.${item.id} must have path or file`);
    }
    for (const field of ['type', 'area', 'notes']) {
      if (typeof item[field] !== 'string' || item[field].trim() === '') {
        throw new Error(`${key}.${item.id} has invalid ${field}`);
      }
    }
    for (const field of ['roles', 'actions', 'expectedEvidence']) {
      if (!Array.isArray(item[field]) || item[field].length === 0) {
        throw new Error(`${key}.${item.id} has invalid ${field}`);
      }
    }
  }
}

const rawText = JSON.stringify(matrix);
if (/https:\/\/(?:api\.)?orchestra\.mcm\.eng\.br/i.test(rawText)) {
  throw new Error('planned production URL must not be an active matrix target');
}
if (/(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer\s+[A-Za-z0-9._~+/-]{16,})/.test(rawText)) {
  throw new Error('apparent credential material in matrix');
}
NODE

  pass 'matrix JSON is valid and satisfies the governed 18A contract'
}

check_ci() {
  require_file "$CI"
  require_pattern "$CI" \
    'scripts/smoke-homologacao-ui-18a.sh --dry-run' \
    'CI runs the 18A dry-run smoke'
  require_exact_line "$CI" \
    '        run: scripts/smoke-homologacao-ui-18a.sh --dry-run' \
    'CI 18A step is exactly the offline dry-run smoke'
  reject_pattern "$CI" \
    'scripts/preflight-homologacao-ui-18a\.sh' \
    'direct 18A preflight execution in CI'
  [ "$(grep -Ec -- 'scripts/(preflight|smoke)-homologacao-ui-18a\.sh' "$CI")" -eq 1 ] \
    || fail 'CI must contain exactly one 18A script invocation'
  pass 'CI contains exactly one 18A script invocation'
  reject_pattern "$CI" \
    '(playwright|cypress|test:e2e|test:visual)' \
    'browser/UI automation in CI'
  reject_pattern "$CI" \
    '^[[:space:]]*(run:[[:space:]]*)?(curl|wget|dig|nslookup|host|getent)[[:space:]]' \
    'network/DNS command in CI'
  reject_pattern "$CI" \
    '^[[:space:]]*(run:[[:space:]]*)?(docker[[:space:]]+compose|docker-compose)[[:space:]]+(up|run|start|restart|pull|push|build|exec|config)' \
    'live Docker Compose command in CI'
  reject_pattern "$CI" \
    '^[[:space:]]*(run:[[:space:]]*)?(az|azd|kubectl|helm|terraform|pulumi)[[:space:]].*(deploy|apply|up|create|delete|destroy)' \
    'deployment command in CI'
  reject_pattern "$CI" \
    '^[[:space:]]*(run:[[:space:]]*)?(npm|npx|pnpm|yarn)[[:space:]].*(prisma:)?migrat(e|ion)' \
    'migration command in CI'
  reject_pattern "$CI" \
    '(smoke-agno-real|smoke-chat-provider-real|--run-real|--execute-real)' \
    'real MCP/provider execution in CI'
}

check_planned_urls_absent_from_runtime() {
  local candidates=(
    "$ROOT_DIR/.env.example"
    "$ROOT_DIR/backend/.env.example"
    "$ROOT_DIR/frontend/.env.example"
    "$ROOT_DIR/runtime/agno-bridge/.env.example"
    "$ROOT_DIR/.github/workflows/ci.yml"
    "$ROOT_DIR/backend/src"
    "$ROOT_DIR/frontend/src"
    "$ROOT_DIR/runtime/agno-bridge"
  )
  local compose
  while IFS= read -r compose; do
    candidates+=("$compose")
  done < <(find "$ROOT_DIR" -maxdepth 1 -type f -name 'docker-compose*.yml' | LC_ALL=C sort)

  if grep -ERq -- 'https://(api\.)?orchestra\.mcm\.eng\.br' "${candidates[@]}"; then
    fail 'planned production URL appears in env examples, Compose, CI or functional code'
  fi
  pass 'planned production URLs are absent from env examples, Compose, CI and functional code'
}

check_functional_fingerprints() {
  local backend_fingerprint
  local frontend_fingerprint
  local schema_sha
  local migrations_fingerprint
  local migration_count

  backend_fingerprint="$(tree_fingerprint backend/src)"
  frontend_fingerprint="$(tree_fingerprint frontend/src)"
  schema_sha="$(sha256sum "$ROOT_DIR/backend/prisma/schema.prisma" | awk '{print $1}')"
  migrations_fingerprint="$(tree_fingerprint backend/prisma/migrations)"
  migration_count="$(find "$ROOT_DIR/backend/prisma/migrations" -type f | wc -l | tr -d ' ')"

  if [ "$backend_fingerprint" = "$EXPECTED_BACKEND_SRC_FINGERPRINT" ]; then
    pass 'backend functional source is unchanged from the historical 18A baseline'
  elif [ "$STRICT_BASELINE" = true ]; then
    fail 'backend functional source differs from the historical 18A baseline'
  else
    warn 'backend functional source differs from the historical 18A baseline; accepted in forward-compatible dry-run (use --strict-baseline to enforce)'
  fi

  if [ "$frontend_fingerprint" = "$EXPECTED_FRONTEND_SRC_FINGERPRINT" ]; then
    pass 'frontend functional source is unchanged from the historical 18A baseline'
  elif [ "$STRICT_BASELINE" = true ]; then
    fail 'frontend functional source differs from the historical 18A baseline'
  else
    warn 'frontend functional source differs from the historical 18A baseline; accepted in forward-compatible dry-run (use --strict-baseline to enforce)'
  fi

  [ "$schema_sha" = "$EXPECTED_PRISMA_SCHEMA_SHA256" ] \
    || fail 'Prisma schema differs from the 18A baseline'
  pass 'Prisma schema is unchanged from the 18A baseline'

  [ "$migrations_fingerprint" = "$EXPECTED_MIGRATIONS_FINGERPRINT" ] \
    || fail 'Prisma migrations differ from the 18A baseline'
  [ "$migration_count" = "$EXPECTED_MIGRATION_FILE_COUNT" ] \
    || fail 'Prisma migration file count differs from the 18A baseline'
  pass 'Prisma migrations are unchanged from the 18A baseline'
}

print_template() {
  cat <<'EOF'
18A suggested manual homologation order
1. Local environment, fail-closed flags and non-sensitive test data
2. Login, protected session and logout
3. Desktop/mobile menus, canonical routes, legacy redirects and error pages
4. Dashboard
5. Assistants catalog, detail and disposable draft wizard
6. Knowledge catalog, detail and local non-sensitive document
7. MCP catalog/detail read-only; no create, binding, readiness or discovery
8. Chat catalog/shell only; no message or AgentRun
9. Analytics, Audit and Admin read-only by profile
10. Loading, empty, error, forbidden, responsive and evidence reconciliation

Short bug template
ID: BUG-18A- | area/screen/route: | profile: | steps: | expected: | obtained:
severity: | sanitized evidence: | hypothesis (unconfirmed): | decision: | suggested fix phase:

Short approved-evidence template
ID: EV-18A- | matrix item: | local route: | profile: | steps: | observed result:
sanitized evidence: | result: PASS | production/deploy/MCP/provider/bug-fix: no

18A GO/NO-GO template
Inventory and manual preparation: GO only if all offline gates pass.
Bug fixing: NO-GO. Deployment/production: NO-GO.
Real MCP/provider/embeddings and external-capable Chat/AgentRun: NO-GO.
UI_HOMOLOGATION=true; MANUAL_BROWSER_TESTING_PREPARED=true; BUG_FIXING=false
EOF
}

[ "$#" -le 1 ] || fail 'only one mode can be selected'

case "$MODE" in
  --help|-h)
    usage
    exit 0
    ;;
  --template)
    print_template
    exit 0
    ;;
  --check-matrix)
    check_matrix
    printf '\n18A UI matrix summary: PASS=%d FAIL=0 phase=18A uiHomologation=true deployment=false productionTest=false realMcpExecution=false realProviderExecution=false bugFixing=false manualBrowserTestingPrepared=true status=not-tested\n' \
      "$pass_count"
    exit 0
    ;;
  --dry-run)
    ;;
  --strict-baseline)
    STRICT_BASELINE=true
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

for file in "$RUNBOOK" "$INVENTORY" "$MATRIX" "$CHECKLIST" "$BUG_TEMPLATE" \
  "$RUNBOOK_17D" "$MANIFEST_17D"
do
  require_file "$file"
done
require_executable "$PREFLIGHT"
require_executable "$SMOKE"

require_pattern "$RUNBOOK" 'A 18A prepara e orienta os testes' 'runbook states the preparation-only boundary'
require_pattern "$RUNBOOK" 'não corrige achados' 'runbook states no bug fixing'
require_pattern "$INVENTORY" 'Rotas detectadas' 'UI inventory contains routes'
require_pattern "$INVENTORY" 'Chamadas de API usadas pelo frontend' 'UI inventory contains API calls'
require_pattern "$CHECKLIST" 'Guardrails obrigatórios' 'manual checklist contains guardrails'
require_pattern "$BUG_TEMPLATE" 'Bug de permissão' 'finding template covers permission bugs'
require_pattern "$RUNBOOK_17D" 'releasePreflightReady=true' '17D runbook is preserved'

check_matrix
check_ci
check_planned_urls_absent_from_runtime
check_functional_fingerprints

printf '\n18A UI preflight summary: mode=%s PASS=%d FAIL=0 strictBaseline=%s uiHomologation=true deployment=false productionTest=false realMcpExecution=false realProviderExecution=false bugFixing=false manualBrowserTestingPrepared=true\n' \
  "${MODE#--}" "$pass_count" "$STRICT_BASELINE"
