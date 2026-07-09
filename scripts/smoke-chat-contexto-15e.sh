#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
AGNO_RUNTIME_URL="${AGNO_RUNTIME_URL:-http://127.0.0.1:8091}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-3}"
CURL_MAX_TIME="${CURL_MAX_TIME:-10}"

COMPOSE=(docker compose -f "$COMPOSE_FILE")
response_file="$(mktemp)"
command_log="$(mktemp)"
trap 'rm -f "$response_file" "$command_log"' EXIT

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

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

request_status() {
  curl \
    --silent \
    --show-error \
    --connect-timeout "$CURL_CONNECT_TIMEOUT" \
    --max-time "$CURL_MAX_TIME" \
    --output "$response_file" \
    --write-out '%{http_code}' \
    "$@"
}

expect_status() {
  local expected="$1"
  local label="$2"
  shift 2

  local status
  if ! status="$(request_status "$@")"; then
    fail "$label request failed"
  fi
  if [ "$status" != "$expected" ]; then
    fail "$label expected HTTP $expected, got $status"
  fi

  pass "$label HTTP $status"
}

assert_json() {
  local label="$1"
  if ! python3 -c 'import json,sys; json.load(open(sys.argv[1], encoding="utf-8"))' "$response_file"; then
    fail "$label returned invalid JSON"
  fi
}

require_command docker
require_command curl
require_command python3

[ -f "$COMPOSE_FILE" ] || fail "compose file not found: $COMPOSE_FILE"

if ! docker compose version >"$command_log" 2>&1; then
  fail "Docker Compose is not available"
fi
pass "Docker Compose available"

if ! "${COMPOSE[@]}" ps >"$command_log" 2>&1; then
  fail "docker compose ps failed"
fi
pass "docker compose ps completed"

running_services="$("${COMPOSE[@]}" ps --services --status running)"
for service in frontend backend db; do
  if ! grep -qx "$service" <<<"$running_services"; then
    fail "compose service is not running: $service"
  fi
  pass "compose service running: $service"
done

if ! "${COMPOSE[@]}" exec -T backend sh -lc 'npx prisma migrate status --schema prisma/schema.prisma' >"$command_log" 2>&1; then
  cat "$command_log" >&2
  fail "Prisma migration status failed or migrations are pending"
fi
pass "Prisma migrations are applied"

expect_status 200 "backend health" "$BASE_URL/health"
assert_json "backend health"

expect_status 200 "backend database health" "$BASE_URL/health/db"
assert_json "backend database health"

expect_status 200 "frontend health" "$FRONTEND_URL/health.html"

runtime_status=""
if runtime_status="$(request_status "$AGNO_RUNTIME_URL/health")"; then
  if [ "$runtime_status" = "200" ]; then
    assert_json "Agno runtime health"
    python3 -c 'import json,sys; data=json.load(open(sys.argv[1])); assert data["provider"] == "agno"; assert data["status"] == "healthy"; assert data["details"]["externalProvidersCalled"] is False; assert data["details"]["databaseCalled"] is False' "$response_file" \
      || fail "Agno runtime health has unexpected payload"
    pass "Agno runtime health"

    expect_status 200 "Agno runtime capabilities" "$AGNO_RUNTIME_URL/capabilities"
    assert_json "Agno runtime capabilities"
    python3 -c 'import json,sys; data=json.load(open(sys.argv[1])); assert data["provider"] == "agno"; assert data["supportsStreaming"] is False; assert data["supportsTools"] is False; assert data["supportsRagContext"] is True; assert data["maxToolCalls"] == 0' "$response_file" \
      || fail "Agno runtime capabilities have unexpected payload"
    pass "Agno runtime capabilities payload"
  else
    fail "Agno runtime health returned HTTP $runtime_status"
  fi
else
  skip "Agno runtime is not active at $AGNO_RUNTIME_URL"
fi

printf '\nSmoke summary: PASS=%d SKIPPED=%d FAIL=0\n' "$pass_count" "$skip_count"
