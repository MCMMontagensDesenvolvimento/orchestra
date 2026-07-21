#!/usr/bin/env bash
set -euo pipefail

MODE="${1:---dry-run}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_BASE_URL="${ORCHESTRA_16R_API_BASE_URL:-http://127.0.0.1:3000/api/v1}"
MCP_DEMO_BASE_URL="${ORCHESTRA_16R_MCP_DEMO_BASE_URL:-http://127.0.0.1:8092}"
STATE_FILE="${ORCHESTRA_16R_STATE_FILE:-/tmp/orchestra-e2e-16r-${UID:-unknown}.state}"
FIXTURE_DIR="$ROOT_DIR/runtime/e2e-fixtures/16r"
FIXTURE_DOCUMENT="$FIXTURE_DIR/catalogo-ficticio.md"
RUNBOOK="$ROOT_DIR/docs/ai-orchestration/ORCHESTRA_E2E_CHAT_RAG_MCP_READONLY_16R.md"
ASSISTANT_NAME='Orchestra 16R E2E Demo'
ASSISTANT_MARKER='[fixture:16R]'
KNOWLEDGE_NAME='Orchestra 16R Catalogo Ficticio'
DOCUMENT_TITLE='Catalogo ficticio 16R'
MCP_SERVER_NAME='Orchestra MCP Read-only Demo 16R'
MCP_TOOL_NAME='catalog.search'

pass_count=0
skip_count=0
TEMP_DIR=''
COOKIE_JAR=''
ASSISTANT_ID=''
KNOWLEDGE_BASE_ID=''
DOCUMENT_ID=''
KNOWLEDGE_BINDING_ID=''
MCP_SERVER_ID=''
MCP_TOOL_ID=''
MCP_BINDING_ID=''
RUN_ID=''
OWN_ASSISTANT='true'
OWN_KNOWLEDGE='true'
OWN_MCP='true'

usage() {
  cat <<'EOF'
Usage: scripts/homologacao-e2e-chat-rag-mcp-16r.sh [MODE]

Modes:
  --dry-run  Validate files, local URL shapes and planned commands without network or database access.
  --prepare  Create or reuse only the fictitious 16R assistant, RAG data and closed-by-default MCP catalog.
  --run      Execute the combined AgentRun and require governed RAG plus a real read-only MCP call.
  --audit    Read and print only allowlisted counters, booleans, statuses and technical identifiers.
  --cleanup  Disable/archive only API objects marked as 16R fixtures; historical runs/audit remain intact.
  --help     Print this help.

The live modes use local dev-login and an HttpOnly cookie jar stored in a private temporary directory.
No response body, session cookie, runtime transport credential, RAG excerpt or tool content is printed.
EOF
}

pass() {
  pass_count=$((pass_count + 1))
  printf 'PASS %s\n' "$1"
}

skip() {
  skip_count=$((skip_count + 1))
  printf 'SKIPPED %s\n' "$1"
}

info() {
  printf 'INFO %s\n' "$1"
}

fail() {
  printf 'FAIL %s\n' "$1" >&2
  printf '\n16R E2E homologation summary: PASS=%d SKIPPED=%d FAIL=1\n' "$pass_count" "$skip_count" >&2
  exit 1
}

cleanup_temp() {
  if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
    rm -rf -- "$TEMP_DIR"
  fi
}

case "$MODE" in
  --dry-run|--prepare|--run|--audit|--cleanup) ;;
  --help|-h) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac
[ "$#" -le 1 ] || fail 'only one mode can be selected'

umask 077
TEMP_DIR="$(mktemp -d)"
COOKIE_JAR="$TEMP_DIR/session.cookies"
trap cleanup_temp EXIT

require_file() {
  [ -f "$1" ] || fail "${1#"$ROOT_DIR/"} is missing"
  pass "${1#"$ROOT_DIR/"} exists"
}

require_executable() {
  require_file "$1"
  [ -x "$1" ] || fail "${1#"$ROOT_DIR/"} is not executable"
  pass "${1#"$ROOT_DIR/"} is executable"
}

validate_local_url() {
  URL_TO_VALIDATE="$1" EXPECTED_API_PATH="${2:-false}" node <<'NODE'
const value = process.env.URL_TO_VALIDATE;
let valid = false;
try {
  const parsed = new URL(value);
  const localHosts = new Set(['127.0.0.1', 'localhost', '[::1]']);
  const expectedApiPath = process.env.EXPECTED_API_PATH === 'true';
  valid = parsed.protocol === 'http:'
    && localHosts.has(parsed.hostname)
    && !parsed.username
    && !parsed.password
    && !parsed.search
    && !parsed.hash
    && (expectedApiPath ? parsed.pathname.replace(/\/$/, '') === '/api/v1' : parsed.pathname === '/');
} catch {}
process.exit(valid ? 0 : 1);
NODE
}

validate_uuid() {
  [[ "$1" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$ ]]
}

