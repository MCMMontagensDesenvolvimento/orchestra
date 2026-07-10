#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

BASE_URL="${BASE_URL:-http://localhost:3000}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-3}"
CURL_MAX_TIME="${CURL_MAX_TIME:-10}"
MODE="${1:---check}"

response_file="$(mktemp)"
trap 'rm -f "$response_file"' EXIT

pass_count=0
skip_count=0

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

skip() {
  skip_count=$((skip_count + 1))
  printf 'SKIPPED %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\nSmoke summary: PASS=%d SKIPPED=%d FAIL=1\n' "$pass_count" "$skip_count" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: scripts/smoke-chat-provider-real-15h.sh [--check|--dry-run|--checklist|--help]

  --check      Validate backend health and non-secret configuration gates (default).
  --dry-run    Validate configuration gates without making network requests.
  --checklist  Print the manual end-to-end homologation checklist only.
  --help       Print this help.

This smoke never sends Chat messages and never calls an external provider.
EOF
}

print_checklist() {
  cat <<'EOF'
Manual 15H checklist (this step can create persistent Chat messages):
1. Confirm a published assistant uses execution mode published.
2. Confirm its policy allows openai and selects openai as the default LLM provider.
3. Open a new disposable conversation in the existing Chat UI.
4. Send the first short fictitious message and inspect Technical details.
5. Send the second short fictitious message in the same conversation.
6. Confirm governed context counters, LLM provider, external call flag, and events.
7. Confirm technical details and events contain no raw context or provider payload.
8. Record only run IDs, statuses, counters, flags, latency, model, and governed errors.
EOF
}

is_true() {
  [ "${1,,}" = "true" ]
}

is_boolean() {
  [ "${1,,}" = "true" ] || [ "${1,,}" = "false" ]
}

is_positive_integer() {
  [[ "$1" =~ ^[1-9][0-9]*$ ]]
}

validate_url_shape() {
  local value="$1"
  local label="$2"
  case "$value" in
    http://*|https://*) ;;
    *) fail "$label must use http or https" ;;
  esac
  case "${value#*://}" in
    *@*) fail "$label must not contain embedded credentials" ;;
  esac
  case "$value" in
    *\?*|*\#*) fail "$label must not contain query parameters or fragments" ;;
  esac
  pass "$label has a safe URL shape"
}

report_flag() {
  local name="$1"
  local value="$2"
  printf 'INFO %s=%s\n' "$name" "$value"
}

case "$MODE" in
  --check|--dry-run) ;;
  --checklist)
    print_checklist
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

runtime_provider="${RUNTIME_PROVIDER:-local}"
runtime_adapter_enabled="${RUNTIME_ADAPTER_ENABLED:-true}"
chat_context_enabled="${CHAT_CONTEXT_ENABLED:-true}"
chat_context_max_messages="${CHAT_CONTEXT_MAX_MESSAGES:-12}"
chat_context_max_message_chars="${CHAT_CONTEXT_MAX_MESSAGE_CHARS:-1200}"
chat_context_max_total_chars="${CHAT_CONTEXT_MAX_TOTAL_CHARS:-6000}"
llm_providers_enabled="${LLM_PROVIDERS_ENABLED:-false}"
llm_execution_enabled="${LLM_EXECUTION_ENABLED:-false}"
openai_enabled="${OPENAI_ENABLED:-false}"
openai_execution_enabled="${OPENAI_EXECUTION_ENABLED:-false}"
openai_base_url="${OPENAI_BASE_URL:-https://api.openai.com/v1}"
openai_default_model="${OPENAI_DEFAULT_MODEL:-}"

validate_url_shape "$BASE_URL" "backend base URL"
validate_url_shape "$openai_base_url" "OpenAI base URL"

case "$runtime_provider" in
  local|agno_stub|agno|agno_http) ;;
  *) fail "RUNTIME_PROVIDER has an unsupported value" ;;
esac

for item in \
  "RUNTIME_ADAPTER_ENABLED:$runtime_adapter_enabled" \
  "CHAT_CONTEXT_ENABLED:$chat_context_enabled" \
  "LLM_PROVIDERS_ENABLED:$llm_providers_enabled" \
  "LLM_EXECUTION_ENABLED:$llm_execution_enabled" \
  "OPENAI_ENABLED:$openai_enabled" \
  "OPENAI_EXECUTION_ENABLED:$openai_execution_enabled"; do
  is_boolean "${item#*:}" || fail "${item%%:*} must be true or false"
