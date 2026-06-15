#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGNO_MOCK_PORT="${AGNO_MOCK_PORT:-7777}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
START_BACKEND="${START_BACKEND:-true}"
BASE_URL="${BASE_URL:-http://localhost:$BACKEND_PORT}"
DEV_EMAIL="${DEV_EMAIL:-admin.dev@orchestra.local}"

cookie_file="$(mktemp)"
payload_file="$(mktemp)"
response_file="$(mktemp)"
backend_log="$(mktemp)"
mock_log="$(mktemp)"
mock_pid=""
backend_pid=""

cleanup() {
  if [ -n "$backend_pid" ] && kill -0 "$backend_pid" 2>/dev/null; then
    kill "$backend_pid" 2>/dev/null || true
  fi
  if [ -n "$mock_pid" ] && kill -0 "$mock_pid" 2>/dev/null; then
    kill "$mock_pid" 2>/dev/null || true
  fi
  rm -f "$cookie_file" "$payload_file" "$response_file" "$backend_log" "$mock_log"
}
trap cleanup EXIT

expect_status() {
  local expected="$1"
  local label="$2"
  shift 2

  local status
  status="$(curl -sS -o "$response_file" -w '%{http_code}' "$@")"
  if [ "$status" != "$expected" ]; then
    echo "FAIL $label expected=$expected actual=$status"
    cat "$response_file"
    echo
    echo "--- backend log ---"
    cat "$backend_log" 2>/dev/null || true
    echo "--- mock log ---"
    cat "$mock_log" 2>/dev/null || true
    exit 1
  fi

  echo "OK $label $status"
}

wait_for_url() {
  local label="$1"
  local url="$2"
  for _ in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "OK $label ready"
      return
    fi
    sleep 1
  done
  echo "FAIL $label not ready: $url"
  echo "--- backend log ---"
  cat "$backend_log" 2>/dev/null || true
  echo "--- mock log ---"
  cat "$mock_log" 2>/dev/null || true
  exit 1
}

node "$ROOT_DIR/scripts/agno-mock-runtime.mjs" >"$mock_log" 2>&1 &
mock_pid="$!"
wait_for_url "agno-mock" "http://127.0.0.1:$AGNO_MOCK_PORT/health"

if [ "$START_BACKEND" = "true" ]; then
  (
    cd "$ROOT_DIR/backend"
    NODE_ENV=development \
    PORT="$BACKEND_PORT" \
    DATABASE_URL="${DATABASE_URL:-postgresql://orchestra:orchestra@localhost:5432/orchestra}" \
    FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-http://localhost:5173}" \
    JWT_SECRET="${JWT_SECRET:-change-me-in-production}" \
    RUNTIME_PROVIDER=agno \
    RUNTIME_ADAPTER_ENABLED=true \
    RUNTIME_DEFAULT_TIMEOUT_MS=15000 \
    RUNTIME_REQUEST_TIMEOUT_MS=15000 \
    RUNTIME_REQUIRE_PRECHECK=true \
    RUNTIME_ALLOW_PROVIDER_FALLBACK=false \
    RUNTIME_ALLOW_EXTERNAL_TOOLS=false \
    AGNO_ENABLED=true \
    AGNO_EXECUTION_ENABLED=true \
    AGNO_BASE_URL="http://127.0.0.1:$AGNO_MOCK_PORT" \
    AGNO_API_KEY= \
    AGNO_TIMEOUT_MS=15000 \
    AGNO_HEALTHCHECK_ENABLED=true \
    AGNO_HEALTH_PATH=/health \
    AGNO_CAPABILITIES_PATH=/capabilities \
    AGNO_EXECUTE_PATH=/runs \
    AGNO_REQUIRE_SANDBOX=true \
    AGNO_ALLOW_EXTERNAL_TOOLS=false \
    AGNO_ALLOW_REMOTE_MCP=false \
    AGNO_SEND_RAG_CONTEXT=true \
    AGNO_SEND_MCP_TOOL_DESCRIPTORS=true \
    AGNO_MAX_INPUT_PREVIEW_CHARS=500 \
    AGNO_MAX_OUTPUT_PREVIEW_CHARS=800 \
    npm run dev
  ) >"$backend_log" 2>&1 &
  backend_pid="$!"
fi

wait_for_url "backend" "$BASE_URL/health"

printf '{"email":"%s"}' "$DEV_EMAIL" > "$payload_file"
expect_status 200 "dev-login" \
  -c "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/auth/dev-login"

expect_status 200 "runtime-config-agno" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/runtime/config"

python3 -c 'import json,sys; text=open(sys.argv[1]).read(); data=json.loads(text)["data"]; assert data["provider"] == "agno"; assert data["agnoEnabled"] is True; assert data["agnoExecutionEnabled"] is True; assert data["agnoBaseUrlConfigured"] is True; assert "AGNO_API_KEY" not in text; assert "secret" not in text.lower()' "$response_file"