json_path() {
  node - "$1" "$2" <<'NODE'
const fs = require('node:fs');
const [file, dottedPath] = process.argv.slice(2);
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
let value = data;
for (const part of dottedPath.split('.')) value = value?.[part];
if (value === undefined || value === null) process.exit(1);
if (typeof value === 'object') process.stdout.write(JSON.stringify(value));
else process.stdout.write(String(value));
NODE
}

find_fixture_id() {
  node - "$1" "$2" <<'NODE'
const fs = require('node:fs');
const [file, expectedName] = process.argv.slice(2);
const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
const items = Array.isArray(payload.data) ? payload.data : [];
const item = items.find((candidate) => candidate?.name === expectedName || candidate?.title === expectedName);
if (!item) process.exit(1);
const marked = item?.metadata?.fixturePhase === '16R'
  || (typeof item?.description === 'string' && item.description.includes('[fixture:16R]'));
if (!marked) process.exit(3);
process.stdout.write(String(item.id));
NODE
}

assert_safe_observability_json() {
  node - "$1" <<'NODE'
const fs = require('node:fs');
const payload = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const forbidden = [
  'rawprompt', 'rawcontext', 'rawpayload', 'rawresponse', 'rawdocument',
  'toolargs', 'toolarguments', 'tooloutput', 'toolresult', 'secretref',
  'authorization', 'cookie', 'apikey', 'password', 'credentialvalue',
];
function visit(value) {
  if (Array.isArray(value)) return value.every(visit);
  if (!value || typeof value !== 'object') return true;
  return Object.entries(value).every(([key, item]) => {
    const normalized = key.replace(/[-_\s]/g, '').toLowerCase();
    return !forbidden.some((fragment) => normalized.includes(fragment)) && visit(item);
  });
}
process.exit(visit(payload) ? 0 : 1);
NODE
}

write_state() {
  for value in "$ASSISTANT_ID" "$KNOWLEDGE_BASE_ID" "$DOCUMENT_ID" "$KNOWLEDGE_BINDING_ID" "$MCP_SERVER_ID" "$MCP_TOOL_ID" "$MCP_BINDING_ID"; do
    validate_uuid "$value" || fail 'refusing to write invalid 16R state identifiers'
  done
  if [ -n "$RUN_ID" ]; then validate_uuid "$RUN_ID" || fail 'refusing to write invalid 16R run identifier'; fi
  case "$OWN_ASSISTANT:$OWN_KNOWLEDGE:$OWN_MCP" in
    true:true:true|true:true:false|false:true:true|false:true:false) ;;
    *) fail 'refusing to write invalid 16R ownership flags' ;;
  esac
  {
    printf 'ASSISTANT_ID=%s\n' "$ASSISTANT_ID"
    printf 'KNOWLEDGE_BASE_ID=%s\n' "$KNOWLEDGE_BASE_ID"
    printf 'DOCUMENT_ID=%s\n' "$DOCUMENT_ID"
    printf 'KNOWLEDGE_BINDING_ID=%s\n' "$KNOWLEDGE_BINDING_ID"
    printf 'MCP_SERVER_ID=%s\n' "$MCP_SERVER_ID"
    printf 'MCP_TOOL_ID=%s\n' "$MCP_TOOL_ID"
    printf 'MCP_BINDING_ID=%s\n' "$MCP_BINDING_ID"
    printf 'RUN_ID=%s\n' "$RUN_ID"
    printf 'OWN_ASSISTANT=%s\n' "$OWN_ASSISTANT"
    printf 'OWN_KNOWLEDGE=%s\n' "$OWN_KNOWLEDGE"
    printf 'OWN_MCP=%s\n' "$OWN_MCP"
  } > "$STATE_FILE"
}

state_value() {
  local key="$1"
  awk -F= -v expected="$key" '$1 == expected { print substr($0, length($1) + 2); exit }' "$STATE_FILE"
}

load_state() {
  [ -f "$STATE_FILE" ] || fail '16R state is missing; run --prepare first'
  ASSISTANT_ID="$(state_value ASSISTANT_ID)"
  KNOWLEDGE_BASE_ID="$(state_value KNOWLEDGE_BASE_ID)"
  DOCUMENT_ID="$(state_value DOCUMENT_ID)"
  KNOWLEDGE_BINDING_ID="$(state_value KNOWLEDGE_BINDING_ID)"
  MCP_SERVER_ID="$(state_value MCP_SERVER_ID)"
  MCP_TOOL_ID="$(state_value MCP_TOOL_ID)"
  MCP_BINDING_ID="$(state_value MCP_BINDING_ID)"
  RUN_ID="$(state_value RUN_ID)"
  OWN_ASSISTANT="$(state_value OWN_ASSISTANT)"
  OWN_KNOWLEDGE="$(state_value OWN_KNOWLEDGE)"
  OWN_MCP="$(state_value OWN_MCP)"
  for value in "$ASSISTANT_ID" "$KNOWLEDGE_BASE_ID" "$DOCUMENT_ID" "$KNOWLEDGE_BINDING_ID" "$MCP_SERVER_ID" "$MCP_TOOL_ID" "$MCP_BINDING_ID"; do
    validate_uuid "$value" || fail '16R state contains an invalid identifier'
  done
  if [ -n "$RUN_ID" ]; then validate_uuid "$RUN_ID" || fail '16R state contains an invalid run identifier'; fi
}

