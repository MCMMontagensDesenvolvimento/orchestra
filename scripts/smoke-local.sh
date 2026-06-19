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

expect_status 200 "runtime-providers" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/runtime/providers"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert any(item["provider"] == "local" and item["current"] is True for item in data); assert any(item["provider"] == "agno_stub" and item["health"]["status"] in ("disabled", "misconfigured") for item in data)' "$response_file"

expect_status 200 "runtime-capabilities" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/runtime/capabilities"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["provider"] == "local"; assert data["supportsSandbox"] is True; assert data["supportsExternalProviders"] is False; assert data["supportsTraceEvents"] is True' "$response_file"

expect_status 200 "runtime-health" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/runtime/health"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["provider"] == "local"; assert data["status"] == "healthy"; assert data["details"]["externalProvidersCalled"] is False' "$response_file"

expect_status 200 "runtime-config" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/runtime/config"

python3 -c 'import json,sys; text=open(sys.argv[1]).read(); data=json.loads(text)["data"]; assert data["provider"] == "local"; assert data["adapterEnabled"] is True; assert data["agnoEnabled"] is False; assert data["externalToolsAllowed"] is False; assert "AGNO_API_KEY" not in text; assert "secret" not in text.lower()' "$response_file"

expect_status 200 "llm-providers" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/llm/providers"

python3 -c 'import json,sys; text=open(sys.argv[1]).read(); data=json.loads(text)["data"]; assert any(item["provider"] == "local_deterministic" and item["current"] is True and item["health"]["status"] == "healthy" for item in data); assert any(item["provider"] == "openai" for item in data); assert "OPENAI_API_KEY" not in text; assert "api_key" not in text.lower(); assert "authorization" not in text.lower()' "$response_file"

expect_status 200 "llm-config" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/llm/config"

python3 -c 'import json,sys; text=open(sys.argv[1]).read(); data=json.loads(text)["data"]; assert data["defaultProvider"] == "local_deterministic"; assert data["storeRawPrompts"] is False; assert data["storeRawOutputs"] is False; assert "OPENAI_API_KEY" not in text; assert "https://api.openai.com" not in text' "$response_file"

openai_real_execution_enabled="$(python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; print("true" if data["providersEnabled"] and data["executionEnabled"] and data["openaiEnabled"] and data["openaiConfigured"] and data["openaiExecutionEnabled"] else "false")' "$response_file")"

expect_status 200 "llm-local-health" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/llm/providers/local_deterministic/health"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["provider"] == "local_deterministic"; assert data["status"] == "healthy"; assert data["details"]["externalProviderCalled"] is False' "$response_file"

expect_status 200 "llm-local-capabilities" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/llm/providers/local_deterministic/capabilities"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["provider"] == "local_deterministic"; assert data["supportsChatCompletion"] == "simulated"; assert data["supportsToolCalling"] is False; assert data["secretsConfigured"] is False' "$response_file"

cat > "$payload_file" <<'JSON'
{
  "provider": "local_deterministic",
  "input": "Smoke LLM provider local sem credencial externa."
}
JSON

expect_status 200 "llm-test-generation-local" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/llm/test-generation"

python3 -c 'import json,sys; text=open(sys.argv[1]).read(); data=json.loads(text)["data"]; assert data["provider"] == "local_deterministic"; assert data["status"] == "completed"; assert data["inputHash"]; assert data["outputHash"]; assert "Smoke LLM provider local" not in text' "$response_file"

cat > "$payload_file" <<'JSON'
{
  "provider": "openai",
  "input": "Smoke deve bloquear provider externo."
}
JSON

if [ "$openai_real_execution_enabled" = "false" ]; then
  expect_status 409 "llm-test-generation-openai-disabled" \
    -b "$cookie_file" \
    -H 'Content-Type: application/json' \
    --data-binary "@$payload_file" \
    "$BASE_URL/api/v1/llm/test-generation"

  python3 -c 'import json,sys; data=json.load(open(sys.argv[1])); assert data["code"] == "LLM_PROVIDER_EXECUTION_BLOCKED"' "$response_file"
else
  echo "SKIP llm-test-generation-openai-disabled: OpenAI real esta habilitado; smoke local nao faz chamada externa."
