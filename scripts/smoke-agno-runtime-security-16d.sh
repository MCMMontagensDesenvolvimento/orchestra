#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-3}"
CURL_MAX_TIME="${CURL_MAX_TIME:-10}"

umask 077
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
  printf '\nSecurity preflight summary: PASS=%d SKIPPED=%d FAIL=1\n' "$pass_count" "$skip_count" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: scripts/smoke-agno-runtime-security-16d.sh [--dry-run|--check|--help]

  --dry-run  Validate exported configuration without network access (default).
  --check    Validate configuration and call only the configured runtime /health route.
  --help     Print this help.

The preflight does not load local environment files, send Chat messages, execute tools,
or call an LLM provider. Credential values and transport headers are never displayed.
EOF
}

is_true() {
  [ "${1,,}" = "true" ]
}

is_boolean() {
  [ "${1,,}" = "true" ] || [ "${1,,}" = "false" ]
}

is_bounded_timeout() {
  [[ "$1" =~ ^[0-9]+$ ]] && [ "$1" -ge 1000 ] && [ "$1" -le 120000 ]
}

validate_url_shape() {
  URL_TO_VALIDATE="$1" python3 - <<'PY'
import os
from urllib.parse import urlsplit

value = os.environ['URL_TO_VALIDATE'].strip()
parsed = urlsplit(value)
valid = (
    parsed.scheme in {'http', 'https'}
    and bool(parsed.hostname)
    and parsed.username is None
    and parsed.password is None
    and not parsed.query
    and not parsed.fragment
    and '?' not in value
    and '#' not in value
)
raise SystemExit(0 if valid else 1)
PY
}

case "$MODE" in
  --dry-run|--check) ;;
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
allow_provider_fallback="${RUNTIME_ALLOW_PROVIDER_FALLBACK:-false}"
agno_http_enabled="${AGNO_RUNTIME_HTTP_ENABLED:-false}"
agno_http_base_url="${AGNO_RUNTIME_HTTP_BASE_URL:-}"
agno_http_timeout_ms="${AGNO_RUNTIME_HTTP_TIMEOUT_MS:-15000}"
security_required="${AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY:-false}"
security_key="${AGNO_RUNTIME_HTTP_SECURITY_KEY:-}"

command -v python3 >/dev/null 2>&1 || fail "required command not found: python3"

case "$runtime_provider" in
  local|agno_stub|agno|agno_http) ;;
  *) fail "RUNTIME_PROVIDER has an unsupported value" ;;
esac

for item in \
  "RUNTIME_ADAPTER_ENABLED:$runtime_adapter_enabled" \
  "RUNTIME_ALLOW_PROVIDER_FALLBACK:$allow_provider_fallback" \
  "AGNO_RUNTIME_HTTP_ENABLED:$agno_http_enabled" \
  "AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY:$security_required"; do
  is_boolean "${item#*:}" || fail "${item%%:*} must be true or false"
done

is_bounded_timeout "$agno_http_timeout_ms" \
  || fail "AGNO_RUNTIME_HTTP_TIMEOUT_MS must be an integer between 1000 and 120000"
pass "runtime timeout is within the safe range"

if [ -n "$security_key" ]; then
  [ "${#security_key}" -ge 16 ] && [ "${#security_key}" -le 512 ] \
    || fail "runtime credential must contain between 16 and 512 characters"
  [[ "$security_key" =~ ^[A-Za-z0-9._~+/-]+=*$ ]] || fail "runtime credential must use a safe bearer-token format"
  pass "runtime credential is configured; value was not displayed"
else
  skip "runtime credential is not configured; acceptable only for isolated development"
fi

if is_true "$security_required" && [ -z "$security_key" ]; then
  fail "runtime authentication is required but no credential is configured"
fi

if is_true "$agno_http_enabled"; then
  [ -n "$agno_http_base_url" ] || fail "runtime base URL is required when the HTTP adapter is enabled"
  validate_url_shape "$agno_http_base_url" || fail "runtime base URL has an unsafe shape"
  pass "runtime base URL has a safe shape; value was not displayed"

  is_true "$runtime_adapter_enabled" || fail "runtime adapter boundary must be enabled"
  [ "$runtime_provider" = "agno_http" ] || fail "agno_http must be the selected runtime provider"
  is_true "$allow_provider_fallback" && fail "provider fallback must remain disabled for agno_http"
  pass "agno_http is selected with fail-closed provider policy"
elif [ "$runtime_provider" = "agno_http" ]; then
  fail "agno_http is selected but its HTTP adapter is disabled"
else
  skip "agno_http adapter is disabled"
fi

if [ "$MODE" = "--dry-run" ]; then
  skip "runtime health request omitted; no network request was attempted"
elif is_true "$agno_http_enabled"; then
  command -v curl >/dev/null 2>&1 || fail "required command not found: curl"
  curl_args=(
    --silent
    --connect-timeout "$CURL_CONNECT_TIMEOUT"
    --max-time "$CURL_MAX_TIME"
    --output "$response_file"
    --write-out '%{http_code}'
  )
  if [ -n "$security_key" ]; then
    status="$(printf 'header = "Authorization: Bearer %s"\n' "$security_key" \
      | curl "${curl_args[@]}" --config - "${agno_http_base_url%/}/health")" \
      || fail "runtime health request failed"
  else
    status="$(curl "${curl_args[@]}" "${agno_http_base_url%/}/health")" \
      || fail "runtime health request failed"
  fi
  [ "$status" = "200" ] || fail "runtime health expected HTTP 200, got $status"
  python3 -c 'import json,sys; data=json.load(open(sys.argv[1], encoding="utf-8")); assert data.get("status") in {"healthy", "degraded"}' "$response_file" \
    || fail "runtime health returned an invalid or unhealthy payload"
  pass "runtime health preflight returned a healthy contract response"
else
  skip "runtime health request omitted because agno_http is disabled"
fi

printf '\nSecurity preflight summary: PASS=%d SKIPPED=%d FAIL=0\n' "$pass_count" "$skip_count"
