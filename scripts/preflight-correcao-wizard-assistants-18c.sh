#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHASE_BASE_COMMIT="ca7e3db"
PHASE_MARKER="scripts/preflight-correcao-wizard-assistants-18c.sh"
CI="$ROOT_DIR/.github/workflows/ci.yml"
DOC_18C="$ROOT_DIR/docs/ai-orchestration/ui/ORCHESTRA_UI_CORRECAO_WIZARD_ASSISTANTS_18C.md"
SERIALIZATION="$ROOT_DIR/frontend/src/pages/Assistants/assistantWizard.serialization.ts"
SERIALIZATION_TEST="$ROOT_DIR/frontend/src/pages/Assistants/assistantWizard.serialization.test.ts"
KNOWLEDGE="$ROOT_DIR/frontend/src/pages/Assistants/assistantWizard.knowledge.ts"
KNOWLEDGE_TEST="$ROOT_DIR/frontend/src/pages/Assistants/assistantWizard.knowledge.test.ts"
WORKFLOW_TEST="$ROOT_DIR/frontend/src/test/assistant-wizard-save-workflow.test.ts"
SMOKE="$ROOT_DIR/scripts/smoke-correcao-wizard-assistants-18c.sh"
PREFLIGHT="$ROOT_DIR/scripts/preflight-correcao-wizard-assistants-18c.sh"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/preflight-correcao-wizard-assistants-18c.sh [--dry-run|--help]

The dry-run validates the governed 18C functional-change scope and static safety
contract. It is offline and read-only: it does not call network or production,
start Docker Compose, deploy, migrate, execute MCP/provider/embeddings, send Chat
messages, create AgentRuns, launch Playwright/Cypress, or change files.

Frontend typecheck/build and the three targeted 18C test files remain explicit
manual validation commands; this preflight verifies their governed expectation.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n18C Wizard correction preflight summary: mode=%s PASS=%d FAIL=1 phase=18C deployment=false migration=false realMcpExecution=false realProviderExecution=false realEmbeddingsExecution=false realChatAgentRunExecution=false liveBrowserExecution=false\n' \
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
    "executable live browser command in $label"
  reject_pattern "$file" \
    '^[[:space:]]*(rm|mv|cp|install|touch|mkdir|rmdir|chmod|chown|truncate|tee)[[:space:]]' \
    "executable filesystem mutation in $label"
}

phase_introduction_commit() {
  if git -C "$ROOT_DIR" ls-files --error-unmatch "$PHASE_MARKER" >/dev/null 2>&1; then
    git -C "$ROOT_DIR" log --diff-filter=A --format='%H' -- "$PHASE_MARKER" \
      | tail -n 1
  fi
}

phase_change_records() {
  local introduction_commit
  introduction_commit="$(phase_introduction_commit)"

  if [ -n "$introduction_commit" ]; then
    git -C "$ROOT_DIR" diff --name-status \
      "${PHASE_BASE_COMMIT}..${introduction_commit}"
  else
    git -C "$ROOT_DIR" diff --name-status "$PHASE_BASE_COMMIT"
    git -C "$ROOT_DIR" ls-files --others --exclude-standard \
      | sed $'s/^/A\\t/'
  fi
}

require_phase_added() {
  local relative_path="$1"
  if phase_change_records | awk -F '\t' -v expected="$relative_path" \
    '$1 == "A" && $2 == expected { found = 1 } END { exit(found ? 0 : 1) }'
  then
    pass "$relative_path is an 18C added artifact"
  else
    fail "$relative_path is not recorded as an 18C added artifact"
  fi
}

frontend_path_is_allowed() {
  case "$1" in
    frontend/src/hooks/queries/useAssistants.ts|\
    frontend/src/pages/Assistants/AssistantWizardPage.tsx|\
    frontend/src/pages/Assistants/AssistantsPage.tsx|\
    frontend/src/pages/Assistants/assistantWizard.knowledge.ts|\
    frontend/src/pages/Assistants/assistantWizard.knowledge.test.ts|\
    frontend/src/pages/Assistants/assistantWizard.serialization.ts|\
    frontend/src/pages/Assistants/assistantWizard.serialization.test.ts|\
    frontend/src/services/assistants.service.ts|\
    frontend/src/test/assistant-wizard-save-workflow.test.ts|\
    frontend/src/types/index.ts)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