fi

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
  "title": "Smoke Empty Ingestion Document",
  "description": "Document intentionally left without content to validate local ingestion failure status.",
  "sourceType": "manual",
  "mimeType": "text/plain",
  "dataClassification": "internal",
  "metadata": {
    "phase": "smoke-local",
    "expectedIngestionFailure": true
  }
}
JSON

expect_status 201 "knowledge-empty-document-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/knowledge-bases/$knowledge_base_id/documents"

empty_knowledge_document_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$response_file")"

cat > "$payload_file" <<'JSON'
{
  "metadata": {
    "source": "smoke-local",
    "expectedFailure": "KNOWLEDGE_DOCUMENT_NO_CONTENT"
  }
}
JSON

expect_status 422 "knowledge-ingestion-no-content-422" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/knowledge-documents/$empty_knowledge_document_id/request-ingestion"

expect_status 200 "knowledge-failed-ingestion-list" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/knowledge-documents/$empty_knowledge_document_id/ingestion"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data[0]["status"] == "failed"; assert data[0]["errorCode"] == "KNOWLEDGE_DOCUMENT_NO_CONTENT"' "$response_file"

expect_status 404 "knowledge-chunk-structured-404" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/knowledge-chunks/00000000-0000-0000-0000-000000000999"

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

expect_status 200 "assistant-rag-readiness-v2" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/rag/readiness"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["ready"] is True; assert data["chunkCount"] > 0; assert data["sourceReferenceCount"] > 0; assert data["embeddingsEnabled"] is False; assert data["vectorStoreEnabled"] is False' "$response_file"

cat > "$payload_file" <<'JSON'
{
  "query": "Smoke ingestion",
  "limit": 5,
  "includeArchived": false
}
JSON

expect_status 201 "assistant-rag-query-local" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/rag/query"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["status"] == "completed"; assert data["resultCount"] > 0; assert len(data["sources"]) > 0; assert data["sources"][0]["citationLabel"].startswith("Fonte")' "$response_file"
rag_query_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["queryId"])' "$response_file")"

cat > "$payload_file" <<'JSON'
{
  "query": "zzzz termo inexistente",
  "limit": 5
}
JSON

expect_status 201 "assistant-rag-query-no-results" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/rag/query"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["status"] == "no_results"; assert data["resultCount"] == 0; assert len(data["sources"]) == 0; assert data["warnings"][0]["code"] == "NO_RELEVANT_CHUNKS_FOUND"' "$response_file"

expect_status 200 "assistant-rag-query-history" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/rag/queries"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1])); assert data["pagination"]["total"] >= 2' "$response_file"

expect_status 200 "rag-query-detail" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/rag/queries/$rag_query_id"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["queryId"]; assert len(data["sources"]) > 0' "$response_file"

expect_status 200 "rag-query-sources" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/rag/queries/$rag_query_id/sources"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert len(data) > 0; assert data[0]["sourceReferenceId"]' "$response_file"

cat > "$payload_file" <<'JSON'
{
  "query": "a",
  "limit": 99
}
JSON

expect_status 422 "assistant-rag-query-structured-422" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/rag/query"

expect_status 404 "rag-query-structured-404" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/rag/queries/00000000-0000-0000-0000-000000000999"

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
  "name": "smoke.low_lookup",
  "description": "Low risk sandbox tool for local smoke execution.",
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
      "message": {
        "type": "string"
      }
    }
  },
  "riskLevel": "low",
  "requiresApproval": false,
  "isEnabled": true,
  "metadata": {
    "phase": "smoke-local",
    "sandboxExpected": true
  }
}
JSON

expect_status 201 "mcp-low-tool-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/mcp/servers/$mcp_server_id/tools"

mcp_low_tool_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$response_file")"

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

cat > "$payload_file" <<'JSON'
{
  "name": "smoke.disabled_lookup",
  "description": "Disabled tool used to validate sandbox policy blocking.",
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
  "isEnabled": false,
  "metadata": {
    "phase": "smoke-local",
    "expectedBlockedReason": "tool_disabled"
  }
}
JSON

expect_status 201 "mcp-disabled-tool-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/mcp/servers/$mcp_server_id/tools"

mcp_disabled_tool_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$response_file")"

