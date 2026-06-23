#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dev.yml}"
BASE_URL="${BASE_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
DEV_EMAIL="${DEV_EMAIL:-admin.dev@orchestra.local}"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-5}"
CURL_MAX_TIME="${CURL_MAX_TIME:-20}"

COMPOSE=(docker compose -f "$COMPOSE_FILE")
DEMO_ASSISTANT_ID="00000000-0000-0000-0000-000000000101"

cookie_file="$(mktemp)"
payload_file="$(mktemp)"
response_file="$(mktemp)"
command_log="$(mktemp)"
trap 'rm -f "$cookie_file" "$payload_file" "$response_file" "$command_log"' EXIT

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

normalize() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | tr -d '[:space:]'
}

read_env_value() {
  local file="$1"
  local key="$2"

  [ -f "$file" ] || return 0
  awk -F= -v key="$key" '
    $0 ~ "^[[:space:]]*" key "[[:space:]]*=" {
      value = substr($0, index($0, "=") + 1)
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
    }
    END { if (value != "") print value }
  ' "$file"
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

assert_json_response() {
  local label="$1"
  if ! python3 -c 'import json,sys; json.load(open(sys.argv[1], encoding="utf-8"))' "$response_file"; then
    fail "$label returned invalid JSON"
  fi
}

compose_value() {
  local service="$1"
  local variable="$2"
  "${COMPOSE[@]}" exec -T "$service" sh -lc "printf '%s' \"\${$variable:-}\""
}

query_demo_assistant_count() {
  "${COMPOSE[@]}" exec -T backend node -e '
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    prisma.assistant.count({ where: { id: process.argv[1] } })
      .then((count) => console.log(count))
      .catch(() => { process.exitCode = 1; })
      .finally(() => prisma.$disconnect());
  ' "$DEMO_ASSISTANT_ID"
}

validate_bootstrap_records() {
  "${COMPOSE[@]}" exec -T backend node -e '
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    (async () => {
      const tenant = await prisma.tenant.findUnique({ where: { slug: "orchestra-dev" } });
      const workspace = tenant
        ? await prisma.workspace.findUnique({
            where: { tenantId_slug: { tenantId: tenant.id, slug: "default" } },
          })
        : null;
      const admin = await prisma.user.findUnique({
        where: { email: "admin.dev@orchestra.local" },
      });
      if (!tenant || !workspace || !admin) process.exitCode = 1;
    })()
      .catch(() => { process.exitCode = 1; })
      .finally(() => prisma.$disconnect());
  '
}

require_command docker
require_command curl
require_command python3

[ -f "$COMPOSE_FILE" ] || fail "compose file not found: $COMPOSE_FILE"

if ! docker compose version >"$command_log" 2>&1; then
  fail "Docker Compose is not available"
fi
pass "Docker Compose available"

running_services="$("${COMPOSE[@]}" ps --services --status running)"
for service in frontend backend db; do
  if ! grep -qx "$service" <<<"$running_services"; then
    fail "compose service is not running: $service"
  fi
  pass "compose service running: $service"
done

frontend_mock_value=""
for env_file in frontend/.env.example frontend/.env; do
  value="$(read_env_value "$env_file" VITE_USE_MOCKS)"
  if [ -n "$value" ]; then
    frontend_mock_value="$value"
  fi
done

case "$(normalize "$frontend_mock_value")" in
  true)
    fail "VITE_USE_MOCKS=true in frontend env files; real smoke requires false"
    ;;
  false)
    pass "frontend env files declare VITE_USE_MOCKS=false"
    ;;
  "")
    pass "frontend env files omit VITE_USE_MOCKS; safe application default is false"
    printf 'INFO Prefer declaring VITE_USE_MOCKS=false explicitly for local real mode.\n'
    ;;
  *)
    fail "VITE_USE_MOCKS has an ambiguous value; use false explicitly"
    ;;
esac

effective_mock_value="$(compose_value frontend VITE_USE_MOCKS)"
case "$(normalize "$effective_mock_value")" in
  true)
    fail "running frontend container has VITE_USE_MOCKS=true"
    ;;
  false)
    pass "running frontend container has VITE_USE_MOCKS=false"
    ;;
  "")
    pass "running frontend container omits VITE_USE_MOCKS; safe application default is false"
    ;;
  *)
    fail "running frontend container has an ambiguous VITE_USE_MOCKS value"
    ;;
esac

effective_demo_seed="$(compose_value backend ORCHESTRA_SEED_DEMO)"
effective_demo_alias="$(compose_value backend SEED_DEMO_DATA)"
if [ "$(normalize "$effective_demo_seed")" = "true" ] || [ "$(normalize "$effective_demo_alias")" = "true" ]; then
  fail "backend container requests demo seed; disable demo flags before real smoke"
fi
pass "backend demo seed flags are disabled"

expect_status 200 "frontend login" "$FRONTEND_URL/login"
if ! grep -qi '<html' "$response_file"; then
  fail "frontend login did not return HTML"
fi
pass "frontend login returned HTML"

expect_status 200 "backend health" "$BASE_URL/health"
assert_json_response "backend health"

expect_status 200 "backend database health" "$BASE_URL/health/db"
assert_json_response "backend database health"

