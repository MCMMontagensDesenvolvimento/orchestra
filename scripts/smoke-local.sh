#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
DEV_EMAIL="${DEV_EMAIL:-admin.dev@orchestra.local}"

cookie_file="$(mktemp)"
payload_file="$(mktemp)"
response_file="$(mktemp)"
trap 'rm -f "$cookie_file" "$payload_file" "$response_file"' EXIT

expect_status() {
  local expected="$1"
  local label="$2"
  shift 2

  local status
  status="$(curl -sS -o "$response_file" -w '%{http_code}' "$@")"
  if [ "$status" != "$expected" ]; then
    echo "FAIL $label expected=$expected actual=$status"
    cat "$response_file"
    exit 1
  fi

  echo "OK $label $status"
}

expect_status 200 "health" "$BASE_URL/health"
expect_status 200 "health-db" "$BASE_URL/health/db"
expect_status 401 "auth-me-no-cookie" "$BASE_URL/api/v1/auth/me"

printf '{"email":"%s"}' "$DEV_EMAIL" > "$payload_file"
expect_status 200 "dev-login" \
  -c "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/auth/dev-login"

expect_status 200 "auth-me" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/auth/me"

expect_status 200 "workspaces" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/workspaces"

expect_status 200 "users" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/users"

expect_status 200 "roles" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/roles"

expect_status 200 "permissions" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/permissions"

expect_status 200 "assistants" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/assistants"

cat > "$payload_file" <<'JSON'
{
  "name": "Smoke Assistant",
  "description": "Assistant created by local smoke test.",
  "status": "draft",
  "version": {
    "displayName": "Smoke draft",
    "instructions": "Smoke test instructions only.",
    "modelProvider": "none",
    "modelName": "not-configured",
    "temperature": 0.2
  }
}
JSON

expect_status 201 "assistant-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants"

assistant_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$response_file")"

cat > "$payload_file" <<'JSON'
{
  "description": "Assistant updated by local smoke test."
}
JSON

expect_status 200 "assistant-update" \
  -b "$cookie_file" \
  -X PATCH \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id"

expect_status 200 "audit-logs" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/audit-logs"

echo "Smoke local concluido."
