#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_EXAMPLE="$ROOT_DIR/backend/.env.example"
BRIDGE_EXAMPLE="$ROOT_DIR/runtime/agno-bridge/.env.example"
COMPOSE_BASE="$ROOT_DIR/docker-compose.dev.yml"
COMPOSE_BRIDGE="$ROOT_DIR/docker-compose.agno-bridge.yml"

umask 077
health_file="$(mktemp)"
capabilities_file="$(mktemp)"
trap 'rm -f "$health_file" "$capabilities_file"' EXIT

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
  printf '\nAgno bridge Docker preflight summary: PASS=%d SKIPPED=%d FAIL=1\n' "$pass_count" "$skip_count" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: scripts/smoke-agno-bridge-docker-16h.sh [MODE]

Modes:
  --dry-run       Validate versioned fail-closed examples, bridge files, and Compose syntax (default).
  --check-runtime Run the offline checks, then call only bridge health and capabilities.
  --help          Print this help.

The script never loads an environment file, submits Chat, starts model execution, contacts an
LLM provider, or invokes a tool callback. It never prints credentials, private URLs, transport
headers, provider keys, response bodies, prompts, RAG excerpts, descriptors, or tool data.
EOF
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

env_value() {
  local file="$1"
  local name="$2"
  awk -F= -v key="$name" '$1 == key { sub(/^[^=]*=/, ""); print; found=1; exit } END { if (!found) exit 1 }' "$file"
}

expect_value() {
  local file="$1"
  local name="$2"
  local expected="$3"
  local value
  value="$(env_value "$file" "$name")" || fail "$name is missing from its versioned example"
  [ "$value" = "$expected" ] || fail "$name does not have the required fail-closed value"
}

validate_url_shape() {
  URL_TO_VALIDATE="$1" python3 - <<'PY'
import os
from urllib.parse import urlsplit

try:
    value = os.environ["URL_TO_VALIDATE"]
    parsed = urlsplit(value)
    parsed.port
    valid = (
        parsed.scheme in {"http", "https"}
        and bool(parsed.hostname)
        and parsed.username is None
        and parsed.password is None
        and not parsed.query
        and not parsed.fragment
        and "?" not in value
        and "#" not in value
    )
except (KeyError, ValueError):
    valid = False
raise SystemExit(0 if valid else 1)
PY
}

validate_health() {
  python3 - "$1" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], encoding="utf-8") as handle:
        data = json.load(handle)
    valid = (
        isinstance(data, dict)
        and set(data).issubset({"provider", "protocolVersion", "status", "checkedAt", "message", "details"})
        and data.get("provider") == "agno"
        and data.get("protocolVersion") == "orchestra.runtime.assistant.v1"
        and data.get("status") in {"healthy", "degraded"}
        and isinstance(data.get("checkedAt"), str)
    )
except (OSError, ValueError, TypeError):
    valid = False
raise SystemExit(0 if valid else 1)
PY
}

validate_capabilities() {
  python3 - "$1" "$2" "$3" "$4" <<'PY'
import json
import sys

max_tool_calls = int(sys.argv[2])
rag_enabled = sys.argv[3] == "true"
tools_enabled = sys.argv[4] == "true"
try:
    with open(sys.argv[1], encoding="utf-8") as handle:
        data = json.load(handle)
    allowed = {
        "provider", "protocolVersion", "supportsStreaming", "supportsTools", "supportsRagContext",
        "supportsExternalProviders", "supportsFileInputs", "maxInputChars", "maxToolCalls",
    }
    booleans = (
        "supportsStreaming", "supportsTools", "supportsRagContext", "supportsExternalProviders", "supportsFileInputs",
    )
    valid = (
        isinstance(data, dict)
        and set(data).issubset(allowed)
        and data.get("provider") == "agno"
        and data.get("protocolVersion") == "orchestra.runtime.assistant.v1"
        and all(isinstance(data.get(name), bool) for name in booleans)
        and data.get("supportsStreaming") is False
        and data.get("supportsExternalProviders") is True
        and data.get("supportsFileInputs") is False
        and (not rag_enabled or data.get("supportsRagContext") is True)
        and (not tools_enabled or data.get("supportsTools") is True)
        and isinstance(data.get("maxInputChars"), int)
        and not isinstance(data.get("maxInputChars"), bool)
        and data.get("maxInputChars", 0) > 0
        and data.get("maxToolCalls") == max_tool_calls
    )
except (OSError, ValueError, TypeError):
    valid = False
raise SystemExit(0 if valid else 1)
PY
}

runtime_request() {
  local path="$1"
  local output_file="$2"
  local target="${runtime_url%/}${path}"
  RUNTIME_REQUEST_URL="$target" \
  RUNTIME_REQUEST_KEY="$runtime_key" \
  RUNTIME_RESPONSE_FILE="$output_file" \
    python3 - <<'PY'
import os
from urllib.error import HTTPError
from urllib.request import Request, urlopen

request = Request(os.environ["RUNTIME_REQUEST_URL"], method="GET")
key = os.environ.get("RUNTIME_REQUEST_KEY", "")
if key:
    request.add_header("Authorization", f"Bearer {key}")
try:
    with urlopen(request, timeout=10) as response:
        body = response.read()
        status = response.status
except HTTPError as error:
    body = error.read()
    status = error.code
with open(os.environ["RUNTIME_RESPONSE_FILE"], "wb") as handle:
    handle.write(body)
print(status, end="")
PY
}