check_phase_scope() {
  local status first_path second_path path

  git -C "$ROOT_DIR" cat-file -e "${PHASE_BASE_COMMIT}^{commit}" 2>/dev/null \
    || fail "18C base commit $PHASE_BASE_COMMIT is unavailable"
  pass "18C base commit $PHASE_BASE_COMMIT is available"

  [ -n "$(phase_change_records)" ] || fail '18C phase change set is empty'
  pass '18C phase change set is available'

  while IFS=$'\t' read -r status first_path second_path; do
    [ -n "$status" ] || continue
    path="${second_path:-$first_path}"

    case "$path" in
      backend/prisma/schema.prisma|backend/prisma/migrations/*)
        fail "Prisma schema or migration changed in 18C: $path"
        ;;
      backend/src/*)
        fail "backend functional source changed in 18C: $path"
        ;;
      frontend/src/*)
        frontend_path_is_allowed "$path" \
          || fail "frontend source outside the governed 18C allowlist changed: $path"
        ;;
      .env|*/.env|*.pem|*.key|*.p12|*.pfx)
        fail "sensitive file type was versioned in 18C: $path"
        ;;
    esac
  done < <(phase_change_records)

  pass 'Prisma schema and migrations are unchanged in the 18C phase scope'
  pass 'backend functional source is unchanged in the 18C phase scope'
  pass '18C frontend changes are limited to the governed Wizard/Assistants/types/hooks/services allowlist'
  pass 'no .env, private key or certificate bundle was added in the 18C phase scope'
}

check_planned_urls_absent() {
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

check_no_apparent_credentials() {
  local credential_pattern
  credential_pattern='(sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,})'

  if grep -ERn -- "$credential_pattern" \
    "$ROOT_DIR/frontend/src/hooks/queries/useAssistants.ts" \
    "$ROOT_DIR/frontend/src/pages/Assistants/AssistantWizardPage.tsx" \
    "$ROOT_DIR/frontend/src/pages/Assistants/AssistantsPage.tsx" \
    "$ROOT_DIR/frontend/src/pages/Assistants/assistantWizard.knowledge.ts" \
    "$ROOT_DIR/frontend/src/pages/Assistants/assistantWizard.knowledge.test.ts" \
    "$ROOT_DIR/frontend/src/pages/Assistants/assistantWizard.serialization.ts" \
    "$ROOT_DIR/frontend/src/pages/Assistants/assistantWizard.serialization.test.ts" \
    "$ROOT_DIR/frontend/src/services/assistants.service.ts" \
    "$ROOT_DIR/frontend/src/test/assistant-wizard-save-workflow.test.ts" \
    "$ROOT_DIR/frontend/src/types/index.ts" >/dev/null
  then
    fail 'apparent credential material detected in governed 18C frontend files'
  fi
  pass 'no apparent secret, token, cookie, authorization header or private key value in governed 18C frontend files'

  reject_pattern "$SERIALIZATION" \
    '(secret|cookie|token|authorization|headers?|api_?key)[[:space:]]*:' \
    'credential-shaped field in the version.configuration serializer'
}

check_no_real_integrations() {
  reject_pattern "$ROOT_DIR/frontend/src/services/assistants.service.ts" \
    'endpoints\.(chat|agentRuns|mcp|providers|embeddings)|/(chat|agent-runs|mcp|embeddings)(/|["'\''])' \
    'Chat/AgentRun/MCP/embeddings endpoint in the 18C Assistant save service'
  reject_pattern "$CI" \
    '(smoke-agno-real|smoke-chat-provider-real|--run-real|--execute-real)' \
    'real MCP/provider execution in CI'
  reject_pattern "$CI" \
    '(playwright|cypress|test:e2e|test:visual)' \
    'live browser execution in CI'
  reject_pattern "$CI" \
    '^[[:space:]]*(run:[[:space:]]*)?(curl|wget|dig|nslookup|host|getent)[[:space:]]' \
    'network/production command in CI'
  reject_pattern "$CI" \
    '^[[:space:]]*(run:[[:space:]]*)?(docker[[:space:]]+compose|docker-compose)[[:space:]]+(up|run|start|restart|pull|push|build|exec|config)' \
    'live Docker Compose command in CI'
  reject_pattern "$CI" \
    '^[[:space:]]*(run:[[:space:]]*)?(az|azd|kubectl|helm|terraform|pulumi)[[:space:]].*(deploy|apply|up|create|delete|destroy)' \
    'deployment command in CI'
  reject_pattern "$CI" \
    '^[[:space:]]*(run:[[:space:]]*)?(npm|npx|pnpm|yarn)[[:space:]].*(prisma:)?migrat(e|ion)' \
    'migration command in CI'
  pass '18C contains no real MCP/provider/embeddings/Chat/AgentRun execution path'
}

