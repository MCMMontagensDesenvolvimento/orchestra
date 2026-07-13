#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
CURL_BIN="${CURL_BIN:-curl}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-3}"
CURL_MAX_TIME="${CURL_MAX_TIME:-10}"

umask 077
health_response_file="$(mktemp)"
capabilities_response_file="$(mktemp)"
trap 'rm -f "$health_response_file" "$capabilities_response_file"' EXIT

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
  printf '\nAgno real preflight summary: PASS=%d SKIPPED=%d FAIL=1\n' "$pass_count" "$skip_count" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: scripts/smoke-agno-real-16e.sh [--dry-run|--check-runtime|--help]

  --dry-run       Validate exported security and governance gates without network access (default).
  --check-runtime Validate the same gates, then call only runtime health and capabilities.
  --help          Print this help.

This smoke does not load local environment files, submit Chat or runtime execution requests,
call an LLM provider, or execute MCP/tools. Chat homologation remains a manual UI procedure.
Private URLs, credentials, transport headers, and response bodies are never displayed.
EOF
}

is_true() {
  [ "${1,,}" = "true" ]
}

is_false() {
  [ "${1,,}" = "false" ]
}

is_boolean() {
  is_true "$1" || is_false "$1"
}

is_bounded_timeout() {
  [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 1000 ] && [ "$1" -le 120000 ]
}

validate_url_shape() {
  URL_TO_VALIDATE="$1" python3 - <<'PY'
import os
from urllib.parse import urlsplit

try:
    raw_value = os.environ['URL_TO_VALIDATE']
    value = raw_value.strip()
    parsed = urlsplit(value)
    parsed.port
    loopback = parsed.hostname in {'localhost', '127.0.0.1', '::1'}
    valid = (
        parsed.scheme in {'http', 'https'}
        and value == raw_value
        and bool(parsed.hostname)
        and (parsed.scheme == 'https' or loopback)
        and parsed.username is None
        and parsed.password is None
        and not parsed.query
        and not parsed.fragment
        and '?' not in value
        and '#' not in value
    )
except (KeyError, ValueError):
    valid = False

raise SystemExit(0 if valid else 1)
PY
}

validate_health_response() {
  python3 - "$1" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], encoding='utf-8') as handle:
        data = json.load(handle)
    allowed_fields = {'provider', 'protocolVersion', 'status', 'checkedAt', 'message', 'details'}
    valid = (
        isinstance(data, dict)
        and set(data).issubset(allowed_fields)
        and data.get('provider') == 'agno'
        and data.get('protocolVersion') == 'orchestra.runtime.assistant.v1'
        and data.get('status') in {'healthy', 'degraded'}
        and isinstance(data.get('checkedAt'), str)
        and bool(data.get('checkedAt'))
        and ('message' not in data or isinstance(data.get('message'), str))
        and ('details' not in data or isinstance(data.get('details'), dict))
    )
except (OSError, ValueError, TypeError):
    valid = False

raise SystemExit(0 if valid else 1)
PY
}

validate_capabilities_response() {
  python3 - "$1" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], encoding='utf-8') as handle:
        data = json.load(handle)
    allowed_fields = {
        'provider',
        'protocolVersion',
        'supportsStreaming',
        'supportsTools',
        'supportsRagContext',
        'supportsExternalProviders',
        'supportsFileInputs',
        'maxInputChars',
        'maxToolCalls',
    }
    boolean_fields = (
        'supportsStreaming',
        'supportsTools',
        'supportsRagContext',
        'supportsExternalProviders',
        'supportsFileInputs',
    )
    valid = (
        isinstance(data, dict)
        and set(data).issubset(allowed_fields)
        and data.get('provider') == 'agno'
        and data.get('protocolVersion') == 'orchestra.runtime.assistant.v1'
        and all(isinstance(data.get(field), bool) for field in boolean_fields)
        and isinstance(data.get('maxInputChars'), int)
        and data.get('maxInputChars', 0) > 0
        and isinstance(data.get('maxToolCalls'), int)
        and data.get('maxToolCalls') == 0
    )
except (OSError, ValueError, TypeError):
    valid = False

raise SystemExit(0 if valid else 1)
PY
}

request_runtime_status() {
  local path="$1"
  local output_file="$2"
  local target="${agno_http_base_url%/}${path}"

  printf 'header = "Authorization: Bearer %s"\n' "$security_key" \
    | "$CURL_BIN" \
      --silent \
      --request GET \
      --connect-timeout "$CURL_CONNECT_TIMEOUT" \
      --max-time "$CURL_MAX_TIME" \
      --output "$output_file" \
      --write-out '%{http_code}' \
      --config - \
      "$target"
}

contains_private_runtime_config() {
  local response_file="$1"
  local normalized_base_url="${agno_http_base_url%/}"

  grep -Fq -- "$security_key" "$response_file" \
    || grep -Fq -- "$normalized_base_url" "$response_file"
}

case "$MODE" in
  --dry-run|--check-runtime) ;;
  --help|-h)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

[ "$#" -le 1 ] || fail "only one mode can be selected"