cat > "$payload_file" <<'JSON'
{
  "name": "smoke.unbound_lookup",
  "description": "Enabled tool intentionally left without assistant binding.",
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
    "phase": "smoke-local",
    "expectedBlockedReason": "tool_not_bound_to_assistant"
  }
}
JSON

expect_status 201 "mcp-unbound-tool-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/mcp/servers/$mcp_server_id/tools"

mcp_unbound_tool_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$response_file")"

expect_status 200 "mcp-tools-list" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/mcp/servers/$mcp_server_id/tools"

cat > "$payload_file" <<JSON
{
  "mcpServerId": "$mcp_server_id",
  "mcpToolId": "$mcp_low_tool_id",
  "mode": "sandbox_only",
  "requiresApprovalOverride": null
}
JSON

expect_status 201 "assistant-mcp-low-binding-create" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/mcp-bindings"

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

cat > "$payload_file" <<JSON
{
  "mcpToolId": "$mcp_low_tool_id",
  "mode": "sandbox",
  "input": {
    "query": "smoke allowed"
  }
}
JSON

expect_status 200 "mcp-sandbox-precheck-allowed" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/mcp/precheck"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["canExecute"] is True; assert data["status"] == "allowed"; assert data["policy"]["riskLevel"] == "low"' "$response_file"

expect_status 201 "mcp-sandbox-tool-call-completed" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/mcp/tool-calls"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["status"] == "completed"; assert data["mode"] == "sandbox"; assert data["outputPreview"]; assert "No external MCP server was called" in data["outputPreview"]; assert len(data["events"]) >= 3' "$response_file"
mcp_tool_call_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["data"]["id"])' "$response_file")"

expect_status 200 "mcp-sandbox-tool-call-list" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/mcp/tool-calls"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1])); assert data["pagination"]["total"] >= 1' "$response_file"

expect_status 200 "mcp-sandbox-tool-call-detail" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/mcp/tool-calls/$mcp_tool_call_id"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["id"]; assert data["status"] == "completed"; assert data["policySnapshot"]["status"] == "allowed"' "$response_file"

expect_status 200 "mcp-sandbox-tool-call-events" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/mcp/tool-calls/$mcp_tool_call_id/events"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; types=[item["type"] for item in data]; assert "execution_completed" in types' "$response_file"

cat > "$payload_file" <<JSON
{
  "mcpToolId": "$mcp_tool_id",
  "mode": "sandbox",
  "input": {
    "query": "smoke approval"
  }
}
JSON

expect_status 200 "mcp-sandbox-precheck-approval-required" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/mcp/precheck"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["canExecute"] is False; assert data["status"] == "approval_required"; assert "tool_requires_approval" in data["reasons"]' "$response_file"

expect_status 201 "mcp-sandbox-tool-call-approval-required" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/mcp/tool-calls"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["status"] == "approval_required"; assert "tool_requires_approval" in data["reasons"]' "$response_file"

cat > "$payload_file" <<JSON
{
  "mcpToolId": "$mcp_disabled_tool_id",
  "mode": "sandbox",
  "input": {
    "query": "smoke disabled"
  }
}
JSON

expect_status 201 "mcp-sandbox-tool-call-disabled-blocked" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/mcp/tool-calls"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["status"] == "blocked"; assert "tool_disabled" in data["reasons"]' "$response_file"

cat > "$payload_file" <<JSON
{
  "mcpToolId": "$mcp_unbound_tool_id",
  "mode": "sandbox",
  "input": {
    "query": "smoke unbound"
  }
}
JSON

expect_status 201 "mcp-sandbox-tool-call-unbound-blocked" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/mcp/tool-calls"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["status"] == "blocked"; assert "tool_not_bound_to_assistant" in data["reasons"]' "$response_file"

cat > "$payload_file" <<'JSON'
{
  "mcpToolId": "not-a-uuid",
  "mode": "sandbox",
  "input": {
    "query": "invalid"
  }
}
JSON

expect_status 422 "mcp-sandbox-tool-call-structured-422" \
  -b "$cookie_file" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/mcp/tool-calls"

expect_status 404 "mcp-sandbox-tool-call-structured-404" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/mcp/tool-calls/00000000-0000-0000-0000-000000000999"