api_request() {
  local method="$1"
  local path="$2"
  local output_file="$3"
  local body_file="${4:-}"
  local status
  local args=(
    --silent --show-error --connect-timeout 3 --max-time 45
    --request "$method" --cookie "$COOKIE_JAR" --cookie-jar "$COOKIE_JAR"
    --header 'Accept: application/json' --output "$output_file" --write-out '%{http_code}'
  )
  if [ -n "$body_file" ]; then
    args+=(--header 'Content-Type: application/json' --data-binary "@$body_file")
  fi
  status="$(curl "${args[@]}" "${API_BASE_URL%/}${path}")" || fail "local API request failed: $method $path"
  [[ "$status" =~ ^2[0-9][0-9]$ ]] || fail "local API returned HTTP $status for $method $path"
}

api_list() {
  local path="$1"
  local search="$2"
  local output_file="$3"
  local status
  status="$(curl --silent --show-error --connect-timeout 3 --max-time 30 \
    --request GET --cookie "$COOKIE_JAR" --cookie-jar "$COOKIE_JAR" \
    --header 'Accept: application/json' --get --data-urlencode "search=$search" \
    --data-urlencode 'perPage=100' --output "$output_file" --write-out '%{http_code}' \
    "${API_BASE_URL%/}${path}")" || fail "local API list failed: $path"
  [ "$status" = '200' ] || fail "local API returned HTTP $status for GET $path"
}

authenticate_local() {
  local response="$TEMP_DIR/auth.json"
  printf '{}\n' > "$TEMP_DIR/empty.json"
  api_request POST '/auth/dev-login' "$response" "$TEMP_DIR/empty.json"
  api_request GET '/auth/me' "$response"
  pass 'local dev session established without displaying session material'
}

direct_demo_request() {
  local method="$1"
  local path="$2"
  local output_file="$3"
  local body_file="${4:-}"
  local status
  local args=(--silent --show-error --connect-timeout 3 --max-time 15 --request "$method" --output "$output_file" --write-out '%{http_code}')
  if [ -n "$body_file" ]; then args+=(--header 'Content-Type: application/json' --data-binary "@$body_file"); fi
  status="$(curl "${args[@]}" "${MCP_DEMO_BASE_URL%/}${path}")" || fail "local MCP demo request failed: $method $path"
  [[ "$status" =~ ^2[0-9][0-9]$ ]] || fail "local MCP demo returned HTTP $status for $method $path"
}

static_validation() {
  command -v bash >/dev/null 2>&1 || fail 'bash is required'
  command -v node >/dev/null 2>&1 || fail 'node is required'
  command -v curl >/dev/null 2>&1 || fail 'curl is required'
  pass 'required local commands are available'

  validate_local_url "$API_BASE_URL" true || fail 'ORCHESTRA_16R_API_BASE_URL must be loopback HTTP ending in /api/v1'
  validate_local_url "$MCP_DEMO_BASE_URL" false || fail 'ORCHESTRA_16R_MCP_DEMO_BASE_URL must be a loopback HTTP origin'
  pass 'live targets are restricted to explicit loopback URLs'

  for file in \
    "$RUNBOOK" "$FIXTURE_DOCUMENT" "$FIXTURE_DIR/README.md" \
    "$FIXTURE_DIR/runtime-proxy.mjs" "$FIXTURE_DIR/Dockerfile" "$FIXTURE_DIR/package.json" \
    "$ROOT_DIR/docker-compose.dev.yml" "$ROOT_DIR/docker-compose.agno-bridge.yml" \
    "$ROOT_DIR/docker-compose.mcp-readonly-demo.yml" "$ROOT_DIR/docker-compose.e2e-16r.yml" \
    "$ROOT_DIR/runtime/mcp-readonly-demo/server.js" \
    "$ROOT_DIR/runtime/mcp-readonly-demo/catalog.js"
  do
    require_file "$file"
  done
  for script in \
    smoke-mcp-readonly-integracao-16q.sh smoke-mcp-externo-readonly-16p.sh \
    smoke-hardening-producao-runtime-16o.sh preflight-prod-runtime-16o.sh \
    smoke-custos-quotas-runtime-16n.sh smoke-observabilidade-runtime-16m.sh \
    smoke-chat-rag-operacional-16k.sh smoke-knowledge-rag-16i.sh
  do
    require_executable "$ROOT_DIR/scripts/$script"
  done
  bash -n "$ROOT_DIR/scripts/homologacao-e2e-chat-rag-mcp-16r.sh"
  node --check "$FIXTURE_DIR/runtime-proxy.mjs"
  pass 'homologation script syntax is valid'

  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    pass 'Docker Compose command is available'
  else
    skip 'Docker Compose is unavailable; live modes require a pre-started stack'
  fi
  info 'planned live flow: local login -> fixture preparation -> Agno stub -> governed gateway -> MCP demo -> safe observability audit'
  info 'MCP policies remain closed after catalog creation until the explicit local-only runbook transaction is approved'
}