expect_status 200 "runtime-providers-agno" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/runtime/providers"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; current=[item for item in data if item["current"]]; assert current[0]["provider"] == "agno"; agno=[item for item in data if item["provider"] == "agno"][0]; assert agno["health"]["status"] == "healthy"; assert agno["capabilities"]["supportsRagContext"] is True' "$response_file"

expect_status 200 "runtime-health-agno" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/runtime/health"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["provider"] == "agno"; assert data["status"] == "healthy"; assert data["details"]["httpCalled"] is True' "$response_file"

cat > "$payload_file" <<'JSON'
{
  "name": "Agno Smoke Assistant",
  "description": "Assistant created by Agno local smoke test.",
  "status": "draft",
  "version": {
    "displayName": "Agno smoke draft",
    "instructions": "Use only the governed context sent by Orchestra.",
    "modelProvider": "local",
    "modelName": "agno-compatible-mock",
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
  "name": "Agno Smoke Knowledge Base",
  "description": "Knowledge catalog entry for Agno smoke.",
  "visibility": "workspace",
  "dataClassification": "internal",
  "metadata": {
    "phase": "smoke-agno-local"
  }
}
JSON

expect_status 201 "knowledge-base-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/knowledge-bases"

knowledge_base_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$response_file")"

cat > "$payload_file" <<'JSON'
{
  "title": "Agno Smoke Document",
  "description": "Document with local text for governed RAG context.",
  "sourceType": "manual",
  "sourceUri": "manual://agno-smoke/document",
  "mimeType": "text/plain",
  "dataClassification": "internal",
  "contentText": "Agno smoke document. This content validates governed RAG context sent to a local mock runtime without embeddings, vector stores or external providers.",
  "metadata": {
    "phase": "smoke-agno-local"
  }
}
JSON

expect_status 201 "knowledge-document-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/knowledge-bases/$knowledge_base_id/documents"

knowledge_document_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$response_file")"

cat > "$payload_file" <<'JSON'
{
  "metadata": {
    "source": "smoke-agno-local",
    "strategy": "local_text_chunking"
  }
}
JSON

expect_status 201 "knowledge-ingestion-local" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/knowledge-documents/$knowledge_document_id/request-ingestion"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["job"]["status"] == "completed"; assert data["job"]["chunksCreated"] > 0' "$response_file"

cat > "$payload_file" <<JSON
{
  "knowledgeBaseId": "$knowledge_base_id",
  "retrievalMode": "retrieval_placeholder",
  "priority": 100
}
JSON

expect_status 201 "assistant-knowledge-binding-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/knowledge-bindings"

cat > "$payload_file" <<'JSON'
{
  "name": "Agno Smoke MCP Server",
  "description": "MCP catalog entry for Agno smoke descriptors.",
  "serverType": "remote",
  "baseUrl": "https://mcp-agno-smoke.example.invalid",
  "status": "active",
  "trustLevel": "restricted",
  "riskLevel": "medium",
  "authType": "none",
  "metadata": {
    "phase": "smoke-agno-local",
    "runtimeExecution": false
  }
}
JSON

expect_status 201 "mcp-server-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/mcp/servers"

mcp_server_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$response_file")"

cat > "$payload_file" <<'JSON'
{
  "name": "agno.smoke_lookup",
  "description": "Low risk descriptor for Agno smoke.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string"
      }
    }
  },
  "riskLevel": "low",
  "requiresApproval": false,
  "isEnabled": true,
  "metadata": {
    "phase": "smoke-agno-local"
  }
}
JSON

expect_status 201 "mcp-tool-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/mcp/servers/$mcp_server_id/tools"

mcp_tool_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$response_file")"

cat > "$payload_file" <<JSON
{
  "mcpServerId": "$mcp_server_id",
  "mcpToolId": "$mcp_tool_id",
  "mode": "sandbox_only",
  "requiresApprovalOverride": null
}
JSON

expect_status 201 "assistant-mcp-binding-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/mcp-bindings"

cat > "$payload_file" <<'JSON'
{
  "mode": "sandbox",
  "input": "Smoke Agno local execution input.",
  "source": "smoke-agno-local",
  "metadata": {
    "scenario": "agno-local-mock"
  }
}
JSON

expect_status 201 "agent-run-create-agno" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/runs"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; events=[event["type"] for event in data["events"]]; runtime=data["metadata"]["runtime"]; assert data["status"] == "completed"; assert runtime["provider"] == "agno"; assert runtime["outputHash"]; assert "Resposta deterministica do Agno mock local" in runtime["outputPreview"]; assert "agno.health_checked" in events; assert "agno.request_started" in events; assert "agno.request_completed" in events; assert "runtime.rag_context_attached" in events; assert "runtime.mcp_tools_attached" in events; assert "runtime.model_started" in events; assert "runtime.model_completed" in events; assert "runtime.run_completed" in events' "$response_file"

echo "Smoke Agno local/mock concluido."
