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

expect_status 200 "assistants" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/assistants"

echo "Smoke local concluido."