prepare_assistant() {
  local response="$TEMP_DIR/assistants.json"
  local body="$TEMP_DIR/assistant.json"
  local managed_fixture='true'
  if [ -n "${ORCHESTRA_16R_ASSISTANT_ID:-}" ]; then
    validate_uuid "$ORCHESTRA_16R_ASSISTANT_ID" || fail 'ORCHESTRA_16R_ASSISTANT_ID is not a UUID'
    ASSISTANT_ID="$ORCHESTRA_16R_ASSISTANT_ID"
    OWN_ASSISTANT='false'
    managed_fixture='false'
    api_request GET "/assistants/$ASSISTANT_ID" "$response"
    ASSISTANT_NAME="$ASSISTANT_NAME" ASSISTANT_MARKER="$ASSISTANT_MARKER" node - "$response" <<'NODE' \
      || fail 'the supplied assistant is not the exact marked local 16R fixture'
const fs = require('node:fs');
const assistant = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).data ?? {};
process.exit(
  assistant.name === process.env.ASSISTANT_NAME
  && typeof assistant.description === 'string'
  && assistant.description.includes(process.env.ASSISTANT_MARKER)
  ? 0 : 1
);
NODE
  else
    api_list '/assistants' "$ASSISTANT_NAME" "$response"
    if ASSISTANT_ID="$(find_fixture_id "$response" "$ASSISTANT_NAME")"; then
      info 'reusing the marked 16R assistant'
    else
      [ "$?" -ne 3 ] || fail 'assistant name collides with an object not marked as a 16R fixture'
      ASSISTANT_NAME="$ASSISTANT_NAME" ASSISTANT_MARKER="$ASSISTANT_MARKER" node - "$body" <<'NODE'
const fs = require('node:fs');
fs.writeFileSync(process.argv[2], JSON.stringify({
  name: process.env.ASSISTANT_NAME,
  description: `${process.env.ASSISTANT_MARKER} Assistente ficticio para homologacao local governada.`,
  status: 'draft',
  version: {
    displayName: '16R initial demo',
    instructions: 'Use somente o contexto RAG governado e tools read-only explicitamente vinculadas.',
    modelProvider: 'local',
    modelName: 'local-deterministic',
    temperature: 0,
    configuration: { fixturePhase: '16R', fictitious: true },
  },
}));
NODE
      api_request POST '/assistants' "$response" "$body"
      ASSISTANT_ID="$(json_path "$response" 'data.id')" || fail 'assistant create response omitted its identifier'
      pass 'marked 16R assistant created'
    fi
  fi

  if [ "$managed_fixture" = 'false' ]; then
    [ "$(json_path "$response" 'data.status')" = 'published' ] || \
      fail 'the supplied assistant must already be published; --prepare will not mutate operator-owned resources'
    api_request GET "/assistants/$ASSISTANT_ID/execution-policy" "$response"
    node - "$response" <<'NODE' || fail 'the supplied assistant policy is not ready for the governed 16R run'
const fs = require('node:fs');
const policy = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).data ?? {};
const allowedScopes = new Set(['general_allowed', 'knowledge_first', 'knowledge_only']);
if (policy.isExecutionEnabled !== true || policy.allowPublishedExecution !== true ||
    !allowedScopes.has(policy.responseScopeMode)) process.exit(1);
NODE
    pass 'operator-supplied assistant and execution policy validated without mutation'
    return
  fi

  cat > "$body" <<'JSON'
{"executionMode":"published","requiresApprovalToPublish":false,"sandboxEnabled":true,"sandboxRequiresAuth":true,"sandboxBlocksExternalTools":true,"sandboxBlocksRealProviders":true,"sandboxLogsRequired":true,"allowDraftTesting":true,"allowPublishedExecution":true,"isExecutionEnabled":true,"responseScopeMode":"general_allowed"}
JSON
  api_request PATCH "/assistants/$ASSISTANT_ID/execution-policy" "$response" "$body"
  api_request GET "/assistants/$ASSISTANT_ID" "$response"
  if [ "$(json_path "$response" 'data.status')" != 'published' ]; then
    printf '{"reason":"Fase 16R local fixture"}\n' > "$body"
    api_request POST "/assistants/$ASSISTANT_ID/publish" "$response" "$body"
  fi
  pass 'assistant execution and response-scope policy prepared'
}