done

for item in \
  "CHAT_CONTEXT_MAX_MESSAGES:$chat_context_max_messages" \
  "CHAT_CONTEXT_MAX_MESSAGE_CHARS:$chat_context_max_message_chars" \
  "CHAT_CONTEXT_MAX_TOTAL_CHARS:$chat_context_max_total_chars"; do
  is_positive_integer "${item#*:}" || fail "${item%%:*} must be a positive integer"
done

for item in \
  "RUNTIME_PROVIDER:$runtime_provider" \
  "RUNTIME_ADAPTER_ENABLED:$runtime_adapter_enabled" \
  "CHAT_CONTEXT_ENABLED:$chat_context_enabled" \
  "CHAT_CONTEXT_MAX_MESSAGES:$chat_context_max_messages" \
  "CHAT_CONTEXT_MAX_MESSAGE_CHARS:$chat_context_max_message_chars" \
  "CHAT_CONTEXT_MAX_TOTAL_CHARS:$chat_context_max_total_chars" \
  "LLM_PROVIDERS_ENABLED:$llm_providers_enabled" \
  "LLM_EXECUTION_ENABLED:$llm_execution_enabled" \
  "OPENAI_ENABLED:$openai_enabled" \
  "OPENAI_EXECUTION_ENABLED:$openai_execution_enabled"; do
  report_flag "${item%%:*}" "${item#*:}"
done

if [ -n "$openai_default_model" ]; then
  pass "OpenAI default model is configured"
else
  skip "OpenAI default model is not configured"
fi

if [ -n "${OPENAI_API_KEY:-}" ]; then
  pass "OpenAI credential is configured; value was not displayed"
else
  skip "OpenAI credential is not configured"
fi

pass "conversation context limits are positive integers"

if [ "$runtime_provider" = "local" ] && is_true "$runtime_adapter_enabled"; then
  pass "local runtime/fallback path is selected and enabled"
else
  skip "local runtime/fallback path is not selected and enabled"
fi

if is_true "$chat_context_enabled"; then
  pass "governed conversation context is enabled"
else
  skip "governed conversation context is disabled"
fi

if [ "$MODE" = "--dry-run" ]; then
  skip "backend health request omitted by dry-run"
else
  command -v curl >/dev/null 2>&1 || fail "required command not found: curl"
  status="$(curl \
    --silent \
    --show-error \
    --connect-timeout "$CURL_CONNECT_TIMEOUT" \
    --max-time "$CURL_MAX_TIME" \
    --output "$response_file" \
    --write-out '%{http_code}' \
    "$BASE_URL/health")" || fail "backend health request failed"
  [ "$status" = "200" ] || fail "backend health expected HTTP 200, got $status"
  pass "backend health HTTP 200"
fi

real_provider_ready=true
is_true "$llm_providers_enabled" || real_provider_ready=false
is_true "$llm_execution_enabled" || real_provider_ready=false
is_true "$openai_enabled" || real_provider_ready=false
is_true "$openai_execution_enabled" || real_provider_ready=false
is_true "$chat_context_enabled" || real_provider_ready=false
[ "$runtime_provider" = "local" ] || real_provider_ready=false
is_true "$runtime_adapter_enabled" || real_provider_ready=false
[ -n "$openai_default_model" ] || real_provider_ready=false
[ -n "${OPENAI_API_KEY:-}" ] || real_provider_ready=false

if [ "$real_provider_ready" = true ]; then
  pass "real-provider environment gates are configured; credential value was not displayed"
  skip "real provider execution remains a manual UI step; no external request was attempted"
else
  skip "real provider scenario is not fully configured; no external request was attempted"
fi

if is_true "$openai_enabled" && { [ -z "${OPENAI_API_KEY:-}" ] || [ -z "$openai_default_model" ]; }; then
  pass "misconfigured-provider precondition detected; expect governed fail-closed without external call"
fi

print_checklist
printf '\nSmoke summary: PASS=%d SKIPPED=%d FAIL=0\n' "$pass_count" "$skip_count"