if ! "${COMPOSE[@]}" exec -T backend npx prisma migrate status >"$command_log" 2>&1; then
  fail "Prisma migration status failed or migrations are pending"
fi
pass "Prisma migrations are applied"

if ! demo_count_before="$(query_demo_assistant_count | tail -n 1 | tr -d '\r[:space:]')"; then
  fail "could not inspect demo assistant count before bootstrap"
fi
[[ "$demo_count_before" =~ ^[0-9]+$ ]] || fail "invalid demo assistant count before bootstrap"

if ! "${COMPOSE[@]}" exec -T backend \
  env ORCHESTRA_SEED_DEMO=false SEED_DEMO_DATA=false \
  npm run prisma:seed >"$command_log" 2>&1; then
  fail "real bootstrap failed"
fi
pass "real bootstrap completed with demo flags forced off"

if ! validate_bootstrap_records >"$command_log" 2>&1; then
  fail "bootstrap tenant, workspace or local admin is missing"
fi
pass "bootstrap tenant, workspace and local admin exist"

if ! demo_count_after="$(query_demo_assistant_count | tail -n 1 | tr -d '\r[:space:]')"; then
  fail "could not inspect demo assistant count after bootstrap"
fi
[[ "$demo_count_after" =~ ^[0-9]+$ ]] || fail "invalid demo assistant count after bootstrap"
if [ "$demo_count_before" != "$demo_count_after" ]; then
  fail "real bootstrap changed the demo assistant count"
fi
pass "real bootstrap did not create demo assistant data"
if [ "$demo_count_after" != "0" ]; then
  printf 'INFO Existing demo assistant data was already present; this smoke did not use or modify it.\n'
fi

expect_status 401 "auth me without session" "$BASE_URL/api/v1/auth/me"
assert_json_response "auth me without session"

expect_status 200 "Microsoft SSO public config" "$BASE_URL/api/v1/auth/sso/config"
assert_json_response "Microsoft SSO public config"
if ! python3 - "$response_file" <<'PY'
import json
import sys

text = open(sys.argv[1], encoding="utf-8").read()
data = json.loads(text)["data"]
assert data["provider"] == "microsoft"
assert data["loginUrl"] == "/api/v1/auth/microsoft/start"
assert isinstance(data["enabled"], bool)
assert isinstance(data["configured"], bool)
assert isinstance(data["allowedDomains"], list)
for forbidden in (
    "client_secret",
    "access_token",
    "refresh_token",
    "id_token",
    "authorization_code",
):
    assert forbidden not in text.lower()
PY
then
  fail "Microsoft SSO public config is invalid or contains sensitive fields"
fi
pass "Microsoft SSO public config is sanitized"
sso_ready="$(python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; print("true" if data["enabled"] and data["configured"] else "false")' "$response_file")"

dev_login_enabled="$(normalize "$(compose_value backend DEV_LOGIN_ENABLED)")"
node_env="$(normalize "$(compose_value backend NODE_ENV)")"

if [ "$dev_login_enabled" = "true" ] && [ "$node_env" != "production" ]; then
  python3 -c 'import json,sys; json.dump({"email": sys.argv[1]}, open(sys.argv[2], "w", encoding="utf-8"))' \
    "$DEV_EMAIL" "$payload_file"

  expect_status 200 "development login" \
    --cookie-jar "$cookie_file" \
    --header 'Content-Type: application/json' \
    --data-binary "@$payload_file" \
    "$BASE_URL/api/v1/auth/dev-login"
  assert_json_response "development login"

  authenticated_checks=(
    "auth me|/api/v1/auth/me"
    "assistants|/api/v1/assistants"
    "audit logs|/api/v1/audit-logs"
    "MCP servers|/api/v1/mcp/servers"
    "knowledge bases|/api/v1/knowledge-bases"
    "LLM providers|/api/v1/llm/providers"
    "runtime providers|/api/v1/runtime/providers"
    "agent runs|/api/v1/agent-runs"
  )

  for check in "${authenticated_checks[@]}"; do
    label="${check%%|*}"
    path="${check#*|}"
    expect_status 200 "$label" --cookie "$cookie_file" "$BASE_URL$path"
    assert_json_response "$label"
  done
else
  skip "authenticated endpoint checks: dev login is disabled or NODE_ENV is production"
fi

printf '\nSmoke summary: PASS=%d SKIPPED=%d FAIL=0\n' "$pass_count" "$skip_count"
printf 'RESULT PASS\n'
printf '\nManual next steps:\n'
if [ "$sso_ready" = "true" ]; then
  printf '1. Open %s/login and complete Microsoft sign-in with an allowed account.\n' "$FRONTEND_URL"
else
  printf '1. Microsoft SSO is not ready in this environment; configure it before the manual SSO smoke.\n'
fi
printf '2. Confirm post-login navigation for Dashboard, Assistants, Knowledge, MCP, LLM and Runtime.\n'
printf '3. Confirm Chat and consolidated Analytics show explicit unavailable/prototype states in real mode.\n'
printf '4. For the opt-in federated redirect checks, use scripts/smoke-microsoft-sso-real.sh.\n'