prepare_knowledge() {
  local response="$TEMP_DIR/knowledge.json"
  local body="$TEMP_DIR/knowledge-body.json"
  api_list '/knowledge-bases' "$KNOWLEDGE_NAME" "$response"
  if KNOWLEDGE_BASE_ID="$(find_fixture_id "$response" "$KNOWLEDGE_NAME")"; then
    info 'reusing the marked 16R knowledge base'
  else
    [ "$?" -ne 3 ] || fail 'knowledge-base name collides with an object not marked as a 16R fixture'
    KNOWLEDGE_NAME="$KNOWLEDGE_NAME" node - "$body" <<'NODE'
const fs = require('node:fs');
fs.writeFileSync(process.argv[2], JSON.stringify({
  name: process.env.KNOWLEDGE_NAME,
  description: 'Base ficticia e descartavel para a homologacao local 16R.',
  status: 'active', visibility: 'workspace', dataClassification: 'internal',
  metadata: { fixturePhase: '16R', fictitious: true },
}));
NODE
    api_request POST '/knowledge-bases' "$response" "$body"
    KNOWLEDGE_BASE_ID="$(json_path "$response" 'data.id')" || fail 'knowledge create response omitted its identifier'
    pass 'marked 16R knowledge base created'
  fi
  printf '{"allowRuntimeRetrieval":true,"allowCitationOnly":true,"requireApprovalForExternal":true,"metadata":{"fixturePhase":"16R","fictitious":true}}\n' > "$body"
  api_request PATCH "/knowledge-bases/$KNOWLEDGE_BASE_ID/policy" "$response" "$body"

  api_request GET "/knowledge-bases/$KNOWLEDGE_BASE_ID/documents" "$response"
  if DOCUMENT_ID="$(find_fixture_id "$response" "$DOCUMENT_TITLE")"; then
    info 'reusing the marked 16R knowledge document'
  else
    [ "$?" -ne 3 ] || fail 'knowledge-document title collides with an object not marked as a 16R fixture'
    FIXTURE_DOCUMENT="$FIXTURE_DOCUMENT" DOCUMENT_TITLE="$DOCUMENT_TITLE" node - "$body" <<'NODE'
const fs = require('node:fs');
fs.writeFileSync(process.argv[2], JSON.stringify({
  title: process.env.DOCUMENT_TITLE,
  description: 'Politica e FAQ totalmente ficticias para a Fase 16R.',
  sourceType: 'manual', mimeType: 'text/markdown', status: 'draft',
  ingestionStatus: 'pending', dataClassification: 'internal',
  contentText: fs.readFileSync(process.env.FIXTURE_DOCUMENT, 'utf8'),
  metadata: { fixturePhase: '16R', fictitious: true },
}));
NODE
    api_request POST "/knowledge-bases/$KNOWLEDGE_BASE_ID/documents" "$response" "$body"
    DOCUMENT_ID="$(json_path "$response" 'data.id')" || fail 'knowledge document response omitted its identifier'
    pass 'marked 16R knowledge document created'
  fi
  api_request GET "/knowledge-documents/$DOCUMENT_ID" "$response"
  if [ "$(json_path "$response" 'data.chunkCount')" = '0' ]; then
    printf '{"metadata":{"fixturePhase":"16R","fictitious":true}}\n' > "$body"
    api_request POST "/knowledge-documents/$DOCUMENT_ID/request-ingestion" "$response" "$body"
    pass '16R document ingestion requested'
  else
    pass '16R document already has indexed chunks'
  fi

  printf '{"knowledgeBaseId":"%s","isEnabled":true,"retrievalMode":"retrieval_placeholder","priority":16}\n' "$KNOWLEDGE_BASE_ID" > "$body"
  api_request POST "/assistants/$ASSISTANT_ID/knowledge-bindings" "$response" "$body"
  KNOWLEDGE_BINDING_ID="$(json_path "$response" 'data.id')" || fail 'knowledge binding response omitted its identifier'
  api_request GET "/assistants/$ASSISTANT_ID/rag/readiness" "$response"
  pass 'assistant RAG binding and readiness endpoint validated'
}

prepare_mcp() {
  local response="$TEMP_DIR/mcp.json"
  local body="$TEMP_DIR/mcp-body.json"
  if [ -n "${ORCHESTRA_16R_MCP_SERVER_ID:-}" ] || [ -n "${ORCHESTRA_16R_MCP_TOOL_ID:-}" ]; then
    [ -n "${ORCHESTRA_16R_MCP_SERVER_ID:-}" ] && [ -n "${ORCHESTRA_16R_MCP_TOOL_ID:-}" ] \
      || fail 'both external MCP identifiers must be supplied together'
    validate_uuid "$ORCHESTRA_16R_MCP_SERVER_ID" || fail 'ORCHESTRA_16R_MCP_SERVER_ID is not a UUID'
    validate_uuid "$ORCHESTRA_16R_MCP_TOOL_ID" || fail 'ORCHESTRA_16R_MCP_TOOL_ID is not a UUID'
    MCP_SERVER_ID="$ORCHESTRA_16R_MCP_SERVER_ID"
    MCP_TOOL_ID="$ORCHESTRA_16R_MCP_TOOL_ID"
    OWN_MCP='false'
    api_request GET "/mcp/servers/$MCP_SERVER_ID" "$response"
    MCP_SERVER_NAME="$MCP_SERVER_NAME" node - "$response" <<'NODE' \
      || fail 'the supplied MCP server is not the exact marked local 16R demo fixture'
const fs = require('node:fs');
const server = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).data ?? {};
const ok = server.name === process.env.MCP_SERVER_NAME
  && server.baseUrl === 'http://mcp-readonly-demo:8092'
  && server.status === 'active'
  && server.trustLevel === 'trusted'
  && server.riskLevel === 'low'
  && server.authType === 'none'
  && server.metadata?.fixturePhase === '16R'
  && server.metadata?.readOnly === true;