for file in "$BACKEND_EXAMPLE" "$BRIDGE_EXAMPLE" "$COMPOSE_BASE" "$COMPOSE_BRIDGE" \
  "$ROOT_DIR/runtime/agno-bridge/Dockerfile" "$ROOT_DIR/runtime/agno-bridge/app.py"; do
  [ -f "$file" ] || fail "a required versioned bridge file is missing"
done
pass "bridge, Docker, Compose, and example files are present"

expect_value "$BACKEND_EXAMPLE" RUNTIME_PROVIDER local
expect_value "$BACKEND_EXAMPLE" AGNO_RUNTIME_HTTP_ENABLED false
expect_value "$BACKEND_EXAMPLE" AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY false
expect_value "$BACKEND_EXAMPLE" AGNO_RUNTIME_HTTP_SECURITY_KEY ""
expect_value "$BACKEND_EXAMPLE" AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED false
expect_value "$BACKEND_EXAMPLE" AGNO_RUNTIME_HTTP_TOOLS_ENABLED false
expect_value "$BACKEND_EXAMPLE" AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS 0
expect_value "$BACKEND_EXAMPLE" AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED false
pass "backend example remains fail-closed"

expect_value "$BRIDGE_EXAMPLE" AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY true
expect_value "$BRIDGE_EXAMPLE" AGNO_RUNTIME_HTTP_SECURITY_KEY ""
expect_value "$BRIDGE_EXAMPLE" AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED false
expect_value "$BRIDGE_EXAMPLE" AGNO_RUNTIME_HTTP_TOOLS_ENABLED false
expect_value "$BRIDGE_EXAMPLE" AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS 0
expect_value "$BRIDGE_EXAMPLE" AGNO_RUNTIME_HTTP_TOOL_GATEWAY_ENABLED false
expect_value "$BRIDGE_EXAMPLE" OPENAI_API_KEY ""
expect_value "$BRIDGE_EXAMPLE" AZURE_OPENAI_API_KEY ""
expect_value "$BRIDGE_EXAMPLE" ANTHROPIC_API_KEY ""
pass "bridge example contains only empty credential placeholders and closed feature gates"

command -v python3 >/dev/null 2>&1 || fail "required command not found: python3"
python3 -m py_compile \
  "$ROOT_DIR/runtime/agno-bridge/app.py" \
  "$ROOT_DIR/runtime/agno-bridge/bridge.py" \
  "$ROOT_DIR/runtime/agno-bridge/contract.py" \
  "$ROOT_DIR/runtime/agno-bridge/healthcheck.py" \
  || fail "bridge Python syntax validation failed"
pass "bridge Python files are syntax-valid"

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose --env-file /dev/null -f "$COMPOSE_BASE" -f "$COMPOSE_BRIDGE" config --no-interpolate --quiet \
    || fail "Docker Compose configuration is invalid"
  pass "Docker Compose base plus bridge override is valid without rendering values"
else
  skip "Docker Compose is unavailable; static file checks still passed"
fi

if [ "$MODE" = "--check-runtime" ]; then
  runtime_url="${AGNO_RUNTIME_HTTP_BASE_URL:-}"
  runtime_key="${AGNO_RUNTIME_HTTP_SECURITY_KEY:-}"
  security_required="${AGNO_RUNTIME_HTTP_REQUIRE_SECURITY_KEY:-true}"
  rag_enabled="${AGNO_RUNTIME_HTTP_RAG_CONTEXT_ENABLED:-false}"
  tools_enabled="${AGNO_RUNTIME_HTTP_TOOLS_ENABLED:-false}"
  max_tool_calls="${AGNO_RUNTIME_HTTP_MAX_TOOL_CALLS:-0}"

  [ -n "$runtime_url" ] || fail "runtime base URL must be exported for the online check"
  validate_url_shape "$runtime_url" || fail "runtime base URL has an unsafe shape"
  [[ "$max_tool_calls" =~ ^[0-9]+$ ]] && [ "$max_tool_calls" -le 50 ] \
    || fail "runtime tool call limit is invalid"
  [ "$security_required" = "true" ] || [ "$security_required" = "false" ] \
    || fail "runtime authentication flag must be boolean"
  if [ "$security_required" = "true" ]; then
    [ -n "$runtime_key" ] || fail "runtime credential must be exported for authenticated checks"
    [ "${#runtime_key}" -ge 16 ] && [ "${#runtime_key}" -le 512 ] \
      || fail "runtime credential length is invalid"
  fi
  health_status="$(runtime_request /health "$health_file")" || fail "runtime health request failed"
  [ "$health_status" = "200" ] || fail "runtime health returned an unexpected status"
  validate_health "$health_file" || fail "runtime health is not ready or contract-compatible"
  pass "runtime health is ready and contract-compatible"

  capabilities_status="$(runtime_request /capabilities "$capabilities_file")" \
    || fail "runtime capabilities request failed"
  [ "$capabilities_status" = "200" ] || fail "runtime capabilities returned an unexpected status"
  validate_capabilities "$capabilities_file" "$max_tool_calls" "${rag_enabled,,}" "${tools_enabled,,}" \
    || fail "runtime capabilities contradict the configured real bridge profile"
  pass "runtime capabilities confirm the real provider and configured governed features"
else
  skip "runtime requests omitted; no network request was attempted"
fi

printf '\nAgno bridge Docker preflight summary: PASS=%d SKIPPED=%d FAIL=0\n' "$pass_count" "$skip_count"