runtime_provider="${RUNTIME_PROVIDER:-local}"
runtime_adapter_enabled="${RUNTIME_ADAPTER_ENABLED:-true}"
runtime_require_precheck="${RUNTIME_REQUIRE_PRECHECK:-true}"
allow_provider_fallback="${RUNTIME_ALLOW_PROVIDER_FALLBACK:-false}"
allow_external_tools="${RUNTIME_ALLOW_EXTERNAL_TOOLS:-false}"
agno_http_enabled="${AGNO_RUNTIME_HTTP_ENABLED:-false}"
agno_http_base_url="${AGNO_RUNTIME_HTTP_BASE_URL:-}"
agno_http_timeout_ms="${AGNO_RUNTIME_HTTP_TIMEOUT_MS:-15000}"
security_required="${AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY:-false}"
security_key="${AGNO_RUNTIME_HTTP_SECURITY_KEY:-}"
tools_descriptors_enabled="${AGNO_RUNTIME_HTTP_TOOLS_ENABLED:-false}"
max_tool_calls="${AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS:-0}"
tool_gateway_enabled="${AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED:-false}"
agno_allow_external_tools="${AGNO_ALLOW_EXTERNAL_TOOLS:-false}"
agno_allow_remote_mcp="${AGNO_ALLOW_REMOTE_MCP:-false}"
mcp_remote_execution_enabled="${MCP_REMOTE_EXECUTION_ENABLED:-false}"

command -v python3 >/dev/null 2>&1 || fail "required command not found: python3"

for item in \
  "RUNTIME_ADAPTER_ENABLED:$runtime_adapter_enabled" \
  "RUNTIME_REQUIRE_PRECHECK:$runtime_require_precheck" \
  "RUNTIME_ALLOW_PROVIDER_FALLBACK:$allow_provider_fallback" \
  "RUNTIME_ALLOW_EXTERNAL_TOOLS:$allow_external_tools" \
  "AGNO_RUNTIME_HTTP_ENABLED:$agno_http_enabled" \
  "AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY:$security_required" \
  "AGNO_RUNTIME_HTTP_TOOLS_ENABLED:$tools_descriptors_enabled" \
  "AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED:$tool_gateway_enabled" \
  "AGNO_ALLOW_EXTERNAL_TOOLS:$agno_allow_external_tools" \
  "AGNO_ALLOW_REMOTE_MCP:$agno_allow_remote_mcp" \
  "MCP_REMOTE_EXECUTION_ENABLED:$mcp_remote_execution_enabled"; do
  is_boolean "${item#*:}" || fail "${item%%:*} must be true or false"
done

[ "$runtime_provider" = "agno_http" ] || fail "agno_http must be the selected runtime provider"
is_true "$runtime_adapter_enabled" || fail "runtime adapter boundary must be enabled"
is_true "$runtime_require_precheck" || fail "runtime governance precheck must be required"
is_false "$allow_provider_fallback" || fail "provider fallback must remain disabled"
is_true "$agno_http_enabled" || fail "Agno HTTP runtime must be enabled"
is_true "$security_required" || fail "runtime authentication must be required"
[ -n "$agno_http_base_url" ] || fail "runtime base URL must be configured"
validate_url_shape "$agno_http_base_url" || fail "runtime base URL has an unsafe shape"
is_bounded_timeout "$agno_http_timeout_ms" \
  || fail "runtime timeout must be an integer between 1000 and 120000"
pass "runtime transport and fail-closed gates are configured"

[ -n "$security_key" ] || fail "runtime credential must be configured"
[ "${#security_key}" -ge 16 ] && [ "${#security_key}" -le 512 ] \
  || fail "runtime credential must contain between 16 and 512 characters"
[[ "$security_key" =~ ^[A-Za-z0-9._~+/-]+=*$ ]] \
  || fail "runtime credential must use a safe bearer-token format"
pass "runtime credential is present; value was not displayed"

[ "$max_tool_calls" = "0" ] || fail "runtime tool call limit must remain zero"
is_false "$tool_gateway_enabled" || fail "governed tool gateway must remain disabled during 16E homologation"
is_false "$allow_external_tools" || fail "external runtime tools must remain disabled"
is_false "$agno_allow_external_tools" || fail "Agno external tools must remain disabled"
is_false "$agno_allow_remote_mcp" || fail "Agno remote MCP must remain disabled"
is_false "$mcp_remote_execution_enabled" || fail "remote MCP execution must remain disabled"
pass "tool descriptors are non-executable and real MCP/tool gates are disabled"

if is_true "$tools_descriptors_enabled"; then
  pass "governed tool descriptors may be attached with zero executable calls"
else
  skip "governed tool descriptors are disabled"
fi

if [ "$MODE" = "--dry-run" ]; then
  skip "runtime requests omitted; no network request was attempted"
else
  command -v "$CURL_BIN" >/dev/null 2>&1 || fail "required HTTP client was not found"

  health_status="$(request_runtime_status '/health' "$health_response_file")" \
    || fail "runtime health request failed"
  [ "$health_status" = "200" ] || fail "runtime health returned an unexpected HTTP status"
  ! contains_private_runtime_config "$health_response_file" \
    || fail "runtime health exposed private transport configuration"
  validate_health_response "$health_response_file" || fail "runtime health returned an invalid contract payload"
  pass "runtime health contract is healthy or degraded"

  capabilities_status="$(request_runtime_status '/capabilities' "$capabilities_response_file")" \
    || fail "runtime capabilities request failed"
  [ "$capabilities_status" = "200" ] || fail "runtime capabilities returned an unexpected HTTP status"
  ! contains_private_runtime_config "$capabilities_response_file" \
    || fail "runtime capabilities exposed private transport configuration"
  validate_capabilities_response "$capabilities_response_file" \
    || fail "runtime capabilities returned an invalid contract payload"
  pass "runtime capabilities contract is valid"
fi

printf '\nAgno real preflight summary: PASS=%d SKIPPED=%d FAIL=0\n' "$pass_count" "$skip_count"