process.exit(ok ? 0 : 1);
NODE
    api_request GET "/mcp/servers/$MCP_SERVER_ID/tools" "$response"
    MCP_TOOL_ID="$MCP_TOOL_ID" node - "$response" <<'NODE' \
      || fail 'the supplied MCP tool is not the exact marked read-only 16R fixture'
const fs = require('node:fs');
const tools = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).data ?? [];
const tool = tools.find((candidate) => candidate?.id === process.env.MCP_TOOL_ID);
const ok = tool?.name === 'catalog.search'
  && tool?.riskLevel === 'low'
  && tool?.requiresApproval === false
  && tool?.isEnabled === true
  && tool?.metadata?.fixturePhase === '16R'
  && tool?.metadata?.readOnly === true;
process.exit(ok ? 0 : 1);
NODE
    pass 'operator-supplied governed MCP server and tool validated'
  else
    api_list '/mcp/servers' "$MCP_SERVER_NAME" "$response"
    if MCP_SERVER_ID="$(find_fixture_id "$response" "$MCP_SERVER_NAME")"; then
      info 'reusing the marked 16R MCP server'
    else
      [ "$?" -ne 3 ] || fail 'MCP server name collides with an object not marked as a 16R fixture'
      MCP_SERVER_NAME="$MCP_SERVER_NAME" node - "$body" <<'NODE'
const fs = require('node:fs');
fs.writeFileSync(process.argv[2], JSON.stringify({
  name: process.env.MCP_SERVER_NAME,
  description: 'Servidor HTTP local ficticio e read-only da homologacao 16R.',
  serverType: 'remote', baseUrl: 'http://mcp-readonly-demo:8092', status: 'active',
  trustLevel: 'trusted', riskLevel: 'low', authType: 'none',
  metadata: { fixturePhase: '16R', fictitious: true, readOnly: true },
}));
NODE
      api_request POST '/mcp/servers' "$response" "$body"
      MCP_SERVER_ID="$(json_path "$response" 'data.id')" || fail 'MCP server response omitted its identifier'
      pass 'marked 16R MCP server created closed by default'
    fi

    api_request GET "/mcp/servers/$MCP_SERVER_ID/tools" "$response"
    if MCP_TOOL_ID="$(find_fixture_id "$response" "$MCP_TOOL_NAME")"; then
      info 'reusing the marked 16R MCP tool without resetting its policy'
    else
      [ "$?" -ne 3 ] || fail 'MCP tool name collides with an object not marked as a 16R fixture'
      cat > "$body" <<'JSON'
{"name":"catalog.search","description":"Consulta read-only no catalogo totalmente ficticio da homologacao 16R.","inputSchema":{"type":"object","additionalProperties":false,"required":["query"],"properties":{"query":{"type":"string","minLength":1,"maxLength":80},"maxResults":{"type":"integer","minimum":1,"maximum":5}}},"outputSchema":{"type":"object","additionalProperties":false,"required":["matches"],"properties":{"matches":{"type":"array","maxItems":5,"items":{"type":"object"}}}},"riskLevel":"low","requiresApproval":false,"isEnabled":true,"metadata":{"fixturePhase":"16R","fictitious":true,"readOnly":true}}
JSON
      api_request POST "/mcp/servers/$MCP_SERVER_ID/tools" "$response" "$body"
      MCP_TOOL_ID="$(json_path "$response" 'data.id')" || fail 'MCP tool response omitted its identifier'
      pass 'marked 16R read-only tool created with fail-closed policy'
    fi
  fi

  printf '{"mcpServerId":"%s","mcpToolId":"%s","isEnabled":true,"mode":"enabled_placeholder","requiresApprovalOverride":false}\n' "$MCP_SERVER_ID" "$MCP_TOOL_ID" > "$body"
  api_request POST "/assistants/$ASSISTANT_ID/mcp-bindings" "$response" "$body"
  MCP_BINDING_ID="$(json_path "$response" 'data.id')" || fail 'MCP binding response omitted its identifier'
  api_request GET "/mcp/servers/$MCP_SERVER_ID/remote-readiness" "$response"
  api_request GET "/mcp/servers/$MCP_SERVER_ID/remote-discovery" "$response"
  pass 'MCP binding, readiness and discovery endpoints validated without printing catalog payloads'
}

