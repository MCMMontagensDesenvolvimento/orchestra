#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
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

expect_status 200 "frontend-health" "$FRONTEND_URL/health.html"
expect_status 200 "frontend-root" "$FRONTEND_URL/"
expect_status 200 "backend-health" "$BASE_URL/health"
expect_status 200 "backend-health-db" "$BASE_URL/health/db"
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

expect_status 200 "tenants" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/tenants"

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

expect_status 200 "assistant-detail" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id"

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

cat > "$payload_file" <<'JSON'
{
  "displayName": "Smoke governed draft",
  "description": "Version created by local smoke test.",
  "instructions": "Smoke test governed instructions only.",
  "modelProvider": "none",
  "modelName": "not-configured",
  "temperature": 0.2,
  "configuration": {
    "source": "smoke-local",
    "runtimeEnabled": false
  }
}
JSON

expect_status 201 "assistant-version-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/versions"

version_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$response_file")"

expect_status 200 "assistant-execution-policy-get" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/execution-policy"

cat > "$payload_file" <<JSON
{
  "requiresApprovalToPublish": true,
  "sandboxEnabled": true,
  "sandboxRequiresAuth": true,
  "sandboxBlocksExternalTools": true,
  "sandboxBlocksRealProviders": true,
  "sandboxLogsRequired": true,
  "allowDraftTesting": true
}
JSON

expect_status 200 "assistant-execution-policy-configure" \
  -b "$cookie_file" \
  -X PATCH \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/execution-policy"

cat > "$payload_file" <<'JSON'
{
  "mode": "sandbox"
}
JSON

expect_status 200 "assistant-execution-precheck-sandbox" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/execution-precheck"

cat > "$payload_file" <<JSON
{
  "action": "publish",
  "assistantVersionId": "$version_id",
  "reason": "Smoke approval workflow validation."
}
JSON

expect_status 201 "assistant-approval-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/approvals"

approval_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$response_file")"

cat > "$payload_file" <<'JSON'
{
  "decisionReason": "Smoke approval granted."
}
JSON

expect_status 200 "assistant-approval-approve" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/approvals/$approval_id/approve"

expect_status 200 "assistant-approvals-list" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/approvals"

cat > "$payload_file" <<JSON
{
  "versionId": "$version_id",
  "approvalId": "$approval_id",
  "reason": "Smoke publication workflow validation."
}
JSON

expect_status 200 "assistant-publish-with-approval" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/publish"

expect_status 200 "assistant-active-publication" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/publications/active"

cat > "$payload_file" <<JSON
{
  "executionMode": "published",
  "allowPublishedExecution": true,
  "isExecutionEnabled": true
}
JSON

expect_status 200 "assistant-execution-policy-enable" \
  -b "$cookie_file" \
  -X PATCH \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/execution-policy"

cat > "$payload_file" <<'JSON'
{
  "mode": "published"
}
JSON

expect_status 200 "assistant-execution-precheck-published" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/execution-precheck"

cat > "$payload_file" <<JSON
{
  "assistantVersionId": "$version_id",
  "input": "Smoke test input",
  "expectedBehavior": "The manual test should be recorded without running AI.",
  "actualOutput": "Manual smoke output.",
  "status": "passed",
  "score": 100,
  "notes": "Smoke local validation."
}
JSON

expect_status 201 "assistant-test-result-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/test-results"

cat > "$payload_file" <<JSON
{
  "assistantVersionId": "$version_id",
  "rating": "positive",
  "comment": "Smoke feedback validation."
}
JSON

expect_status 201 "assistant-feedback-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/feedback"

expect_status 200 "assistant-unpublish" \
  -b "$cookie_file" \
  -X POST \
  "$BASE_URL/api/v1/assistants/$assistant_id/unpublish"

expect_status 200 "audit-logs" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/audit-logs"

expect_status 404 "structured-404" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/missing-route"

cat > "$payload_file" <<'JSON'
{
  "name": ""
}
JSON

expect_status 422 "structured-422" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants"

echo "Smoke local concluido."