expect_status 200 "mcp-sandbox-audit-log" \
  -b "$cookie_file" \
  "$BASE_URL/api/v1/audit-logs?action=mcp_tool_call_completed"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1])); assert data["pagination"]["total"] >= 1' "$response_file"

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
  "allowExternalLlmProviders": false,
  "allowedLlmProviders": [],
  "defaultLlmProvider": null,
  "allowDraftTesting": true
}
JSON

expect_status 200 "assistant-execution-policy-configure" \
  -b "$cookie_file" \
  -X PATCH \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/execution-policy"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["allowExternalLlmProviders"] is False; assert data["allowedLlmProviders"] == []; assert data["defaultLlmProvider"] is None; assert data["sandboxBlocksRealProviders"] is True' "$response_file"

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

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; events=[event["type"] for event in data["events"]]; adapter=data["metadata"]["runtime"]["adapterMetadata"]; assert data["status"] == "completed"; assert data["metadata"]["runtime"]["provider"] == "local"; assert data["metadata"]["runtime"]["rag"]["chunkCount"] >= 1; assert adapter["llmProvider"] == "local_deterministic"; assert adapter["externalProviderCalled"] is False; assert adapter["llmSelectionReason"] == "sandbox_blocks_real_providers"; assert "runtime.run_completed" in events; assert "runtime.rag_context_attached" in events; assert "runtime.mcp_tools_attached" in events; assert "llm.provider_selected" in events' "$response_file"

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

python3 -c 'import json,sys; events=[event["type"] for event in json.load(open(sys.argv[1]))["data"]]; assert "runtime.run_started" in events; assert "runtime.run_completed" in events' "$response_file"

cat > "$payload_file" <<'JSON'
{
  "allowExternalLlmProviders": true,
  "allowedLlmProviders": ["openai"],
  "defaultLlmProvider": "openai"
}
JSON

expect_status 200 "assistant-llm-policy-openai-opt-in" \
  -b "$cookie_file" \
  -X PATCH \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/execution-policy"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["allowExternalLlmProviders"] is True; assert data["allowedLlmProviders"] == ["openai"]; assert data["defaultLlmProvider"] == "openai"' "$response_file"

if [ "$openai_real_execution_enabled" = "false" ]; then
  cat > "$payload_file" <<'JSON'
{
  "mode": "draft_test",
  "input": "Smoke OpenAI opt-in deve permanecer fail-closed sem credencial real.",
  "source": "smoke-local"
}
JSON

  expect_status 201 "agent-run-openai-opt-in-fail-closed" \
    -b "$cookie_file" \
    -H 'Content-Type: application/json' \
    --data-binary "@$payload_file" \
    "$BASE_URL/api/v1/assistants/$assistant_id/runs"

  python3 -c 'import json,sys; text=open(sys.argv[1]).read(); data=json.loads(text)["data"]; adapter=data["metadata"]["runtime"]["adapterMetadata"]; events=data["events"]; blocked=next(event for event in events if event["type"] == "llm.generation_blocked"); assert data["status"] == "blocked"; assert adapter["llmProvider"] == "openai"; assert adapter["externalProviderCalled"] is False; assert adapter["llmSelectionReason"] == "assistant_policy_opt_in"; assert adapter["llm"]["failedClosed"] is True; assert blocked["metadata"]["externalProviderCalled"] is False; assert "Smoke OpenAI opt-in" not in text; assert "authorization" not in text.lower(); assert "api_key" not in text.lower()' "$response_file"
else
  echo "SKIP agent-run-openai-opt-in-fail-closed: OpenAI real esta habilitado; policy sera limpa sem executar provider externo."
fi

cat > "$payload_file" <<'JSON'
{
  "allowExternalLlmProviders": false,
  "allowedLlmProviders": [],
  "defaultLlmProvider": null
}
JSON

expect_status 200 "assistant-llm-policy-clear-openai" \
  -b "$cookie_file" \
  -X PATCH \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/api/v1/assistants/$assistant_id/execution-policy"

python3 -c 'import json,sys; data=json.load(open(sys.argv[1]))["data"]; assert data["allowExternalLlmProviders"] is False; assert data["allowedLlmProviders"] == []; assert data["defaultLlmProvider"] is None' "$response_file"

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
