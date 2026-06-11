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
  "name": "Smoke Knowledge Base",
  "description": "Knowledge catalog entry created by local smoke test.",
  "visibility": "workspace",
  "dataClassification": "internal",
  "metadata": {
    "phase": "smoke-local",
    "retrievalRuntime": false
  }
}
JSON

expect_status 201 "knowledge-base-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/knowledge-bases"

knowledge_base_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$response_file")"

expect_status 200 "knowledge-bases-list" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/knowledge-bases"

expect_status 200 "knowledge-base-detail" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/knowledge-bases/$knowledge_base_id"

cat > "$payload_file" <<'JSON'
{
  "title": "Smoke Catalog Document",
  "description": "Document with simple text for local ingestion; no binary upload.",
  "sourceType": "manual",
  "sourceUri": "manual://smoke/document",
  "mimeType": "text/plain",
  "dataClassification": "internal",
  "contentText": "Smoke ingestion document. This text is processed locally by Orchestra. It creates deterministic chunks and source references without embeddings, vector stores, providers, LLM calls, Agno execution or MCP runtime execution.\n\nThe second paragraph gives the chunker enough material to validate offsets, token estimates and source reference metadata during the local smoke test.",
  "metadata": {
    "phase": "smoke-local",
    "binaryUpload": false
  }
}
JSON

expect_status 201 "knowledge-document-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/knowledge-bases/$knowledge_base_id/documents"

knowledge_document_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$response_file")"

expect_status 200 "knowledge-documents-list" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/knowledge-bases/$knowledge_base_id/documents"

cat > "$payload_file" <<'JSON'
{
  "metadata": {
    "source": "smoke-local",
    "strategy": "local_text_chunking"
  }
}
JSON

expect_status 201 "knowledge-ingestion-local" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/knowledge-documents/$knowledge_document_id/request-ingestion"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["job"]["status"] == "completed"; assert data["job"]["chunksCreated"] > 0; assert data["job"]["sourceReferencesCreated"] > 0' "$response_file"
knowledge_ingestion_job_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["job"]["id"])' "$response_file")"

expect_status 200 "knowledge-ingestion-list" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/knowledge-documents/$knowledge_document_id/ingestion"

expect_status 200 "knowledge-ingestion-job-detail" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/knowledge-ingestion-jobs/$knowledge_ingestion_job_id"

expect_status 200 "knowledge-document-chunks" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/knowledge-documents/$knowledge_document_id/chunks"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1])); assert data["pagination"]["total"] > 0' "$response_file"
knowledge_chunk_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"][0]["id"])' "$response_file")"

expect_status 200 "knowledge-base-chunks" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/knowledge-bases/$knowledge_base_id/chunks"

python3 -c 'import json,sys; assert json.load(open(sys.argv[1]))["pagination"]["total"] > 0' "$response_file"

expect_status 200 "knowledge-document-source-references" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/knowledge-documents/$knowledge_document_id/source-references"

python3 -c 'import json,sys; assert len(json.load(open(sys.argv[1]))["data"]) > 0' "$response_file"

expect_status 200 "knowledge-chunk-source-references" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/knowledge-chunks/$knowledge_chunk_id/source-references"

python3 -c 'import json,sys; assert len(json.load(open(sys.argv[1]))["data"]) > 0' "$response_file"

cat > "$payload_file" <<'JSON'
{
  "name": "Smoke Data Source",
  "type": "manual",
  "config": {
    "uri": "catalog://smoke/data-source",
    "connectorExecution": false
  },
  "status": "active"
}
JSON

expect_status 201 "knowledge-data-source-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/knowledge-bases/$knowledge_base_id/data-sources"

expect_status 200 "knowledge-data-sources-list" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/knowledge-bases/$knowledge_base_id/data-sources"

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

expect_status 200 "assistant-knowledge-bindings-list" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/knowledge-bindings"

