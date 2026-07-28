#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PREFLIGHT="$ROOT_DIR/scripts/preflight-correcao-wizard-assistants-18c.sh"
SMOKE="$ROOT_DIR/scripts/smoke-correcao-wizard-assistants-18c.sh"
CI="$ROOT_DIR/.github/workflows/ci.yml"
pass_count=0

usage() {
  cat <<'EOF'
Usage: scripts/smoke-correcao-wizard-assistants-18c.sh [--dry-run|--help]

The dry-run invokes only the local, static and read-only 18C preflight. It does
not call network or production, start Docker Compose, deploy, migrate, execute
MCP/provider/embeddings, send Chat messages, create AgentRuns, launch a browser,
run Playwright/Cypress, or change files.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n18C Wizard correction smoke summary: PASS=%d FAIL=1 phase=18C deployment=false migration=false realMcpExecution=false realProviderExecution=false realEmbeddingsExecution=false realChatAgentRunExecution=false liveBrowserExecution=false\n' \
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

require_executable "$PREFLIGHT"
require_executable "$SMOKE"
require_file "$CI"

HELP_OUTPUT="$("$PREFLIGHT" --help)"
for required_mode in --dry-run --help; do
  grep -Fq -- "$required_mode" <<<"$HELP_OUTPUT" \
    || fail "preflight mode $required_mode"
  pass "preflight mode $required_mode"
done

reject_executable_operations "$PREFLIGHT" '18C preflight'
reject_executable_operations "$SMOKE" '18C smoke'

STATUS_BEFORE="$(git -C "$ROOT_DIR" status --short)"
PREFLIGHT_OUTPUT="$("$PREFLIGHT" --dry-run)" \
  || fail '18C preflight dry-run execution'
STATUS_AFTER="$(git -C "$ROOT_DIR" status --short)"
[ "$STATUS_BEFORE" = "$STATUS_AFTER" ] \
  || fail '18C preflight changed the worktree'
pass '18C preflight is read-only'

for marker in \
  'phase=18C' \
  'phaseAware=true' \
  'deployment=false' \
  'migration=false' \
  'realMcpExecution=false' \
  'realProviderExecution=false' \
  'realEmbeddingsExecution=false' \
  'realChatAgentRunExecution=false' \
  'liveBrowserExecution=false' \
  'frontendTypecheckExpected=true' \
  'frontendBuildExpected=true' \
  'targetedTestsExpected=true'
do
  grep -Fq -- "$marker" <<<"$PREFLIGHT_OUTPUT" \
    || fail "preflight marker $marker"
  pass "preflight marker $marker"
done

require_pattern "$CI" \
  'scripts/smoke-correcao-wizard-assistants-18c.sh --dry-run' \
  'CI runs only the 18C dry-run smoke'
require_exact_line "$CI" \
  '        run: scripts/smoke-correcao-wizard-assistants-18c.sh --dry-run' \
  'CI 18C invocation is exact'
reject_pattern "$CI" \
  'scripts/preflight-correcao-wizard-assistants-18c\.sh' \
  'direct 18C preflight execution in CI'

bash -n "$PREFLIGHT"
bash -n "$SMOKE"
pass '18C Bash syntax checks passed'

printf '\n18C Wizard correction smoke summary: PASS=%d FAIL=0 phase=18C phaseAware=true deployment=false migration=false realMcpExecution=false realProviderExecution=false realEmbeddingsExecution=false realChatAgentRunExecution=false liveBrowserExecution=false\n' \
  "$pass_count"
