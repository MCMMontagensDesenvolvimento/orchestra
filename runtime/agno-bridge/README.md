# Orchestra Agno Bridge

Local Docker bridge that implements the Orchestra runtime V1 boundary and executes an approved model through the real Agno SDK. The Orchestra remains the control plane: it selects the assistant, provider/model, conversation context, governed RAG excerpts, tool descriptors, limits, and policy. The bridge only executes the received spec.

Endpoints:

- `GET /health`
- `GET /capabilities`
- `POST /execute`

The versioned `.env.example` is intentionally non-operational for real execution: transport authentication is required with an empty key, provider keys are empty, RAG/tools are disabled, and tool calls are zero. Create an ignored `runtime/agno-bridge/.env` for a deliberate local profile.

## Execution modes

- `stub`: deterministic, offline, no provider and no gateway call. Used by unit tests and contract checks.
- `real`: imports `agno==2.7.1` and uses the configured `openai`, `azure_openai`, or `anthropic` model adapter. A missing provider key keeps health `misconfigured` and execution fails closed.

The bridge never loads an environment file itself. Docker Compose layers `.env.example` and the ignored local `.env` into the container.

## Local Docker profile

Configure the Orchestra real profile in the ignored `backend/.env`, configure the bridge in the ignored `runtime/agno-bridge/.env`, then run from the repository root:

```bash
docker compose -f docker-compose.dev.yml -f docker-compose.agno-bridge.yml up --build
```

The override makes the backend call `http://agno-bridge:8091`. Use the same `AGNO_RUNTIME_HTTP_SECURITY_KEY` in the two ignored files. Provider keys belong only to the bridge file or an external container secret.

## Offline tests

```bash
python3 -m unittest discover -s runtime/agno-bridge/tests -v
```

The tests use only the Python standard library and an injected stub. They do not install/import Agno, contact a provider, invoke Chat, or call the Orchestra tool gateway.

## Gateway 16F

The bridge exposes governed descriptors to Agno as functions only when tools and the private sandbox gateway are enabled, `maxToolCalls=1`, authentication is configured, and `ORCHESTRA_TOOL_GATEWAY_URL` is present. Every call is sent to the Orchestra callback with the trace/run/assistant correlation from the received spec. External MCP is never contacted by the bridge.