expect_status 200 "assistant-rag-readiness" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/rag-readiness"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["retrievalMode"] == "local_chunks_only"; assert data["chunksAvailable"] > 0; assert data["embeddingsEnabled"] is False; assert data["vectorStoreEnabled"] is False' "$response_file"

cat > "$payload_file" <<'JSON'
{
  "query": "Smoke ingestion"
}
JSON

expect_status 200 "assistant-rag-local-search" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/rag-local-search"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["mode"] == "keyword_local_placeholder"; assert len(data["results"]) > 0' "$response_file"

cat > "$payload_file" <<'JSON'
{
  "name": "Smoke MCP Server",
  "description": "MCP catalog entry created by local smoke test.",
  "serverType": "remote",
  "baseUrl": "https://mcp-smoke.example.invalid",
  "status": "active",
  "trustLevel": "restricted",
  "riskLevel": "medium",
  "authType": "none",
  "metadata": {
    "phase": "smoke-local",
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

expect_status 200 "mcp-servers-list" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/mcp/servers"

expect_status 200 "mcp-server-detail" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/mcp/servers/$mcp_server_id"

cat > "$payload_file" <<'JSON'
{
  "name": "smoke.lookup",
  "description": "Tool catalog entry only; no MCP execution.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string"
      }
    }
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "result": {
        "type": "string"
      }
    }
  },
  "riskLevel": "high",
  "requiresApproval": true,
  "isEnabled": true,
  "metadata": {
    "phase": "smoke-local"
  }
}
JSON

expect_status 201 "mcp-tool-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/mcp/servers/$mcp_server_id/tools"

mcp_tool_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$response_file")"

expect_status 200 "mcp-tools-list" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/mcp/servers/$mcp_server_id/tools"

cat > "$payload_file" <<JSON
{
  "mcpServerId": "$mcp_server_id",
  "mcpToolId": "$mcp_tool_id",
  "mode": "sandbox_only",
  "requiresApprovalOverride": true
}
JSON

expect_status 201 "assistant-mcp-binding-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/mcp-bindings"

expect_status 200 "assistant-mcp-bindings-list" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/mcp-bindings"

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

cat > "$payload_file" <<'JSON'
{
  "mode": "sandbox",
  "input": "Smoke controlled execution input.",
  "source": "smoke-local",
  "metadata": {
    "scenario": "sandbox-runtime-contract"
  }
}
JSON

expect_status 201 "agent-run-create-sandbox" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/runs"

run_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$response_file")"

expect_status 200 "agent-run-list-assistant" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/runs"

expect_status 200 "agent-run-detail" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/agent-runs/$run_id"

expect_status 200 "agent-run-events" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/agent-runs/$run_id/events"

cat > "$payload_file" <<'JSON'
{
  "mode": "blocked",
  "input": "Smoke blocked execution input.",
  "source": "smoke-local"
}
JSON

expect_status 201 "agent-run-create-blocked" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/runs"

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

expect_status 404 "agent-run-structured-404" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/agent-runs/00000000-0000-0000-0000-000000000999"

expect_status 404 "knowledge-structured-404" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/knowledge-bases/00000000-0000-0000-0000-000000000999"

expect_status 404 "mcp-structured-404" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/mcp/servers/00000000-0000-0000-0000-000000000999"

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

cat > "$payload_file" <<'JSON'
{
  "mode": "sandbox",
  "input": ""
}
JSON

expect_status 422 "agent-run-structured-422" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/runs"

cat > "$payload_file" <<'JSON'
{
  "name": ""
}
JSON

expect_status 422 "knowledge-structured-422" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/knowledge-bases"

cat > "$payload_file" <<'JSON'
{
  "name": "Smoke Secret Guard",
  "metadata": {
    "api_key": "do-not-store"
  }
}
JSON

expect_status 422 "mcp-secret-guard-422" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/mcp/servers"

echo "Smoke local concluido."
