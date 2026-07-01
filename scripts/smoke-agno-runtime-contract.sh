#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGNO_RUNTIME_HTTP_HOST="${AGNO_RUNTIME_HTTP_HOST:-127.0.0.1}"
AGNO_RUNTIME_HTTP_PORT="${AGNO_RUNTIME_HTTP_PORT:-8091}"
BASE_URL="http://${AGNO_RUNTIME_HTTP_HOST}:${AGNO_RUNTIME_HTTP_PORT}"

runtime_log="$(mktemp)"
payload_file="$(mktemp)"
response_file="$(mktemp)"
runtime_pid=""

cleanup() {
  if [ -n "$runtime_pid" ] && kill -0 "$runtime_pid" 2>/dev/null; then
    kill "$runtime_pid" 2>/dev/null || true
  fi
  rm -f "$runtime_log" "$payload_file" "$response_file"
}
trap cleanup EXIT

wait_for_url() {
  local label="$1"
  local url="$2"
  for _ in $(seq 1 30); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "OK $label ready"
      return
    fi
    sleep 1
  done
  echo "FAIL $label not ready: $url"
  cat "$runtime_log" 2>/dev/null || true
  exit 1
}

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
    cat "$runtime_log" 2>/dev/null || true
    exit 1
  fi
  echo "OK $label $status"
}

(
  cd "$ROOT_DIR/backend"
  AGNO_RUNTIME_HTTP_HOST="$AGNO_RUNTIME_HTTP_HOST" \
  AGNO_RUNTIME_HTTP_PORT="$AGNO_RUNTIME_HTTP_PORT" \
  npm run agno:runtime
) >"$runtime_log" 2>&1 &
runtime_pid="$!"

wait_for_url "agno-runtime-contract" "$BASE_URL/health"

expect_status 200 "health" "$BASE_URL/health"
python3 -c 'import json,sys; data=json.load(open(sys.argv[1])); assert data["provider"] == "agno"; assert data["status"] == "healthy"; assert "secret" not in json.dumps(data).lower()' "$response_file"

expect_status 200 "capabilities" "$BASE_URL/capabilities"
python3 -c 'import json,sys; data=json.load(open(sys.argv[1])); assert data["provider"] == "agno"; assert data["supportsStreaming"] is False; assert data["supportsTools"] is False; assert data["supportsRagContext"] is True' "$response_file"

cat > "$payload_file" <<'JSON'
{
  "specVersion": "orchestra.runtime.execute.v1",
  "assistantRuntimeSpec": {
    "specVersion": "orchestra.runtime.assistant.v1",
    "trace": {
      "traceId": "trace-smoke-runtime-contract",
      "runId": "run-smoke-runtime-contract"
    },
    "tenant": {
      "id": "tenant-smoke"
    },
    "workspace": {
      "id": "workspace-smoke"
    },
    "actor": {
      "userId": "user-smoke"
    },
    "assistant": {
      "id": "assistant-smoke",
      "name": "Smoke Assistant"
    },
    "input": {
      "message": "Run the minimal sandbox runtime smoke."
    },
    "model": {
      "provider": "local",
      "model": "deterministic-sandbox"
    },
    "policy": {
      "executionMode": "sync",
      "streaming": false,
      "timeoutMs": 15000,
      "maxToolCalls": 0,
      "maxRagResults": 2,
      "maxContextChars": 12000,
      "failClosed": true
    },
    "instructions": {
      "system": "Use only governed context."
    },
    "rag": {
      "enabled": true,
      "mode": "resolved_context",
      "sources": [
        {
          "sourceId": "source-smoke-1",
          "excerpt": "Governed smoke excerpt."
        }
      ]
    },
    "tools": {
      "enabled": false,
      "mode": "none",
      "descriptors": []
    },
    "observability": {
      "usageEventEnabled": true,
      "auditEnabled": true,
      "qualityEvaluationEnabled": false
    },
    "limits": {
      "enforce": true
    },
    "metadata": {
      "mode": "smoke"
    }
  }
}
JSON

expect_status 200 "execute" \
  -H 'Content-Type: application/json' \
  --data-binary "@$payload_file" \
  "$BASE_URL/execute"
python3 -c 'import json,sys; data=json.load(open(sys.argv[1])); assert data["status"] == "succeeded"; assert data["trace"]["traceId"] == "trace-smoke-runtime-contract"; assert data["output"]["metadata"]["ragSourceCount"] == 1; assert "provider externo" in data["output"]["text"]' "$response_file"

echo "OK agno-runtime-contract smoke completed"