prepare() {
  static_validation
  direct_demo_request GET '/health' "$TEMP_DIR/mcp-health.json"
  direct_demo_request GET '/ready' "$TEMP_DIR/mcp-ready.json"
  pass 'local MCP demo health and readiness are available'
  authenticate_local
  prepare_assistant
  prepare_knowledge
  prepare_mcp
  write_state
  pass 'private local 16R state written outside the repository by default'
  info 'catalog creation intentionally keeps MCP policies fail-closed'
  info 'approve the exact local 16R server/tool policy with the transaction documented in the runbook before --run'
}

validate_run_observation() {
  node - "$1" <<'NODE'
const fs = require('node:fs');
const run = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).data;
const ok = run
  && run.status === 'completed'
  && run.ragMode === 'resolved_context'
  && Number(run.ragSourceCount) > 0
  && run.responseScopeMode === 'general_allowed'
  && run.ragIntentDetected === true
  && run.rawContentLogged === false
  && run.externalMcpCalled === true
  && run.mcpRemoteAllowed === true
  && run.mcpRemoteBlocked === false
  && run.mcpRemoteReadOnly === true
  && run.simulated === false
  && Number(run.toolCallsExecuted) > 0;
process.exit(ok ? 0 : 1);
NODE
}

run_scenario() {
  static_validation
  load_state
  authenticate_local
  local response="$TEMP_DIR/run.json"
  local body="$TEMP_DIR/run-body.json"

  direct_demo_request GET '/health' "$TEMP_DIR/mcp-health.json"
  direct_demo_request GET '/ready' "$TEMP_DIR/mcp-ready.json"
  cat > "$body" <<'JSON'
{"executionId":"phase16r-direct-transport-check","toolName":"catalog.get_status","input":{"itemId":"svc-catalog"}}
JSON
  direct_demo_request POST '/v1/tools/call' "$TEMP_DIR/mcp-call.json" "$body"
  node - "$TEMP_DIR/mcp-call.json" <<'NODE'
const fs = require('node:fs');
const value = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
process.exit(value?.status === 'completed' && value?.simulated === false && typeof value?.content === 'string' ? 0 : 1);
NODE
  pass 'real local MCP transport completed read-only with simulated=false; content was not displayed'

  api_request GET "/assistants/$ASSISTANT_ID/rag/readiness" "$response"
  api_request GET "/mcp/servers/$MCP_SERVER_ID/remote-readiness" "$response"
  api_request GET "/mcp/servers/$MCP_SERVER_ID/remote-discovery" "$response"
  pass 'governed RAG and MCP readiness/discovery were called through the backend'

  cat > "$body" <<'JSON'
{"mode":"published","input":"Segundo a politica ficticia 16R, consulte o catalogo e informe o status de svc-catalog.","source":"phase16r_e2e","metadata":{"fixturePhase":"16R","scenario":"rag_mcp_readonly_allowed","rawContentLogged":false}}
JSON
  api_request POST "/assistants/$ASSISTANT_ID/runs" "$response" "$body"
  RUN_ID="$(json_path "$response" 'data.id')" || fail 'AgentRun response omitted its identifier'
  write_state
  pass '16R AgentRun executed and its technical identifier was retained locally'

  api_request GET "/ai-observability/runtime-runs/$RUN_ID" "$response"
  assert_safe_observability_json "$response" || fail 'runtime observability DTO contains a prohibited raw or credential-shaped field'
  validate_run_observation "$response" \
    || fail 'combined acceptance was not met: require completed RAG plus real MCP read-only metadata on the same AgentRun'
  pass 'same AgentRun proves resolved RAG and real governed MCP read-only execution'
}

audit_scenario() {
  static_validation
  load_state
  [ -n "$RUN_ID" ] || fail '16R state has no run identifier; run --run first'
  authenticate_local
  local observation="$TEMP_DIR/observation.json"
  local events="$TEMP_DIR/events.json"
  local calls="$TEMP_DIR/tool-calls.json"
  api_request GET "/ai-observability/runtime-runs/$RUN_ID" "$observation"
  api_request GET "/agent-runs/$RUN_ID/events" "$events"
  api_request GET "/mcp/tool-calls?agentRunId=$RUN_ID&perPage=100" "$calls"
  for file in "$observation" "$events" "$calls"; do
    assert_safe_observability_json "$file" || fail 'audit response contains a prohibited raw or credential-shaped field'
  done
  node - "$observation" "$calls" <<'NODE'
const fs = require('node:fs');
const run = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).data ?? {};
const calls = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).data ?? [];
const allowed = {
  runId: run.runId ?? null,
  status: run.status ?? null,
  ragMode: run.ragMode ?? null,
  ragSourceCount: run.ragSourceCount ?? null,
  responseScopeMode: run.responseScopeMode ?? null,
  ragIntentDetected: run.ragIntentDetected ?? null,
  rawContentLogged: run.rawContentLogged ?? null,
  externalProviderCalled: run.externalProviderCalled ?? null,
  externalMcpCalled: run.externalMcpCalled ?? null,
  mcpRemoteAllowed: run.mcpRemoteAllowed ?? null,
  mcpRemoteBlocked: run.mcpRemoteBlocked ?? null,
  mcpRemoteBlockedReason: run.mcpRemoteBlockedReason ?? null,
  mcpRemoteReadOnly: run.mcpRemoteReadOnly ?? null,
  simulated: run.simulated ?? null,
  toolCallsExecuted: run.toolCallsExecuted ?? null,
  toolCallRecords: Array.isArray(calls) ? calls.length : 0,
};
for (const [key, value] of Object.entries(allowed)) process.stdout.write(`AUDIT ${key}=${value}\n`);
NODE
  pass 'allowlisted runtime, event and MCP audit views inspected without displaying raw content'
}