check_ci() {
  require_file "$CI"
  require_pattern "$CI" \
    'scripts/smoke-correcao-wizard-assistants-18c.sh --dry-run' \
    'CI runs the 18C smoke in dry-run mode'
  require_exact_line "$CI" \
    '        run: scripts/smoke-correcao-wizard-assistants-18c.sh --dry-run' \
    'CI 18C step is exactly the offline dry-run smoke'
  [ "$(grep -Ec -- 'scripts/(preflight|smoke)-correcao-wizard-assistants-18c\.sh' "$CI")" -eq 1 ] \
    || fail 'CI must contain exactly one 18C gate invocation'
  pass 'CI contains exactly one 18C gate invocation'
  require_pattern "$CI" 'fetch-depth: 0' \
    'CI fetches history required to resolve the immutable 18C phase boundary'
}

[ "$#" -le 1 ] || fail 'only one mode can be selected'
case "$MODE" in
  --dry-run)
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

for file in \
  "$DOC_18C" "$SERIALIZATION" "$SERIALIZATION_TEST" \
  "$KNOWLEDGE" "$KNOWLEDGE_TEST" "$WORKFLOW_TEST"
do
  require_file "$file"
done
require_executable "$PREFLIGHT"
require_executable "$SMOKE"

for artifact in \
  'docs/ai-orchestration/ui/ORCHESTRA_UI_CORRECAO_WIZARD_ASSISTANTS_18C.md' \
  'frontend/src/pages/Assistants/assistantWizard.serialization.ts' \
  'frontend/src/pages/Assistants/assistantWizard.serialization.test.ts' \
  'frontend/src/pages/Assistants/assistantWizard.knowledge.ts' \
  'frontend/src/pages/Assistants/assistantWizard.knowledge.test.ts' \
  'frontend/src/test/assistant-wizard-save-workflow.test.ts'
do
  require_phase_added "$artifact"
done

check_phase_scope
check_planned_urls_absent
check_no_apparent_credentials
check_no_real_integrations
check_ci

require_pattern "$SERIALIZATION" 'schemaVersion: 1' \
  'serialization contract contains schemaVersion 1'
require_pattern "$SERIALIZATION_TEST" 'expect(configuration.schemaVersion).toBe(1)' \
  'serialization test asserts schemaVersion 1'
require_pattern "$SERIALIZATION_TEST" "describe('assistant Wizard serialization'" \
  'serialization test suite exists'
require_pattern "$KNOWLEDGE_TEST" "describe('assistant Wizard Knowledge Binding synchronization'" \
  'Knowledge diff test suite exists'
require_pattern "$WORKFLOW_TEST" "describe('assistant Wizard save workflow'" \
  'Wizard save workflow test suite exists'
require_pattern "$DOC_18C" 'npm --prefix frontend run typecheck' \
  '18C documentation expects frontend typecheck'
require_pattern "$DOC_18C" 'npm --prefix frontend run build' \
  '18C documentation expects frontend build'
require_pattern "$DOC_18C" 'assistantWizard.serialization.test.ts' \
  '18C documentation expects the targeted serialization test'
require_pattern "$DOC_18C" 'assistantWizard.knowledge.test.ts' \
  '18C documentation expects the targeted Knowledge test'
require_pattern "$DOC_18C" 'assistant-wizard-save-workflow.test.ts' \
  '18C documentation expects the targeted save workflow test'

reject_executable_operations "$PREFLIGHT" '18C preflight'
reject_executable_operations "$SMOKE" '18C smoke'
bash -n "$PREFLIGHT"
bash -n "$SMOKE"
pass '18C Bash syntax checks passed'
pass 'frontend typecheck/build and targeted tests remain explicit manual validation commands'
pass 'dry-run completed by reading local/versioned state only'

printf '\n18C Wizard correction preflight summary: mode=dry-run PASS=%d FAIL=0 phase=18C phaseAware=true deployment=false migration=false realMcpExecution=false realProviderExecution=false realEmbeddingsExecution=false realChatAgentRunExecution=false liveBrowserExecution=false frontendTypecheckExpected=true frontendBuildExpected=true targetedTestsExpected=true\n' \
  "$pass_count"