assert_marked_object() {
  local path="$1"
  local expected_kind="$2"
  local expected_value="$3"
  local response="$TEMP_DIR/cleanup-check.json"
  api_request GET "$path" "$response"
  EXPECTED_KIND="$expected_kind" EXPECTED_VALUE="$expected_value" node - "$response" <<'NODE'
const fs = require('node:fs');
const item = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).data;
const marked = item?.metadata?.fixturePhase === '16R'
  || (typeof item?.description === 'string' && item.description.includes('[fixture:16R]'));
const key = process.env.EXPECTED_KIND;
process.exit(marked && String(item?.[key] ?? '') === process.env.EXPECTED_VALUE ? 0 : 1);
NODE
}

cleanup_scenario() {
  static_validation
  load_state
  authenticate_local
  local response="$TEMP_DIR/cleanup.json"
  local empty="$TEMP_DIR/empty.json"
  printf '{}\n' > "$empty"

  api_request DELETE "/assistants/$ASSISTANT_ID/knowledge-bindings/$KNOWLEDGE_BINDING_ID" "$response"
  api_request DELETE "/assistants/$ASSISTANT_ID/mcp-bindings/$MCP_BINDING_ID" "$response"
  pass '16R assistant bindings disabled/removed'

  if [ "$OWN_KNOWLEDGE" = 'true' ]; then
    assert_marked_object "/knowledge-documents/$DOCUMENT_ID" title "$DOCUMENT_TITLE" \
      || fail 'refusing to archive a knowledge document not marked as the exact 16R fixture'
    api_request POST "/knowledge-documents/$DOCUMENT_ID/archive" "$response" "$empty"
    assert_marked_object "/knowledge-bases/$KNOWLEDGE_BASE_ID" name "$KNOWLEDGE_NAME" \
      || fail 'refusing to archive a knowledge base not marked as the exact 16R fixture'
    api_request POST "/knowledge-bases/$KNOWLEDGE_BASE_ID/archive" "$response" "$empty"
    pass 'marked 16R RAG data archived'
  fi

  if [ "$OWN_MCP" = 'true' ]; then
    api_request GET "/mcp/servers/$MCP_SERVER_ID/tools" "$response"
    MCP_TOOL_ID="$MCP_TOOL_ID" node - "$response" <<'NODE' \
      || fail 'refusing to archive an MCP tool not marked as the exact 16R fixture'
const fs = require('node:fs');
const items = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).data ?? [];
const item = items.find((candidate) => candidate?.id === process.env.MCP_TOOL_ID);
process.exit(item?.name === 'catalog.search' && item?.metadata?.fixturePhase === '16R' ? 0 : 1);
NODE
    api_request POST "/mcp/tools/$MCP_TOOL_ID/archive" "$response" "$empty"
    assert_marked_object "/mcp/servers/$MCP_SERVER_ID" name "$MCP_SERVER_NAME" \
      || fail 'refusing to archive an MCP server not marked as the exact 16R fixture'
    api_request POST "/mcp/servers/$MCP_SERVER_ID/archive" "$response" "$empty"
    pass 'marked 16R MCP catalog archived'
  fi

  if [ "$OWN_ASSISTANT" = 'true' ]; then
    assert_marked_object "/assistants/$ASSISTANT_ID" name "$ASSISTANT_NAME" \
      || fail 'refusing to archive an assistant not marked as the exact 16R fixture'
    api_request POST "/assistants/$ASSISTANT_ID/archive" "$response" "$empty"
    pass 'marked 16R assistant archived'
  fi

  rm -f -- "$STATE_FILE"
  pass 'local 16R state removed; immutable run and audit evidence was preserved'
}

case "$MODE" in
  --dry-run) static_validation ;;
  --prepare) prepare ;;
  --run) run_scenario ;;
  --audit) audit_scenario ;;
  --cleanup) cleanup_scenario ;;
esac

printf '\n16R E2E homologation summary: PASS=%d SKIPPED=%d FAIL=0\n' "$pass_count" "$skip_count"
